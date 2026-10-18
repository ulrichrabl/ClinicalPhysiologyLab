import type { Catalog } from '../data/catalog.ts';
import type { Locale } from '../model/i18n.ts';
import type { ManoeuvreDef } from '../model/types.ts';
import signRows from '../../../knowledge/signs.json';
import syndromeRows from '../../../knowledge/syndromes.json';
import relationRows from '../../../knowledge/relations.json';
import textRows from '../../../knowledge/texts.json';
import testRows from '../../../knowledge/tests.json';
import presentationRows from '../../../knowledge/presentations.json';
import { NAMED, contextFits, partsOf, type WantedContext } from './predicates.ts';
import type { EntityKind, EntityRef, Knowledge, KnowledgeTables, PresentationRow, RelationRow, SignRow, SyndromeRow, TestRow, TextRow } from './types.ts';

/* ===========================================================================
   The clinical knowledge tables (ADR-016), loaded and queryable.

   The tables live in source/knowledge/ as JSON, one row per line, and are
   compiled into the bundle by the build. Everything a teaching view needs to
   say about a sign is derived here from the links, never written twice.
=========================================================================== */

export const KNOWLEDGE_TABLES: KnowledgeTables = {
  signs: signRows as SignRow[], syndromes: syndromeRows as SyndromeRow[], tests: testRows as TestRow[],
  presentations: presentationRows as PresentationRow[], relations: relationRows as RelationRow[], texts: textRows as TextRow[],
};

const textKey = (entity: string, field: string, locale: string) => `${entity}|${field}|${locale}`;
const textIndexes = new WeakMap<Knowledge, Map<string, string>>();
const indexTexts = (rows: TextRow[]) => new Map(rows.flatMap((x) => Object.entries(x.fields).map(([f, text]) => [textKey(x.entity, f, x.locale), text] as [string, string])));

export function buildKnowledge(t: KnowledgeTables): Knowledge {
  const k: Knowledge = {
    signs: Object.fromEntries(t.signs.map((s) => [s.id, s])),
    syndromes: Object.fromEntries(t.syndromes.map((s) => [s.id, s])),
    tests: Object.fromEntries(t.tests.map((s) => [s.id, s])),
    presentations: Object.fromEntries(t.presentations.map((s) => [s.id, s])),
    relations: t.relations, texts: t.texts,
  };
  textIndexes.set(k, indexTexts(t.texts));
  return k;
}

export const KNOWLEDGE: Knowledge = buildKnowledge(KNOWLEDGE_TABLES);

export const kindOf = (ref: EntityRef): EntityKind => ref.slice(0, ref.indexOf(':')) as EntityKind;
export const idOf = (ref: EntityRef): string => ref.slice(ref.indexOf(':') + 1);

const indexOf = (k: Knowledge) => {
  let ix = textIndexes.get(k);
  if (!ix) { ix = indexTexts(k.texts); textIndexes.set(k, ix); }
  return ix;
};

/** A text of an entity in a language, or undefined. */
export function textIn(k: Knowledge, ref: EntityRef, field: string, locale: Locale): string | undefined {
  return indexOf(k).get(textKey(ref, field, locale));
}

/** A text of an entity in a language, falling back to English, then to the id. */
export function textOf(k: Knowledge, ref: EntityRef, field: string, locale: Locale): string {
  return textIn(k, ref, field, locale) ?? textIn(k, ref, field, 'en') ?? idOf(ref);
}
export const labelOf = (k: Knowledge, ref: EntityRef, locale: Locale) => textOf(k, ref, 'label', locale);

/** A numbered list of texts (`how.1`, `how.2`, …) in a language; English when the language has none. */
export function listOf(k: Knowledge, ref: EntityRef, field: string, locale: Locale): string[] {
  const read = (l: Locale) => { const out: string[] = []; for (let n = 1; ; n++) { const x = textIn(k, ref, `${field}.${n}`, l); if (x === undefined) return out; out.push(x); } };
  const mine = read(locale);
  return mine.length ? mine : read('en');
}

/** Every language a text exists in, as a localized object (`{ en, de }`). */
export function localized(k: Knowledge, ref: EntityRef, field: string, locales: readonly Locale[]): { en: string } & Record<string, string> {
  return Object.fromEntries(locales.map((l) => [l, textIn(k, ref, field, l)]).filter(([, x]) => x !== undefined)) as { en: string } & Record<string, string>;
}
export function localizedList(k: Knowledge, ref: EntityRef, field: string, locales: readonly Locale[]): { en: string[] } & Record<string, string[]> {
  return Object.fromEntries(locales.map((l) => {
    const out: string[] = [];
    for (let n = 1; ; n++) { const x = textIn(k, ref, `${field}.${n}`, l); if (x === undefined) break; out.push(x); }
    return [l, out];
  }).filter(([, x]) => (x as string[]).length)) as { en: string[] } & Record<string, string[]>;
}

const out = (k: Knowledge, ref: EntityRef, rel: RelationRow['rel']) => k.relations.filter((r) => r.from === ref && r.rel === rel);
const into = (k: Knowledge, ref: EntityRef, rel: RelationRow['rel']) => k.relations.filter((r) => r.to === ref && r.rel === rel);

/** A condition and everything it is a kind of (`peptic-ulcer-bleed` → `upper-gi-bleed`). */
export function conditionAncestors(k: Knowledge, id: string): string[] {
  const seen = [id];
  for (let i = 0; i < seen.length; i++) for (const r of out(k, `condition:${seen[i]}`, 'is-a')) if (!seen.includes(idOf(r.to))) seen.push(idOf(r.to));
  return seen;
}

/** A condition and every narrower kind of it. */
export function conditionDescendants(k: Knowledge, id: string): string[] {
  const seen = [id];
  for (let i = 0; i < seen.length; i++) for (const r of into(k, `condition:${seen[i]}`, 'is-a')) if (!seen.includes(idOf(r.from))) seen.push(idOf(r.from));
  return seen;
}

export interface Reached { ref: EntityRef; via: EntityRef[] }

/**
 * Everything a sign leads to: its variants, the syndromes it belongs to (with its role), and the conditions it or
 * those syndromes suggest, each with the path that reached it. Variants are included, so "ptosis" reaches
 * myasthenia gravis through "fatigable ptosis".
 */
export function explore(k: Knowledge, signId: string): { variants: string[]; parents: string[]; syndromes: Array<{ id: string; role: string; via: EntityRef[] }>; conditions: Reached[] } {
  const variants: string[] = [];
  const queue = [signId];
  while (queue.length) {
    const s = queue.shift()!;
    for (const r of into(k, `sign:${s}`, 'variant-of')) { const v = idOf(r.from); if (!variants.includes(v)) { variants.push(v); queue.push(v); } }
  }
  const parents: string[] = [];
  for (let s = signId, p = out(k, `sign:${s}`, 'variant-of')[0]?.to; p && !parents.includes(idOf(p)); s = idOf(p), p = out(k, `sign:${s}`, 'variant-of')[0]?.to) parents.push(idOf(p));
  const syndromes: Array<{ id: string; role: string; via: EntityRef[] }> = [];
  const conditions: Reached[] = [];
  const reach = (ref: EntityRef, via: EntityRef[]) => {
    for (const anc of conditionAncestors(k, idOf(ref))) if (!conditions.some((c) => c.ref === `condition:${anc}`)) conditions.push({ ref: `condition:${anc}`, via: anc === idOf(ref) ? via : [...via, ref] });
  };
  for (const s of [signId, ...variants]) {
    const via: EntityRef[] = s === signId ? [] : [`sign:${s}`];
    for (const r of out(k, `sign:${s}`, 'suggests')) reach(r.to, via);
    for (const r of out(k, `sign:${s}`, 'part-of')) {
      if (r.role === 'absent') continue;
      const syn = idOf(r.to);
      if (!syndromes.some((x) => x.id === syn)) syndromes.push({ id: syn, role: r.role ?? 'supporting', via });
      for (const c of out(k, r.to, 'suggests')) reach(c.to, [...via, r.to]);
    }
  }
  return { variants, parents, syndromes, conditions };
}

/** The signs that point to a condition (or to a narrower kind of it), directly or through a syndrome. */
export function signsForCondition(k: Knowledge, conditionId: string): Reached[] {
  const targets = new Set(conditionDescendants(k, conditionId).map((c) => `condition:${c}`));
  const outR: Reached[] = [];
  const add = (ref: EntityRef, via: EntityRef[]) => { if (!outR.some((x) => x.ref === ref)) outR.push({ ref, via }); };
  for (const r of k.relations) {
    if (r.rel !== 'suggests' || !targets.has(r.to)) continue;
    if (kindOf(r.from) === 'sign') add(r.from, []);
    else for (const m of into(k, r.from, 'part-of')) if (m.role !== 'absent') add(m.from, [r.from]);
  }
  return outR;
}

/** The members of a syndrome, by role. */
export function syndromeSigns(k: Knowledge, syndromeId: string): Array<{ sign: string; role: 'required' | 'supporting' | 'absent' | 'associated' }> {
  return into(k, `syndrome:${syndromeId}`, 'part-of').map((r) => ({ sign: idOf(r.from), role: r.role ?? 'supporting' }));
}

/** The tests that can elicit a sign: they reveal an observable it reads, in a context its definition allows. */
export function testsForSign(k: Knowledge, cat: Catalog, signId: string): string[] {
  const def = k.signs[signId]?.definition ?? null;
  const parts = partsOf(def);
  const want: Array<{ obs: string; ctx: WantedContext }> = parts.flatMap((p) => {
    if (!('fn' in p)) return [{ obs: p.obs, ctx: p.ctx ?? {} }];
    const n = NAMED[p.fn];
    return n?.observes?.(p.args ?? {}) ?? n?.uses(p.args ?? {}).map((obs) => ({ obs, ctx: {} })) ?? [];
  });
  const fits = (m: ManoeuvreDef, r: ManoeuvreDef['reveals'][number], w: { obs: string; ctx: WantedContext }) => {
    if (r.property !== w.obs) return false;
    const base = { ...(m.context ?? {}), ...(r.context ?? {}) } as Record<string, unknown>;
    if (!contextFits(base, w.ctx)) return false;
    /* A fixed context the test does not set must be one the observable ignores, or one an intervention sets first
       (lay the patient flat, then look at the neck). A list accepts the patient as is. */
    return Object.entries(w.ctx).every(([key, v]) => Array.isArray(v) || key in base || !(cat.properties[w.obs].contextDims ?? []).includes(key as never) || !!setterOf(key, v));
  };
  const setterOf = (key: string, v: unknown) => Object.values(cat.manoeuvres).find((m) => (m.sets as Record<string, unknown> | undefined)?.[key] === v);
  const tests = Object.values(cat.manoeuvres).filter((m) => (m.reveals ?? []).some((r) => want.some((w) => fits(m, r, w)))).map((m) => m.id);
  /* Investigations a reader looks at (the ECG) are tests too: they reveal their observables in no context. */
  for (const inv of Object.values(cat.investigations)) if ((inv.reveals ?? []).some((r) => want.some((w) => w.obs === r.property && Object.values(w.ctx).every(Array.isArray)))) tests.push(inv.id);
  /* The interventions that set a context the tests leave open come first: they are the first step. */
  const setters = want.flatMap((w) => Object.entries(w.ctx).filter(([, v]) => !Array.isArray(v)).map(([k, v]) => setterOf(k, v)?.id))
    .filter((id): id is string => !!id && tests.length > 0 && !tests.includes(id));
  return [...new Set([...setters, ...tests])];
}

export { SignEvaluator, NAMED, contextsFor, contextFits, observablesOf, partsOf, type Observer, type Row, type WantedContext } from './predicates.ts';
export type * from './types.ts';
