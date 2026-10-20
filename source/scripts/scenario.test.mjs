/* Interventions and scenarios (ADR-018 step 1): the registry, the scene, the case's course on the scenario's clock,
   interventions acting on the running model, and the seeded replay. No new physiology is tested here: only that the
   inputs reach the models the right way, and that the seed and the inputs reproduce a run exactly. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const bundle = join(tmpdir(), `scenario-${Date.now()}.mjs`);
await esbuild.build({ entryPoints: ['scripts/_scenario_entry.ts'], bundle: true, outfile: bundle, format: 'esm', target: 'es2022', platform: 'node', loader: { '.ts': 'ts', '.js': 'js', '.json': 'json' }, logLevel: 'error' });
const S = await import(pathToFileURL(bundle).href);
unlinkSync(bundle);

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); } };
const J = (x) => JSON.stringify(x);
const errors = (issues) => issues.filter((i) => i.level === 'error');
const show = (issues) => issues.map((i) => `${i.path}: ${i.message}`).join('; ');

const caseOf = (id) => S.CASES.find((c) => c.id === id);
const scenarioOf = (id) => S.SCENARIOS.find((s) => s.id === id);
const COPD = scenarioOf('copd-ed-oxygen'), VEST = scenarioOf('vestibular-ed-course');
const start = (def, seed, caseDef = caseOf(def.caseId), more = {}) => new S.ScenarioRun(def, { seed, caseDef, ...more });
/* What a replay must reproduce: everything that followed, the encounter, the model and the patient's values. */
const fingerprint = (run) => J({
  events: run.events, log: run.log, encounter: run.session.encounter.events, state: run.session.state, model: run.live.model,
  circulation: run.live.snap.metricsBreath, resp: run.live.snap.resp, body: run.live.snap.body, scene: run.scene,
});
const kinds = (run, kind) => run.events.filter((e) => e.kind === kind);

console.log('\nThe registry and the scenarios');
{
  const ii = S.validateInterventions(S.INTERVENTIONS, S.CATALOG);
  ok('every intervention is valid: both languages, a time with its source, inputs the running models take', !errors(ii).length, show(ii));
  ok('every intervention’s time says where it comes from; the guessed ones say they are placements', S.INTERVENTIONS.every((x) => x.timing.note && ['measured', 'placement'].includes(x.timing.status)));
  ok('the oxygen devices are the encounter’s own, with the same ids and the same inspired fraction',
    S.INTERVENTIONS.filter((x) => x.id.startsWith('give.oxygen.')).every((x) => S.CATALOG.manoeuvres[x.id]?.sets?.oxygen?.fio2 === x.effect.inputs['respiratory.FiO2']));
  for (const s of S.SCENARIOS) {
    const si = S.validateScenario(s, { cases: S.CASES, interventions: S.INTERVENTION_BY_ID, catalog: S.CATALOG });
    ok(`scenario ${s.id} is valid, in English and German`, !errors(si).length, show(si));
  }
  const bad = structuredClone(COPD);
  bad.machine.states.arrival.label = { en: 'Arrival' };
  bad.machine.states.arrival.next.push({ when: { did: 'no.such-thing' }, to: 'nowhere' });
  const bi = show(errors(S.validateScenario(bad, { cases: S.CASES, interventions: S.INTERVENTION_BY_ID, catalog: S.CATALOG })));
  ok('the validator catches a missing language, an unknown action and an unknown state', /label: missing de/.test(bi) && /unknown action no\.such-thing/.test(bi) && /no state nowhere/.test(bi), bi);
  const writesBody = { ...S.INTERVENTIONS[0], id: 'test.salt', effect: { kind: 'instantaneous', change: [{ path: 'body.sodiumIntake', add: 50 }] } };
  ok('the validator refuses an intervention that writes the body’s slow parameters (they would re-run the illness)',
    errors(S.validateInterventions([writesBody], S.CATALOG)).some((i) => /not a model input/.test(i.message)));
  const c = caseOf('copd-exacerbation'), withUnless = { ...c, course: [{ atMinutes: 1, unless: ['access.iv'], change: { state: { nausea: 1 } } }] };
  ok('a case’s course may be prevented by an intervention', !errors(S.validateCase(withUnless, S.CATALOG, S.REGISTRY)).some((i) => i.path.startsWith('course')));
}

console.log('\nOne seeded generator');
{
  const a = new S.Chance(5), b = new S.Chance(5);
  b.uniform('other'); b.uniform('other');
  ok('each stream depends on the seed and its name alone: drawing from one does not shift another', a.uniform('duration:x') === b.uniform('duration:x'));
  ok('another seed draws otherwise', new S.Chance(5).uniform('x') !== new S.Chance(6).uniform('x'));
}

console.log('\nInputs at rest change nothing');
{
  const run = start(COPD, 7);
  run.advanceTo(30);
  /* The same patient, run by hand the same way: the same settling, the same heart seed, the same ticks. */
  const lp = new S.LivePatient(S.modelFromCase(caseOf('copd-exacerbation')));
  lp.run.heart.seedChance(new S.Chance(7).seedFor('heart'));
  lp.settleNow(20);
  for (let i = 0; i < 300; i++) lp.advance(S.TICK_S);
  ok('a scenario with no inputs runs the patient exactly as the patient runs alone', J(run.live.snap.metricsBreath) === J(lp.snap.metricsBreath) && J(run.live.snap.resp) === J(lp.snap.resp) && J(run.live.snap.body) === J(lp.snap.body));
  ok('…and its model is the case’s, unchanged', J(run.live.model) === J(lp.model));
}

console.log('\nThe scene, and interventions on the running model');
let A;
{
  const run = A = start(COPD, 7);
  ok('the scene starts in its first state, and the nurse says her line in both languages', run.scene === 'arrival' && kinds(run, 'say')[0]?.text.de.length > 0);
  run.advanceTo(5);
  ok('a task needs its equipment: no cannula before the tray has come', !run.intervene('access.iv', 'nurse') && kinds(run, 'blocked').at(-1)?.reason === 'equipment:cannula-kit');
  ok('the nurse puts a 28 % Venturi mask on', run.intervene('give.oxygen.venturi-28', 'nurse'));
  ok('…and is busy meanwhile: she cannot start another task', !run.intervene('give.oxygen.nasal-2', 'nurse') && kinds(run, 'blocked').at(-1)?.reason === 'busy');
  run.advanceTo(20);
  ok('the oxygen takes effect only when the mask is on (after 30 s), not when asked for', run.live.model.respiratory.FiO2 === 0.21 && !run.held.has('oxygen'));
  run.advanceTo(35);
  ok('once on, the lungs breathe 28 % and the patient wears the device', run.live.model.respiratory.FiO2 === 0.28 && run.session.state.oxygen?.fio2 === 0.28 && run.held.get('oxygen')?.id === 'give.oxygen.venturi-28');
  ok('the device is logged in the encounter as a change of state, as the encounter logs it', run.session.encounter.events.some((e) => e.kind === 'state' && e.change.oxygen?.fio2 === 0.28));
  run.advanceTo(60);
  ok('the cannula tray arrives when the scene said it would (60 s)', kinds(run, 'arrive').some((e) => e.t === 60 && e.equipment.includes('cannula-kit')) && run.equipment.has('cannula-kit'));
  ok('the learner places the cannula', run.intervene('access.iv'));
  const draw = kinds(run, 'chance').at(-1);
  const took = kinds(run, 'begin').at(-1).until - 60;
  ok('how long it takes is drawn from the run’s seed, within its range (30–60 s), and the draw is recorded', draw?.stream === 'duration:access.iv' && took >= 30 && took <= 60, `${took} s`);
  ok('the learner cannot examine while the hands are busy', run.examine('measure.spo2').outcome === 'blocked' && kinds(run, 'blocked').at(-1)?.reason === 'busy');
  ok('…but can still order a test: an order takes no one’s hands', run.order('blood-gas'));
  ok('the scene waits for both oxygen and the line', run.scene === 'arrival');
  run.advanceTo(60 + took + 0.1);
  ok('with oxygen on and the line in, the scene moves on, at the next tick', run.scene === 'ready' && run.access.has('iv') && run.over, `${run.scene} at ${run.t} s`);
  run.advanceTo(180);
  const f = run.examine('measure.spo2').findings[0];
  ok('the saturation is measured on 28 %: the examination reads what the running lungs breathe', f?.value?.fio2 === 0.28, J(f?.value));
  /* The same patient without the mask, for comparison: oxygen raises the saturation (direction only; no expected number). */
  const control = start(COPD, 7);
  control.advanceTo(180);
  ok('on oxygen the arterial saturation is higher than without (the existing lungs, no new physiology)', run.live.snap.resp.SaO2 > control.live.snap.resp.SaO2,
    `${(run.live.snap.resp.SaO2 * 100).toFixed(1)} % against ${(control.live.snap.resp.SaO2 * 100).toFixed(1)} %`);
  run.advanceTo(190);
  ok('a reservoir mask replaces the Venturi in the same slot', run.intervene('give.oxygen.nrb-15', 'nurse'));
  run.advanceTo(220);
  ok('…the Venturi comes off as the reservoir mask goes on', run.live.model.respiratory.FiO2 === 0.8 && kinds(run, 'release').at(-1)?.id === 'give.oxygen.venturi-28');
  ok('taking the oxygen off', run.release('oxygen'));
  ok('…returns the lungs and the patient to what they breathed before', run.live.model.respiratory.FiO2 === 0.21 && run.session.state.oxygen === undefined && !run.held.has('oxygen'));
  run.advanceTo(230);
}

console.log('\nThe seed and the inputs replay a run');
{
  const B = S.replay(COPD, { seed: 7, caseDef: caseOf('copd-exacerbation'), log: A.log, until: A.t });
  ok('replayed from its seed and inputs, the run is the same: scene, events, encounter, model and every value', fingerprint(B) === fingerprint(A));
  ok('…including the blocked inputs and the time the cannula took', J(kinds(B, 'blocked')) === J(kinds(A, 'blocked')) && J(kinds(B, 'chance')) === J(kinds(A, 'chance')));
  const C = S.replay(COPD, { seed: 8, caseDef: caseOf('copd-exacerbation'), log: A.log, until: A.t });
  ok('another seed draws another time for the same inputs', kinds(C, 'chance')[0].value !== kinds(A, 'chance')[0].value);
  let threw = false;
  try { A.advanceTo(10); } catch { threw = true; }
  ok('the clock never runs back', threw);
}

console.log('\nWho does it');
{
  const def = structuredClone(COPD);
  def.scene.people.push({ id: 'doctor', role: { en: 'Doctor', de: 'Ärztin' }, present: false });
  def.machine.states.arrival.enter.push({ arrive: { people: ['doctor'], afterSeconds: 10 } });
  const run = start(def, 3);
  ok('someone who is not there yet cannot act', !run.intervene('give.oxygen.nasal-2', 'doctor') && kinds(run, 'blocked').at(-1)?.reason === 'absent');
  run.advanceTo(10);
  ok('…until they arrive', run.actors.doctor.present && run.intervene('give.oxygen.nasal-2', 'doctor'));
  /* A test-only intervention, to check that an instantaneous change reaches the model and a held one can keep the hands busy. */
  const own = {
    ...S.INTERVENTION_BY_ID,
    'test.rate': { id: 'test.rate', label: { en: 'x', de: 'x' }, duration: { seconds: 0 }, timing: { status: 'placement', note: 'test' }, effect: { kind: 'instantaneous', change: [{ path: 'circulation.HR', set: 90 }] } },
    'test.hold': { id: 'test.hold', label: { en: 'x', de: 'x' }, duration: { seconds: 1 }, timing: { status: 'placement', note: 'test' }, effect: { kind: 'continuous', slot: 'hands-test', inputs: { 'circulation.HR': 80 }, handsWhileHeld: true } },
  };
  const r2 = start(COPD, 3, undefined, { interventions: own });
  r2.intervene('test.rate');
  ok('an instantaneous change takes effect at once when it takes no time', r2.live.model.circulation.HR === 90);
  r2.advanceTo(1); r2.intervene('test.hold'); r2.advanceTo(2.5);
  ok('a held intervention that needs hands keeps them busy as long as it is held', r2.live.model.circulation.HR === 80 && r2.examine('measure.hr').outcome === 'blocked');
  ok('…letting go frees them, and what it held returns', r2.release('hands-test') && r2.live.model.circulation.HR === 90 && r2.examine('measure.hr').outcome === 'performed');
}

console.log('\nThe case’s course on the scenario’s clock');
{
  const run = start(VEST, 1);
  run.advanceTo(30);
  const r = run.examine('test.head-impulse', 'L');
  ok('an examination performed in a scenario reads the patient as the encounter does', r.outcome === 'performed' && r.findings.length > 0 && run.session.encounter.events.some((e) => e.kind === 'finding' && e.t === 30000));
  run.advanceTo(30.1);
  ok('the scene moves on what was examined', run.scene === 'examined');
  run.advanceTo(10 * 60);
  ok('the hands are free again after the test’s 10 s', run.actors.learner.busyUntil <= run.tick);
  ok('before its minute the course has not applied', !kinds(run, 'course').length && run.session.state.nausea === 2);
  run.advanceTo(20 * 60);
  const ev = kinds(run, 'course')[0];
  ok('at 20 minutes the case’s course applies, on the scenario’s clock, with its note in both languages', ev?.t === 1200 && !ev.prevented && ev.note?.de && run.session.state.nausea === 3, J(ev));
  ok('…and the examination sees it: the general appearance changed', run.examine('inspect.general').findings[0]?.value?.distress === 'severe');

  /* A course that changes the physiology, and one prevented by what was done: fixtures on the COPD case. */
  const c = caseOf('copd-exacerbation');
  const fix = { ...c, course: [{ atMinutes: 0.5, change: { physiology: { HR: 95 } } }, { atMinutes: 1, unless: ['give.oxygen.nasal-2'], change: { physiology: { HR: 100 } }, note: { en: 'x', de: 'x' } }] };
  const run2 = start(COPD, 2, fix);
  run2.intervene('give.oxygen.nasal-2', 'nurse');
  run2.advanceTo(31);
  ok('the course’s physiology reaches the running model at its minute (the encounter alone does not apply it)', run2.live.model.circulation.HR === 95);
  run2.advanceTo(61);
  const ce = kinds(run2, 'course');
  ok('a course event prevented by an intervention done in time does not apply, and is logged as prevented', ce[1]?.prevented === true && run2.live.model.circulation.HR === 95 && !ce[1].note, J(ce));
}

console.log(`\n${pass} passed, ${fail} failed, 0 known gaps`);
if (fail) process.exit(1);
