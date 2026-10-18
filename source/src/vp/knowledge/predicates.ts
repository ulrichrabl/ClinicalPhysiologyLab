import type { Catalog } from '../data/catalog.ts';
import type { ExamContext, Finding, ManoeuvreDef, Side } from '../model/types.ts';
import type { Clause, NamedPredicate, SignDefinition } from './types.ts';

/* ===========================================================================
   Evaluating sign definitions (ADR-016).

   A definition is read against what an examiner could observe: every context
   in which some test reveals the observable, merged with the context the
   definition asks for. `holds` answers true, false, or undefined when the
   definition cannot be decided here (it needs an intervention, such as oxygen,
   that the observation does not include).

   Patterns a threshold cannot express are named predicates, written below and
   referred to by id from the tables, as resolvers are from the catalog.
=========================================================================== */

export type Observer = (ref: string, ctx: ExamContext) => Finding;

/** One observation of an observable: its side (paired or sided by site), context and value. */
export interface Row { side?: Side; ctx: ExamContext; value: any; normal: boolean; provenance: Finding['provenance'] }

const SIDES: Side[] = ['L', 'R'];

/** A context the definition asks for. A list means "any of these, or left as the patient is" (resting signs: not standing). */
export type WantedContext = { [K in keyof ExamContext]?: ExamContext[K] | Array<NonNullable<ExamContext[K]>> };

/** Whether a test's context fits what a definition asks for. */
export function contextFits(base: Record<string, unknown>, want: WantedContext): boolean {
  return Object.entries(want).every(([k, v]) => (Array.isArray(v) ? !(k in base) || v.includes(base[k] as never) : !(k in base) || base[k] === v));
}

/** Restrict observation to what one test, done on one side (if any), reveals: the findings of that test alone. */
export interface OnlyTest { test: string; side?: Side }

/** The refs and contexts an examiner can observe `obs` in, restricted to (and merged with) `want`. */
export function contextsFor(cat: Catalog, obs: string, wanted: WantedContext = {}, only?: OnlyTest): Array<{ ref: string; side?: Side; ctx: ExamContext }> {
  const want = Object.fromEntries(Object.entries(wanted).filter(([, v]) => !Array.isArray(v))) as ExamContext;
  const pd = cat.properties[obs];
  if (!pd) throw new Error(`unknown observable ${obs}`);
  const out: Array<{ ref: string; side?: Side; ctx: ExamContext }> = [];
  const seen = new Set<string>();
  const push = (ref: string, side: Side | undefined, ctx: ExamContext) => {
    const k = ref + JSON.stringify(ctx);
    if (!seen.has(k)) { seen.add(k); out.push({ ref, side, ctx }); }
  };
  const addSides = (m: ManoeuvreDef | undefined, ctx: ExamContext) => {
    const sideCtx = (S: Side): ExamContext => {
      const c: Record<string, unknown> = { ...ctx };
      for (const k of m?.sideContext ?? []) if (!(k in (want as object))) c[k] = S;
      return c as ExamContext;
    };
    const sides = only?.side ? [only.side] : SIDES;
    if (pd.paired) { for (const S of sides) push(`${obs}.${S}`, S, m?.sideContext?.length ? sideCtx(S) : ctx); return; }
    if (m?.paired && ctx.site) { for (const S of sides) push(obs, S, { ...ctx, site: `${ctx.site}.${S}` }); return; }
    if (m?.paired && m.sideContext?.length) { for (const S of sides) push(obs, undefined, sideCtx(S)); return; }
    /* Asked for one side, an observation without sides says nothing about that side. */
    if (only?.side && !m?.paired) return;
    push(obs, undefined, ctx);
  };
  for (const m of Object.values(cat.manoeuvres)) for (const r of m.reveals ?? []) {
    if (r.property !== obs || (only && m.id !== only.test)) continue;
    const base = { ...(m.context ?? {}), ...(r.context ?? {}) } as Record<string, unknown>;
    if (!contextFits(base, wanted)) continue;
    addSides(m, { ...base, ...want } as ExamContext);
  }
  /* An investigation whose result a reader looks at (the ECG's tracing) reveals its observables too, in no context. */
  for (const inv of Object.values(cat.investigations)) for (const r of inv.reveals ?? []) {
    if (r.property !== obs || (only && inv.id !== only.test)) continue;
    if (!only?.side) push(obs, undefined, { ...want });
  }
  if (!out.length && !only) addSides(undefined, want);
  return out;
}

export function getPath(v: unknown, path?: string): unknown {
  if (!path) return v;
  let x: any = v;
  for (const k of path.split('.')) { if (x == null || typeof x !== 'object') return undefined; x = x[k]; }
  return x;
}

function compare(op: Clause['op'], a: any, b: any): boolean {
  if (a === undefined || a === null) return false;
  switch (op) {
    case 'eq': return a === b;
    case 'ne': return a !== b;
    case 'in': return Array.isArray(b) && b.includes(a);
    case 'gt': return a > b;
    case 'ge': return a >= b;
    case 'lt': return a < b;
    case 'le': return a <= b;
    case 'has': return Array.isArray(a) && a.includes(b);
    case 'hasWhere': return Array.isArray(a) && a.some((i) => i && Object.entries(b ?? {}).every(([k, x]) => i[k] === x));
    default: return false;
  }
}

/** Reads one patient (one case and its runtime view) and decides sign definitions on it. */
export class SignEvaluator {
  private cache = new Map<string, Row[]>();
  /** `only`: read just what one test (on one side) reveals, to name the signs that test found. */
  constructor(readonly cat: Catalog, private observe: Observer, readonly only?: OnlyTest) {}

  rows(obs: string, want: WantedContext = {}): Row[] {
    const key = obs + JSON.stringify(want);
    let rs = this.cache.get(key);
    if (!rs) {
      rs = contextsFor(this.cat, obs, want, this.only).map(({ ref, side, ctx }) => {
        const f = this.observe(ref, ctx);
        return { side, ctx, value: f.value, normal: f.normal, provenance: f.provenance };
      });
      this.cache.set(key, rs);
    }
    return rs;
  }

  clause(c: Clause): boolean {
    const hit = this.rows(c.obs, c.ctx).filter((r) => (c.op === 'abnormal' ? !r.normal : compare(c.op, getPath(r.value, c.path), c.value)));
    const sides = new Set(hit.map((r) => r.side));
    if (c.side === 'one') return hit.length > 0 && sides.size === 1 && !sides.has(undefined);
    if (c.side === 'both') return sides.has('L') && sides.has('R');
    return hit.length > 0;
  }

  holds(d: SignDefinition): boolean | undefined {
    if ('all' in d) {
      const r = d.all.map((x) => this.holds(x));
      return r.includes(false) ? false : r.includes(undefined) ? undefined : true;
    }
    if ('any' in d) {
      const r = d.any.map((x) => this.holds(x));
      return r.includes(true) ? true : r.includes(undefined) ? undefined : false;
    }
    if ('not' in d) { const r = this.holds(d.not); return r === undefined ? undefined : !r; }
    if ('fn' in d) {
      const p = NAMED[d.fn];
      if (!p) throw new Error(`unknown named predicate ${d.fn}`);
      return p.holds(this, d.args ?? {});
    }
    return this.clause(d);
  }
}

/* ---- named predicates ------------------------------------------------------------- */

export interface NamedPredicateDef {
  /** The observables it reads (for validation, for deriving the tests that elicit a sign, and for coverage). */
  uses: (args: Record<string, any>) => string[];
  holds: (h: SignEvaluator, args: Record<string, any>) => boolean | undefined;
  /** What the evaluation needs that plain observation does not supply. */
  needs?: string;
  /** The contexts it must observe in, when they matter for which test can elicit it (default: any context). */
  observes?: (args: Record<string, any>) => Array<{ obs: string; ctx: WantedContext }>;
  what: string;
}

/** Resting: as the patient lies or sits, or lying for the test; never the standing half of the lying-and-standing test. */
const resting: WantedContext = { position: ['supine', 'reclined-45', 'sitting'] };
const bp = (h: SignEvaluator) => h.rows('vitals.bp', resting).map((r) => r.value as { systolic: number; diastolic: number });
const restingPower = (h: SignEvaluator, obs: string) => h.rows(obs).filter((r) => !r.ctx.repetition);
const bySide = (rows: Row[]) => Object.fromEntries(rows.filter((r) => r.side).map((r) => [r.side, r.value])) as Record<Side, any>;
const nys = (h: SignEvaluator, want: ExamContext) => h.rows('eyes.nystagmus', want).map((r) => r.value).filter((v) => v.present && !v.physiological);
const spv = (vs: any[]) => Math.max(0, ...vs.map((v) => v.spvDegPerS ?? 0));
const LOST = ['reduced', 'absent', 'lost'];
const ARM_ROOTS = ['C5', 'C6', 'C7', 'C8', 'T1'], LEG_ROOTS = ['L2', 'L3', 'L4', 'L5', 'S1'];

function ctxDelta(h: SignEvaluator, a: Record<string, any>): boolean {
  const to = (a.to ?? {}) as ExamContext;
  const fromRows = h.rows(a.obs, a.from ?? {}).filter((r) => !Object.entries(to).every(([k, v]) => (r.ctx as any)[k] === v));
  const toRows = h.rows(a.obs, to);
  return fromRows.some((x) => toRows.some((y) => {
    if (x.side && y.side && x.side !== y.side) return false;
    const vx = getPath(x.value, a.path) as number | undefined, vy = getPath(y.value, a.path) as number | undefined;
    return typeof vx === 'number' && typeof vy === 'number' && compare(a.op, vy - vx, a.value);
  }));
}

function sideDiff(h: SignEvaluator, obs: string, path: string, ctx: ExamContext): number | undefined {
  const s = bySide(h.rows(obs, ctx));
  const l = getPath(s.L, path), r = getPath(s.R, path);
  return typeof l === 'number' && typeof r === 'number' ? Math.abs(l - r) : undefined;
}

function weakMuscles(v: Record<string, number>): string[] { return Object.entries(v).filter(([, x]) => x < 5).map(([k]) => k); }

/* ECG leads that look at the same wall: a change in two of them is a change in that wall (Thygesen 2018). */
const CONTIGUOUS: Array<[string, string]> = [['II', 'III'], ['II', 'aVF'], ['III', 'aVF'], ['I', 'aVL'], ['V1', 'V2'], ['V2', 'V3'], ['V3', 'V4'], ['V4', 'V5'], ['V5', 'V6'], ['I', 'V6']];
const RBBB_V1 = ['rsR′', 'RsR′'];
function ecgContiguous(h: SignEvaluator, a: Record<string, any>): boolean {
  return h.rows('ecg.reading').some((r) => {
    const v = r.value as Record<string, any>;
    /* With a broad QRS other than right bundle branch block (left bundle branch block, a ventricular rhythm) ST and T
       follow the abnormal depolarisation, and these criteria do not apply. */
    if (a.unlessBroadNonRbbb && v.qrs >= 120 && !RBBB_V1.includes(v.v1)) return false;
    const vals = v[a.field] as Record<string, number> | undefined;
    if (!vals) return false;
    const exclude = new Set<string>(a.exclude ?? []);
    const meets = (lead: string) => {
      if (exclude.has(lead)) return false;
      const x = vals[lead], lim = (lead === 'V2' || lead === 'V3') && a.v2v3 != null ? a.v2v3 : a.value;
      return typeof x === 'number' && compare(a.op, x, lim);
    };
    return CONTIGUOUS.some(([p, q]) => meets(p) && meets(q));
  });
}

export const NAMED: Record<string, NamedPredicateDef> = {
  ecgContiguous: {
    what: 'In two contiguous ECG leads, `field` (st or t, mV) compares by `op` with `value` (`v2v3` in V2 and V3), leaving out the leads in `exclude`; with `unlessBroadNonRbbb`, not when QRS is broad for a reason other than right bundle branch block.',
    uses: () => ['ecg.reading'], holds: ecgContiguous,
  },
  ecgAnyLead: {
    what: 'In any ECG lead of `leads`, `field` (st or t, mV) compares by `op` with `value`.',
    uses: () => ['ecg.reading'],
    holds: (h, a) => h.rows('ecg.reading').some((r) => (a.leads as string[]).some((l) => typeof r.value?.[a.field]?.[l] === 'number' && compare(a.op, r.value[a.field][l], a.value))),
  },
  meanPressureBelow: {
    what: 'Mean arterial pressure at rest below `value` mmHg.',
    uses: () => ['vitals.bp'], holds: (h, a) => bp(h).some((v) => (v.systolic + 2 * v.diastolic) / 3 < a.value),
  },
  pulsePressureAtLeast: {
    what: 'Pulse pressure at rest at least `value` mmHg.',
    uses: () => ['vitals.bp'], holds: (h, a) => bp(h).some((v) => v.systolic - v.diastolic >= a.value),
  },
  pulsePressureBelowFraction: {
    what: 'Pulse pressure at rest below the fraction `value` of the systolic pressure.',
    uses: () => ['vitals.bp'], holds: (h, a) => bp(h).some((v) => v.systolic - v.diastolic < a.value * v.systolic),
  },
  ctxDelta: {
    what: 'The change of `obs.path` from context `from` to context `to` compares by `op` with `value` (same side).',
    uses: (a) => [a.obs], observes: (a) => [{ obs: a.obs, ctx: a.to ?? {} }], holds: ctxDelta,
  },
  sideDiff: {
    what: 'The two sides of `obs.path`, in context `ctx`, differ by at least `value`.',
    uses: (a) => [a.obs], holds: (h, a) => { const d = sideDiff(h, a.obs, a.path, a.ctx ?? {}); return d !== undefined && d >= a.value; },
  },
  spo2OnOxygenBelow: {
    what: 'Saturation below `value` % while breathing an inspired fraction of at least `fio2`.',
    needs: 'oxygen given (an intervention)',
    uses: () => ['vitals.spo2'],
    holds: (h, a) => {
      const onO2 = h.rows('vitals.spo2').map((r) => r.value).filter((v) => v.fio2 >= a.fio2);
      return onO2.length ? onO2.some((v) => v.spo2 < a.value) : undefined;
    },
  },
  anisocoriaGrowsInDim: {
    what: 'Anisocoria of at least 1 mm in dim light, larger than in room light (the small pupil is the abnormal one).',
    uses: () => ['eye.pupil'],
    holds: (h) => {
      const dim = sideDiff(h, 'eye.pupil', 'sizeMm', { ambient: 'dim', lightOn: 'none' }), room = sideDiff(h, 'eye.pupil', 'sizeMm', { ambient: 'room', lightOn: 'none' });
      return dim !== undefined && room !== undefined && dim >= 1 && dim > room;
    },
  },
  eyeDownAndOut: {
    what: 'One eye rests depressed and cannot adduct (third nerve).',
    uses: () => ['eye.motility'],
    holds: (h) => h.rows('eye.motility').some((r) => (r.value.restingDeg?.vertical ?? 0) < 0 && (r.value.adduction ?? 100) < 50),
  },
  nystagmusPeripheral: {
    what: 'Pathological nystagmus in primary gaze beating one way only, horizontal, stronger without fixation.',
    uses: () => ['eyes.nystagmus'],
    holds: (h) => {
      const all = nys(h, { gaze: 'primary' }), fix = nys(h, { gaze: 'primary', fixation: true }), nofix = nys(h, { gaze: 'primary', fixation: false });
      const dirs = new Set(all.map((v) => v.fastPhase));
      return all.length > 0 && dirs.size === 1 && ['left', 'right'].includes(all[0].fastPhase) && nofix.length > 0 && spv(nofix) > spv(fix);
    },
  },
  nystagmusDirectionChanging: {
    what: 'Pathological nystagmus beating left on left gaze and right on right gaze (physiological end-point nystagmus excluded).',
    uses: () => ['eyes.nystagmus'],
    holds: (h) => nys(h, { gaze: 'left', fixation: true }).some((v) => v.fastPhase === 'left') && nys(h, { gaze: 'right', fixation: true }).some((v) => v.fastPhase === 'right'),
  },
  nystagmusCentral: {
    what: 'Pathological nystagmus in primary gaze that is purely vertical, or not suppressed by fixation.',
    uses: () => ['eyes.nystagmus'],
    holds: (h) => {
      const fix = nys(h, { gaze: 'primary', fixation: true }), nofix = nys(h, { gaze: 'primary', fixation: false });
      const vertical = [...fix, ...nofix].some((v) => v.fastPhase === 'up' || v.fastPhase === 'down');
      return vertical || (fix.length > 0 && nofix.length > 0 && spv(nofix) <= spv(fix));
    },
  },
  fieldHomonymous: {
    what: 'The same half of the field lost in both eyes.',
    uses: () => ['eye.field'],
    holds: (h) => {
      const f = bySide(h.rows('eye.field')), lost = (S: Side, half: string) => LOST.includes(f[S]?.[half]);
      return (lost('L', 'temporal') && lost('R', 'nasal')) || (lost('L', 'nasal') && lost('R', 'temporal'));
    },
  },
  fieldBitemporal: {
    what: 'The temporal half lost in both eyes.',
    uses: () => ['eye.field'],
    holds: (h) => { const f = bySide(h.rows('eye.field')); return SIDES.every((S) => LOST.includes(f[S]?.temporal)); },
  },
  rombergSign: {
    what: 'Steady with the eyes open; sways or falls, without a direction, with them closed.',
    uses: () => ['posture.romberg'], observes: () => [{ obs: 'posture.romberg', ctx: { eyesClosed: true } }],
    holds: (h) => h.rows('posture.romberg', { eyesClosed: false }).some((r) => r.value.stance === 'steady')
      && h.rows('posture.romberg', { eyesClosed: true }).some((r) => ['sways', 'falls'].includes(r.value.stance) && !r.value.toward),
  },
  ataxiaOnlyEyesClosed: {
    what: 'Finger–nose or heel–shin accurate with the eyes open and dysmetric with them closed.',
    uses: () => ['arm.finger-nose', 'leg.heel-shin'],
    observes: () => [{ obs: 'arm.finger-nose', ctx: { eyesClosed: true } }, { obs: 'leg.heel-shin', ctx: { eyesClosed: true } }],
    holds: (h) => ['arm.finger-nose', 'leg.heel-shin'].some((o) =>
      h.rows(o, { eyesClosed: false }).some((r) => r.value.dysmetria === 'none') && h.rows(o, { eyesClosed: true }).some((r) => r.value.dysmetria !== 'none')),
  },
  facialWeakness: {
    what: 'Lower facial weakness on one side, with (`forehead: true`) or without the forehead; or on both sides (`both: true`).',
    uses: () => ['face.movement'],
    holds: (h, a) => {
      const weak = h.rows('face.movement').filter((r) => r.value.mouth !== 'normal');
      if (a.both) return new Set(weak.map((r) => r.side)).size === 2;
      if (new Set(weak.map((r) => r.side)).size !== 1) return false;
      return weak.some((r) => (r.value.forehead !== 'normal') === !!a.forehead);
    },
  },
  pyramidalPattern: {
    what: 'Arm extensors weaker than flexors, or leg flexors weaker than extensors.',
    uses: () => ['arm.power', 'leg.power'],
    holds: (h) => restingPower(h, 'arm.power').some(({ value: v }) => Math.min(v.elbowExtension, v.wristExtension) < Math.min(v.elbowFlexion, v.fingerFlexion))
      || restingPower(h, 'leg.power').some(({ value: v }) => v.hipFlexion < 5 && Math.min(v.hipFlexion, v.ankleDorsiflexion) < Math.min(v.kneeExtension, v.anklePlantarflexion)),
  },
  symmetricalWeakness: {
    what: 'Weakness on both sides, proximal (shoulders and hips) or distal (feet).',
    uses: () => ['arm.power', 'leg.power'],
    holds: (h, a) => {
      const both = (obs: string, keys: string[]) => { const s = bySide(restingPower(h, obs)); return SIDES.every((S) => keys.some((k) => (s[S]?.[k] ?? 5) < 5)); };
      return a.distribution === 'proximal' ? both('arm.power', ['shoulderAbduction']) && both('leg.power', ['hipFlexion']) : both('leg.power', ['ankleDorsiflexion', 'anklePlantarflexion']);
    },
  },
  allReflexesAbsent: {
    what: 'Every tendon reflex in arms and legs graded 0.',
    uses: () => ['arm.reflexes', 'leg.reflexes'],
    holds: (h) => {
      const grades = ['arm.reflexes', 'leg.reflexes'].flatMap((o) => h.rows(o).flatMap((r) => Object.entries(r.value).filter(([k]) => k !== 'plantar').map(([, x]) => x)));
      return grades.length > 0 && grades.every((x) => x === 0);
    },
  },
  myotomalPattern: {
    what: 'Weakness on one side that is not pyramidal (a root or nerve pattern).',
    uses: () => ['arm.power', 'leg.power'],
    holds: (h) => {
      const weakSides = new Set(['arm.power', 'leg.power'].flatMap((o) => restingPower(h, o).filter((r) => weakMuscles(r.value).length).map((r) => r.side)));
      return weakSides.size === 1 && !NAMED.pyramidalPattern.holds(h, {});
    },
  },
  dermatomalPattern: {
    what: 'Pinprick reduced in exactly one dermatome of a limb.',
    uses: () => ['arm.pinprick', 'leg.pinprick'],
    holds: (h) => ([['arm.pinprick', ARM_ROOTS], ['leg.pinprick', LEG_ROOTS]] as const).some(([o, roots]) =>
      h.rows(o).some((r) => roots.filter((k) => LOST.includes(r.value[k])).length === 1)),
  },
  hemisensoryPattern: {
    what: 'Sensory loss on the face and the body on the same side.',
    uses: () => ['face.sensation', 'arm.pinprick', 'leg.pinprick'],
    holds: (h) => {
      const face = new Set(h.rows('face.sensation').filter((r) => !r.normal).map((r) => r.side));
      const body = new Set(['arm.pinprick', 'leg.pinprick'].flatMap((o) => h.rows(o).filter((r) => !r.normal).map((r) => r.side)));
      return [...face].some((s) => body.has(s));
    },
  },
  crossedSensoryPattern: {
    what: 'Sensory loss on the face on one side and the body on the other only.',
    uses: () => ['face.sensation', 'arm.pinprick', 'leg.pinprick'],
    holds: (h) => {
      const face = new Set(h.rows('face.sensation').filter((r) => !r.normal).map((r) => r.side));
      const body = new Set(['arm.pinprick', 'leg.pinprick'].flatMap((o) => h.rows(o).filter((r) => !r.normal).map((r) => r.side)));
      return face.size > 0 && body.size > 0 && ![...face].some((s) => body.has(s));
    },
  },
};

/** The observables a definition reads. */
export function observablesOf(d: SignDefinition | null): string[] {
  if (!d) return [];
  if ('all' in d) return [...new Set(d.all.flatMap(observablesOf))];
  if ('any' in d) return [...new Set(d.any.flatMap(observablesOf))];
  if ('not' in d) return observablesOf(d.not);
  if ('fn' in d) return NAMED[d.fn]?.uses(d.args ?? {}) ?? [];
  return [d.obs];
}

/** Clauses of a definition, with the named predicates kept whole. */
export function partsOf(d: SignDefinition | null): Array<Clause | NamedPredicate> {
  if (!d) return [];
  if ('all' in d) return d.all.flatMap(partsOf);
  if ('any' in d) return d.any.flatMap(partsOf);
  if ('not' in d) return partsOf(d.not);
  return [d];
}
