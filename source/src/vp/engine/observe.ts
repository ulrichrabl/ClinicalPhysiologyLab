import type {
  CaseDef, ContextPredicate, ExamContext, Finding, NormalSpec, PatientState, PropertyDef, Side, Valued,
} from '../model/types.ts';
import type { Catalog } from '../data/catalog.ts';
import type { RespSnapshot } from '../physiology/lung/respiratory.ts';
import type { BodySnapshot } from '../physiology/body/body.ts';

/* ---------------------------------------------------------------------------
   Observation engine.

   Answers one question: what does the learner perceive when this property is
   examined in this context, on this patient, now?

     1. model      a registered resolver reads the runtime (circulation,
                   chemistry, nervous-system graph) and returns a value
     2. case       the case layer, for what no model covers
     3. normal     the age- and sex-appropriate normal value

   Every examinable property always yields a finding. A normal finding comes
   from the same path as an abnormal one, so nothing in the answer reveals that
   a property is relevant.
--------------------------------------------------------------------------- */

/** What resolvers may read. Built by the runtime adapter; plain data in tests. */
export interface RuntimeView {
  patient: CaseDef['patient'];
  state: PatientState;
  /** Circulation snapshot (metrics, valve parameters, beat) as the cardio host emits it. */
  circulation?: Record<string, any>;
  chemistry?: Record<string, number>;
  /** The respiratory model's state: gases, mechanics, the lobes and pleura. */
  respiratory?: RespSnapshot;
  /** The internal milieu: volumes, plasma concentrations, the kidney's output, hormones. */
  body?: BodySnapshot;
  /** Nervous system: lesioned graph nodes, and the findings the graph derives from them. */
  neuro?: { nodes: string[]; complete: boolean; findings: Array<Record<string, any>> };
  /** Named conditions the case declares, for models that read them (e.g. vestibular hypofunction). */
  conditions?: Array<{ id: string; params?: Record<string, unknown> }>;
  /** Simulated minutes since the encounter began. */
  minutes?: number;
}

/**
 * A model's answer. `normal` lets the model say whether the value is normal
 * when that depends on more than the value (a 2 mm pupil is normal in bright
 * light and abnormal beside a 4 mm one); otherwise the normal spec decides.
 */
export interface Resolved { value: unknown; basis?: string; normal?: boolean }

/** A resolver may return undefined when the model has nothing abnormal to say. */
export type Resolver = (view: RuntimeView, ref: PropertyRef, ctx: ExamContext) => Resolved | undefined;

export interface PropertyRef { property: string; side?: Side }

export function parseRef(ref: string): PropertyRef {
  const m = /^(.*)\.(L|R)$/.exec(ref);
  return m ? { property: m[1], side: m[2] as Side } : { property: ref };
}

export const refString = (r: PropertyRef) => (r.side ? `${r.property}.${r.side}` : r.property);

/* ---- context ---------------------------------------------------------------- */

export function matches(pred: ContextPredicate, ctx: ExamContext): boolean {
  for (const [k, want] of Object.entries(pred)) {
    if (k === 'not') continue;
    const have = (ctx as Record<string, unknown>)[k];
    if (Array.isArray(want) ? !want.includes(have as never) : have !== want) return false;
  }
  return !(pred.not && matches(pred.not, ctx));
}

/** Apply a Valued's context rules, in order. */
export function evaluate<T>(v: Valued<T>, ctx: ExamContext): T {
  let out: unknown = structuredCloneSafe(v.value);
  for (const rule of v.when || []) {
    if (!matches(rule.if, ctx)) continue;
    const mode = rule.mode || 'replace';
    if (mode === 'replace') out = structuredCloneSafe(rule.value);
    else if (mode === 'merge') out = { ...(out as object), ...(rule.value as object) };
    else if (mode === 'scale' && out && typeof out === 'object') {
      const o = { ...(out as Record<string, unknown>) };
      for (const f of rule.fields || Object.keys(o)) if (typeof o[f] === 'number') o[f] = (o[f] as number) * (rule.factor ?? 1);
      out = o;
    } else if (mode === 'scale' && typeof out === 'number') out = out * (rule.factor ?? 1);
  }
  return out as T;
}

function structuredCloneSafe<T>(x: T): T {
  return x == null || typeof x !== 'object' ? x : JSON.parse(JSON.stringify(x));
}

/* ---- normals ------------------------------------------------------------------ */

export function normalFor(spec: NormalSpec, patient: CaseDef['patient']): { value: unknown; range?: NormalSpec['range'] } {
  for (const b of spec.bands || []) {
    if (b.minAge != null && patient.age < b.minAge) continue;
    if (b.maxAge != null && patient.age > b.maxAge) continue;
    if (b.sex && b.sex !== patient.sex) continue;
    return { value: b.value, range: b.range ?? spec.range };
  }
  return { value: spec.value, range: spec.range };
}

export function isNormal(value: unknown, normal: { value: unknown; range?: NormalSpec['range'] }): boolean {
  const r = normal.range;
  if (typeof value === 'number' && Array.isArray(r)) return value >= r[0] && value <= r[1];
  const isRecord = (x: unknown) => !!x && typeof x === 'object' && !Array.isArray(x);
  if (isRecord(value) && isRecord(normal.value) && !Array.isArray(r)) {
    const v = value as Record<string, unknown>; const n = normal.value as Record<string, unknown>;
    // Only the fields the value carries are compared: a pupil seen without a
    // light has a size but no reaction, and that is not abnormal.
    for (const k of Object.keys(v)) {
      const rk = r ? (r as Record<string, [number, number]>)[k] : undefined;
      if (rk && typeof v[k] === 'number') { if (v[k] < rk[0] || v[k] > rk[1]) return false; }
      else if (JSON.stringify(v[k]) !== JSON.stringify(n[k])) return false;
    }
    return true;
  }
  return JSON.stringify(value) === JSON.stringify(normal.value);
}

/* ---- observe ------------------------------------------------------------------ */

export function observe(
  catalog: Catalog,
  resolvers: Record<string, Resolver>,
  caseDef: CaseDef,
  view: RuntimeView,
  ref: string | PropertyRef,
  ctx: ExamContext = {},
): Finding {
  const r = typeof ref === 'string' ? parseRef(ref) : ref;
  const def: PropertyDef | undefined = catalog.properties[r.property];
  if (!def) throw new Error(`unknown property ${r.property}`);
  if (def.paired && !r.side) throw new Error(`property ${r.property} is paired; give a side`);
  const normal = normalFor(def.normal, caseDef.patient);
  const key = refString(r);

  const fromModel = def.source !== 'case' && def.resolver ? resolvers[def.resolver]?.(view, r, ctx) : undefined;
  if (fromModel) {
    return {
      property: key, context: ctx, value: fromModel.value,
      normal: fromModel.normal ?? isNormal(fromModel.value, normal),
      provenance: 'model', basis: fromModel.basis,
    };
  }
  const authored = def.source !== 'model' ? caseDef.observables?.[key] : undefined;
  if (authored) {
    const value = evaluate(authored, ctx);
    return { property: key, context: ctx, value, normal: isNormal(value, normal), provenance: 'case' };
  }
  return { property: key, context: ctx, value: structuredCloneSafe(normal.value), normal: true, provenance: 'default-normal' };
}
