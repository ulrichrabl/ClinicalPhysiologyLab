/* Learning layer: spaced repetition, the learner record, analytics and the
   CME module definitions. Pure modules, so this runs without a DOM. */
import { schedule, newCard, grade, strength, isDue, DAY } from '../src/core/learning/srs.js';
import { LearnerStore, migrate, STORAGE_KEY } from '../src/core/learning/store.js';
import { dueItems, calibration, streak, moduleStatus, followUpsDue, topicMastery } from '../src/core/learning/analytics.js';
import { MODULES, buildTest, scoreTest } from '../src/core/learning/modules.js';
import { CASE_SETS as CARDIO_CASES } from '../src/domains/cardio/data/cases.js';
import { LESSONS as CARDIO_LESSONS } from '../src/domains/cardio/data/lessons.js';
import { CASE_SETS as NEURO_CASES, LESSONS as NEURO_LESSONS } from '../src/domains/neuro/data/cases.js';
import { CASE_SETS as LABS_CASES, LESSONS as LABS_LESSONS } from '../src/domains/labs/data/labs.js';

let pass = 0; let fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name); } };

const T0 = Date.UTC(2026, 0, 5, 9);
const memory = () => { const d = {}; return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; }, _d: d }; };

console.log('\nSpaced repetition');
ok('certain-and-right grades 5, certain-and-wrong grades 0', grade(true, 'sure') === 5 && grade(false, 'sure') === 0);
{
  const sure = schedule(newCard(), { correct: true, conf: 'sure', now: T0 });
  const guess = schedule(newCard(), { correct: true, conf: 'guess', now: T0 });
  const wrongSure = schedule(newCard(), { correct: false, conf: 'sure', now: T0 });
  ok('a confident correct answer waits longer than a lucky guess', sure.interval > guess.interval);
  ok('a confident error comes back tomorrow', wrongSure.interval === 1 && wrongSure.lapses === 1);
  let c = newCard(); let t = T0;
  for (let i = 0; i < 5; i++) { c = schedule(c, { correct: true, conf: 'sure', now: t }); t = c.due; }
  ok('intervals grow with repeated success', c.interval > 20);
  ok('ease never falls below 1.3', [...Array(10)].reduce((k) => schedule(k, { correct: false, conf: 'sure', now: T0 }), newCard()).ease >= 1.3);
  ok('due exactly at the scheduled time', !isDue(sure, sure.due - 1) && isDue(sure, sure.due));
  ok('strength is 0 after an error and positive after success', strength(wrongSure, T0) === 0 && strength(sure, T0) > 0);
}

console.log('\nLearner record');
{
  let now = T0;
  const storage = memory();
  const s = new LearnerStore({ storage, now: () => now });
  s.recordAttempt('cardio/case/vt', { correct: false, choice: 'lbbb', conf: 'sure' });
  ok('attempts persist to storage', JSON.parse(storage._d[STORAGE_KEY]).items['cardio/case/vt'].attempts.length === 1);
  const again = new LearnerStore({ storage, now: () => now });
  ok('a new session reloads the record', again.item('cardio/case/vt')?.card.lapses === 1);
  const nopersist = new LearnerStore({ storage: null });
  nopersist.recordAttempt('x', { correct: true });
  ok('works without storage and says so', nopersist.persistent === false && nopersist.item('x'));
  ok('migrate tolerates junk', migrate(null).v === 1 && migrate({ items: 'nope' }).items && typeof migrate({ items: 'nope' }).items === 'object');
  const exported = s.exportJSON();
  const other = new LearnerStore({ storage: memory(), now: () => now });
  other.importJSON(exported);
  ok('export → import round-trips', other.item('cardio/case/vt')?.attempts.length === 1);
  let threw = false; try { other.importJSON('{"hello":1}'); } catch { threw = true; }
  ok('import rejects files that are not learner records', threw);

  // Module lifecycle and honest credit.
  const mod = MODULES[0];
  s.startModule(mod.id);
  s.addActiveSeconds(20 * 60);
  s.savePreTest(mod.id, { score: 0.5, byObjective: {} });
  s.savePostTest(mod.id, { score: 1, passed: true });
  s.saveReflection(mod.id, { commitment: 'Record posterior leads' });
  s.saveEvaluation(mod.id, { objectives: 5 });
  const m = s.completeModule(mod.id, { title: mod.title, maxHours: mod.maxHours });
  ok('certificate claims engaged time, rounded to a quarter hour', m.certificate.hours === 0.25 && m.certificate.minutes === 20);
  s.startModule(MODULES[1].id);
  s.addActiveSeconds(5 * 3600);
  s.savePreTest(MODULES[1].id, { score: 0 }); s.savePostTest(MODULES[1].id, { score: 1, passed: true });
  const m2 = s.completeModule(MODULES[1].id, { title: 'x', maxHours: MODULES[1].maxHours });
  ok('credit is capped at the module maximum', m2.certificate.hours === MODULES[1].maxHours);
  ok('certificate ids are stable and readable', /^CPL-\d{8}-[0-9A-Z]{7}$/.test(m.certificate.id));
  now = T0 + 31 * DAY;
  ok('the 30-day commitment follow-up becomes due', followUpsDue(s.state, now).some((f) => f.moduleId === mod.id));
}

console.log('\nAnalytics');
{
  let now = T0;
  const s = new LearnerStore({ storage: null, now: () => now });
  const items = [
    { id: 'a', domain: 'cardio', topicId: 't1', topic: 'T1' },
    { id: 'b', domain: 'cardio', topicId: 't1', topic: 'T1' },
    { id: 'c', domain: 'neuro', topicId: 't2', topic: 'T2' },
  ];
  s.recordAttempt('a', { correct: true, conf: 'unsure' });
  s.recordAttempt('b', { correct: false, conf: 'sure' });
  now = T0 + 3 * DAY;
  const due = dueItems(s.state, items, now);
  ok('both attempted items are due after three days', due.length === 2);
  ok('confident errors lead the review queue', due[0].item.id === 'b' && due[0].danger);
  const cal = calibration(s.state);
  ok('calibration counts each confidence level', cal.buckets.find((b) => b.id === 'sure').n === 1 && cal.confidentlyWrong === 1);
  ok('streak counts consecutive active days', streak(s.state, T0) === 1 && streak(s.state, T0 + 3 * DAY) === 0);
  const tm = topicMastery(s.state, items, T0 + DAY);
  ok('unseen items pull topic mastery down', tm.find((t) => t.key === 'neuro/t2').mastery === 0);
}

console.log('\nCME modules');
{
  const ids = new Set();
  const add = (d, k, list) => list.forEach((x, i) => ids.add(`${d}/${k}/${x}`));
  for (const s of CARDIO_CASES) add('cardio', 'case', s.cases.map((c) => c.id ?? c.pathId));
  for (const s of NEURO_CASES) add('neuro', 'case', s.cases.map((c) => c.id));
  for (const s of LABS_CASES) add('labs', 'case', s.cases.map((c) => c.id));
  add('cardio', 'lesson', CARDIO_LESSONS.map((l, i) => l.id ?? i));
  add('neuro', 'lesson', NEURO_LESSONS.map((l, i) => l.id ?? i));
  add('labs', 'lesson', LABS_LESSONS.map((l, i) => l.id ?? i));
  const missing = MODULES.flatMap((m) => m.activities.filter((a) => !ids.has(a.ref)).map((a) => `${m.id}:${a.ref}`));
  ok(`every module activity points at a real case or lesson${missing.length ? ` (missing ${missing.join(', ')})` : ''}`, missing.length === 0);
  ok('module ids are unique', new Set(MODULES.map((m) => m.id)).size === MODULES.length);
  const balanced = MODULES.every((m) => m.objectives.every((_, i) => ['a', 'b'].every((f) => m.questions.some((q) => q.objective === i && q.form === f))));
  ok('every objective has a pre-test and a parallel post-test question', balanced);
  const answerable = MODULES.every((m) => m.questions.every((q) => q.options.some((o) => o.id === q.answer) && q.explanation.length > 40));
  ok('every question has its answer among the options and a real explanation', answerable);
  ok('every module has references and an honest review status', MODULES.every((m) => m.references.length >= 2 && m.review?.status));
  const t = buildTest(MODULES[0], 'b', () => 0.3);
  const all = Object.fromEntries(t.map((q) => [q.id, q.answer]));
  ok('a perfect post-test scores 100%', scoreTest(t, all).score === 1);
  const positions = new Set(MODULES.flatMap((m) => buildTest(m, 'a').map((q) => q.options.findIndex((o) => o.id === q.answer))));
  ok('answer position varies once options are shuffled', positions.size > 1);
  const st = moduleStatus({ modules: {}, items: {}, lessons: {} }, MODULES[0]);
  ok('an untouched module is "new" with no progress', st.phase === 'new' && st.progress === 0);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
