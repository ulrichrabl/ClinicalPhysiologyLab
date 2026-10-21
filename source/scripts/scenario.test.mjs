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

const caseOf = (id) => [...S.CASES, S.FREE_CASE].find((c) => c.id === id);
const scenarioOf = (id) => S.SCENARIOS.find((s) => s.id === id);
const COPD = scenarioOf('copd-ed-oxygen'), VEST = scenarioOf('vestibular-ed-course');
const start = (def, seed, caseDef = caseOf(def.caseId), more = {}) => new S.ScenarioRun(def, { seed, caseDef, ...more });
/** The case lying flat from the start: for tests of the compressions themselves, not of laying the bed flat. */
const lying = (c) => ({ ...c, initialState: { ...c.initialState, position: 'supine' } });
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
    const si = S.validateScenario(s, { cases: [...S.CASES, S.FREE_CASE], interventions: S.INTERVENTION_BY_ID, catalog: S.CATALOG });
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
  const cannula = (r) => kinds(r, 'chance').find((e) => e.stream === 'duration:access.iv');
  ok('another seed draws another time for the same inputs', cannula(C).value !== cannula(A).value);
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

console.log('\nChest compressions in a scenario (ADR-018 step 2)');
{
  const own = { ...S.INTERVENTION_BY_ID,
    'test.vf': { id: 'test.vf', label: { en: 'x', de: 'x' }, duration: { seconds: 0 }, timing: { status: 'placement', note: 'test' }, effect: { kind: 'instantaneous', change: [{ path: 'electrical.ventricular', set: 'vf' }] } } };
  /* On the vestibular patient, whose breathing is quiet: the lungs do not yet stop breathing in arrest (step 2b), and a
     breathless patient's pleural swings would pump a little blood on their own. */
  const run = start(VEST, 11, lying(caseOf(VEST.caseId)), { interventions: own });
  run.intervene('test.vf', 'nurse');
  ok('a model input can be a rhythm: the heart fibrillates', run.live.model.electrical.ventricular === 'vf');
  run.advanceTo(20);
  const still = run.live.snap.metrics;
  ok('…and twenty seconds later there is no output', still.CO < 0.1, `CO ${still.CO.toFixed(2)} L/min`);
  ok('a tap before anyone is compressing does nothing', !run.compress(run.t) && kinds(run, 'blocked').at(-1)?.reason === 'not-compressing');
  ok('the learner starts compressions', run.intervene('cpr.compressions'));
  run.advanceTo(22);
  ok('…which keeps the hands busy: no examination while compressing', run.examine('measure.hr').outcome === 'blocked');
  /* Taps at 110/min, landing inside ticks rather than on them, for 30 s. */
  let at = 22.03;
  while (at < 52) { run.advanceTo(Math.floor(at * 10 + 1e-9) / 10); run.compress(Math.round(at * 1000) / 1000); at += 60 / 110; }
  run.advanceTo(53);
  const m = run.live.snap.metrics;
  ok('the learner’s taps make a coronary perfusion pressure and flow', m.CPP > 5 && m.CO > 0.2, `CPP ${m.CPP?.toFixed(1)} mmHg, CO ${m.CO.toFixed(2)} L/min`);
  ok('only the one compressing can tap', !run.compress(run.t, 'nurse') && kinds(run, 'blocked').at(-1)?.reason === 'not-compressing');
  ok('stopping compressions frees the hands', run.release('compressions') && run.examine('measure.hr').outcome === 'performed');
  run.advanceTo(65);
  ok('…and the coronary gradient goes', run.live.run.sim.Part - run.live.run.sim.Pra < 3);
  ok('the nurse takes over compressions, at a steady rate', run.intervene('cpr.compressions', 'nurse'));
  run.advanceTo(95);
  const n = run.live.snap.metrics;
  ok('…which makes flow too', n.CPP > 5 && n.CO > 0.2, `CPP ${n.CPP?.toFixed(1)} mmHg, CO ${n.CO.toFixed(2)} L/min`);
  const R = S.replay(VEST, { seed: 11, caseDef: lying(caseOf('vestibular-neuritis-left')), interventions: own, log: run.log, until: run.t });
  ok('a run with tapped compressions replays exactly from its seed and taps', fingerprint(R) === fingerprint(run));
}

console.log('\nBreaths given in a scenario, and gasping drawn from the seed (ADR-018 step 2b)');
{
  /* Gasping: drawn once per run, from the seed, as Clark's share of VF arrests; its duration from Bobrow's decline. */
  const draws = Array.from({ length: 4000 }, (_, i) => { const c = new S.Chance(i + 1); const u = c.uniform('gasp'); return u < S.LUNG.gaspChanceVf ? -Math.log(1 - c.uniform('gasp-duration')) * S.LUNG.gaspMeanSeconds : 0; });
  const share = draws.filter((x) => x > 0).length / draws.length;
  ok('over many seeds, the share of patients who gasp is Clark’s 56 % for VF (within 3 %)', Math.abs(share - 0.56) < 0.03, `${(share * 100).toFixed(0)} %`);
  const still = (min) => draws.filter((x) => x > min * 60).length / Math.max(1, draws.filter((x) => x > 0).length);
  ok('…and the share still gasping falls with time as in Bobrow’s patients (61, 42 and 21 % at about 4.5, 8 and 11 min; within 8 %)',
    Math.abs(still(4.5) - 20 / 33) < 0.08 && Math.abs(still(8) - 14 / 33) < 0.08 && Math.abs(still(11) - 7 / 33) < 0.08, `${[4.5, 8, 11].map((m) => (still(m) * 100).toFixed(0)).join(', ')} %`);
  const run = start(COPD, 4);
  ok('a run records whether its patient would gasp, as a draw from its seed', kinds(run, 'chance')[0]?.stream === 'gasp' && run.live.run.resp.gaspFor === draws[3]);

  const def = structuredClone(COPD);
  def.scene.equipment.push({ id: 'bag-mask', label: { en: 'Bag-valve-mask', de: 'Beatmungsbeutel mit Maske' }, present: true },
    { id: 'airway-kit', label: { en: 'Airway kit', de: 'Atemwegsset' }, present: true });
  const r = start(def, 4);
  ok('the learner takes the bag', r.intervene('vent.bag'));
  r.advanceTo(6);
  ok('…and gives a breath (squeezed over a second): the chest rises through the mask, less than through a tube', r.ventilate(r.t, 1) && (r.advanceTo(8), r.live.snap.resp.givenVolume > 0.2 && r.live.snap.resp.givenVolume < S.LUNG.bagVolume),
    `${r.live.snap.resp.givenVolume.toFixed(2)} L`);
  ok('only the one holding the bag can give a breath', !r.ventilate(r.t, 1, 'nurse') && kinds(r, 'blocked').at(-1)?.reason === 'not-ventilating');
  ok('the bag keeps the hands busy', r.examine('measure.spo2').outcome === 'blocked');
  ok('the nurse intubates while the learner bags', r.intervene('airway.tube', 'nurse'));
  r.advanceTo(40);
  ok('…and the breaths go through the tube from then on, without leak', r.airway === 'tube' && r.ventilator.route === 'tube' && r.ventilator.reach() === 1);
  r.ventilate(r.t, 1); r.advanceTo(43);
  ok('…so a breath fills the lungs with what was squeezed', Math.abs(r.live.snap.resp.givenVolume - S.LUNG.bagVolume) < 1e-9);
  const R = S.replay(def, { seed: 4, caseDef: caseOf('copd-exacerbation'), log: r.log, until: r.t });
  ok('a run with given breaths replays exactly', fingerprint(R) === fingerprint(r));
}

console.log('\nTaking over (ADR-018 step 2b)');
{
  const def = structuredClone(COPD);
  def.scene.equipment.push({ id: 'bag-mask', label: { en: 'Bag-valve-mask', de: 'Beatmungsbeutel mit Maske' }, present: true },
    { id: 'airway-kit', label: { en: 'Airway kit', de: 'Atemwegsset' }, present: true });
  const r = start(def, 9, lying(caseOf(def.caseId)));
  r.intervene('cpr.compressions');
  r.advanceTo(3);
  ok('the nurse takes over the compressions the learner was doing', r.intervene('cpr.compressions', 'nurse'));
  r.advanceTo(6);
  ok('…and the learner’s hands are free again', !r.actors.learner.hands && r.examine('measure.hr').outcome === 'performed' && kinds(r, 'release').some((e) => e.by === 'learner' && e.slot === 'compressions'));
  r.advanceTo(20);
  r.release('compressions', 'nurse');
  ok('with a mask, the nurse holding the bag gives no breaths until told', r.intervene('vent.bag', 'nurse') && (r.advanceTo(40), r.ventilator.given(0, 1e9).length === 0));
  ok('…and gives one when told', r.ventilate(r.t, 1, 'nurse') && r.ventilator.given(0, 1e9).length === 1);
  r.advanceTo(42);
  ok('once a tube is in, she goes over to 10 breaths a minute', r.intervene('airway.tube', 'learner') && (r.advanceTo(110), r.airway === 'tube' && r.live.snap.resp.givenRate >= 8 && r.live.snap.resp.givenRate <= 12), `${r.live.snap.resp.givenRate?.toFixed(1)}/min`);
}

console.log('\nA breath lasts as long as the bag is squeezed (decision 7)');
{
  const P = structuredClone(scenarioOf('arrest-practice'));
  P.machine.states.arrest.enter = P.machine.states.arrest.enter.filter((d) => !('leave' in d) && !('arrive' in d));
  const r = start(P, 41, S.FREE_CASE);
  r.advanceTo(10);
  ok('squeezing needs the bag in your hands', !r.bag('squeeze', r.t) && kinds(r, 'blocked').at(-1)?.reason === 'not-ventilating');
  r.intervene('vent.bag');
  r.advanceTo(20);
  const held = (s) => { const t0 = r.t; r.bag('squeeze', t0); r.advanceTo(Math.round((t0 + s) * 10) / 10); r.bag('release', r.t); const b = kinds(r, 'breath').at(-1); r.advanceTo(r.t + 6); return b; };
  const quick = held(0.3), standard = held(1.0), long = held(2.0);
  ok('a squeeze held about a second gives the standard breath (bagVolume, 0.5 L)', Math.abs(standard.volume - S.LUNG.bagVolume) < 0.01 && standard.seconds === 1, `${standard.volume} L over ${standard.seconds} s`);
  ok('a quick squeeze gives less: the lungs have not filled to the pressure', quick.volume < 0.8 * standard.volume, `${quick.volume} L over ${quick.seconds} s`);
  ok('holding longer adds little: the lungs have come up to the pressure', long.volume > standard.volume && long.volume < 1.1 * standard.volume, `${long.volume} L over ${long.seconds} s`);
  ok('letting go of a bag not squeezed does nothing', !r.bag('release', r.t) && kinds(r, 'breath').length === 3);
  const R = S.replay(P, { seed: 41, caseDef: S.FREE_CASE, log: r.log, until: r.t });
  ok('a run with held squeezes replays exactly', fingerprint(R) === fingerprint(r) && J(kinds(R, 'breath')) === J(kinds(r, 'breath')));
}

console.log('\nThe practice arrest (a scene that changes the model)');
{
  const P = scenarioOf('arrest-practice');
  const r = start(P, 2, S.FREE_CASE);
  ok('the patient talks, and his heart beats', r.scene === 'talking' && r.live.model.electrical.ventricular !== 'vf');
  r.advanceTo(4.1);
  ok('four seconds in, the scene fibrillates his heart (a scripted change to the model), and the nurse calls it', r.scene === 'arrest' && r.live.model.electrical.ventricular === 'vf' && kinds(r, 'say').some((e) => e.who === 'nurse'));
  r.advanceTo(40);
  ok('…and with no one acting, he has no output', r.live.snap.metrics.CO < 0.1);
  ok('the nurse stays and asks what to do; nothing else comes unless the learner sends for it', r.actors.nurse.present && !kinds(r, 'leave').length && !r.equipment.has('defibrillator'));
  const bad = structuredClone(P);
  bad.machine.states.arrest.enter[0].change[0].path = 'body.sodiumIntake';
  ok('the validator refuses a scene change to the body’s slow parameters', errors(S.validateScenario(bad, { cases: [...S.CASES, S.FREE_CASE], interventions: S.INTERVENTION_BY_ID, catalog: S.CATALOG })).some((i) => /not a model input/.test(i.message)));
}

console.log('\nThe team (ADR-018 step 5, decision 8)');
{
  const P = scenarioOf('arrest-practice');
  const r = start(P, 61, S.FREE_CASE);
  r.advanceTo(6);
  ok('the nurse calls the arrest team, saying where: her hands are busy for the call', r.call(['where', 'arrest', 'defibrillator'], 'nurse') && r.actors.nurse.busyUntil === r.tick + 150 && kinds(r, 'call')[0]?.arriveAt === 126);
  ok('a second call is refused', !r.call(['where'], 'learner') && kinds(r, 'blocked').at(-1)?.reason === 'already-called');
  ok('no compressions while he slumps on the raised head of the bed', !r.assign('compressions', 'learner') && kinds(r, 'blocked').at(-1)?.reason === 'position:supine' && !r.held.get('compressions'));
  ok('the learner lays the bed flat: 3 s, and he lies supine', r.intervene('bed.flat') && r.session.state.position !== 'supine' && (r.advanceTo(9.1), r.session.state.position === 'supine'));
  ok('the learner gives himself the compressions: he holds them, and the task is his', r.assign('compressions', 'learner') && (r.advanceTo(12), r.held.get('compressions')?.by === 'learner' && r.roles.compressions === 'learner'));
  r.advanceTo(30);
  ok('the nurse takes the airway: the bag goes on', r.assign('airway', 'nurse') && (r.advanceTo(36), r.held.get('ventilation')?.by === 'nurse'));
  r.advanceTo(126.1);
  ok('two minutes after the call the doctor and a second nurse arrive with the trolley', r.actors.doctor.present && r.actors.nurse2.present && ['defibrillator', 'cannula-kit', 'drugs'].every((e) => r.equipment.has(e)));
  ok('the doctor takes over the compressions: the learner’s hands are free and the task is hers', r.assign('compressions', 'doctor') && (r.advanceTo(129), r.held.get('compressions')?.by === 'doctor' && !r.actors.learner.hands && r.roles.compressions === 'doctor'));
  ok('the second nurse takes the defibrillator, and puts the pads on', r.assign('defibrillator', 'nurse2') && r.intervene('defib.pads', 'nurse2'));
  r.advanceTo(150);
  ok('when the nurse puts the bag down, the airway is nobody’s', r.release('ventilation', 'nurse') && r.roles.airway === null);
  const R = S.replay(P, { seed: 61, caseDef: S.FREE_CASE, log: r.log, until: r.t });
  ok('a run with a call and tasks replays exactly', fingerprint(R) === fingerprint(r) && J(R.roles) === J(r.roles));

  const vague = start(P, 62, S.FREE_CASE);
  vague.advanceTo(6); vague.call(['arrest'], 'nurse');
  ok('a call that does not say where brings the team 90 s later', kinds(vague, 'call')[0]?.arriveAt === 6 + 120 + 90);
  const fetch = start(P, 63, S.FREE_CASE);
  fetch.advanceTo(6);
  ok('the nurse can be sent for the trolley: she goes, and is back in a minute with it', fetch.intervene('fetch.trolley', 'nurse') && !fetch.actors.nurse.present && (fetch.advanceTo(66.1), fetch.actors.nurse.present && fetch.equipment.has('defibrillator')));
}

console.log('\nThe defibrillator (ADR-018 step 3)');
{
  const P = structuredClone(scenarioOf('arrest-practice'));
  P.scene.equipment.find((e) => e.id === 'defibrillator').present = true;
  P.machine.states.arrest.enter = P.machine.states.arrest.enter.filter((d) => !('leave' in d) && !('arrive' in d));   // the nurse stays, the trolley is here
  const r = start(P, 21, S.FREE_CASE);
  r.advanceTo(5);
  ok('shocking needs pads first', !r.intervene('defib.shock') && kinds(r, 'blocked').at(-1)?.reason === 'access:pads');
  ok('the learner puts the pads on', r.intervene('defib.pads'));
  r.advanceTo(30);
  ok('…and charges', r.access.has('pads') && r.intervene('defib.charge'));
  r.advanceTo(40);
  ok('once charged, a shock is delivered, its outcome drawn from the seed', r.charged && r.intervene('defib.shock') && kinds(r, 'shock').at(-1)?.joules === 150 && kinds(r, 'chance').some((e) => e.stream === 'shock'));
  const out = kinds(r, 'shock').at(-1).outcome;
  ok('…and the rhythm follows the outcome', (out === 'organised' && r.rhythm() === 'organised') || (out === 'asystole' && r.rhythm() === 'asystole') || (out === 'not-terminated' && r.rhythm() === 'vf'), `${out}, rhythm ${r.rhythm()}`);
  ok('a shock without charging does nothing', r.intervene('defib.shock') && kinds(r, 'shock').at(-1)?.outcome === 'no-effect' && kinds(r, 'shock').at(-1)?.joules === 0);
  const R = S.replay(P, { seed: 21, caseDef: S.FREE_CASE, log: r.log, until: r.t });
  ok('a run with shocks replays exactly, outcome and all', fingerprint(R) === fingerprint(r));

  /* Safety: a shock with someone compressing, and a shock of a rhythm that is not shockable, are recorded as hazards. */
  const h = start(P, 22, S.FREE_CASE);
  h.advanceTo(5); h.intervene('defib.pads', 'nurse'); h.intervene('bed.flat'); h.advanceTo(8.1); h.intervene('cpr.compressions');
  h.advanceTo(30); h.intervene('defib.charge', 'nurse'); h.advanceTo(40); h.intervene('defib.shock', 'nurse');
  ok('a shock while someone is compressing is given, and recorded as a hazard', kinds(h, 'hazard').some((e) => e.code === 'shock-while-compressing' && e.by === 'learner'));
  /* A beating heart (the scene's arrest never comes): a shock does nothing to it, and is a hazard. */
  const B = structuredClone(P);
  B.machine.states.talking.next = [{ when: { at: 1199 }, to: 'arrest' }];
  const n = start(B, 23, S.FREE_CASE);
  n.intervene('defib.pads'); n.advanceTo(25); n.intervene('defib.charge'); n.advanceTo(35);
  n.intervene('defib.shock');
  ok('shocking a rhythm that is not shockable (a beating heart) does nothing to it, and is recorded as a hazard',
    kinds(n, 'hazard').some((e) => e.code === 'shock-non-shockable') && n.rhythm() === 'organised' && kinds(n, 'shock').at(-1)?.outcome === 'no-effect');

  /* Over many seeds, the first shock's outcomes follow the measured odds (termination 86.8 %), and VF comes back in most. */
  let term = 0, refib = 0, n2 = 0;
  for (let seed = 100; seed < 260; seed++) {
    const c = new S.Chance(seed);
    const uT = c.uniform('shock'); c.uniform('shock-rhythm');
    const uF = c.uniform('refibrillation');
    if (uT < S.ARREST.shockTermination) { term++; if (uF < S.ARREST.refibrillationChance) refib++; }
    n2++;
  }
  ok('over many seeds, shocks end VF as often as in Stiell’s trial (86.8 %, within 6 %), and VF comes back after most of them (van Alem: 79 %, within 8 %)',
    Math.abs(term / n2 - 0.868) < 0.06 && Math.abs(refib / term - 0.79) < 0.08, `${(term / n2 * 100).toFixed(0)} %, ${(refib / term * 100).toFixed(0)} %`);
  /* VF comes back in a run, when drawn to. */
  let seen = null;
  for (let seed = 300; seed < 340 && !seen; seed++) {
    const q = start(P, seed, S.FREE_CASE);
    q.advanceTo(5); q.intervene('defib.pads'); q.advanceTo(30); q.intervene('defib.charge'); q.advanceTo(40); q.intervene('defib.shock');
    const o = kinds(q, 'shock').at(-1).outcome, planned = kinds(q, 'chance').find((e) => e.stream === 'refibrillation');
    if (o !== 'not-terminated' && planned) { q.advanceTo(40 + 240); seen = { q, planned }; }
  }
  ok('after a terminating shock, VF comes back at the time drawn for it', !!seen && kinds(seen.q, 'refibrillation').length >= 1 && seen.q.rhythm() === 'vf', seen ? seen.planned.use : 'no seed with a terminating shock and a recurrence');
}

console.log('\nDrugs (ADR-018 step 4)');
{
  const P = structuredClone(scenarioOf('arrest-practice'));
  for (const e of P.scene.equipment) e.present = true;
  P.machine.states.arrest.enter = P.machine.states.arrest.enter.filter((d) => !('leave' in d) && !('arrive' in d));   // the nurse stays, the trolley is here
  const r = start(P, 31, S.FREE_CASE);
  r.advanceTo(5);
  ok('no drug without a vein: adrenaline needs IV access first', !r.intervene('drug.adrenaline') && kinds(r, 'blocked').at(-1)?.reason === 'access:iv');
  ok('the nurse puts in a cannula', r.intervene('access.iv', 'nurse'));
  r.intervene('bed.flat'); r.advanceTo(8.1);
  r.intervene('cpr.compressions');
  r.advanceTo(70);
  ok('…and then gives adrenaline 1 mg', r.access.has('iv') && r.intervene('drug.adrenaline', 'nurse'));
  r.advanceTo(90);
  const dose = kinds(r, 'dose').at(-1);
  r.advanceTo(170);
  const level = r.live.run.drugs.adrenaline(), mult = r.live.run.drugs.resistanceMult();
  ok('the dose is recorded, and a minute later it is in the blood and constricts the arterioles', dose?.drug === 'adrenaline' && dose.mg === 1 && dose.by === 'nurse' && level > 50 && mult > 1.5,
    `${level.toFixed(0)} ng/mL, resistance × ${mult.toFixed(2)}`);
  r.advanceTo(170 + 900);
  ok('fifteen minutes later it has nearly gone (half-life 2.6 min: under 3 % of the level a minute after the dose)', r.live.run.drugs.adrenaline() < 0.03 * level && r.live.run.drugs.resistanceMult() < 1.1,
    `${level.toFixed(0)} → ${r.live.run.drugs.adrenaline().toFixed(1)} ng/mL`);
  const R = S.replay(P, { seed: 31, caseDef: S.FREE_CASE, log: r.log, until: r.t });
  ok('a run with a drug replays exactly', fingerprint(R) === fingerprint(r) && R.live.run.drugs.given.adrenaline === 1);

  const noKit = structuredClone(P);
  noKit.scene.equipment.find((e) => e.id === 'drugs').present = false;
  const k = start(noKit, 32, S.FREE_CASE);
  k.advanceTo(5); k.intervene('access.iv'); k.advanceTo(70);
  ok('no drug without the drugs in the room', !k.intervene('drug.adrenaline') && /equipment/.test(kinds(k, 'blocked').at(-1)?.reason ?? ''), kinds(k, 'blocked').at(-1)?.reason);

  /* Amiodarone: on board, the recurrence a seed would have drawn may not come. A seed whose draw falls between the two
     chances (79 % without, 79 % × (1 − 0.13) with) shows it. */
  const withAmio = S.ARREST.refibrillationChance * (1 - S.DRUGS.amiodaroneRecurrenceCut);
  let seed = null;
  for (let s = 400; s < 2000 && seed == null; s++) {
    const c = new S.Chance(s); const uT = c.uniform('shock'); const uR = c.uniform('shock-rhythm'); const uF = c.uniform('refibrillation');
    if (uT < S.ARREST.shockTermination && uR < 0.5 && uF >= withAmio && uF < S.ARREST.refibrillationChance) seed = s;
  }
  const shockRun = (amio) => {
    const q = start(P, seed, S.FREE_CASE);
    q.advanceTo(5); q.intervene('access.iv', 'nurse'); q.intervene('defib.pads');
    q.advanceTo(70);
    if (amio) q.intervene('drug.amiodarone.300', 'nurse');
    q.advanceTo(390); q.intervene('defib.charge'); q.advanceTo(400); q.intervene('defib.shock');   // the dose given by 130 s, arrived by 400
    return q;
  };
  const without = shockRun(false), withA = shockRun(true);
  ok('amiodarone on board, a recurrence the seed draws without it does not come (its cut of 13 %)', seed != null
    && kinds(without, 'chance').some((e) => e.stream === 'refibrillation') && !kinds(withA, 'chance').some((e) => e.stream === 'refibrillation')
    && withA.live.run.drugs.amiodarone() > 0.999 && kinds(withA, 'shock').at(-1).outcome === kinds(without, 'shock').at(-1).outcome, `seed ${seed}`);

  const bad = structuredClone(S.INTERVENTIONS);
  bad.find((x) => x.id === 'drug.adrenaline').effect.dose.mg = 0;
  ok('the validator refuses a dose that is not one', errors(S.validateInterventions(bad, S.CATALOG)).some((i) => /not a drug the model has, or not a dose/.test(i.message)));
}

console.log('\nBefore the first compression: the bed, the breathing, the mouth (ADR-018 step 5, second pass)');
{
  const P = scenarioOf('arrest-practice');
  /* the bolus is drawn from its own stream: find a run with one and a run without */
  let withBolus = null, without = null;
  for (let seed = 1; seed < 80 && !(withBolus && without); seed++) {
    const r = start(P, seed, S.FREE_CASE);
    const draw = kinds(r, 'chance').find((e) => e.stream === 'obstruction');
    if (!draw || (draw.value < 0.25) !== !!r.obstruction) { ok('the obstruction follows its draw', false, `seed ${seed}`); break; }
    if (r.obstruction && !withBolus) withBolus = seed; else if (!r.obstruction && !without) without = seed;
  }
  ok('the scenario puts a bolus in his pharynx in some runs and not in others, by the seed', withBolus != null && without != null, `bolus with seed ${withBolus}, none with ${without}`);

  const c = start(P, without, S.FREE_CASE);
  c.advanceTo(10);
  ok('he slumps where he sat: the head of the bed is still raised', c.session.state.position === 'reclined-45');
  ok('the learner opens the airway and looks for breathing: 7 s', c.intervene('assess.breathing') && c.actors.learner.busyUntil === c.tick + 70);
  c.advanceTo(17.1);
  const look = kinds(c, 'assessed').at(-1);
  ok('…and finds him not breathing normally (a failing centre’s last shallow breaths, gasping, or nothing)', look?.what === 'breathing' && ['failing', 'gasping', 'none'].includes(look.breathing), look?.breathing);
  ok('before the collapse what a look would see is normal breathing (a look takes 7 s, longer than he talks)', (() => { const q = start(P, without, S.FREE_CASE); q.advanceTo(3); return S.breathingOf(q.live.snap.resp) === 'normal'; })());
  ok('a look in his mouth: nothing there', c.intervene('assess.mouth') && (c.advanceTo(20.2), kinds(c, 'assessed').at(-1)?.mouth === 'clear'));

  const b = start(P, withBolus, S.FREE_CASE);
  b.advanceTo(6);
  b.intervene('vent.bag');
  b.advanceTo(12);
  b.ventilate(b.t, 1);
  ok('with a bolus in the pharynx a breath goes nowhere: the chest does not rise', kinds(b, 'breath').at(-1)?.rise === false && b.ventilator.reach() === 0);
  b.release('ventilation');
  ok('a look in his mouth shows it', b.intervene('assess.mouth') && (b.advanceTo(15.1), kinds(b, 'assessed').at(-1)?.mouth === 'bolus'));
  ok('without the airway kit (it is on the trolley) it cannot be taken out', !b.intervene('airway.clear') && kinds(b, 'blocked').at(-1)?.reason === 'equipment:airway-kit');

  const K = structuredClone(P);
  for (const e of K.scene.equipment) e.present = true;
  K.machine.states.arrest.enter = K.machine.states.arrest.enter.filter((d) => !('leave' in d) && !('arrive' in d));
  const k = start(K, withBolus, S.FREE_CASE);
  k.advanceTo(6); k.intervene('vent.bag'); k.advanceTo(12); k.ventilate(k.t, 1);
  ok('with the kit, suction and Magill forceps take it out (10–20 s), and the next breath gets in', k.intervene('airway.clear', 'nurse') && (k.advanceTo(33), !k.obstruction && k.ventilate(k.t, 1) && kinds(k, 'breath').at(-1)?.rise === true && kinds(k, 'obstruction').at(-1)?.what === null));
  ok('a supraglottic airway does not get past a bolus either', (() => { const q = start(K, withBolus, S.FREE_CASE); q.advanceTo(6); q.intervene('airway.supraglottic'); q.advanceTo(27); q.intervene('vent.bag'); q.advanceTo(33); q.ventilate(q.t, 1); return kinds(q, 'breath').at(-1)?.rise === false; })());
  const R = S.replay(K, { seed: withBolus, caseDef: S.FREE_CASE, log: k.log, until: k.t });
  ok('a run with a bolus cleared replays exactly', fingerprint(R) === fingerprint(k) && R.obstruction === null && J(kinds(R, 'obstruction')) === J(kinds(k, 'obstruction')));

  const bad = structuredClone(P); bad.scene.airway.chance = 2;
  ok('the validator refuses an obstruction chance outside 0–1', errors(S.validateScenario(bad, { cases: [...S.CASES, S.FREE_CASE], interventions: S.INTERVENTION_BY_ID, catalog: S.CATALOG })).some((i) => /obstruction/.test(i.message)));
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
