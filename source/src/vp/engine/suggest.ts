import type { Catalog } from '../data/catalog.ts';
import type { ManoeuvreDef, Side } from '../model/types.ts';
import { list, tr, SUPPORTED_LOCALES, type Locale } from '../model/i18n.ts';
import { normalise } from './language.ts';

/* ---------------------------------------------------------------------------
   Suggestions as the learner types.

   The command field searches everything the learner can do: examinations
   (by name, the phrases the parser understands, eponyms and the names used in
   other languages, and the signs on their teaching cards), investigations and
   history topics. Names are matched in every language, so a learner working in
   English who types "Knie-Hacke" still finds the heel–shin test.

   Suggestions only help the learner find and phrase things; choosing one does
   exactly what typing its label would do.
--------------------------------------------------------------------------- */

export type Suggestion =
  | { kind: 'act'; id: string; label: string; section?: string; score: number; side?: Side; matched?: string }
  | { kind: 'order'; id: string; label: string; score: number; matched?: string }
  | { kind: 'ask'; id: string; label: string; text: string; score: number; matched?: string };

const SIDE_WORDS: Record<string, Side> = { left: 'L', links: 'L', linke: 'L', linken: 'L', linkes: 'L', right: 'R', rechts: 'R', rechte: 'R', rechten: 'R', rechtes: 'R' };

/** How well a typed query matches one name, 0..1: whole-name prefix beats word prefix beats substring beats all words. */
function nameScore(q: string, qWords: string[], name: string): number {
  const n = normalise(name);
  if (!n) return 0;
  if (n === q) return 1;
  if (n.startsWith(q)) return 0.95;
  const words = n.split(/[\s-]+/);
  if (words.some((w) => w.startsWith(q))) return 0.85;
  if (q.length >= 3 && n.includes(q)) return 0.75;
  if (qWords.length > 1 && qWords.every((qw) => words.some((w) => w.startsWith(qw)))) return 0.7;
  return 0;
}

function bestOf(q: string, qWords: string[], names: Array<[string, number]>): { score: number; name?: string } {
  let score = 0, name: string | undefined;
  for (const [nm, weight] of names) {
    const s = nameScore(q, qWords, nm) * weight;
    if (s > score) { score = s; name = nm; }
  }
  return { score, name };
}

const allLocales = <T>(f: (l: Locale) => T[]): T[] => SUPPORTED_LOCALES.flatMap(f);

/** The names a manoeuvre is found by, with weights: its label in the learner's language counts most. */
function manoeuvreNames(m: ManoeuvreDef, locale: Locale): Array<[string, number]> {
  const out: Array<[string, number]> = [[tr(m.label, locale), 1]];
  for (const l of SUPPORTED_LOCALES) if (l !== locale && m.label[l]) out.push([m.label[l], 0.9]);
  for (const p of list(m.phrases, locale)) out.push([p, 0.9]);
  for (const p of allLocales((l) => (l === locale ? [] : m.phrases[l] ?? []))) out.push([p, 0.8]);
  for (const a of allLocales((l) => m.teaching?.aliases?.[l] ?? [])) out.push([a, 0.95]);
  /* The signs a test looks for and what they mean ("ataxia", "nystagmus") find it too, but below its names. */
  for (const f of m.teaching?.abnormal ?? []) for (const l of SUPPORTED_LOCALES) {
    if (f.sign[l]) out.push([f.sign[l], 0.55]);
    if (f.means[l]) out.push([f.means[l], 0.5]);
  }
  return out;
}

export function suggest(cat: Catalog, text: string, locale: Locale, limit = 10): Suggestion[] {
  const raw = normalise(text);
  if (raw.length < 2) return [];
  const words = raw.split(' ');
  const side = words.map((w) => SIDE_WORDS[w]).find(Boolean);
  const qWords = words.filter((w) => !SIDE_WORDS[w]);
  const q = qWords.join(' ');
  if (q.length < 2) return [];
  const out: Suggestion[] = [];

  for (const m of Object.values(cat.manoeuvres)) {
    const { score, name } = bestOf(q, qWords, manoeuvreNames(m, locale));
    if (score > 0) out.push({ kind: 'act', id: m.id, label: tr(m.label, locale), section: m.section, score: score - (m.hidden ? 0.02 : 0), side: m.paired ? side : undefined, matched: name });
  }
  for (const inv of Object.values(cat.investigations)) {
    const names: Array<[string, number]> = [[tr(inv.label, locale), 1], ...list(inv.synonyms, locale).map((x): [string, number] => [x, 0.9]),
      ...allLocales((l) => (l === locale ? [] : [inv.label[l], ...(inv.synonyms?.[l] ?? [])].filter(Boolean))).map((x): [string, number] => [x, 0.8])];
    const { score, name } = bestOf(q, qWords, names);
    if (score > 0) out.push({ kind: 'order', id: inv.id, label: tr(inv.label, locale), score: score * 0.97, matched: name });
  }
  for (const t of Object.values(cat.topics)) {
    const intents = list(t.intents, locale);
    const { score, name } = bestOf(q, qWords, [[tr(t.label, locale), 1], ...intents.map((x): [string, number] => [x, 0.85])]);
    if (score > 0) out.push({ kind: 'ask', id: t.id, label: tr(t.label, locale), text: name && intents.includes(name) ? name : intents[0] ?? tr(t.label, locale), score: score * 0.95, matched: name });
  }
  /* Best first; among equals, the clinical order of the examination. */
  return out.sort((a, b) => b.score - a.score || orderOf(cat, a) - orderOf(cat, b)).slice(0, limit);
}

const orderOf = (cat: Catalog, s: Suggestion) => (s.kind === 'act' ? cat.manoeuvres[s.id].order ?? 1e6 : s.kind === 'order' ? 2e6 : 3e6);
