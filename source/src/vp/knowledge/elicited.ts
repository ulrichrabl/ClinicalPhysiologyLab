import type { Catalog } from '../data/catalog.ts';
import type { Side } from '../model/types.ts';
import { signsElicitedBy } from './cards.ts';
import { testsForSign } from './index.ts';
import { figureOnly } from './coverage.ts';
import { SignEvaluator, type Observer } from './predicates.ts';
import type { Knowledge } from './types.ts';

/* ===========================================================================
   The signs a test found (ADR-016 §11): after a test, the app names every sign
   whose definition that test's own observations meet, with the side, the
   normal variants it showed, and the signs it looked for but did not find.
   Nothing here is recorded as examined: it only reads what the test revealed.
=========================================================================== */

export interface SignsFound {
  found: Array<{ sign: string; sides: Side[] }>;
  normal: string[];
  /** Looked for by this test and not found (pertinent negatives). */
  absent: string[];
}

/** Manoeuvres that act on the patient rather than examine: they name no signs themselves. */
const ACTS = new Set(['position', 'give', 'expose']);

export function signsFoundBy(k: Knowledge, cat: Catalog, observe: Observer, testId: string, side?: Side): SignsFound {
  const m = cat.manoeuvres[testId];
  const out: SignsFound = { found: [], normal: [], absent: [] };
  if (!m || ACTS.has(m.verb)) return out;
  const named = new Set<string>(signsElicitedBy(k, cat).get(testId) ?? []);
  for (const p of Object.values(k.presentations)) if (p.tests.includes(testId)) for (const x of p.signs) if (k.signs[x]?.definition) named.add(x);
  const all = new SignEvaluator(cat, observe, { test: testId, side });
  const perSide = side ? undefined : { L: new SignEvaluator(cat, observe, { test: testId, side: 'L' }), R: new SignEvaluator(cat, observe, { test: testId, side: 'R' }) };
  for (const id of named) {
    const def = k.signs[id].definition!;
    const r = all.holds(def);
    if (r === undefined) continue;
    if (!r) { if (!k.signs[id].normalVariant) out.absent.push(id); continue; }
    if (k.signs[id].normalVariant) { out.normal.push(id); continue; }
    const sides = side ? [side] : (['L', 'R'] as const).filter((S) => perSide![S].holds(def) === true);
    /* Found on each side alone: both sides. Found only by comparing the sides (anisocoria): no side of its own. */
    out.found.push({ sign: id, sides: [...sides] });
  }
  return out;
}

/** Looking and uncovering: the manoeuvres whose findings the eye alone could give. */
const LOOK = new Set(['inspect', 'expose']);

/**
 * The signs the bedside figure shows, named when the learner performs general inspection: drawn by the figure, and
 * found by looking (a test or an exposure that only looks). Shifting dullness and pitting oedema read the same fields
 * but need percussion or pressure, so they are not named by sight.
 */
export function signsOnTheFigure(k: Knowledge, cat: Catalog, observe: Observer): string[] {
  const h = new SignEvaluator(cat, observe);
  const byLook = (id: string) => [...testsForSign(k, cat, id), ...Object.values(k.presentations).filter((p) => p.signs.includes(id)).flatMap((p) => p.tests)]
    .some((t) => LOOK.has(cat.manoeuvres[t]?.verb ?? ''));
  return Object.values(k.signs).filter((s) => s.definition && figureOnly(s.definition) && byLook(s.id) && h.holds(s.definition) === true).map((s) => s.id);
}
