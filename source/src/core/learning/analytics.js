import { CONFIDENCE, DAY, isDue, strength, SECURE_INTERVAL_DAYS } from './srs.js';
import { dayKey } from './store.js';

/* ---------------------------------------------------------------------------
   Read-only views over the learner record. Every function takes the record
   (and the item registry where it needs item metadata) plus `now`, so each
   one is a pure function and can be asserted in tests.
--------------------------------------------------------------------------- */

/** Items whose review is due, most overdue first; confidently-wrong first of all. */
export function dueItems(rec, items, now) {
  const out = [];
  for (const it of items) {
    const r = rec.items[it.id];
    if (r && isDue(r.card, now)) {
      const last = r.attempts[r.attempts.length - 1];
      out.push({ item: it, card: r.card, overdueDays: (now - r.card.due) / DAY,
        danger: !!last && !last.ok && last.conf === 'sure' });
    }
  }
  return out.sort((a, b) => (b.danger - a.danger) || (b.overdueDays - a.overdueDays));
}

/** Items never attempted, in registry order. */
export function newItems(rec, items) {
  return items.filter((it) => !rec.items[it.id]);
}

/** Mastery per topic: mean strength over all items in it (unseen count as 0). */
export function topicMastery(rec, items, now) {
  const by = new Map();
  for (const it of items) {
    const key = `${it.domain}/${it.topicId}`;
    const t = by.get(key) || { key, domain: it.domain, topic: it.topic, n: 0, seen: 0, secure: 0, sum: 0, correct: 0, attempts: 0 };
    const r = rec.items[it.id];
    t.n += 1;
    if (r) {
      t.seen += 1;
      t.sum += strength(r.card, now);
      if (r.card.lastCorrect && r.card.interval >= SECURE_INTERVAL_DAYS) t.secure += 1;
      for (const a of r.attempts) { t.attempts += 1; if (a.ok) t.correct += 1; }
    }
    by.set(key, t);
  }
  return [...by.values()].map((t) => ({ ...t, mastery: t.n ? t.sum / t.n : 0,
    accuracy: t.attempts ? t.correct / t.attempts : null }));
}

/** Calibration: how often each stated confidence level was actually right. */
export function calibration(rec) {
  const buckets = Object.fromEntries(CONFIDENCE.map((c) => [c.id, { ...c, n: 0, ok: 0 }]));
  let confidentlyWrong = 0;
  for (const r of Object.values(rec.items)) {
    for (const a of r.attempts) {
      if (!a.conf || !buckets[a.conf]) continue;
      buckets[a.conf].n += 1;
      if (a.ok) buckets[a.conf].ok += 1;
      else if (a.conf === 'sure') confidentlyWrong += 1;
    }
  }
  const list = CONFIDENCE.map((c) => {
    const b = buckets[c.id];
    return { ...b, rate: b.n ? b.ok / b.n : null };
  });
  return { buckets: list, confidentlyWrong, total: list.reduce((s, b) => s + b.n, 0) };
}

/** Consecutive days with any learning activity, ending today or yesterday. */
export function streak(rec, now) {
  const has = (t) => {
    const a = rec.activity[dayKey(t)];
    return !!a && (a.attempts > 0 || a.seconds >= 60);
  };
  let t = now;
  if (!has(t)) t -= DAY;
  let n = 0;
  while (has(t) && n < 3650) { n += 1; t -= DAY; }
  return n;
}

/** Per-day activity for the last `weeks` weeks, oldest first, for a heatmap. */
export function activityGrid(rec, now, weeks = 16) {
  const days = [];
  const end = new Date(now); end.setHours(12, 0, 0, 0);
  const start = end.getTime() - (weeks * 7 - 1) * DAY;
  for (let t = start; t <= end.getTime() + 1; t += DAY) {
    const a = rec.activity[dayKey(t)] || { seconds: 0, attempts: 0 };
    days.push({ key: dayKey(t), t, seconds: a.seconds, attempts: a.attempts });
  }
  return days;
}

export function totals(rec, now) {
  let attempts = 0; let correct = 0; let recent = 0; let recentOk = 0;
  for (const r of Object.values(rec.items)) {
    for (const a of r.attempts) {
      attempts += 1; if (a.ok) correct += 1;
      if (now - a.t < 30 * DAY) { recent += 1; if (a.ok) recentOk += 1; }
    }
  }
  let monthSeconds = 0;
  for (const [k, a] of Object.entries(rec.activity)) {
    if (now - new Date(`${k}T12:00:00`).getTime() < 30 * DAY) monthSeconds += a.seconds;
  }
  const certificates = Object.values(rec.modules).filter((m) => m.certificate).length
    + Object.values(rec.modules).reduce((s, m) => s + (m.history || []).filter((h) => h.certificate).length, 0);
  return {
    attempts, correct, accuracy: attempts ? correct / attempts : null,
    recentAccuracy: recent ? recentOk / recent : null, recent,
    monthMinutes: Math.round(monthSeconds / 60), certificates,
  };
}

/** Status of one CME module against its definition. */
export function moduleStatus(rec, mod) {
  const m = rec.modules[mod.id];
  const acts = mod.activities.map((a) => ({ ...a, done: activityDone(rec, a.ref, m?.startedAt) }));
  const done = acts.filter((a) => a.done).length;
  const lastPost = m?.posts?.[m.posts.length - 1] || null;
  let phase = 'new';
  if (m) {
    if (m.completedAt) phase = 'complete';
    else if (!m.pre) phase = 'pre';
    else if (done < acts.length) phase = 'activities';
    else if (!lastPost || !lastPost.passed) phase = 'post';
    else if (!m.reflection || !m.evaluation) phase = 'reflect';
    else phase = 'certificate';
  }
  return { record: m, activities: acts, done, total: acts.length, phase, lastPost,
    progress: !m ? 0 : m.completedAt ? 1
      : (0.1 + 0.6 * (done / Math.max(1, acts.length)) + (lastPost?.passed ? 0.2 : 0) + (m.reflection ? 0.1 : 0)) };
}

/** An activity counts only if it was done after the module was started. */
export function activityDone(rec, ref, since = 0) {
  if (!since) return false;
  if (ref.includes('/case/')) {
    const r = rec.items[ref];
    return !!r && r.attempts.some((a) => a.t >= since);
  }
  const l = rec.lessons[ref];
  return !!l && l.completions.some((t) => t >= since);
}

/** Commitment-to-change follow-ups that are now due (default: 30 days on). */
export function followUpsDue(rec, now, afterDays = 30) {
  const out = [];
  for (const [id, m] of Object.entries(rec.modules)) {
    if (m.completedAt && m.reflection?.commitment && !m.followUp && now - m.completedAt >= afterDays * DAY) {
      out.push({ moduleId: id, record: m });
    }
  }
  return out;
}
