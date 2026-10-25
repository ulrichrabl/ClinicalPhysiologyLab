import type { ExamContext, Side } from '../model/types.ts';
import type { Resolved, Resolver, RuntimeView } from '../engine/observe.ts';
import { MOTOR_UNITS, PATHWAYS, REFLEX_ROOTS as ANATOMY_REFLEX_ROOTS } from '../../domains/neuro/data/anatomy.js';
import { NEURO, ROOT_SHARE } from '../evidence/neuro.ts';

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
   weakness at 3–4/5 when partial, 0/5 when complete. A lower motor neuron
   lesion is graded from the force its muscle keeps: the share of motor units
   left (each root carrying its share, the nerve all of them), the survivors'
   sprouting over the months after, and the force a hand grades 5, 4 or 3
   (evidence/neuro.ts). The muscle wastes as its denervated fibres shrink,
   from about three weeks: a fresh lesion weakens without wasting.
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
  ['ankleDorsiflexion', 'tibialis anterior'], ['toeExtension', 'extensor hallucis longus'], ['footEversion', 'peroneus longus'], ['footInversion', 'tibialis posterior'], ['anklePlantarflexion', 'gastrocnemius'],
] as const;
/** The joint whose segment the muscle lifts against gravity: sets the force that is MRC 3 and 4 (evidence/neuro.ts). */
const JOINT: Record<string, 'Knee' | 'Elbow' | 'Shoulder' | 'Hip' | 'Distal'> = {
  shoulderAbduction: 'Shoulder', elbowFlexion: 'Elbow', elbowExtension: 'Elbow', hipFlexion: 'Hip', hipAdduction: 'Hip', hipAbduction: 'Hip', kneeExtension: 'Knee', shrug: 'Shoulder',
};
/** The MRC grade a hand gives a muscle keeping this share of its normal force. */
export function mrcOf(force: number, move: string): number {
  const j = JOINT[move] ?? 'Distal';
  const g3 = { Knee: NEURO.grade3Knee, Elbow: NEURO.grade3Elbow, Shoulder: NEURO.grade3Shoulder, Hip: NEURO.grade3Hip, Distal: NEURO.grade3Distal }[j];
  const g4 = { Knee: NEURO.grade4Knee, Elbow: NEURO.grade4Knee, Shoulder: NEURO.grade4Shoulder, Hip: NEURO.grade4Hip, Distal: NEURO.grade4Distal }[j];
  return force >= NEURO.mrc5 ? 5 : force >= g4 ? 4 : force >= g3 ? 3 : force >= NEURO.mrcTrace ? 2 : force > 0 ? 1 : 0;
}
/** Movements the pyramidal tract serves most: weakest after an upper motor neuron lesion. */
const PYRAMIDAL_WEAK = new Set(['shoulderAbduction', 'elbowExtension', 'wristExtension', 'fingerAbduction', 'thumbAbduction', 'hipFlexion', 'ankleDorsiflexion', 'toeExtension', 'footEversion']);
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
  /** fasciculations: the anterior horn cell itself sick (motor neurone disease), not a root or a nerve */
  fasciculation: Record<Side, { arm: boolean; leg: boolean }>;
  reflex: Record<Side, Record<string, number>>;        // biceps, supinator, triceps, knee, ankle
  /** mute: no response at all, in spinal shock */
  plantar: Record<Side, 'flexor' | 'extensor' | 'mute'>;
  drift: Record<Side, boolean>;
  pinprick: Record<Side, Record<string, Level>>;       // C5..S1, T6, T10
  territories: Record<Side, string[]>;
  vibration: Record<Side, { arm: Level; leg: Level }>;
  /** joint position sense: lost with vibration in the cord and nerves, alone with the sensory cortex */
  proprioception: Record<Side, { arm: Level; leg: Level }>;
  saddle: Level;
  face: Record<Side, { forehead: string; eyeClosure: string; mouth: string }>;
  faceSensation: Record<Side, { V1: Level; V2: Level; V3: Level; corneal: boolean }>;
  jawTo: 'none' | Side;
  uvulaTo: 'none' | Side;
  gag: Record<Side, boolean>;
  voice: 'normal' | 'hoarse' | 'nasal';
  /** the palate weak on both sides: it lifts little, the uvula central, the voice nasal (bulbar palsy) */
  palateWeakBoth: boolean;
  shrug: Record<Side, number>;
  tongue: { to: 'none' | Side; wasting: boolean; fasciculation: boolean };
  speech: { fluency: string; comprehension: string; repetition: string; naming: string; articulation: string };
  bulbarFatigue: boolean;
  ocularFatigue: boolean;
  gaitBalance: boolean;                                // vermis
  /** the substantia nigra on the other side lost: rigidity, bradykinesia, a rest tremor */
  parkinson: Record<Side, boolean>;
  /** a length-dependent polyneuropathy */
  polyneuropathy: boolean;
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
  /* what each lesion is: only degenerating motor neurons (motor neurone disease) fasciculate */
  const process = view.neuro?.process ?? {};
  const degenerating = (n: string) => nodes.has(n) && process[n] === 'degeneration';
  /* the time since onset: the survivors sprout and the denervated fibres shrink (evidence/neuro.ts) */
  const days = view.neuro?.days ?? 1;
  const sprout = 1 + (NEURO.sproutGain - 1) * (1 - Math.exp(-days / NEURO.sproutDays));
  const atrophy = NEURO.atrophyMax * (1 - Math.exp(-days / NEURO.atrophyDays));
  /** the share of a structure's fibres the lesion takes */
  const frac = (n: string) => Math.max(0, Math.min(1, extent[n] ?? (complete ? 1 : NEURO.partialShare)));
  const pathNodes = new Map<string, string[]>(); for (const pw of PATHWAYS as Array<{ id: string; nodes: string[] }>) pathNodes.set(pw.id, pw.nodes);
  /** the share of a pathway's fibres its lesioned structures take */
  const pathFrac = (f: Record<string, any>) => { const on = (pathNodes.get(f.pathwayId) ?? []).filter((n) => nodes.has(n)); return on.length ? Math.max(...on.map(frac)) : frac(''); };
  /** A muscle whose motor units conduct to share s, of which share ax still have their axons (the rest of what does not
      conduct is blocked by compression, its fibres still innervated): the survivors sprout to the denervated fibres; only
      denervated fibres waste. */
  const keep = (s: number, ax = s) => {
    if (s >= 1) return { force: 1, bulk: 1 };
    const innervated = ax <= 0 ? 0 : Math.min(1, ax * sprout);
    const force = ax <= 0 ? 0 : innervated * Math.max(0, s / ax);
    return { force, bulk: 1 - (1 - innervated) * atrophy };
  };
  /** the share of a lesion's lost fibres that are cut (the rest blocked): all, unless the lesion is a compression */
  const axonal = (f: Record<string, any>) => ((pathNodes.get(f.pathwayId) ?? []).some((n) => nodes.has(n) && process[n] === 'compression') ? 1 - NEURO.compressionBlock : 1);
  const myotome = (view.patient as { anatomy?: { myotome?: Record<string, Record<string, number>> } } | undefined)?.anatomy?.myotome ?? {};
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
  const fasciculation = { L: { arm: false, leg: false }, R: { arm: false, leg: false } };
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
      /* the segments whose lower motor neurons (anterior horn, ventral root) the lesion takes, and how much of each */
      const lmnFrac = new Map<string, number>(), lmnAx = new Map<string, number>();
      for (const f of find((f) => f.modality === 'motor' && f.umnOrLmn === 'LMN' && f.bodyRegion.startsWith(`${S}_${limb}_`))) {
        const g = f.bodyRegion.split('_')[2];
        lmnFrac.set(g, Math.max(lmnFrac.get(g) ?? 0, pathFrac(f)));
        lmnAx.set(g, Math.max(lmnAx.get(g) ?? 0, pathFrac(f) * axonal(f)));
      }
      const lmnSegs = new Set(lmnFrac.keys());
      const k = limb === 'arm' ? som.arm : som.leg;
      if (umnSegs.size) {
        basis.push(`${S} ${limb}: upper motor neuron${k < 1 ? ' (motor strip partly spared)' : ''}`);
        if (limb === 'arm') drift[S] = true;
      }
      /* where the upper motor neuron lesion is: the cord (below the decussation), and whether it takes the whole width */
      const umnOn = new Set(find((f) => f.modality === 'motor' && f.umnOrLmn === 'UMN' && f.bodyRegion.startsWith(`${S}_${limb}_`))
        .flatMap((f) => (pathNodes.get(f.pathwayId) ?? []).filter((n) => nodes.has(n))));
      const inCord = [...umnOn].some((n) => /_cst_/.test(n));
      const transverse = [...umnOn].some((n) => { const m = /^[LR]_cst_(\w+)$/.exec(n); return !!m && ['L', 'R'].every((x) => frac(`${x}_cst_${m[1]}`) >= 1 && nodes.has(`${x}_cst_${m[1]}`)); });
      let lowest = 5, leastBulk = 1, umnLowest = 5;
      for (const [move, muscle] of moves) {
        const u = unit(muscle);
        let p = 5;
        // upper motor neuron, pyramidal pattern
        if (u.roots.some((r) => umnSegs.has(r))) {
          const base = complete ? 0 : PYRAMIDAL_WEAK.has(move) ? 3 : 4;
          p = Math.min(p, Math.round(5 - (5 - base) * k));
          if (PYRAMIDAL_WEAK.has(move)) umnLowest = Math.min(umnLowest, p);
        }
        /* the motor units it keeps: each root takes its share (measured where known, else equal), the plexus and the nerve
           all of the muscle's, each by the share of fibres it loses */
        const share = myotome[muscle] ?? ROOT_SHARE[muscle] ?? Object.fromEntries(u.roots.map((r) => [r, 1 / u.roots.length]));
        let units = 1, ax = 1;
        for (const r of Object.keys(share)) { units -= share[r] * (lmnFrac.get(r) ?? 0); ax -= share[r] * (lmnAx.get(r) ?? 0); }
        units = Math.max(0, units); ax = Math.max(0, ax);
        for (const f of find((x) => x.modality === 'peripheral_motor' && x.bodyRegion === `${S}_muscle_${muscle.replace(/\s+/g, '_')}` && (x.rung === 'nerve' || x.rung === 'plexus'))) {
          units *= 1 - pathFrac(f); ax *= 1 - pathFrac(f) * axonal(f);
        }
        if (units < 1) {
          const m = keep(units, ax);
          p = Math.min(p, mrcOf(m.force, move));
          leastBulk = Math.min(leastBulk, m.bulk);
        }
        // the junction and the muscle itself
        for (const f of find((x) => x.modality === 'peripheral_motor' && x.bodyRegion === `${S}_muscle_${muscle.replace(/\s+/g, '_')}`)) {
          /* the junction: fatigable, and proximal (limb-girdle) muscles first; distal ones are kept at first effort */
          if (f.rung === 'nmj') { fatigable[S] = true; if (u.bulk === 'prox') p = Math.min(p, complete ? 4 : 5); }
          else if (f.rung === 'muscle') p = Math.min(p, complete ? 3 : 4);
        }
        power[S][move] = p;
        lowest = Math.min(lowest, p);
      }
      if (lowest <= 2 && !umnSegs.size) tone[S][limb] = 'reduced';
      /* The release of tone and reflexes takes time (evidence/neuro.ts). Above the cord (a stroke) a severely weak limb
         becomes spastic and its reflexes brisk from about day 3, a lesser weakness mostly not at all; at first a paralysed
         limb is floppy. In the cord an incomplete lesion releases the reflexes within days and tone within a month; a
         complete transection first silences everything below it (spinal shock), the ankle jerk returning at about a week,
         the knee jerk at two, brisk by a month. The plantar turns extensor at once, except in spinal shock. */
      let release: { brisk: boolean; clonus: boolean; silent: string[] } = { brisk: false, clonus: false, silent: [] };
      if (umnSegs.size) {
        if (transverse) {
          const shock = days < NEURO.cordBriskDays;
          release = { brisk: days >= NEURO.cordSpasticDays, clonus: days >= NEURO.cordSpasticDays && limb === 'leg',
            silent: [...(days < NEURO.cordAnkleDays ? ['ankle'] : []), ...(days < NEURO.cordKneeDays ? ['knee', 'biceps', 'supinator', 'triceps'] : [])] };
          tone[S][limb] = days >= NEURO.cordSpasticDays ? 'spastic' : 'reduced';
          if (limb === 'leg') plantar[S] = shock ? 'mute' : 'extensor';
          basis.push(`${S} ${limb}: cord transection, day ${days}${shock ? ' (spinal shock)' : ''}`);
        } else if (inCord) {
          release = { brisk: days >= NEURO.cordBriskDays, clonus: false, silent: [] };
          if (days >= NEURO.cordSpasticDays) tone[S][limb] = 'spastic';
          if (limb === 'leg') plantar[S] = 'extensor';
        } else {
          const released = umnLowest <= NEURO.spasticPower && days >= NEURO.spasticityOnsetDays;
          release = { brisk: released, clonus: released && complete && limb === 'leg', silent: [] };
          tone[S][limb] = released ? 'spastic' : umnLowest === 0 ? 'reduced' : tone[S][limb];
          if (limb === 'leg') plantar[S] = 'extensor';
        }
      }
      /* sick anterior horn cells that still fire make their motor units twitch: fasciculation in motor neurone disease,
         not after an infarct of the cord or a cut root */
      if ((segs as readonly string[]).some((g) => degenerating(`${S}_ahn_${g}`))) fasciculation[S][limb] = true;
      if (leastBulk < NEURO.wastingVisible) wasting[S][limb] = true;
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
        else if (roots.some((g) => umnSegs.has(g)) && reflex[S][rx] === 2)
          reflex[S][rx] = release.silent.includes(rx) ? 0 : release.brisk ? (release.clonus && rx === 'ankle' ? 4 : 3) : 2;
      }
    }
  }

  /* ---- the extrapyramidal system and the longest nerves ---------------------------- */
  /* Parkinsonism: the nigrostriatal system lost on one side shows on the other side of the body: rigid tone through the
     whole range, slow movements that shrink as they repeat (bradykinesia), a 4–6 Hz tremor at rest (Deuschl 1998). */
  const parkinson = { L: nodes.has('R_snc'), R: nodes.has('L_snc') };
  for (const S of SIDES) if (parkinson[S]) {
    for (const limb of ['arm', 'leg'] as const) if (tone[S][limb] === 'normal') tone[S][limb] = 'rigid';
    basis.push(`${S} limbs: substantia nigra on the other side (parkinsonism)`);
  }
  /* A length-dependent polyneuropathy reaches the longest nerves first: the feet before the hands, the ankle jerks lost
     before the knee jerks, the toes' dorsiflexors weak before anything proximal. */
  const poly = nodes.has('polyneuropathy');
  if (poly) {
    basis.push('length-dependent polyneuropathy: the longest nerves first');
    for (const S of SIDES) {
      power[S].ankleDorsiflexion = Math.min(power[S].ankleDorsiflexion, complete ? 3 : 4);
      power[S].footEversion = Math.min(power[S].footEversion, complete ? 3 : 4);
      if (complete) { power[S].anklePlantarflexion = Math.min(power[S].anklePlantarflexion, 4); power[S].fingerAbduction = Math.min(power[S].fingerAbduction, 4); }
      reflex[S].ankle = Math.min(reflex[S].ankle, complete ? 0 : 1);
      if (complete) reflex[S].knee = Math.min(reflex[S].knee, 1);
    }
  }

  /* ---- sensation ---------------------------------------------------------------- */
  const pinprick = { L: {}, R: {} } as LimbState['pinprick'];
  const territories = { L: [] as string[], R: [] as string[] };
  const vibration = { L: { arm: 'normal' as Level, leg: 'normal' as Level }, R: { arm: 'normal' as Level, leg: 'normal' as Level } };
  const lvl: Level = complete ? 'absent' : 'reduced';
  /* A lesion of the sensory cortex alone loses discrimination and the sense of position, but pain, temperature and
     vibration reach consciousness at the thalamus: pinprick is at most reduced and vibration kept. So a pathway cut only
     at the cortex counts for less than one cut below it. */
  const onlyCortex = (f: Record<string, any>) => (pathNodes.get(f.pathwayId) ?? []).filter((n) => nodes.has(n)).every((n) => /_scx$/.test(n));
  /* lost where the lesion takes all of a pathway's fibres, reduced where it takes part (or only the cortex) */
  const level = (fs: Array<Record<string, any>>): Level => (!fs.length ? 'normal' : fs.every(onlyCortex) ? 'reduced' : fs.some((f) => pathFrac(f) >= 1) ? 'absent' : 'reduced');
  const proprioception = { L: { arm: 'normal' as Level, leg: 'normal' as Level }, R: { arm: 'normal' as Level, leg: 'normal' as Level } };
  for (const S of SIDES) {
    for (const seg of [...ARM_SEGS, 'T6', 'T10', ...LEG_SEGS]) {
      pinprick[S][seg] = level(find((f) => f.modality === 'pain_temp' && f.bodyRegion === `${S}_dermatome_${seg}`));
    }
    for (const f of find((x) => x.modality === 'cutaneous' && x.bodyRegion.startsWith(`${S}_skin_`))) {
      const t = SKIN_TERRITORY[f.bodyRegion.slice(`${S}_skin_`.length)];
      if (t && (f.rung === 'nerve' || f.rung === 'plexus') && !territories[S].includes(t)) territories[S].push(t);
    }
    // Vibration at the finger or big toe is lost only when the column (or several roots) is: a single root rarely abolishes it.
    const col = (segs: string[]) => segs.map((g) => find((f) => f.modality === 'proprioception' && f.bodyRegion === `${S}_dermatome_${g}`));
    const dc = (segs: string[], cortexCounts: boolean) => { const fs = col(segs); return fs.every((x) => x.length) && (cortexCounts || !fs.flat().every(onlyCortex)) ? lvl : 'normal'; };
    vibration[S] = { arm: dc(['C7', 'C8'], false), leg: dc(['L5', 'S1'], false) };
    proprioception[S] = { arm: dc(['C7', 'C8'], true), leg: dc(['L5', 'S1'], true) };
  }
  if (poly) for (const S of SIDES) {
    /* stockings, and gloves when it is severe */
    for (const g of complete ? ['L4', 'L5', 'S1'] : ['L5', 'S1']) pinprick[S][g] = pinprick[S][g] === 'normal' ? lvl : pinprick[S][g];
    if (complete) for (const g of ['C7', 'C8']) pinprick[S][g] = pinprick[S][g] === 'normal' ? 'reduced' : pinprick[S][g];
    vibration[S].leg = lvl; proprioception[S].leg = lvl;
    if (complete) { vibration[S].arm = 'reduced'; }
  }
  /* the saddle is both sides' S3–5: one side lost leaves it reduced */
  /* the saddle is felt in both hemispheres: a lesion of one sensory cortex leaves it */
  const saddleSides = SIDES.filter((S) => find((f) => f.modality === 'pain_temp' && f.bodyRegion.startsWith(`${S}_saddle_`) && !onlyCortex(f)).length);
  const saddle: Level = saddleSides.length === 2 ? lvl : saddleSides.length === 1 ? 'reduced' : 'normal';

  /* ---- cranial nerves ------------------------------------------------------------ */
  const face = { L: { forehead: 'normal', eyeClosure: 'normal', mouth: 'normal' }, R: { forehead: 'normal', eyeClosure: 'normal', mouth: 'normal' } };
  const faceSensation = { L: { V1: 'normal' as Level, V2: 'normal' as Level, V3: 'normal' as Level, corneal: true }, R: { V1: 'normal' as Level, V2: 'normal' as Level, V3: 'normal' as Level, corneal: true } };
  const gag = { L: true, R: true };
  const shrug = { L: 5, R: 5 };
  let jawTo: LimbState['jawTo'] = 'none', uvulaTo: LimbState['uvulaTo'] = 'none', voice: LimbState['voice'] = 'normal';
  const tongue: LimbState['tongue'] = { to: 'none', wasting: false, fasciculation: false };
  const tongueWeight: Record<Side, number> = { L: 0, R: 0 }, palateWeak: Side[] = [];
  for (const S of SIDES) {
    const som = cortical(S);
    for (const f of find((x) => x.modality === 'cranial_motor' && x.bodyRegion.startsWith(`${S}_face_`))) {
      const weak = complete ? 'absent' : 'weak';
      if (f.umnOrLmn === 'LMN') { face[S].forehead = weak; face[S].eyeClosure = weak; face[S].mouth = weak; }
      else face[S].mouth = som.face >= 0.5 ? 'weak' : face[S].mouth;   // upper motor neuron: forehead spared
    }
    for (const v of ['V1', 'V2', 'V3'] as const) {
      const region = { V1: 'face_V1_forehead', V2: 'face_V2_cheek', V3: 'face_V3_jaw' }[v];
      faceSensation[S][v] = level(find((x) => x.modality === 'face_sensation' && x.bodyRegion === `${S}_${region}`));
    }
    /* the corneal reflex is the brainstem's: lost with the first division in the nerve or the brainstem, or with the eye's
       own closure (VII); a hemisphere lesion leaves it */
    const v1Below = find((x) => x.modality === 'face_sensation' && x.bodyRegion === `${S}_face_V1_forehead` && (pathNodes.get(x.pathwayId) ?? []).some((n) => nodes.has(n) && /_cn5_/.test(n))).length > 0;
    faceSensation[S].corneal = !v1Below && face[S].eyeClosure !== 'absent';
    if (find((x) => x.bodyRegion === `${S}_jaw`).length) jawTo = S;
    if (find((x) => x.bodyRegion === `${S}_palate_vocal`).length) { uvulaTo = uvulaTo === 'none' ? other(S) : 'none'; voice = 'hoarse'; palateWeak.push(S); }
    if (find((x) => x.bodyRegion === `${S}_pharynx`).length) gag[S] = false;
    for (const f of find((x) => x.bodyRegion === `${S}_trapezius_scm`)) shrug[S] = Math.min(shrug[S], mrcOf(keep(1 - pathFrac(f)).force, 'shrug'));
    for (const f of find((x) => x.bodyRegion === `${S}_tongue`)) {
      /* the tongue deviates toward its weaker side: a lower motor neuron weakness outweighs an upper (each half of the tongue
         has cortical fibres from both hemispheres); equally weak on both sides, it does not deviate */
      const w = f.umnOrLmn === 'LMN' ? 2 : 1;
      tongueWeight[S] = Math.max(tongueWeight[S], w);
      tongue.to = tongueWeight.L === tongueWeight.R ? 'none' : tongueWeight.L > tongueWeight.R ? 'L' : 'R';
      /* a lower motor neuron lesion wastes the tongue as it does a limb muscle, from about three weeks */
      /* fasciculations come from sick motor neurons that still fire (motor neurone disease of the hypoglossal nucleus), not
         from a nucleus or nerve destroyed by an infarct or a cut */
      if (f.umnOrLmn === 'LMN' && keep(1 - pathFrac(f)).bulk < NEURO.wastingVisible) tongue.wasting = true;
      if (f.umnOrLmn === 'LMN' && (pathNodes.get(f.pathwayId) ?? []).some(degenerating)) tongue.fasciculation = true;
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
    power, fatigable, tone, wasting, fasciculation, reflex, plantar, drift, pinprick, territories, vibration, proprioception, saddle,
    face, faceSensation, jawTo, uvulaTo, gag, voice: palateWeak.length === 2 ? 'nasal' : voice, palateWeakBoth: palateWeak.length === 2, shrug, tongue, speech, bulbarFatigue, ocularFatigue,
    gaitBalance: has('gait_balance'), parkinson, polyneuropathy: poly, basis,
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
      case 'arm.rest-tremor': return { value: { tremor: st.parkinson[S!] ? 'rest' : 'none' }, ...(st.parkinson[S!] ? { basis: 'substantia nigra on the other side' } : {}) };
      case 'arm.tone': return { value: { tone: st.tone[S].arm, wasting: st.wasting[S].arm, fasciculation: st.fasciculation[S].arm }, basis };
      case 'leg.tone': return { value: { tone: st.tone[S].leg, wasting: st.wasting[S].leg, fasciculation: st.fasciculation[S].leg }, basis };
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
      case 'arm.vibration': return { value: { vibration: st.vibration[S!].arm, proprioception: st.proprioception[S!].arm } };
      case 'leg.vibration': return { value: { vibration: st.vibration[S!].leg, proprioception: st.proprioception[S!].leg } };
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
      case 'mouth.palate': return { value: { uvulaDeviatesTo: st.uvulaTo, ...(st.palateWeakBoth ? { weakBoth: true } : {}), gagLeft: st.gag.L, gagRight: st.gag.R, voice: st.voice } };
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
