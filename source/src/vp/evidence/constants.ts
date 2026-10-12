import { REFERENCES } from './references.ts';

/* ===========================================================================
   Model constants, each with its evidence.

   Every number the physiology uses lives here with what it means, its unit,
   how it was obtained and the references it rests on:

     measured    the value is reported in the source as it is used
     derived     computed from reported values; `derivation` shows how
     assumed     a judgement where no measurement was found; `derivation`
                 says why this value (and the model chapter flags it)
     ungrounded  not yet sourced (legacy constants awaiting their evidence)

   Model code reads constants through the typed objects defineConstants
   returns, so a value cannot exist in the model without an entry here.
=========================================================================== */

export type ConstantStatus = 'measured' | 'derived' | 'assumed' | 'ungrounded';

export interface ConstantSpec {
  value: number;
  unit: string;
  /** What the number is, in a sentence. */
  means: string;
  status: ConstantStatus;
  refs?: string[];
  /** For derived and assumed constants: the arithmetic or the reasoning. */
  derivation?: string;
}

export interface ConstantEntry extends ConstantSpec { id: string; group: string }

export const CONSTANTS: Record<string, ConstantEntry> = {};

/** Register a group of constants; returns their values, typed by name. */
export function defineConstants<K extends string>(group: string, specs: Record<K, ConstantSpec>): Record<K, number> {
  const out = {} as Record<K, number>;
  /* Calibration scripts (never the app) may set globalThis.__CONSTANT_OVERRIDES = { 'group.name': value } before the
     model loads, to fit constants against data; the registry records the value actually in use. */
  const overrides = (globalThis as any).__CONSTANT_OVERRIDES as Record<string, number> | undefined;
  for (const [k, spec] of Object.entries(specs) as Array<[K, ConstantSpec]>) {
    const id = `${group}.${k}`;
    const value = overrides?.[id] ?? spec.value;
    CONSTANTS[id] = { ...spec, value, id, group };
    out[k] = value;
  }
  return Object.freeze(out);
}

/** Problems with the registry: what the validator and the tests check. */
export function constantIssues(): string[] {
  const issues: string[] = [];
  for (const c of Object.values(CONSTANTS)) {
    if (!Number.isFinite(c.value)) issues.push(`${c.id}: value is not a number`);
    if (!c.means) issues.push(`${c.id}: no meaning given`);
    for (const r of c.refs ?? []) if (!REFERENCES[r]) issues.push(`${c.id}: unknown reference ${r}`);
    if ((c.status === 'measured' || c.status === 'derived') && !(c.refs ?? []).length) issues.push(`${c.id}: ${c.status} without a reference`);
    if ((c.status === 'derived' || c.status === 'assumed') && !c.derivation) issues.push(`${c.id}: ${c.status} without a derivation`);
  }
  return issues;
}

/** How much of the model is grounded: counts by status, per group. */
export function groundingSummary(): Record<string, Record<ConstantStatus, number>> {
  const out: Record<string, Record<ConstantStatus, number>> = {};
  for (const c of Object.values(CONSTANTS)) {
    out[c.group] ??= { measured: 0, derived: 0, assumed: 0, ungrounded: 0 };
    out[c.group][c.status]++;
  }
  return out;
}
