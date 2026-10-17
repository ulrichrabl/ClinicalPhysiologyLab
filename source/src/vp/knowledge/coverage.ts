import type { Catalog } from '../data/catalog.ts';
import type { Knowledge, SignRow } from './types.ts';
import { NAMED, SignEvaluator, observablesOf, partsOf, type Observer } from './predicates.ts';
import { syndromeSigns, testsForSign } from './index.ts';

/* ===========================================================================
   Coverage (ADR-016 §12): for every sign, whether the model can produce it,
   where the app presents it, which tests elicit it and which cases show it.
   It is what a later run works from when it adds signs to the model.
=========================================================================== */

export type Representation = 'model' | 'case layer only' | 'needs an intervention' | 'not represented';

/** The places the app presents an observable, field by field. Code facts: kept beside the renderers they describe. */
const FIGURE_FIELDS = new Set(['general.appearance:colour', 'general.appearance:sweating', 'general.appearance:distress', 'legs.oedema:extent',
  'abdomen.ascites:ascites', 'eyes.sclera:icterus', 'eyes.conjunctiva:pallor', 'breathing.pattern:hyperinflated', 'breathing.pattern:accessory', 'breathing.pattern:pursedLips']);
const EYE_VIEW = new Set(['eye.pupil', 'eye.lid', 'eye.motility', 'eyes.alignment', 'eyes.nystagmus', 'eye.head-impulse', 'eyes.swinging-light']);
export const CHANNEL_ORDER = ['text', 'bedside figure', 'eye close-up', 'face view', 'sound + phonocardiogram', 'chest view + sound', 'pulse trace + sound'] as const;
export type Channel = typeof CHANNEL_ORDER[number];

export function channelsOf(def: SignRow['definition']): Channel[] {
  const out = new Set<Channel>();
  for (const p of partsOf(def)) {
    const obsFields: Array<[string, string]> = 'fn' in p ? (NAMED[p.fn]?.uses(p.args ?? {}) ?? []).map((o) => [o, String((p.args as any)?.path ?? '').split('.')[0]]) : [[p.obs, (p.path ?? '').split('.')[0]]];
    for (const [o, f] of obsFields) {
      out.add('text');
      if (FIGURE_FIELDS.has(`${o}:${f}`)) out.add('bedside figure');
      if (EYE_VIEW.has(o)) out.add('eye close-up');
      if (o === 'face.movement') out.add('face view');
      if (o === 'heart.sounds') out.add('sound + phonocardiogram');
      if (o === 'lung.sounds' || o === 'chest.percussion' || o === 'chest.resonance') out.add('chest view + sound');
      if (o.startsWith('pulse.')) out.add('pulse trace + sound');
    }
  }
  return CHANNEL_ORDER.filter((c) => out.has(c));
}

/** Whether a definition reads only what the bedside figure draws (colour, sweating, oedema, ascites, hyperinflation …). */
export function figureOnly(def: SignRow['definition']): boolean {
  const parts = partsOf(def);
  return parts.length > 0 && parts.every((p) => !('fn' in p) && FIGURE_FIELDS.has(`${p.obs}:${(p.path ?? '').split('.')[0]}`));
}

export function representation(cat: Catalog, s: SignRow): Representation {
  if (!s.definition) return 'not represented';
  if (partsOf(s.definition).some((p) => 'fn' in p && NAMED[p.fn]?.needs)) return 'needs an intervention';
  if (observablesOf(s.definition).some((o) => cat.properties[o]?.source === 'case')) return 'case layer only';
  return 'model';
}

/** Which signs one patient shows: true, false, or undefined when the definition cannot be decided by observation. */
export function signsOf(k: Knowledge, cat: Catalog, observe: Observer): Record<string, boolean | undefined> {
  const h = new SignEvaluator(cat, observe);
  const out: Record<string, boolean | undefined> = {};
  for (const s of Object.values(k.signs)) out[s.id] = s.definition ? h.holds(s.definition) : undefined;
  return out;
}

/**
 * Whether a syndrome is present, given the signs: every required sign present, every pertinent negative absent, and,
 * for a syndrome with no required sign, at least two of its supporting signs.
 */
export function syndromePresent(k: Knowledge, id: string, present: Record<string, boolean | undefined>): boolean {
  const m = syndromeSigns(k, id);
  const req = m.filter((x) => x.role === 'required'), sup = m.filter((x) => x.role === 'supporting');
  if (!req.every((x) => present[x.sign] === true)) return false;
  if (!m.filter((x) => x.role === 'absent').every((x) => present[x.sign] === false)) return false;
  return req.length > 0 || sup.filter((x) => present[x.sign] === true).length >= 2;
}

export interface CoverageRow {
  id: string; representation: Representation; channels: Channel[]; tests: string[]; cases: string[]; normalVariant: boolean; modelGap?: string;
}

export function coverage(k: Knowledge, cat: Catalog, perCase: Record<string, Record<string, boolean | undefined>>): CoverageRow[] {
  return Object.values(k.signs).map((s) => ({
    id: s.id, representation: representation(cat, s), channels: channelsOf(s.definition), tests: s.definition ? testsForSign(k, cat, s.id) : [],
    cases: Object.entries(perCase).filter(([, p]) => p[s.id] === true).map(([c]) => c), normalVariant: !!s.normalVariant, modelGap: s.modelGap,
  }));
}

/** A short printable summary of the coverage. */
export function coverageSummary(rows: CoverageRow[]): string[] {
  const by = (r: Representation) => rows.filter((x) => x.representation === r).length;
  const defined = rows.filter((x) => x.representation !== 'not represented');
  return [
    `${rows.length} signs: ${by('model')} from the models, ${by('case layer only')} from the case layer only, ${by('needs an intervention')} needing an intervention, ${by('not represented')} not represented yet`,
    `${rows.filter((x) => x.cases.length).length} shown by at least one case; ${defined.filter((x) => !x.cases.length).length} defined but shown by no case yet`,
    `${defined.filter((x) => !x.tests.length).length} defined but elicited by no test: ${defined.filter((x) => !x.tests.length).map((x) => x.id).join(', ') || '—'}`,
    `${rows.filter((x) => x.modelGap).length} with a model or view gap noted for a later run`,
  ];
}
