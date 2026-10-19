import type { ExamContext } from '../model/types.ts';
import { EXAM } from '../evidence/exam.ts';
import type { Resolved, Resolver, RuntimeView } from '../engine/observe.ts';
import { orthostatic } from './body-exam.ts';
import { CIRC } from '../evidence/circulation.ts';

/* ===========================================================================
   Cardiovascular examination model.

   Turns a circulation snapshot (the closed-loop model's beat metrics and
   valve parameters) into what the hands and the stethoscope perceive. Every
   sign is a function of a model quantity, and the quantity is reported as
   the finding's basis so the debrief can show why it sounded that way.

   A stenotic aortic valve, for example: the model computes the peak
   ventricular-aortic gradient; the murmur's grade follows the gradient and
   the forward stroke volume, A2 softens and S2 becomes single as the
   gradient rises, the carotid upstroke becomes slow-rising, and a pressure-
   loaded ventricle gives a heaving apex and an S4 heard with the bell.

   Auscultation depends on where and how one listens: site, bell or
   diaphragm, position and respiration. Low-pitched sounds (S3, S4, mitral
   stenosis) need the bell; aortic regurgitation is loudest sitting forward
   in held expiration; mitral stenosis with the patient turned to the left.
=========================================================================== */

type Murmur = { valve: string; timing: string; shape: string; grade: number; pitch: string };

interface Hemodynamics {
  hr: number; sys: number; dia: number; pp: number; map: number; sv: number;
  gradient: number; pvPeak: number; edv: number; cvp: number; la: number;
  regAortic: number; regMitral: number; regTricuspid: number; rMitral: number; regurgFraction: number;
  /** mean diastolic gradient across the mitral valve, and whether the valve is narrowed at all */
  mitralGradient: number; mitralNarrowed: boolean;
  af: boolean;
}

function hemo(view: RuntimeView): Hemodynamics | undefined {
  const c = view.circulation;
  if (!c) return undefined;
  const m = c.metricsBreath ?? c.metrics ?? c;
  const n = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
  return {
    hr: n(m.HRbeat, n(c.HR, 72)), sys: n(m.Psys, 120), dia: n(m.Pdia, 75), pp: n(m.PP, n(m.Psys, 120) - n(m.Pdia, 75)),
    map: n(m.Pmean, 90), sv: n(m.SV, 70), gradient: n(m.aorticGradient, 0), pvPeak: n(m.PvPeak, 125),
    edv: n(m.EDV, 120), cvp: n(m.CVPmean, n(c.CVP, 4)), la: n(m.PlaMean, n(c.Pla, 8)),
    regAortic: n(c.regAortic, 0), regMitral: n(c.regMitral, 0), regTricuspid: n(c.regTricuspid, 0),
    rMitral: n(c.Rmitral, 0.01), regurgFraction: n(m.regurgFraction, 0),
    mitralGradient: n(m.mitralMeanGradient, 0), mitralNarrowed: n(c.Rmitral, CIRC.Rmitral) > CIRC.Rmitral * 1.2,
    af: typeof c.pathology === 'string' && /fib|af\b/i.test(c.pathology),
  };
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/* Mitral stenosis is heard by what the valve does to the flow, not by its resistance: a narrowed valve whose mean
   diastolic gradient passes the audible threshold snaps open, shuts loudly (S1, from wide open) and makes a rumble that
   grows with the gradient (Bonow's grades). A gradient from flow alone through a normal valve (regurgitation, a fast
   rate) is not mitral stenosis. The model's valve is always pliable: calcification, which silences the snap and S1, is
   not modelled. */
const msAudible = (h: Hemodynamics) => h.mitralNarrowed && h.mitralGradient >= EXAM.msAudibleGradient;

/** Murmur grades at their loudest, before site attenuation. */
function sourceMurmurs(h: Hemodynamics, ctx: ExamContext): Array<Murmur & { loudestAt: string[]; radiates: string[] }> {
  const out: Array<Murmur & { loudestAt: string[]; radiates: string[] }> = [];
  if (h.gradient >= 12) {
    let grade = Math.round(1 + h.gradient / 25);
    if (h.sv < 45) grade -= 1;   // low flow, softer murmur for the same valve
    out.push({ valve: 'aortic', timing: 'ejection-systolic', shape: 'crescendo-decrescendo', grade: clamp(grade, 1, 5), pitch: 'medium',
      loudestAt: ['chest.aortic-area'], radiates: ['neck.carotid', 'chest.erb', 'chest.pulmonary-area', 'chest.mitral-area'] });
  }
  if (h.regMitral > 0.05) {
    out.push({ valve: 'mitral', timing: 'pansystolic', shape: 'plateau', grade: clamp(Math.round(1 + h.regurgFraction * 8), 1, 5), pitch: 'high',
      loudestAt: ['chest.mitral-area'], radiates: ['chest.axilla'] });
  }
  if (h.regAortic > 0.05) {
    const best = ctx.position === 'sitting-forward' && ctx.respiration === 'held-expiration';
    out.push({ valve: 'aortic', timing: 'early-diastolic', shape: 'decrescendo', grade: clamp(Math.round(1 + h.regurgFraction * 6) - (best ? 0 : 1), 1, 4), pitch: 'high',
      loudestAt: ['chest.erb', 'chest.tricuspid-area'], radiates: ['chest.aortic-area'] });
  }
  if (msAudible(h) && ctx.instrument === 'stethoscope-bell') {
    const best = ctx.position === 'left-lateral';
    const g = h.mitralGradient, base = g >= EXAM.msSevereGradient ? 3 : g >= EXAM.msModerateGradient ? 2 : 1;
    out.push({ valve: 'mitral', timing: 'mid-diastolic', shape: 'decrescendo', grade: clamp(base - (best ? 0 : 1), 1, 4), pitch: 'low',
      loudestAt: ['chest.mitral-area'], radiates: [] });
  }
  return out;
}

function siteOf(ctx: ExamContext) {
  const site = ctx.site ?? 'chest.aortic-area';
  return site.replace(/\.(L|R)$/, '');
}

export function heartSounds(h: Hemodynamics, ctx: ExamContext) {
  const site = siteOf(ctx);
  const murmurs: Murmur[] = [];
  for (const m of sourceMurmurs(h, ctx)) {
    const drop = m.loudestAt.includes(site) ? 0 : m.radiates.includes(site) ? 1 : 3;
    const grade = m.grade - drop;
    if (grade >= 1) {
      // Gallavardin: at the apex the aortic murmur loses its harshness and sounds higher.
      const pitch = m.valve === 'aortic' && m.timing === 'ejection-systolic' && site === 'chest.mitral-area' ? 'high' : m.pitch;
      murmurs.push({ valve: m.valve, timing: m.timing, shape: m.shape, grade, pitch });
    }
  }
  const a2 = h.gradient >= 90 ? 'absent' : h.gradient >= 60 ? 'soft' : 'normal';
  const s2Split = h.gradient >= 60 ? 'single' : 'physiological';
  const added: string[] = [];
  const bellAtApex = ctx.instrument === 'stethoscope-bell' && site === 'chest.mitral-area';
  if (bellAtApex && h.pvPeak >= 160) added.push('s4');           // atrial kick into a pressure-loaded ventricle
  if (bellAtApex && h.edv >= 180 && h.la >= 18) added.push('s3');  // rapid filling of a dilated, high-pressure ventricle
  if (msAudible(h) && site === 'chest.mitral-area') added.push('opening-snap');
  return {
    s1: msAudible(h) ? 'loud' : 'normal',
    a2, p2: h.la >= 25 ? 'loud' : 'normal', s2Split, added, murmurs,
  };
}

const r = Math.round;

/* ---- read from the beats themselves (the circulation's beat log: each beat's interval and waves) ----------------- */
type LoggedBeat = { rr: number; ven?: { mean: number; a: number | null; aClosed: number | null; x: number; v: number; y: number } };
const recentBeats = (view: RuntimeView, n: number): LoggedBeat[] => ((view.circulation?.beatLog ?? []) as LoggedBeat[]).filter((b) => b.rr > 0).slice(-n);

/** The rhythm a finger on the pulse feels, from the intervals of the last beats. Regular when they vary by less than
    EXAM.pulseIrregularCv; regularly irregular when the intervals fall into two tight groups that repeat (a dropped beat
    in a pattern, bigeminy); irregularly irregular otherwise (atrial fibrillation). */
export function rhythmOf(view: RuntimeView): 'regular' | 'regularly-irregular' | 'irregularly-irregular' | undefined {
  const rr = recentBeats(view, 12).map((b) => b.rr);
  if (rr.length < 6) return undefined;
  const mean = rr.reduce((a, b) => a + b, 0) / rr.length;
  const cv = Math.sqrt(rr.reduce((a, b) => a + (b - mean) ** 2, 0) / rr.length) / mean;
  if (cv < EXAM.pulseIrregularCv) return 'regular';
  /* two tight groups: split at the largest gap in the sorted intervals, each group within its own tolerance */
  const s = [...rr].sort((a, b) => a - b);
  let cut = 1;
  for (let i = 1; i < s.length; i++) if (s[i] - s[i - 1] > s[cut] - s[cut - 1]) cut = i;
  const tight = (g: number[]) => { const m = g.reduce((a, b) => a + b, 0) / g.length; return g.every((x) => Math.abs(x - m) <= EXAM.pulseIrregularCv * m); };
  return tight(s.slice(0, cut)) && tight(s.slice(cut)) ? 'regularly-irregular' : 'irregularly-irregular';
}

/** The venous waveform the eye reads in the neck, from the last beats' right atrial pressure. In health the a wave is the
    tallest. Cannon a waves: the atrium contracting against a shut tricuspid valve (ventricle contracting at the same time)
    makes a wave taller than the v wave, on any of the recent beats. Absent a: no atrial contraction wave on any.
    Large v: the v wave taller than the a wave (a leaking tricuspid valve fills the atrium in systole). */
export function jvpWaveform(view: RuntimeView): { form: 'normal' | 'cannon-a' | 'absent-a' | 'large-v'; basis: string } | undefined {
  const bs = recentBeats(view, 8).filter((b) => b.ven);
  if (bs.length < 4) return undefined;
  const f = (x: number) => x.toFixed(1);
  const cannon = bs.filter((b) => b.ven!.aClosed != null && b.ven!.aClosed > b.ven!.v);
  if (cannon.length) {
    const b = cannon[cannon.length - 1].ven!;
    return { form: 'cannon-a', basis: `atrium contracting against a shut tricuspid valve on ${cannon.length} of ${bs.length} beats (a ${f(b.aClosed!)} mmHg, v ${f(b.v)})` };
  }
  if (bs.every((b) => b.ven!.a == null)) return { form: 'absent-a', basis: 'no atrial contraction wave in the last beats' };
  const withA = bs.filter((b) => b.ven!.a != null);
  const vOverA = withA.filter((b) => b.ven!.v > b.ven!.a!).length;
  if (vOverA > withA.length / 2) return { form: 'large-v', basis: `v wave taller than a on ${vOverA} of ${withA.length} beats` };
  return { form: 'normal', basis: `a wave tallest (a ${f(withA.at(-1)!.ven!.a!)}, v ${f(withA.at(-1)!.ven!.v)} mmHg)` };
}

export const CARDIO_RESOLVERS: Record<string, Resolver> = {
  'circulation.hr': (view, _ref, ctx): Resolved | undefined => {
    const h = hemo(view); if (!h) return undefined;
    if (ctx.position === 'standing' && view.body) { const o = orthostatic(view); return { value: r(h.hr + o.dHR), basis: `beat-to-beat rate ${h.hr.toFixed(0)}/min lying; ${o.basis}` }; }
    return { value: r(h.hr), basis: `beat-to-beat rate ${h.hr.toFixed(0)}/min` };
  },
  'circulation.bp': (view, _ref, ctx): Resolved | undefined => {
    const h = hemo(view); if (!h) return undefined;
    if (ctx.position === 'standing' && view.body) {
      const o = orthostatic(view);
      const sys = r(h.sys + o.dSys), dia = Math.min(r(h.dia + o.dDia), sys - 8);
      return { value: { systolic: sys, diastolic: dia }, basis: `lying ${h.sys.toFixed(0)}/${h.dia.toFixed(0)} mmHg; ${o.basis}` };
    }
    return { value: { systolic: r(h.sys), diastolic: r(h.dia) }, basis: `aortic pressure ${h.sys.toFixed(0)}/${h.dia.toFixed(0)}, mean ${h.map.toFixed(0)} mmHg` };
  },
  'circulation.pulse': (view, ref): Resolved | undefined => {
    const h = hemo(view); if (!h) return undefined;
    const carotid = ref.property === 'pulse.carotid';
    const volume = h.pp < 30 || h.sv < 40 ? 'low' : h.pp > 70 ? 'high' : 'normal';
    let character = 'normal';
    if (h.regAortic > 0.05 && h.regurgFraction >= 0.3 && h.pp >= 60) character = 'collapsing';
    else if (carotid && h.gradient >= 40) character = 'slow-rising';   // the upstroke is judged at the carotid
    else if (h.sv < 35) character = 'thready';
    return {
      value: { rate: r(h.hr), rhythm: rhythmOf(view) ?? (h.af ? 'irregularly-irregular' : 'regular'), volume, character },
      basis: `pulse pressure ${h.pp.toFixed(0)} mmHg, stroke volume ${h.sv.toFixed(0)} mL, aortic gradient ${h.gradient.toFixed(0)} mmHg`,
    };
  },
  'circulation.jvp': (view): Resolved | undefined => {
    const h = hemo(view); if (!h) return undefined;
    const heightCm = Math.round((h.cvp * 1.36 - EXAM.jvpSternalOffset) * 2) / 2;   // cmH2O above the right atrium, minus ~5 cm to the sternal angle
    const w = jvpWaveform(view);
    return { value: { heightCm, waveform: w?.form ?? 'normal' }, basis: `mean right atrial pressure ${h.cvp.toFixed(1)} mmHg${w ? `; ${w.basis}` : ''}` };
  },
  'circulation.apex': (view): Resolved | undefined => {
    const h = hemo(view); if (!h) return undefined;
    const position = h.edv >= 200 ? 'inferolateral' : h.edv >= 170 ? 'lateral' : 'normal';
    const character = h.pvPeak >= 160 ? 'heaving' : h.edv >= 170 ? 'diffuse' : 'normal';
    return { value: { position, character }, basis: `peak LV pressure ${h.pvPeak.toFixed(0)} mmHg, end-diastolic volume ${h.edv.toFixed(0)} mL` };
  },
  'circulation.heart-sounds': (view, _ref, ctx): Resolved | undefined => {
    const h = hemo(view); if (!h) return undefined;
    const v = heartSounds(h, ctx);
    const site = siteOf(ctx);
    // Over the carotid one hears only transmitted murmurs and bruits.
    if (site === 'neck.carotid') return { value: { murmurs: v.murmurs }, normal: v.murmurs.length === 0, basis: `aortic gradient ${h.gradient.toFixed(0)} mmHg` };
    return { value: v, basis: `aortic gradient ${h.gradient.toFixed(0)} mmHg, stroke volume ${h.sv.toFixed(0)} mL, peak LV pressure ${h.pvPeak.toFixed(0)} mmHg` };
  },
  'circulation.lungs': (view, _ref, ctx): Resolved | undefined => {
    const h = hemo(view); if (!h) return undefined;
    const base = (ctx.site ?? '').startsWith('chest.lung-base');
    if (h.la >= 28 || (base && h.la >= 20)) return { value: { breath: 'vesicular', added: ['fine-crackles'] }, basis: `left atrial pressure ${h.la.toFixed(0)} mmHg` };
    return undefined;
  },
  'circulation.echo': (view): Resolved | undefined => {
    const h = hemo(view); if (!h) return undefined;
    const ef = (view.circulation?.metricsBreath ?? view.circulation?.metrics)?.EF ?? 60;
    const sev = (x: number) => (x > 0.4 ? 'marked' : x > 0.15 ? 'mild' : 'none');
    return { value: { ef: r(ef), aorticPeakGradient: r(h.gradient), aorticRegurgitation: sev(h.regAortic ? h.regurgFraction : 0), mitralRegurgitation: sev(h.regMitral ? h.regurgFraction : 0) } };
  },
  'circulation.crt': (view): Resolved | undefined => {
    const h = hemo(view); if (!h) return undefined;
    /* In vasodilatory (septic) shock the skin vessels are open too: warm peripheries and a brisk refill, until late. */
    const warm = (view.body?.vasoplegia ?? 0) > 0.35;
    const normal = view.patient.age >= 65 ? EXAM.crtNormalOld : view.patient.sex === 'F' ? EXAM.crtNormalWoman : EXAM.crtNormalMan;   // Schriger & Baraff
    const crt = h.map < 50 ? EXAM.crtProfound : h.map < 65 ? (warm ? Math.max(normal, 1.5) : EXAM.crtShock) : normal;
    return { value: crt, basis: `mean arterial pressure ${h.map.toFixed(0)} mmHg${warm ? '; skin vessels dilated by sepsis' : ''}` };
  },
  'circulation.oedema': (view): Resolved | undefined => {
    const h = hemo(view); if (!h) return undefined;
    /* Oedema is interstitial fluid gained (2–3 L before it pits at the ankle), pushed out by venous pressure or held by too little albumin. */
    const isf = (view.body?.dISF ?? 0) - (view.body?.ascites ?? 0);   // ascites is interstitial fluid in the peritoneum, not the legs
    const scale = Math.max(0.6, (view.patient.weightKg ?? 70) / 70);
    const byIsf = isf >= 7 * scale ? 3 : isf >= 4.5 * scale ? 2 : isf >= EXAM.oedemaAnkle * scale ? 1 : 0;
    const byCvp = h.cvp >= 16 ? 3 : h.cvp >= 13 ? 2 : h.cvp >= 10 ? 1 : 0;
    const g = Math.max(byIsf, byCvp);
    if (!g) return undefined;
    return { value: { extent: ['none', 'ankle', 'shin', 'knee'][g] }, basis: `interstitial fluid ${isf >= 0 ? '+' : ''}${isf.toFixed(1)} L; mean right atrial pressure ${h.cvp.toFixed(1)} mmHg` };
  },
  'general.appearance': (view): Resolved | undefined => {
    const h = hemo(view); if (!h) return undefined;
    /* Fever: the skin flushed and sweating as heat is shed (or pale and shivering while the set point is still being climbed). */
    const T = view.body?.temperature ?? 37;
    if (h.map >= 60 && T >= EXAM.feverFlush) return { value: { distress: 'mild', colour: 'flushed', sweating: true }, basis: `core temperature ${T.toFixed(1)} °C` };
    /* Thyrotoxicosis: heat produced faster than it can be lost, shed through warm, flushed, sweating skin. */
    const thy = view.body?.thyroidEffect ?? 1;
    if (h.map >= 60 && thy >= 1.8) return { value: { distress: 'mild', colour: 'flushed', sweating: true }, basis: `thyroid hormone action ×${thy.toFixed(2)}: metabolic rate ×${(view.body?.metabolicMult ?? 1).toFixed(2)}` };
    if (h.map >= 60) return undefined;   // the case layer describes a well-perfused patient
    if ((view.body?.vasoplegia ?? 0) > 0.35) return { value: { distress: 'moderate', colour: 'flushed', sweating: true }, basis: `mean arterial pressure ${h.map.toFixed(0)} mmHg with dilated skin vessels (sepsis)` };
    return { value: { distress: 'moderate', colour: 'pale', sweating: true }, basis: `mean arterial pressure ${h.map.toFixed(0)} mmHg` };
  },
};
