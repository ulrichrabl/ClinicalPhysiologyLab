import type { ExamContext, Side } from '../model/types.ts';
import { NEURO } from '../evidence/neuro.ts';
import type { Resolved, Resolver, RuntimeView } from '../engine/observe.ts';
import { limbState } from './neuro-limb.ts';

/* ===========================================================================
   Neuro-ophthalmology, vestibular and cerebellar examination model.

   Reads the nervous-system graph (lesioned nodes and the findings the graph
   derives) plus declared conditions, and computes what the examiner sees as
   physiological quantities: slow-phase velocity, VOR gain, pupil diameter,
   duction range, prism dioptres. The same numbers drive text and animation,
   so a nystagmus on screen beats at the velocity the model computed.

   The physiology, kept deliberately small:

   * Vestibular tone. Each side's resting discharge is periphery x nucleus.
     An imbalance drives the eyes slowly toward the weaker side; quick phases
     reset them, so the nystagmus beats toward the stronger side. Visual
     fixation suppresses it (flocculus intact) and it grows when looking in
     the direction of the quick phase (Alexander's law). Central
     compensation reduces it over days.

   * Gaze holding. The neural integrator keeps the eyes eccentric; it leaks
     with a time constant tau. With a normal tau (25 s) the drift at 30° of
     lateral gaze reaches the visible threshold, so a fine nystagmus beats
     toward the direction of gaze. That is physiological end-point nystagmus:
     most healthy people have it at 30°, often sustained (Ritter 2020), and
     the model labels it as normal. Cerebellar or brainstem lesions shorten
     tau, so the eyes drift back to centre faster and beat toward the
     direction of gaze: gaze-evoked, direction-changing nystagmus, unaffected
     by fixation.

   * VOR gain. A head impulse toward a side tests that side's horizontal
     canal and nerve. Gain below ~0.6 produces an overt catch-up saccade.

   * Otolith pathway. A lateral medullary lesion tilts the vertical
     alignment (skew deviation, ipsilesional eye lower).

   Together these reproduce the bedside HINTS contrast: a peripheral lesion
   gives an abnormal head impulse, unidirectional nystagmus and no skew; a
   central one a normal head impulse, direction-changing nystagmus or skew.
=========================================================================== */

const SIDES: Side[] = ['L', 'R'];

/** Neural integrator time constant with healthy gaze holding (s). Not yet in the evidence registry; at 30° it drifts
    about twice as fast as Ritter 2020 measured (a known gap in the test suite). */
export const NORMAL_INTEGRATOR_TAU_S = 25;
const other = (s: Side): Side => (s === 'L' ? 'R' : 'L');

const ECC_H: Record<string, number> = { primary: 0, left: -30, right: 30, up: 0, down: 0, 'up-left': -25, 'up-right': 25, 'down-left': -25, 'down-right': 25 };
const ECC_V: Record<string, number> = { primary: 0, left: 0, right: 0, up: 25, down: -25, 'up-left': 20, 'up-right': 20, 'down-left': -20, 'down-right': -20 };

/** Condition ids this model understands, with their parameters. The validator reads this. */
export const NEURO_CONDITIONS: Record<string, { params: Record<string, 'side' | 'fraction' | 'number'> }> = {
  'vestibular-hypofunction': { params: { side: 'side', severity: 'fraction', daysSinceOnset: 'number' } },
};

export interface NeuroExamState {
  periphery: Record<Side, number>;       // labyrinth and vestibular nerve, 0..1
  nucleus: Record<Side, number>;         // vestibular nuclei resting tone, 0..1
  vor: Record<Side, number>;             // VOR drive for impulses toward that side, 0..1
  compensation: number;                  // central compensation of tone imbalance, 0..1
  tauSeconds: number;                    // neural integrator time constant
  fixationResidual: number;              // fraction of spontaneous nystagmus left with fixation
  skew: { higherEye: Side; prismDioptres: number } | null;
  pursuit: 'smooth' | 'saccadic';
  lateropulsion: { toward: Side; strength: number } | null;   // 0..1
  ataxia: Record<Side, 'none' | 'mild' | 'marked'>;
  hearing: Record<Side, number>;         // cochlea and cochlear nerve, 0..1
  pupil: { efferent: Record<Side, boolean>; afferent: Record<Side, boolean>; horner: Record<Side, boolean> };
  ductions: Record<Side, { abduction: number; adduction: number; elevation: number; depression: number; restH: number; restV: number }>;
  ptosisMm: Record<Side, number>;
  fields: Record<Side, { temporal: 'intact' | 'lost'; nasal: 'intact' | 'lost' }>;
  /** What the derivation rested on, for the debrief. */
  basis: string[];
}

const cache = new WeakMap<RuntimeView, NeuroExamState>();

export function neuroExamState(view: RuntimeView): NeuroExamState {
  const hit = cache.get(view);
  if (hit) return hit;
  const s = derive(view);
  cache.set(view, s);
  return s;
}

function derive(view: RuntimeView): NeuroExamState {
  const nodes = new Set(view.neuro?.nodes ?? []);
  const findings = view.neuro?.findings ?? [];
  const partial = view.neuro ? !view.neuro.complete : false;
  const has = (id: string) => nodes.has(id);
  const finding = (modality: string, region: string) => findings.some((f) => f.modality === modality && f.bodyRegion === region);
  const basis: string[] = [];
  const loss = partial ? 0.5 : 1;   // incomplete lesion: half the deficit

  /* ---- vestibular ---------------------------------------------------------- */
  const periphery = { L: 1, R: 1 } as Record<Side, number>;
  const nucleus = { L: 1, R: 1 } as Record<Side, number>;
  const nuclearVor = { L: 1, R: 1 } as Record<Side, number>;
  let compensation = 0;
  for (const S of SIDES) {
    if (has(`${S}_cn8`)) { periphery[S] = 1 - loss; basis.push(`${S} vestibulocochlear nerve lesion`); }
    if (has(`${S}_cn8_vest`)) { nucleus[S] = 1 - 0.7 * loss; nuclearVor[S] = 1 - 0.5 * loss; basis.push(`${S} vestibular nucleus lesion`); }
  }
  for (const c of view.conditions ?? []) {
    if (c.id !== 'vestibular-hypofunction') continue;
    const S = (c.params?.side as Side) ?? 'L';
    const sev = Number(c.params?.severity ?? 1);
    periphery[S] = Math.min(periphery[S], 1 - sev);
    const days = Number(c.params?.daysSinceOnset ?? 1);
    compensation = Math.max(compensation, Math.min(0.9, 0.07 * days));
    basis.push(`${S} peripheral vestibular hypofunction ${(sev * 100).toFixed(0)}%, day ${days}`);
  }

  const lateralMedulla = SIDES.filter((S) => has(`${S}_lat_bs`) && has(`${S}_icp`));
  const cerebellar = SIDES.filter((S) => has(`${S}_cerebellum`) || has(`${S}_dentate`) || has(`${S}_icp`) || has(`${S}_mcp`));
  for (const S of lateralMedulla) { nucleus[S] = Math.min(nucleus[S], 1 - 0.2 * loss); basis.push(`${S} lateral medulla (vestibular nuclei, otolith pathway)`); }

  let tauSeconds = NORMAL_INTEGRATOR_TAU_S;
  if (lateralMedulla.length) tauSeconds = 6;
  if (cerebellar.length) tauSeconds = Math.min(tauSeconds, partial ? 6 : 3);
  const fixationResidual = cerebellar.length ? 1 : lateralMedulla.length ? 0.8 : 0.3;

  const skew = lateralMedulla.length
    ? { higherEye: other(lateralMedulla[0]), prismDioptres: 4 }
    : null;
  const pursuit: NeuroExamState['pursuit'] = cerebellar.length || lateralMedulla.length ? 'saccadic' : 'smooth';

  /* lateropulsion: toward the weaker periphery, or toward the central lesion */
  const tone = { L: periphery.L * nucleus.L, R: periphery.R * nucleus.R };
  const imbalance = (tone.R - tone.L) * (1 - compensation);
  let lateropulsion: NeuroExamState['lateropulsion'] = null;
  if (Math.abs(imbalance) > 0.1) lateropulsion = { toward: imbalance > 0 ? 'L' : 'R', strength: Math.min(1, Math.abs(imbalance)) };
  if (lateralMedulla.length) lateropulsion = { toward: lateralMedulla[0], strength: 0.9 };
  else if (cerebellar.length) lateropulsion = { toward: cerebellar[0], strength: Math.max(lateropulsion?.strength ?? 0, 0.6) };

  const ataxia = { L: 'none', R: 'none' } as NeuroExamState['ataxia'];
  for (const S of SIDES) {
    if (finding('cerebellar', `${S}_coordination`)) ataxia[S] = partial ? 'mild' : 'marked';
    else if (has(`${S}_icp`)) ataxia[S] = 'mild';
  }

  /* ---- hearing ------------------------------------------------------------- */
  const hearing = { L: 1, R: 1 } as Record<Side, number>;
  for (const S of SIDES) if (finding('hearing', `${S}_ear`)) hearing[S] = 1 - loss;

  /* ---- pupils, lids, ductions ----------------------------------------------- */
  const efferent = { L: true, R: true } as Record<Side, boolean>;
  const afferent = { L: true, R: true } as Record<Side, boolean>;
  const horner = { L: false, R: false } as Record<Side, boolean>;
  const ptosisMm = { L: 0, R: 0 } as Record<Side, number>;
  const ductions = {
    L: { abduction: 100, adduction: 100, elevation: 100, depression: 100, restH: 0, restV: 0 },
    R: { abduction: 100, adduction: 100, elevation: 100, depression: 100, restH: 0, restV: 0 },
  };
  for (const S of SIDES) {
    if (finding('pupil_efferent', `${S}_pupil_constrict`)) efferent[S] = false;
    if (has(`${S}_cn2`) || (has(`${S}_retina_temp`) && has(`${S}_retina_nas`))) afferent[S] = false;
    if (finding('sympathetic', `${S}_horner`)) { horner[S] = true; ptosisMm[S] = 2; basis.push(`${S} oculosympathetic pathway`); }
    const d = ductions[S];
    if (finding('cranial_motor', `${S}_eye_movement`)) {   // CN III
      const k = loss;
      d.adduction = 100 - 100 * k; d.elevation = 100 - 100 * k; d.depression = 100 - 80 * k;
      d.restH = 20 * k; d.restV = -10 * k;          // down and out
      ptosisMm[S] = Math.max(ptosisMm[S], 8 * k);
      basis.push(`${S} oculomotor nerve`);
    }
    if (finding('cranial_motor', `${S}_eye_abduction`)) {  // CN VI
      d.abduction = 100 - 100 * loss; d.restH = Math.min(d.restH, -15 * loss);
      basis.push(`${S} abducens nerve`);
    }
    if (finding('cranial_motor', `${S}_eye_downgaze`)) {   // CN IV
      d.depression = Math.min(d.depression, 100 - 50 * loss); d.restV = Math.max(d.restV, 3 * loss);
      basis.push(`${S} trochlear nerve`);
    }
  }

  /* ---- visual fields, from the anatomy of the pathway ---------------------- */
  const fields = { L: { temporal: 'intact', nasal: 'intact' }, R: { temporal: 'intact', nasal: 'intact' } } as NeuroExamState['fields'];
  for (const S of SIDES) {
    const o = other(S);
    if (has(`${S}_cn2`)) { fields[S].temporal = 'lost'; fields[S].nasal = 'lost'; }
    if (has(`${S}_retina_nas`)) fields[S].temporal = 'lost';
    if (has(`${S}_retina_temp`)) fields[S].nasal = 'lost';
    // Retro-chiasmal on side S: contralateral homonymous hemianopia.
    if (has(`${S}_optic_tract`) || has(`${S}_lgn`) || has(`${S}_optic_rad`) || has(`${S}_vis_cx`)) {
      fields[o].temporal = 'lost'; fields[S].nasal = 'lost';
    }
  }
  if (has('chiasm')) { fields.L.temporal = 'lost'; fields.R.temporal = 'lost'; }

  const vor = { L: periphery.L * nuclearVor.L, R: periphery.R * nuclearVor.R };

  return {
    periphery, nucleus, vor, compensation, tauSeconds, fixationResidual, skew, pursuit, lateropulsion, ataxia,
    hearing, pupil: { efferent, afferent, horner }, ductions, ptosisMm, fields, basis,
  };
}

/* ---- nystagmus ---------------------------------------------------------------- */

export interface NystagmusValue {
  present: boolean;
  type?: 'jerk';
  fastPhase?: 'left' | 'right' | 'up' | 'down';
  torsion?: 'none' | 'toward-left-ear' | 'toward-right-ear';
  slowPhase?: 'constant' | 'decreasing';
  spvDegPerS?: number;
  amplitudeDeg?: number;
  frequencyHz?: number;
  /** End-point nystagmus from a healthy integrator alone, with no spontaneous (vestibular) component: normal. */
  physiological?: boolean;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

export function nystagmus(s: NeuroExamState, ctx: ExamContext): NystagmusValue {
  const gaze = ctx.gaze ?? 'primary';
  const fixation = ctx.fixation ?? true;
  const eH = ECC_H[gaze] ?? 0, eV = ECC_V[gaze] ?? 0;

  // Spontaneous component: slow phase toward the weaker side. Positive = rightward.
  const tone = { L: s.periphery.L * s.nucleus.L, R: s.periphery.R * s.nucleus.R };
  let spont = -(tone.R - tone.L) * 20 * (1 - s.compensation);
  const quickRight = spont < 0;
  if (eH !== 0 && spont !== 0) spont *= (eH > 0) === quickRight ? 1.7 : 0.35;   // Alexander's law
  if (fixation) spont *= s.fixationResidual;

  // Gaze-holding: centripetal drift with the integrator's time constant.
  const driftH = -eH / s.tauSeconds, driftV = -eV / s.tauSeconds;
  const netH = spont + driftH, netV = driftV;
  const threshold = fixation ? 1.0 : 0.6;
  const mag = Math.hypot(netH, netV);
  if (mag < threshold) return { present: false };

  const horizontal = Math.abs(netH) >= Math.abs(netV);
  const fastPhase = horizontal ? (netH < 0 ? 'right' : 'left') : (netV < 0 ? 'up' : 'down');
  const peripheralShare = Math.abs(spont) / (Math.abs(spont) + Math.hypot(driftH, driftV) + 1e-9);
  const torsion = peripheralShare > 0.5 && horizontal ? (fastPhase === 'right' ? 'toward-right-ear' : 'toward-left-ear') : 'none';
  const frequencyHz = peripheralShare > 0.5 ? 2.5 : 2;
  /* Physiological when a healthy integrator alone makes it visible: the spontaneous component would not be seen on
     its own and gaze holding is normal. Any shortening of tau (cerebellum, brainstem) makes it pathological. */
  const physiological = Math.abs(spont) < threshold && s.tauSeconds >= NORMAL_INTEGRATOR_TAU_S && (eH !== 0 || eV !== 0);
  return {
    present: true, type: 'jerk', fastPhase, torsion,
    slowPhase: peripheralShare > 0.5 ? 'constant' : 'decreasing',
    spvDegPerS: round1(mag),
    // Amplitude is what the slow phase covers before the ~30 ms quick phase resets it.
    amplitudeDeg: round1(mag * (1 / frequencyHz - 0.03)), frequencyHz, physiological,
  };
}

/* ---- vertical alignment by gaze -------------------------------------------------- */

/** How far one eye can look down and up (degrees, down negative). A paretic eye at rest can lie beyond what its muscles
    can reach on command (the third nerve's eye rests down and out, pulled by the muscles still working), so the range
    always includes where it rests. */
export function verticalRange(d: { elevation: number; depression: number; restV: number }): { min: number; max: number } {
  return { min: Math.min(-25 * d.depression / 100, d.restV), max: Math.max(25 * d.elevation / 100, d.restV) };
}

/** The vertical position of the right eye minus the left (degrees) when the patient looks in `gaze` with the better eye
    fixing: each eye goes to the target plus its resting deviation, as far as its range allows. */
export function verticalAt(s: NeuroExamState, gaze: string): number {
  const target = ECC_V[gaze] ?? 0;
  const pos = (S: Side) => { const d = s.ductions[S], r = verticalRange(d); return Math.max(r.min, Math.min(r.max, target + d.restV)); };
  return pos('R') - pos('L');
}

/* ---- resolvers ------------------------------------------------------------------ */

const pupilBase = (age: number) => (age < 12 ? 5 : age >= 60 ? 3.5 : 4);

export const NEURO_RESOLVERS: Record<string, Resolver> = {
  'neuro.vestibular': (view, ref, ctx): Resolved => {
    const s = neuroExamState(view);
    if (ref.property === 'eyes.nystagmus') {
      const v = nystagmus(s, ctx);
      return { value: v, normal: !v.present || !!v.physiological, basis: s.basis.join('; ') || undefined };
    }
    if (ref.property === 'eye.head-impulse') {
      const S = ref.side ?? ctx.headImpulseTo ?? 'L';
      const gain = round1(0.25 + 0.75 * s.vor[S]);
      const saccade = gain < 0.6 ? 'overt' : gain < 0.8 ? 'covert' : 'none';
      return { value: { gain, saccade }, basis: `VOR gain ${gain.toFixed(1)} toward the ${S === 'L' ? 'left' : 'right'}` };
    }
    if (ref.property === 'eyes.pursuit') return { value: { quality: s.pursuit } };
    return undefined;
  },

  'neuro.pupils': (view, ref, ctx): Resolved => {
    const s = neuroExamState(view);
    const { efferent, afferent, horner } = s.pupil;
    if (ref.property === 'eyes.swinging-light') {
      const rapd = afferent.L === afferent.R ? 'none' : afferent.L ? 'R' : 'L';
      return { value: { rapd } };
    }
    const S = ref.side!;
    const dim = ctx.ambient === 'dim';
    const base = pupilBase(view.patient.age) + (dim ? 1.5 : 0);
    let size = base;
    if (horner[S]) size = dim ? base - 2.5 : base - 1.8;   // dilation lag: anisocoria larger in the dark
    if (!efferent[S]) size = 6.5;
    const lit: Side[] = ctx.lightOn === 'both' ? ['L', 'R'] : ctx.lightOn === 'L' || ctx.lightOn === 'R' ? [ctx.lightOn] : [];
    const value: { sizeMm: number; reaction?: string } = { sizeMm: round1(size) };
    if (lit.length) {
      const drive = lit.some((E) => afferent[E]);
      if (efferent[S] && drive) { value.sizeMm = round1(Math.max(1.5, size * 0.6)); value.reaction = 'brisk'; }
      else value.reaction = 'absent';
    }
    const abnormal = !efferent[S] || horner[S] || (lit.length > 0 && value.reaction === 'absent');
    return { value, normal: !abnormal };
  },

  'neuro.lids': (view, ref, ctx): Resolved | undefined => {
    let mm = neuroExamState(view).ptosisMm[ref.side!];
    // Myasthenia: the lid is fine at first and droops with sustained upgaze.
    if (limbState(view).ocularFatigue && (ctx.sustainedSeconds ?? 0) >= 30) mm = Math.max(mm, ref.side === 'L' ? 3 : 2);
    return mm > 0 ? { value: { ptosisMm: mm }, basis: mm && (ctx.sustainedSeconds ?? 0) >= 30 ? 'fatigable neuromuscular transmission' : undefined } : undefined;
  },

  'neuro.ocular-motor': (view, ref, ctx): Resolved => {
    const s = neuroExamState(view);
    if (ref.property === 'eye.motility') {
      const d = s.ductions[ref.side!];
      return { value: { abduction: d.abduction, adduction: d.adduction, elevation: d.elevation, depression: d.depression,
        restingDeg: { horizontal: d.restH, vertical: d.restV } } };
    }
    // eyes.alignment: positive restH = abducted; the deviation is the sum across both eyes.
    const h = s.ductions.L.restH + s.ductions.R.restH;
    /* The vertical deviation in the gaze asked for (primary unless stated). A paretic eye goes where the target asks
       only as far as its weak muscle lets it, so a nerve palsy's vertical deviation grows in the weak muscle's field:
       incomitant. A skew deviation comes from the otolith pathway, not from a muscle, and is the same in every gaze. */
    const vDiff = verticalAt(s, ctx.gaze ?? 'primary');
    let verticalPD = Math.round(Math.abs(vDiff) * 1.75);
    let higherEye: Side | undefined = vDiff > 0 ? 'R' : vDiff < 0 ? 'L' : undefined;
    if (s.skew && verticalPD === 0) { verticalPD = s.skew.prismDioptres; higherEye = s.skew.higherEye; }
    const value: Record<string, unknown> = {
      horizontal: Math.abs(h) < 1 ? 'ortho' : h > 0 ? 'exo' : 'eso',
      horizontalPD: Math.round(Math.abs(h) * 1.75), verticalPD,
    };
    if (higherEye && verticalPD > 0) value.higherEye = higherEye;
    return { value };
  },

  'neuro.fields': (view, ref): Resolved => ({ value: { ...neuroExamState(view).fields[ref.side!] } }),

  'neuro.hearing': (view, ref): Resolved | undefined => {
    const s = neuroExamState(view);
    const { L, R } = s.hearing;
    if (L === 1 && R === 1) return undefined;   // nothing from the model; conductive losses are case data
    if (ref.property === 'head.weber') return { value: L < R ? 'R' : R < L ? 'L' : 'central' };
    const S = ref.side!;
    if (ref.property === 'ear.whisper') return { value: s.hearing[S] < 0.6 ? 'not-heard' : 'heard' };
    if (ref.property === 'ear.rinne') {
      // A dead ear gives a false-negative Rinne: bone conduction crosses to the other cochlea.
      if (s.hearing[S] === 0 && s.hearing[other(S)] > 0.5) {
        return { value: 'negative', normal: false, basis: 'false-negative Rinne: bone conduction heard by the other cochlea' };
      }
      return { value: 'positive' };
    }
    return undefined;
  },

  'neuro.balance': (view, ref, ctx): Resolved | undefined => {
    const s = neuroExamState(view);
    const st = limbState(view);
    const sensoryAtaxia = st.proprioception.L.leg !== 'normal' && st.proprioception.R.leg !== 'normal';
    if (ref.property === 'posture.romberg') {
      if (sensoryAtaxia) return { value: ctx.eyesClosed ? { stance: 'falls' } : { stance: 'steady' }, basis: 'joint position sense lost in both legs' };
      if (st.gaitBalance) return { value: { stance: 'sways' }, basis: 'cerebellar vermis' };
      const lp = s.lateropulsion;
      if (!lp) return undefined;
      const k = ctx.eyesClosed ? lp.strength * 1.6 : lp.strength;
      const stance = k > 0.9 ? 'falls' : k > 0.25 ? 'sways' : 'steady';
      return { value: stance === 'steady' ? { stance } : { stance, toward: lp.toward } };
    }
    if (ref.property === 'posture.pull-test') {
      /* postural reflexes are lost late in bilateral parkinsonism (Hoehn & Yahr 3): many small steps back */
      if (st.parkinson.L && st.parkinson.R && (view.neuro?.days ?? 1) >= NEURO.posturalInstabilityDays)
        return { value: { response: 'steps' }, basis: `parkinsonism on both sides for ${Math.round((view.neuro?.days ?? 1) / 365)} years: postural reflexes lost` };
      return undefined;
    }
    if (ref.property === 'gait.pattern') {
      for (const S of ['L', 'R'] as Side[]) {
        if (st.plantar[S] === 'extensor' && st.power[S].hipFlexion <= 4) return { value: { pattern: 'hemiplegic', toward: S }, basis: `${S} leg upper motor neuron weakness` };
      }
      const drop = (['L', 'R'] as Side[]).filter((S) => st.power[S].ankleDorsiflexion <= 3);
      if (drop.length === 2) return { value: { pattern: 'high-stepping' }, basis: `ankle dorsiflexion ${st.power.L.ankleDorsiflexion}/5 and ${st.power.R.ankleDorsiflexion}/5: both feet drop` };
      if (drop.length === 1) { const S = drop[0]; return { value: { pattern: 'high-stepping', toward: S }, basis: `${S} ankle dorsiflexion ${st.power[S].ankleDorsiflexion}/5` }; }
      if (st.parkinson.L || st.parkinson.R) return { value: { pattern: 'parkinsonian' }, basis: 'substantia nigra (parkinsonism)' };
      if (st.power.L.hipAbduction <= 4 && st.power.R.hipAbduction <= 4) return { value: { pattern: 'waddling' }, basis: 'bilateral hip abductor weakness' };
      if (sensoryAtaxia) return { value: { pattern: 'sensory-ataxic' }, basis: 'joint position sense lost in both legs' };
      if (st.gaitBalance) return { value: { pattern: 'ataxic' }, basis: 'cerebellar vermis' };
      const lp = s.lateropulsion;
      if (!lp) return undefined;
      const ataxic = s.tauSeconds < 10;
      const pattern = ataxic ? 'ataxic' : lp.strength > 0.3 ? 'veers' : 'normal';
      return { value: pattern === 'normal' ? { pattern } : { pattern, toward: lp.toward } };
    }
    return undefined;
  },

  'neuro.coordination': (view, ref, ctx): Resolved | undefined => {
    const S = ref.side!;
    const a = neuroExamState(view).ataxia[S];
    const st = limbState(view);
    const arm = ref.property !== 'leg.heel-shin';
    const limbPower = arm ? Math.min(st.power[S].shoulderAbduction, st.power[S].elbowExtension, st.power[S].elbowFlexion) : Math.min(st.power[S].hipFlexion, st.power[S].kneeExtension);
    const proprio = arm ? st.proprioception[S].arm : st.proprioception[S].leg;
    if (ref.property === 'arm.rapid-alternating') {
      /* slowed by a pyramidal weakness, or by weakness of the forearm and hand that do the turning; a weak shoulder alone
         (a myopathy) leaves it */
      const slowed = st.drift[S] || st.parkinson[S] || Math.min(st.power[S].wristExtension, st.power[S].fingerFlexion, st.power[S].elbowFlexion) <= 2 || Math.min(st.power[S].wristExtension, st.power[S].fingerFlexion) <= 3;
      if (a === 'none' && !slowed) return undefined;
      return { value: { dysdiadochokinesia: a !== 'none', slowed } };
    }
    if (limbPower <= 2) return { value: { dysmetria: 'none', intentionTremor: false, limitedByWeakness: true }, basis: `${S} ${arm ? 'arm' : 'leg'} power ${limbPower}/5` };
    if (a !== 'none') return { value: { dysmetria: a, intentionTremor: a === 'marked' } };
    if (proprio !== 'normal' && ctx.eyesClosed) return { value: { dysmetria: 'mild', intentionTremor: false }, basis: 'joint position sense lost: accurate only while watching' };
    return undefined;
  },
};
