import type { ExamContext, Side } from '../model/types.ts';
import type { Resolved, Resolver, RuntimeView } from '../engine/observe.ts';
import { MOTOR_UNITS, REFLEX_ROOTS as ANATOMY_REFLEX_ROOTS } from '../../domains/neuro/data/anatomy.js';

/* ===========================================================================
   Neurological examination model: cranial nerves V, VII, IX–XII, speech,
   limbs (tone, power, reflexes, sensation, drift) and gait.

   It reads the nervous-system graph's findings: which pathways a lesion
   interrupts, whether as an upper or a lower motor neuron, and at which rung
   of the ladder (cortex, cord, root, plexus, nerve, junction, muscle). From
   those it computes what the hands and the hammer find, muscle by muscle and
   dermatome by dermatome, so that the classic dissociations emerge without
   being written down:

   * An upper motor neuron lesion weakens in a pyramidal pattern (arm
     extensors, leg flexors), raises tone, brisks the reflexes, makes the
     plantar extensor and the arm drift. A cortical lesion spares limbs whose
     motor strip it does not touch (face and arm more than leg in the MCA).
   * A root lesion weakens every muscle sharing the myotome whatever its
     nerve, and loses that root's reflex and dermatome.
   * A nerve lesion weakens only that nerve's muscles, with sensory loss in
     its territory and a sharp edge, and spares its myotome neighbours: in
     foot drop, inversion (tibial nerve, L4–5) separates root from nerve.
   * The junction fatigues; muscle disease is proximal with normal sensation.

   MRC grades for central weakness follow the bedside convention: pyramidal
   weakness at 3–4/5 when partial, 0/5 when complete.
=========================================================================== */

const SIDES: Side[] = ['L', 'R'];
const other = (s: Side): Side => (s === 'L' ? 'R' : 'L');

/** Movements tested at the bedside, each mapped to the graph's muscle. */
export const ARM_MOVES = [
  ['shoulderAbduction', 'deltoid'], ['elbowFlexion', 'biceps'], ['elbowExtension', 'triceps'], ['wristExtension', 'wrist extensors'],
  ['fingerFlexion', 'flexor pollicis longus'], ['thumbAbduction', 'abductor pollicis brevis'], ['fingerAbduction', 'first dorsal interosseous'],
] as const;
export const LEG_MOVES = [
  ['hipFlexion', 'iliopsoas'], ['hipAdduction', 'hip adductors'], ['hipAbduction', 'gluteus medius'], ['kneeExtension', 'quadriceps'],
  ['ankleDorsiflexion', 'tibialis anterior'], ['footEversion', 'peroneus longus'], ['footInversion', 'tibialis posterior'], ['anklePlantarflexion', 'gastrocnemius'],
] as const;
/** Movements the pyramidal tract serves most: weakest after an upper motor neuron lesion. */
const PYRAMIDAL_WEAK = new Set(['shoulderAbduction', 'elbowExtension', 'wristExtension', 'fingerAbduction', 'thumbAbduction', 'hipFlexion', 'ankleDorsiflexion', 'footEversion']);
const ARM_SEGS = ['C5', 'C6', 'C7', 'C8', 'T1'] as const;
const LEG_SEGS = ['L2', 'L3', 'L4', 'L5', 'S1'] as const;
const SKIN_TERRITORY: Record<string, string> = {
  shoulder_badge_patch: 'axillary', lateral_forearm: 'musculocutaneous', dorsal_first_web_space: 'radial', 'thumb_and_index,_palmar': 'median',
  little_finger_and_medial_hand: 'ulnar', anterior_thigh: 'femoral', medial_thigh: 'obturator', dorsum_of_foot: 'peroneal', sole_of_foot: 'tibial',
};
const ARM_TERRITORIES = new Set(['axillary', 'musculocutaneous', 'radial', 'median', 'ulnar']);
const unit = (name: string) => (MOTOR_UNITS as Array<{ m: string; roots: string[]; reflex?: string; bulk: string }>).find((u) => u.m === name)!;

type Level = 'normal' | 'reduced' | 'absent';
const worse = (a: Level, b: Level): Level => (a === 'absent' || b === 'absent' ? 'absent' : a === 'reduced' || b === 'reduced' ? 'reduced' : 'normal');

export interface LimbState {
  power: Record<Side, Record<string, number>>;        // movement → MRC at first effort
  fatigable: Record<Side, boolean>;
  tone: Record<Side, { arm: string; leg: string }>;
  wasting: Record<Side, { arm: boolean; leg: boolean }>;
  reflex: Record<Side, Record<string, number>>;        // biceps, supinator, triceps, knee, ankle
  plantar: Record<Side, 'flexor' | 'extensor'>;
  drift: Record<Side, boolean>;
  pinprick: Record<Side, Record<string, Level>>;       // C5..S1, T6, T10
  territories: Record<Side, string[]>;
  vibration: Record<Side, { arm: Level; leg: Level }>;
  saddle: Level;
  face: Record<Side, { forehead: string; eyeClosure: string; mouth: string }>;
  faceSensation: Record<Side, { V1: Level; V2: Level; V3: Level; corneal: boolean }>;
  jawTo: 'none' | Side;
  uvulaTo: 'none' | Side;
  gag: Record<Side, boolean>;
  voice: 'normal' | 'hoarse';
  shrug: Record<Side, number>;
  tongue: { to: 'none' | Side; wasting: boolean; fasciculation: boolean };
  speech: { fluency: string; comprehension: string; repetition: string; naming: string; articulation: string };
  bulbarFatigue: boolean;
  ocularFatigue: boolean;
  gaitBalance: boolean;                                // vermis
  basis: string[];
}

const cache = new WeakMap<RuntimeView, LimbState>();
export function limbState(view: RuntimeView): LimbState {
  let s = cache.get(view);
  if (!s) { s = derive(view); cache.set(view, s); }
  return s;
}

function derive(view: RuntimeView): LimbState {
  const nodes = new Set(view.neuro?.nodes ?? []);
  const F = view.neuro?.findings ?? [];
  const complete = view.neuro?.complete ?? true;
  const basis: string[] = [];
  const find = (pred: (f: Record<string, any>) => boolean) => F.filter(pred);

  /* How much of the tract serving each part of side S a lesion takes. Below the cortex the fibres for face, arm and leg
     run together, so a lesion there takes them all. In the motor strip each part has its own place: a part of the strip
     the lesion reaches loses the share its `extent` gives (all of it unless the case says less, as when an MCA infarct
     only grazes the leg's fibres); a part it does not reach is untouched, since its pathways then pass no lesion. Above
     the pyramidal decussation the tract serving side S runs on the other side; below it, in the cord, on the same side. */
  const extent = view.neuro?.extent ?? {};
  const cortical = (S: Side) => {
    const lesionSide = other(S);
    const subcortical = [...nodes].some((n) => (n.startsWith(`${lesionSide}_`) && /_(ic|peduncle|pons_cst|med_pyr)/.test(n)) || n.startsWith(`${S}_cst_`));
    const part = (p: 'face' | 'arm' | 'leg') => { const n = `${lesionSide}_mcx_${p}`; return subcortical || !nodes.has(n) ? 1 : Math.max(0, Math.min(1, extent[n] ?? 1)); };
    return { face: part('face'), arm: part('arm'), leg: part('leg') };
  };

  const power = { L: {}, R: {} } as LimbState['power'];
  const fatigable = { L: false, R: false };
  const tone = { L: { arm: 'normal', leg: 'normal' }, R: { arm: 'normal', leg: 'normal' } };
  const wasting = { L: { arm: false, leg: false }, R: { arm: false, leg: false } };
  const reflex = { L: { biceps: 2, supinator: 2, triceps: 2, knee: 2, ankle: 2 }, R: { biceps: 2, supinator: 2, triceps: 2, knee: 2, ankle: 2 } } as LimbState['reflex'];
  const plantar = { L: 'flexor', R: 'flexor' } as LimbState['plantar'];
  const drift = { L: false, R: false };
  /** the roots that carry each reflex (the graph's own table) and the muscle whose nerve carries it */
  const REFLEX_ROOTS = ANATOMY_REFLEX_ROOTS as Record<string, string[]>;
  const REFLEX_MUSCLE: Record<string, string> = { biceps: 'biceps', supinator: 'brachioradialis', triceps: 'triceps', knee: 'quadriceps', ankle: 'gastrocnemius' };

  for (const S of SIDES) {
    const som = cortical(S);
    for (const [limb, moves, segs] of [['arm', ARM_MOVES, ARM_SEGS], ['leg', LEG_MOVES, LEG_SEGS]] as const) {
      const umnSegs = new Set(find((f) => f.modality === 'motor' && f.umnOrLmn === 'UMN' && f.bodyRegion.startsWith(`${S}_${limb}_`)).map((f) => f.bodyRegion.split('_')[2]));
      const lmnSegs = new Set(find((f) => f.modality === 'motor' && f.umnOrLmn === 'LMN' && f.bodyRegion.startsWith(`${S}_${limb}_`)).map((f) => f.bodyRegion.split('_')[2]));
      const k = limb === 'arm' ? som.arm : som.leg;
      if (umnSegs.size) {
        basis.push(`${S} ${limb}: upper motor neuron${k < 1 ? ' (motor strip partly spared)' : ''}`);
        if (k >= 0.5) tone[S][limb] = 'spastic';
        if (limb === 'arm') drift[S] = true;
        if (limb === 'leg') plantar[S] = 'extensor';
      }
      let lowest = 5;
      for (const [move, muscle] of moves) {
        const u = unit(muscle);
        let p = 5;
        // upper motor neuron, pyramidal pattern
        if (u.roots.some((r) => umnSegs.has(r))) {
          const base = complete ? 0 : PYRAMIDAL_WEAK.has(move) ? 3 : 4;
          p = Math.min(p, Math.round(5 - (5 - base) * k));
        }
        // segmental lower motor neuron (anterior horn, ventral root)
        const hitRoots = u.roots.filter((r) => lmnSegs.has(r)).length;
        if (hitRoots) p = Math.min(p, complete ? (hitRoots >= u.roots.length ? 1 : 3) : 4);
        // the muscle's own final common path
        for (const f of find((x) => x.modality === 'peripheral_motor' && x.bodyRegion === `${S}_muscle_${muscle.replace(/\s+/g, '_')}`)) {
          const r = f.rung;
          if (r === 'nmj') { fatigable[S] = true; p = Math.min(p, complete ? 4 : 5); }
          else if (r === 'muscle') p = Math.min(p, complete ? 3 : 4);
          else if (r === 'nerve') p = Math.min(p, complete ? 1 : 4);
          else if (r === 'plexus') p = Math.min(p, complete ? 2 : 4);
          else p = Math.min(p, complete ? (u.roots.length > 1 ? 3 : 1) : 4);   // root / anterior horn
        }
        power[S][move] = p;
        lowest = Math.min(lowest, p);
      }
      if (lowest <= 2 && !umnSegs.size) tone[S][limb] = 'reduced';
      if (complete && (lmnSegs.size || find((x) => x.modality === 'peripheral_motor' && x.bodyRegion.startsWith(`${S}_muscle_`) && (x.rung === 'nerve' || x.rung === 'root')).length) && lowest <= 1) wasting[S][limb] = true;
      // reflexes: upper motor neuron brisk, lower motor neuron arc lost
      /* a reflex is lost with the nerve or plexus of its muscle (the brachioradialis too, which power testing leaves out);
         a root takes only its share of the arc (below) */
      for (const [rx, mu] of Object.entries(REFLEX_MUSCLE)) {
        if (!REFLEX_ROOTS[rx].every((g) => (segs as readonly string[]).includes(g))) continue;
        if (find((x) => x.modality === 'peripheral_motor' && x.bodyRegion === `${S}_muscle_${mu.replace(/\s+/g, '_')}` && (x.rung === 'nerve' || x.rung === 'plexus')).length)
          reflex[S][rx] = Math.min(reflex[S][rx], complete ? 0 : 1);
      }
      for (const [rx, roots] of Object.entries(REFLEX_ROOTS)) {
        if (!roots.every((g) => (segs as readonly string[]).includes(g))) continue;
        const cut = roots.filter((g) => find((f) => f.modality === 'reflex' && f.bodyRegion === `${S}_reflex_${g}`).length || lmnSegs.has(g)).length;
        // every root of the arc cut: lost (reduced if partly); one of two: reduced
        if (cut) reflex[S][rx] = Math.min(reflex[S][rx], cut === roots.length && complete ? 0 : 1);
        else if (roots.some((g) => umnSegs.has(g)) && reflex[S][rx] === 2) reflex[S][rx] = k >= 0.5 ? (complete && rx === 'ankle' ? 4 : 3) : 2;
      }
    }
  }

  /* ---- sensation ---------------------------------------------------------------- */
  const pinprick = { L: {}, R: {} } as LimbState['pinprick'];
  const territories = { L: [] as string[], R: [] as string[] };
  const vibration = { L: { arm: 'normal' as Level, leg: 'normal' as Level }, R: { arm: 'normal' as Level, leg: 'normal' as Level } };
  const lvl: Level = complete ? 'absent' : 'reduced';
  for (const S of SIDES) {
    for (const seg of [...ARM_SEGS, 'T6', 'T10', ...LEG_SEGS]) {
      pinprick[S][seg] = find((f) => f.modality === 'pain_temp' && f.bodyRegion === `${S}_dermatome_${seg}`).length ? lvl : 'normal';
    }
    for (const f of find((x) => x.modality === 'cutaneous' && x.bodyRegion.startsWith(`${S}_skin_`))) {
      const t = SKIN_TERRITORY[f.bodyRegion.slice(`${S}_skin_`.length)];
      if (t && (f.rung === 'nerve' || f.rung === 'plexus') && !territories[S].includes(t)) territories[S].push(t);
    }
    // Vibration at the finger or big toe is lost only when the column (or several roots) is: a single root rarely abolishes it.
    const dc = (segs: string[]) => segs.every((g) => find((f) => f.modality === 'proprioception' && f.bodyRegion === `${S}_dermatome_${g}`).length) ? lvl : 'normal';
    vibration[S] = { arm: dc(['C7', 'C8']), leg: dc(['L5', 'S1']) };
  }
  const saddle: Level = find((f) => f.modality === 'pain_temp' && /_saddle_/.test(f.bodyRegion)).length ? lvl : 'normal';

  /* ---- cranial nerves ------------------------------------------------------------ */
  const face = { L: { forehead: 'normal', eyeClosure: 'normal', mouth: 'normal' }, R: { forehead: 'normal', eyeClosure: 'normal', mouth: 'normal' } };
  const faceSensation = { L: { V1: 'normal' as Level, V2: 'normal' as Level, V3: 'normal' as Level, corneal: true }, R: { V1: 'normal' as Level, V2: 'normal' as Level, V3: 'normal' as Level, corneal: true } };
  const gag = { L: true, R: true };
  const shrug = { L: 5, R: 5 };
  let jawTo: LimbState['jawTo'] = 'none', uvulaTo: LimbState['uvulaTo'] = 'none', voice: LimbState['voice'] = 'normal';
  const tongue: LimbState['tongue'] = { to: 'none', wasting: false, fasciculation: false };
  for (const S of SIDES) {
    const som = cortical(S);
    for (const f of find((x) => x.modality === 'cranial_motor' && x.bodyRegion.startsWith(`${S}_face_`))) {
      const weak = complete ? 'absent' : 'weak';
      if (f.umnOrLmn === 'LMN') { face[S].forehead = weak; face[S].eyeClosure = weak; face[S].mouth = weak; }
      else face[S].mouth = som.face >= 0.5 ? 'weak' : face[S].mouth;   // upper motor neuron: forehead spared
    }
    for (const v of ['V1', 'V2', 'V3'] as const) {
      const region = { V1: 'face_V1_forehead', V2: 'face_V2_cheek', V3: 'face_V3_jaw' }[v];
      if (find((x) => x.modality === 'face_sensation' && x.bodyRegion === `${S}_${region}`).length) faceSensation[S][v] = lvl;
    }
    faceSensation[S].corneal = faceSensation[S].V1 === 'normal' && face[S].eyeClosure !== 'absent';
    if (find((x) => x.bodyRegion === `${S}_jaw`).length) jawTo = S;
    if (find((x) => x.bodyRegion === `${S}_palate_vocal`).length) { uvulaTo = other(S); voice = 'hoarse'; }
    if (find((x) => x.bodyRegion === `${S}_pharynx`).length) gag[S] = false;
    if (find((x) => x.bodyRegion === `${S}_trapezius_scm`).length) shrug[S] = complete ? 1 : 4;
    for (const f of find((x) => x.bodyRegion === `${S}_tongue`)) {
      tongue.to = S;   // the tongue deviates toward the weak side, whatever the level
      if (f.umnOrLmn === 'LMN' && complete) { tongue.wasting = true; tongue.fasciculation = f.rung === 'central'; }
    }
  }

  /* ---- speech ------------------------------------------------------------------------- */
  const has = (region: string) => find((x) => x.bodyRegion === region).length > 0;
  const speech = {
    fluency: has('speech_production') ? 'impaired' : 'normal',
    comprehension: has('speech_comprehension') ? 'impaired' : 'normal',
    repetition: has('speech_repetition') ? 'impaired' : 'normal',
    naming: has('speech_production') || has('speech_comprehension') ? 'impaired' : 'normal',
    articulation: SIDES.some((S) => face[S].mouth !== 'normal' || has(`${S}_palate_vocal`)) || tongue.to !== 'none' ? 'dysarthric' : 'normal',
  };
  const bulbarFatigue = find((x) => x.rung === 'nmj' && /_muscle_bulbar$/.test(x.bodyRegion)).length > 0;
  const ocularFatigue = find((x) => x.rung === 'nmj' && /_muscle_ocular$/.test(x.bodyRegion)).length > 0;

  return {
    power, fatigable, tone, wasting, reflex, plantar, drift, pinprick, territories, vibration, saddle,
    face, faceSensation, jawTo, uvulaTo, gag, voice, shrug, tongue, speech, bulbarFatigue, ocularFatigue,
    gaitBalance: has('gait_balance'), basis,
  };
}

/** Power after repeated effort: the junction fatigues, nothing else does. */
export function powerAt(st: LimbState, S: Side, move: string, ctx: ExamContext): number {
  const p = st.power[S][move];
  if (!st.fatigable[S] || !ctx.repetition || ctx.repetition <= 1) return p;
  return Math.max(2, p - Math.min(2, Math.floor(ctx.repetition / 5)));
}

/* ---- resolvers ------------------------------------------------------------------------ */

const lv = (st: LimbState, S: Side, segs: readonly string[]) => Object.fromEntries(segs.map((g) => [g, st.pinprick[S][g]]));

export const NEURO_LIMB_RESOLVERS: Record<string, Resolver> = {
  'neuro.motor': (view, ref, ctx): Resolved => {
    const st = limbState(view); const S = ref.side!;
    const basis = st.basis.filter((b) => b.startsWith(S)).join('; ') || undefined;
    switch (ref.property) {
      case 'arm.power': return { value: Object.fromEntries(ARM_MOVES.map(([m]) => [m, powerAt(st, S, m, ctx)])), basis };
      case 'leg.power': return { value: Object.fromEntries(LEG_MOVES.map(([m]) => [m, powerAt(st, S, m, ctx)])), basis };
      case 'arm.tone': return { value: { tone: st.tone[S].arm, wasting: st.wasting[S].arm, fasciculation: false }, basis };
      case 'leg.tone': return { value: { tone: st.tone[S].leg, wasting: st.wasting[S].leg, fasciculation: false }, basis };
      case 'arm.drift': return { value: { drift: st.drift[S] }, basis };
      default: return { value: undefined };
    }
  },
  'neuro.reflexes': (view, ref): Resolved => {
    const st = limbState(view); const S = ref.side!; const r = st.reflex[S];
    return ref.property === 'arm.reflexes'
      ? { value: { biceps: r.biceps, supinator: r.supinator, triceps: r.triceps } }
      : { value: { knee: r.knee, ankle: r.ankle, plantar: st.plantar[S] } };
  },
  'neuro.sensory': (view, ref): Resolved => {
    const st = limbState(view); const S = ref.side;
    switch (ref.property) {
      case 'arm.pinprick': return { value: { ...lv(st, S!, ARM_SEGS), territories: st.territories[S!].filter((t) => ARM_TERRITORIES.has(t)) } };
      case 'leg.pinprick': return { value: { ...lv(st, S!, LEG_SEGS), territories: st.territories[S!].filter((t) => !ARM_TERRITORIES.has(t)) } };
      case 'arm.vibration': return { value: { vibration: st.vibration[S!].arm, proprioception: st.vibration[S!].arm } };
      case 'leg.vibration': return { value: { vibration: st.vibration[S!].leg, proprioception: st.vibration[S!].leg } };
      case 'trunk.pinprick': return { value: lv(st, S!, ['T6', 'T10']) };
      case 'saddle.sensation': return { value: { pinprick: st.saddle } };
      case 'face.sensation': return { value: { ...st.faceSensation[S!] } };
      default: return { value: undefined };
    }
  },
  'neuro.cranial': (view, ref): Resolved => {
    const st = limbState(view);
    switch (ref.property) {
      case 'face.movement': return { value: { ...st.face[ref.side!] } };
      case 'jaw.opening': return { value: { deviatesTo: st.jawTo } };
      case 'mouth.palate': return { value: { uvulaDeviatesTo: st.uvulaTo, gagLeft: st.gag.L, gagRight: st.gag.R, voice: st.voice } };
      case 'shoulder.shrug': return { value: { power: st.shrug[ref.side!] } };
      case 'mouth.tongue': return { value: { deviatesTo: st.tongue.to, wasting: st.tongue.wasting, fasciculation: st.tongue.fasciculation } };
      default: return { value: undefined };
    }
  },
  'neuro.speech': (view, ref, ctx): Resolved => {
    const st = limbState(view);
    if (ref.property === 'speech.fatigue') return { value: { voice: st.bulbarFatigue && (ctx.repetition ?? 0) >= 30 ? 'fading-nasal' : 'normal' } };
    return { value: { ...st.speech } };
  },
};
