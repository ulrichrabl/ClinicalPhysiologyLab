import type { ExamContext } from '../model/types.ts';
import type { Resolved, Resolver, RuntimeView } from '../engine/observe.ts';
import { orthostatic } from './body-exam.ts';

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
  af: boolean;
}

function hemo(view: RuntimeView): Hemodynamics | undefined {
  const c = view.circulation;
  if (!c) return undefined;
  const m = c.metrics ?? c;
  const n = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
  return {
    hr: n(m.HRbeat, n(c.HR, 72)), sys: n(m.Psys, 120), dia: n(m.Pdia, 75), pp: n(m.PP, n(m.Psys, 120) - n(m.Pdia, 75)),
    map: n(m.Pmean, 90), sv: n(m.SV, 70), gradient: n(m.aorticGradient, 0), pvPeak: n(m.PvPeak, 125),
    edv: n(m.EDV, 120), cvp: n(m.CVPmean, n(c.CVP, 4)), la: n(m.PlaMean, n(c.Pla, 8)),
    regAortic: n(c.regAortic, 0), regMitral: n(c.regMitral, 0), regTricuspid: n(c.regTricuspid, 0),
    rMitral: n(c.Rmitral, 0.01), regurgFraction: n(m.regurgFraction, 0),
    af: typeof c.pathology === 'string' && /fib|af\b/i.test(c.pathology),
  };
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

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
  if (h.rMitral > 0.05 && ctx.instrument === 'stethoscope-bell') {
    const best = ctx.position === 'left-lateral';
    out.push({ valve: 'mitral', timing: 'mid-diastolic', shape: 'decrescendo', grade: clamp(Math.round(h.rMitral * 20) - (best ? 0 : 1), 1, 4), pitch: 'low',
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
  if (h.rMitral > 0.05 && site === 'chest.mitral-area') added.push('opening-snap');
  return {
    s1: h.rMitral > 0.05 ? 'loud' : 'normal',
    a2, p2: h.la >= 25 ? 'loud' : 'normal', s2Split, added, murmurs,
  };
}

const r = Math.round;

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
      value: { rate: r(h.hr), rhythm: h.af ? 'irregularly-irregular' : 'regular', volume, character },
      basis: `pulse pressure ${h.pp.toFixed(0)} mmHg, stroke volume ${h.sv.toFixed(0)} mL, aortic gradient ${h.gradient.toFixed(0)} mmHg`,
    };
  },
  'circulation.jvp': (view): Resolved | undefined => {
    const h = hemo(view); if (!h) return undefined;
    const heightCm = Math.round((h.cvp * 1.36 - 5) * 2) / 2;   // cmH2O above the right atrium, minus ~5 cm to the sternal angle
    return { value: { heightCm, waveform: h.regTricuspid > 0.2 ? 'large-v' : 'normal' }, basis: `mean right atrial pressure ${h.cvp.toFixed(1)} mmHg` };
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
    const ef = view.circulation?.metrics?.EF ?? 60;
    const sev = (x: number) => (x > 0.4 ? 'marked' : x > 0.15 ? 'mild' : 'none');
    return { value: { ef: r(ef), aorticPeakGradient: r(h.gradient), aorticRegurgitation: sev(h.regAortic ? h.regurgFraction : 0), mitralRegurgitation: sev(h.regMitral ? h.regurgFraction : 0) } };
  },
  'circulation.crt': (view): Resolved | undefined => {
    const h = hemo(view); if (!h) return undefined;
    /* In vasodilatory (septic) shock the skin vessels are open too: warm peripheries and a brisk refill, until late. */
    const warm = (view.body?.vasoplegia ?? 0) > 0.35;
    const crt = h.map < 50 ? 5 : h.map < 65 ? (warm ? 2 : 3.5) : 2;
    return { value: crt, basis: `mean arterial pressure ${h.map.toFixed(0)} mmHg${warm ? '; skin vessels dilated by sepsis' : ''}` };
  },
  'circulation.oedema': (view): Resolved | undefined => {
    const h = hemo(view); if (!h) return undefined;
    /* Oedema is interstitial fluid gained (2–3 L before it pits at the ankle), pushed out by venous pressure or held by too little albumin. */
    const isf = (view.body?.dISF ?? 0) - (view.body?.ascites ?? 0);   // ascites is interstitial fluid in the peritoneum, not the legs
    const scale = Math.max(0.6, (view.patient.weightKg ?? 70) / 70);
    const byIsf = isf >= 7 * scale ? 3 : isf >= 4.5 * scale ? 2 : isf >= 2.5 * scale ? 1 : 0;
    const byCvp = h.cvp >= 16 ? 3 : h.cvp >= 13 ? 2 : h.cvp >= 10 ? 1 : 0;
    const g = Math.max(byIsf, byCvp);
    if (!g) return undefined;
    return { value: { extent: ['none', 'ankle', 'shin', 'knee'][g] }, basis: `interstitial fluid ${isf >= 0 ? '+' : ''}${isf.toFixed(1)} L; mean right atrial pressure ${h.cvp.toFixed(1)} mmHg` };
  },
  'general.appearance': (view): Resolved | undefined => {
    const h = hemo(view); if (!h) return undefined;
    /* Fever: the skin flushed and sweating as heat is shed (or pale and shivering while the set point is still being climbed). */
    const T = view.body?.temperature ?? 37;
    if (h.map >= 60 && T >= 38.3) return { value: { distress: 'mild', colour: 'flushed', sweating: true }, basis: `core temperature ${T.toFixed(1)} °C` };
    if (h.map >= 60) return undefined;   // the case layer describes a well-perfused patient
    if ((view.body?.vasoplegia ?? 0) > 0.35) return { value: { distress: 'moderate', colour: 'flushed', sweating: true }, basis: `mean arterial pressure ${h.map.toFixed(0)} mmHg with dilated skin vessels (sepsis)` };
    return { value: { distress: 'moderate', colour: 'pale', sweating: true }, basis: `mean arterial pressure ${h.map.toFixed(0)} mmHg` };
  },
};
