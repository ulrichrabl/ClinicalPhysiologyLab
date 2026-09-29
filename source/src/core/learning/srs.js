/* ---------------------------------------------------------------------------
   Spaced repetition.

   A variant of SM-2 with one change that matters for clinicians: the grade is
   built from correctness *and* stated confidence. Being right by guessing is
   not the same as knowing, and being wrong while certain is the most dangerous
   state a clinician can be in — it gets the shortest interval and is flagged.

   Pure functions only. Time is passed in, never read, so the scheduler is
   deterministic under test.
--------------------------------------------------------------------------- */

export const DAY = 86_400_000;
export const MAX_INTERVAL_DAYS = 180;
export const SECURE_INTERVAL_DAYS = 21;

/** Confidence levels a learner can declare before seeing the answer. */
export const CONFIDENCE = [
  { id: 'sure', label: 'Certain', expected: 0.9 },
  { id: 'unsure', label: 'Fairly sure', expected: 0.7 },
  { id: 'guess', label: 'Guessing', expected: 0.3 },
];

/** SM-2 quality 0–5 from (correct, confidence). */
export function grade(correct, conf) {
  if (correct) return conf === 'sure' ? 5 : conf === 'guess' ? 3 : 4;
  return conf === 'sure' ? 0 : conf === 'guess' ? 2 : 1;
}

export function newCard() {
  return { reps: 0, ease: 2.5, interval: 0, due: 0, lapses: 0, last: 0, lastCorrect: null };
}

/** Next scheduling state after one attempt. Returns a new object. */
export function schedule(card, { correct, conf, now }) {
  const c = { ...newCard(), ...card };
  const q = grade(correct, conf);
  c.ease = Math.max(1.3, c.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  if (q < 3) {
    c.reps = 0;
    c.lapses += 1;
    c.interval = 1;
  } else {
    c.reps += 1;
    if (c.reps === 1) c.interval = q === 5 ? 3 : q === 4 ? 2 : 1;
    else if (c.reps === 2) c.interval = q === 3 ? 3 : 6;
    else c.interval = Math.round(c.interval * c.ease);
  }
  c.interval = Math.min(MAX_INTERVAL_DAYS, Math.max(1, c.interval));
  c.last = now;
  c.due = now + c.interval * DAY;
  c.lastCorrect = !!correct;
  c.lastConf = conf || null;
  return c;
}

/** Probability of recall now, assuming 90% at the scheduled due date. */
export function retrievability(card, now) {
  if (!card || !card.last) return 0;
  const elapsedDays = Math.max(0, (now - card.last) / DAY);
  return Math.exp(Math.log(0.9) * elapsedDays / Math.max(1, card.interval));
}

/** 0–1 strength used for the mastery map. Unseen and last-wrong are 0. */
export function strength(card, now) {
  if (!card || !card.last || !card.lastCorrect) return 0;
  const maturity = Math.min(1, 0.35 + 0.65 * (card.interval / SECURE_INTERVAL_DAYS));
  return Math.max(0, Math.min(1, maturity * retrievability(card, now) / 0.9));
}

export const isDue = (card, now) => !!card && card.last > 0 && card.due <= now;
