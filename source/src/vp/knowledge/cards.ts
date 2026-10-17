import type { Catalog } from '../data/catalog.ts';
import { SUPPORTED_LOCALES } from '../model/i18n.ts';
import type { CardPresentation, TeachingCard } from '../model/types.ts';
import { explore, idOf, localized, localizedList, testsForSign } from './index.ts';
import type { Knowledge } from './types.ts';

/* ===========================================================================
   Cards, built from the knowledge tables (ADR-016 step 2).

   A test card: what the test assesses, how, what is normal, pitfalls; then
   its presentations (how signs show on this test and what they mean), the
   further signs it can show (derived from their definitions), and the normal
   variants worth naming.

   A sign card: everything about one sign, gathered across tests.
=========================================================================== */

const signsByTest = new WeakMap<Catalog, Map<string, string[]>>();

/** For each test, the signs whose definitions it can elicit (derived once per catalog). */
export function signsElicitedBy(k: Knowledge, cat: Catalog): Map<string, string[]> {
  let m = signsByTest.get(cat);
  if (!m) {
    m = new Map();
    for (const s of Object.values(k.signs)) if (s.definition) for (const t of testsForSign(k, cat, s.id)) m.set(t, [...(m.get(t) ?? []), s.id]);
    signsByTest.set(cat, m);
  }
  return m;
}

/** The conditions a presentation asserts (the links that name it in `via`). */
export function presentationConditions(k: Knowledge, id: string): string[] {
  return [...new Set(k.relations.filter((r) => r.rel === 'suggests' && r.via?.includes(id)).map((r) => idOf(r.to)))];
}

function presentation(k: Knowledge, id: string): CardPresentation {
  const p = k.presentations[id];
  return {
    id, tests: p.tests, signs: p.signs, accompanying: p.accompanying ?? [], ...(p.syndrome ? { syndrome: p.syndrome } : {}),
    description: localized(k, `presentation:${id}`, 'description', SUPPORTED_LOCALES),
    meaning: localized(k, `presentation:${id}`, 'meaning', SUPPORTED_LOCALES),
    conditions: presentationConditions(k, id),
  };
}

export function teachingCard(k: Knowledge, cat: Catalog, testId: string): TeachingCard | undefined {
  const row = k.tests[testId];
  if (!row) return undefined;
  const ref = `test:${testId}`;
  const presentations = Object.values(k.presentations).filter((p) => p.tests.includes(testId)).map((p) => presentation(k, p.id));
  const named = new Set(presentations.flatMap((p) => p.signs));
  const elicited = signsElicitedBy(k, cat).get(testId) ?? [];
  const pitfalls = localizedList(k, ref, 'pitfall', SUPPORTED_LOCALES);
  const aliases = localizedList(k, ref, 'alias', SUPPORTED_LOCALES);
  return {
    assesses: localized(k, ref, 'assesses', SUPPORTED_LOCALES),
    how: localizedList(k, ref, 'how', SUPPORTED_LOCALES),
    normal: localized(k, ref, 'normal', SUPPORTED_LOCALES),
    ...(pitfalls.en?.length ? { pitfalls } : {}),
    ...(aliases.en?.length ? { aliases } : {}),
    ...(row.refs ? { refs: row.refs } : {}),
    ...(row.animation ? { animation: row.animation } : {}),
    presentations,
    alsoShows: elicited.filter((s) => !named.has(s) && !k.signs[s].normalVariant),
    normalVariants: elicited.filter((s) => k.signs[s].normalVariant),
  };
}

export interface SignCard {
  id: string;
  represented: boolean;
  normalVariant: boolean;
  threshold?: { text: string; status: string };
  /** Tests that elicit it: derived from the definition, and named by its presentations. */
  tests: string[];
  presentations: CardPresentation[];
  variants: string[];
  parents: string[];
  syndromes: Array<{ id: string; role: string }>;
  conditions: string[];
  modelGap?: string;
}

export function signCard(k: Knowledge, cat: Catalog, signId: string): SignCard | undefined {
  const s = k.signs[signId];
  if (!s) return undefined;
  const ps = Object.values(k.presentations).filter((p) => p.signs.includes(signId) || p.accompanying?.includes(signId)).map((p) => presentation(k, p.id));
  const e = explore(k, signId);
  /* Found by: the tests its definition allows, and the tests of presentations that name it (not those that only
     mention it as accompanying another test's finding). */
  const tests = [...new Set([...(s.definition ? testsForSign(k, cat, signId) : []), ...ps.filter((p) => p.signs.includes(signId)).flatMap((p) => p.tests)])];
  return {
    id: signId, represented: !!s.definition, normalVariant: !!s.normalVariant,
    ...(s.threshold ? { threshold: { text: s.threshold.text, status: s.threshold.status } } : {}),
    tests, presentations: ps, variants: e.variants, parents: e.parents,
    /* Its own syndromes; those of its variants are reached through the variant's card. */
    syndromes: e.syndromes.filter((x) => !x.via.length).map((x) => ({ id: x.id, role: x.role })), conditions: e.conditions.map((c) => idOf(c.ref)),
    ...(s.modelGap ? { modelGap: s.modelGap } : {}),
  };
}
