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

const SIDE_WORDS: Record<string, Side> = { left: 'L', links: 'L', linke: 'L', linken: 'L', linkes: 'L', right: 'R', rechts: 'R', rechte: 'R', rechten: 'R', rechtes: 'R' };

/** Map a typed action to a manoeuvre and side. */
export function parseAction(cat: Catalog, text: string, locale: Locale): { manoeuvre: string; side?: Side; score: number } | undefined {
  let bestId: string | undefined, bestScore = 0;
  for (const m of Object.values(cat.manoeuvres)) {
    const score = best(text, [...list(m.phrases, locale), tr(m.label, locale)]);
    if (score > bestScore) { bestScore = score; bestId = m.id; }
  }
  if (!bestId || bestScore < 0.6) return undefined;
  const side = tokens(text).map((w) => SIDE_WORDS[w]).find(Boolean);
  return { manoeuvre: bestId, side, score: bestScore };
}
