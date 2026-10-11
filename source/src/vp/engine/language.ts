import type { HistoryFact, Side } from '../model/types.ts';
import type { Catalog } from '../data/catalog.ts';
import { list, tr, type Locale } from '../model/i18n.ts';
import { statePredicateHolds, type Session } from './encounter.ts';

/* ---------------------------------------------------------------------------
   Free text in, structure out.

   The learner types a question or an action in their own words. These
   matchers map it to history topics or a manoeuvre using the phrasings in
   the catalog. They are deliberately plain (normalised token overlap with
   prefix matching, so "schwindelig" finds "schwindel") and replaceable: an
   LLM can later take the same text and return the same structure, and the
   rest of the engine will not notice.
--------------------------------------------------------------------------- */

export function normalise(text: string): string {
  return text.toLowerCase().normalize('NFC').replace(/[’']/g, '').replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
}
const tokens = (s: string) => normalise(s).split(' ').filter((w) => w.length > 1);
const STOP = new Set(['the', 'a', 'an', 'you', 'your', 'do', 'have', 'any', 'is', 'are', 'did', 'der', 'die', 'das', 'sie', 'ihr', 'ihre', 'haben', 'ist', 'sind', 'ein', 'eine', 'und', 'and', 'or', 'oder', 'to', 'zu', 'at', 'in', 'im', 'mit', 'with']);

/** How well one phrasing matches the text, 0..1. */
export function phraseScore(text: string, phrase: string): number {
  const t = normalise(text), p = normalise(phrase);
  if (!p) return 0;
  if (` ${t} `.includes(` ${p} `)) return 1;
  const pt = tokens(p).filter((w) => !STOP.has(w));
  if (!pt.length) return 0;
  const tt = tokens(t);
  const hit = pt.filter((w) => tt.some((x) => x === w || (w.length >= 5 && x.length >= 5 && (x.startsWith(w.slice(0, 5)) || w.startsWith(x.slice(0, 5))))));
  return (hit.length / pt.length) * 0.9;
}

function best(text: string, phrasings: string[]): number {
  let b = 0;
  for (const p of phrasings) b = Math.max(b, phraseScore(text, p) * (1 + Math.min(normalise(p).split(' ').length, 4) * 0.05));
  return b;
}

export function matchTopics(cat: Catalog, text: string, locale: Locale, threshold = 0.6): Array<{ topic: string; score: number }> {
  const out: Array<{ topic: string; score: number }> = [];
  for (const t of Object.values(cat.topics)) {
    const score = best(text, [...list(t.intents, locale), ...(locale === 'en' ? [] : list(t.intents, 'en'))]);
    if (score >= threshold) out.push({ topic: t.id, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

export interface Reply { topics: string[]; facts: HistoryFact[]; text: string }

/** Ask the patient something. Answers come from case facts, or the topic's natural default. */
export function ask(s: Session, question: string, locale: Locale = s.encounter.locale): Reply {
  const matched = matchTopics(s.catalog, question, locale);
  const top = matched.length ? matched.filter((m) => m.score >= matched[0].score - 0.02).map((m) => m.topic) : [];
  const facts = s.caseDef.history.filter((f) => top.includes(f.topic) && (!f.onlyIf || statePredicateHolds(f.onlyIf, s.state, s.view)));
  let text: string;
  if (facts.length) text = facts.map((f) => tr(f.say, locale)).join(' ');
  else if (top.length) {
    const t = s.catalog.topics[top[0]];
    text = t.defaultAnswer ? tr(t.defaultAnswer, locale) : (locale === 'de' ? 'Hm, da bin ich mir nicht sicher.' : "Hm, I'm not sure.");
  } else text = locale === 'de' ? 'Wie meinen Sie das?' : 'Sorry, what do you mean?';
  s.encounter.events.push({ t: s.t, kind: 'utterance', from: 'learner', locale, text: question, topics: top });
  s.encounter.events.push({ t: s.t, kind: 'utterance', from: 'patient', locale, text, facts: facts.map((f) => f.id) });
  s.t += 15000;
  return { topics: top, facts, text };
}

/** Facts the patient says without being asked, for the start of the encounter. */
export function opening(s: Session, locale: Locale = s.encounter.locale): string {
  return s.caseDef.history.filter((f) => f.volunteered).map((f) => tr(f.say, locale)).join(' ');
}

const SIDE_WORDS: Record<string, Side> = { left: 'L', links: 'L', linke: 'L', linken: 'L', linkes: 'L', linker: 'L', linkem: 'L', right: 'R', rechts: 'R', rechte: 'R', rechten: 'R', rechtes: 'R', rechter: 'R', rechtem: 'R' };

/** Map a typed action to a manoeuvre and side. */
export function parseAction(cat: Catalog, text: string, locale: Locale): { manoeuvre: string; side?: Side; score: number } | undefined {
  let bestId: string | undefined, bestScore = 0;
  const words = ` ${normalise(text)} `;
  const mentions = (structure: string) => {
    for (let id: string | undefined = structure; id; id = cat.structures[id]?.parent) {
      const st = cat.structures[id];
      if (!st || id === 'body' || id === 'head' || id === 'chest') break;
      const names = [tr(st.label, locale), ...list(st.synonyms, locale)].map((x) => normalise(x)).filter((x) => x.length > 2);
      if (names.some((n) => words.includes(` ${n} `) || words.includes(` ${n}s `))) return true;
    }
    return false;
  };
  for (const m of Object.values(cat.manoeuvres)) {
    let score = best(text, [...list(m.phrases, locale), tr(m.label, locale)]);
    // Naming the body part the manoeuvre acts on settles ties between, say, pinprick in the arm and in the leg.
    if (score > 0 && mentions(m.target)) score += 0.15;
    if (score > bestScore) { bestScore = score; bestId = m.id; }
  }
  if (!bestId || bestScore < 0.6) return undefined;
  const side = tokens(text).map((w) => SIDE_WORDS[w]).find(Boolean);
  return { manoeuvre: bestId, side, score: bestScore };
}

/** Map typed text to an investigation. */
export function parseOrder(cat: Catalog, text: string, locale: Locale): { investigation: string; score: number } | undefined {
  let id: string | undefined, top = 0;
  for (const inv of Object.values(cat.investigations)) {
    const score = best(text, [...list(inv.synonyms, locale), ...list(inv.synonyms, 'en'), tr(inv.label, locale)]);
    if (score > top) { top = score; id = inv.id; }
  }
  return id && top >= 0.85 ? { investigation: id, score: top } : undefined;
}

const QUESTION_START = /^(what|when|where|why|how|who|which|do|does|did|have|has|had|are|is|was|were|can|could|any|tell|wie|was|wann|wo|warum|welche|wer|haben|hatten|hat|sind|waren|ist|war|können|nehmen|rauchen|trinken|gibt|erzählen)\b/;
const ORDER_WORDS = /\b(order|request|arrange|send|get an?|anordnen|veranlassen|anmelden|bestellen|schreiben|ableiten|messen lassen)\b/;

export type Interpretation =
  | { kind: 'ask'; topics: string[] }
  | { kind: 'act'; manoeuvre: string; side?: Side }
  | { kind: 'order'; investigation: string }
  | { kind: 'unknown' };

/**
 * Decide whether typed text is a question for the patient, an examination
 * step or an order. The same routing an LLM would do later, done with the
 * catalog's phrasings.
 */
export function interpret(cat: Catalog, text: string, locale: Locale): Interpretation {
  const t = normalise(text);
  if (!t) return { kind: 'unknown' };
  const topics = matchTopics(cat, text, locale);
  const act = parseAction(cat, text, locale);
  const ord = parseOrder(cat, text, locale);
  const isQuestion = /\?\s*$/.test(text) || QUESTION_START.test(t);
  if (ord && (ORDER_WORDS.test(t) || (ord.score >= 0.95 && !isQuestion && (act?.score ?? 0) < 0.95))) return { kind: 'order', investigation: ord.investigation };
  const topScore = topics[0]?.score ?? 0;
  if (isQuestion && topScore >= 0.6) return { kind: 'ask', topics: topics.map((x) => x.topic) };
  if (act && act.score >= topScore) return { kind: 'act', manoeuvre: act.manoeuvre, side: act.side };
  if (topScore >= 0.6) return { kind: 'ask', topics: topics.map((x) => x.topic) };
  if (isQuestion) return { kind: 'ask', topics: [] };
  return { kind: 'unknown' };
}
