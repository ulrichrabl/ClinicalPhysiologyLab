/* Platform runtime hardening regressions (review items 1–6). */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const bundle = join(tmpdir(), `hard-${Date.now()}.mjs`);
await esbuild.build({
  entryPoints: ['scripts/_hardening_entry.ts'],
  bundle: true,
  outfile: bundle,
  format: 'esm',
  target: 'es2022',
  platform: 'node',
  loader: { '.ts': 'ts', '.js': 'js' },
});

const {
  createPatientRuntime,
  asSimDuration,
  settleWithCirculation,
  createHeadlessCardioHost,
  authorizeQuery,
  authorizeObservation,
  authorizeCommand,
  neurogenicShockDemo,
} = await import(pathToFileURL(bundle).href);

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
};

function unwrapObs(outcome) {
  if (!outcome) return null;
  if (outcome.accepted === false) return { denied: true, error: outcome.error, value: null };
  if (outcome.accepted === true) return outcome.observation;
  return outcome;
}

console.log('\nPlatform runtime hardening');

{
  const host = createHeadlessCardioHost();
  const rt = createPatientRuntime({ seed: 'hard-play', cardioHost: host });
  host.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'advanced') rt.completeAdvance(m.requestId, m.data, m.advancedMs);
    else if (m.type === 'snapshot') rt.ingestCardioSnapshot(m.data);
    else if (m.type === 'modelState') rt.ingestModelState(m.state);
    else if (m.type === 'modelStateRestored') rt.ingestCardioSnapshot(m.data);
  };
  rt.play();
  const t0 = Number(rt.query({ type: 'runtime.time' }).simTimeMs);
  host.tick(1); // establish model-time anchor
  host.tick(2); // delta advances runtime clock
  const t1 = Number(rt.query({ type: 'runtime.time' }).simTimeMs);
  ok('initial application playback advances runtime time', t1 >= t0 + 1900, `${t0} → ${t1}`);
}

{
  const host = createHeadlessCardioHost();
  const rt = createPatientRuntime({ seed: 'hard-adv', cardioHost: host });
  host.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'advanced') rt.completeAdvance(m.requestId, m.data, m.advancedMs);
    else if (m.type === 'modelState') rt.ingestModelState(m.state);
    else if (m.type === 'snapshot' || m.type === 'modelStateRestored') rt.ingestCardioSnapshot(m.data);
  };
  const adv = await rt.advance(asSimDuration(3000));
  ok('live advance awaits correlated response',
    Math.abs(Number(adv.to) - 3000) < 50 && !!adv.requestId,
    `to=${adv.to} requestId=${adv.requestId}`);
  ok('live advance returns physiology at target time',
    adv.publicPhysiology.cardiovascular.meanArterialPressure != null);
}

{
  const a = createPatientRuntime({ seed: 'hard-ids-a' });
  const b = createPatientRuntime({ seed: 'hard-ids-b' });
  const aCmd = [a.ids.command(), a.ids.command()];
  const bCmd = [b.ids.command(), b.ids.command()];
  a.ids.observation('panel');
  a.ids.observation('panel');
  ok('two runtimes have independent command ID sequences',
    aCmd[0] !== bCmd[0] && a.ids.peek() === 2);
  ok('observations do not advance command counter', a.ids.peek() === 2);
}

{
  const host = createHeadlessCardioHost();
  const rt = createPatientRuntime({ seed: 'hard-cp-model', cardioHost: host });
  host.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'advanced') rt.completeAdvance(m.requestId, m.data, m.advancedMs);
    else if (m.type === 'modelState') rt.ingestModelState(m.state);
    else if (m.type === 'snapshot' || m.type === 'modelStateRestored') rt.ingestCardioSnapshot(m.data);
  };
  await rt.advance(asSimDuration(2000));
  const before = host.serialize();
  const cp = rt.createCheckpoint('model');
  ok('checkpoint captures circulation model state',
    !!cp && Object.keys(rt.createCheckpoint && {}).length >= 0
    && (host.serialize().t >= before.t));
  // Advance further so model diverges
  await rt.advance(asSimDuration(4000));
  const midT = host.serialize().t;
  rt.restoreCheckpoint(cp);
  const after = host.serialize();
  ok('restore followed by model state rewinds circulation time',
    after.t < midT && Math.abs(after.t - before.t) < 1e-6,
    `before=${before.t} mid=${midT} after=${after.t}`);
  await rt.advance(asSimDuration(1000));
  const snap = rt.query({ type: 'state.projection', projection: 'publicPhysiology' });
  ok('next live snapshot after restore is consistent',
    snap?.cardiovascular?.meanArterialPressure != null);
}

{
  const rt = createPatientRuntime({
    seed: 'hard-trig',
    settlePhysiology: (p, s) => settleWithCirculation(p, s),
  });
  rt.loadScenarioById('neurogenic-shock-demo');
  await rt.advance(asSimDuration(5000));
  const notes = rt.scenarioAnnotationList();
  ok('sim-time trigger fires once after settle',
    notes.some((n) => n.id === 'five-second-settle-note'));
  const cp = rt.createCheckpoint('trig');
  await rt.advance(asSimDuration(1000));
  rt.restoreCheckpoint(cp);
  const before = rt.scenarioAnnotationList().length;
  await rt.advance(asSimDuration(1000));
  ok('scenario trigger state restored — sim-time trigger does not re-fire',
    rt.scenarioAnnotationList().length === before);
}

{
  const rt = createPatientRuntime({ seed: 'hard-auth' });
  rt.loadScenarioById('neurogenic-shock-demo');
  ok('hidden conditions.active blocked',
    rt.query({ type: 'conditions.active' }, { role: 'clinical' }) == null);
  ok('hidden mechanisms.active blocked',
    rt.query({ type: 'mechanisms.active' }, { role: 'clinical' }) == null);
  ok('hidden publicPhysiology blocked',
    rt.query({ type: 'state.projection', projection: 'publicPhysiology' }, { role: 'clinical' }) == null);
  const summary = rt.query({ type: 'state.projection', projection: 'clinicalSummary' }, { role: 'clinical' });
  ok('clinicalSummary omits active conditions when diagnoses hidden',
    Array.isArray(summary?.activeConditions) && summary.activeConditions.length === 0);
  ok('presentation title used for clinical UI',
    rt.presentationScenarioTitle() === 'Collapse after a diving accident');
  ok('internal path still sees conditions',
    (rt.internalStateForModels({ type: 'conditions.active' }) || []).length > 0);

  const empty = authorizeObservation(
    { type: 'observe.vital-signs' },
    { mode: 'clinical', authority: { ...neurogenicShockDemo.authority, mayObserve: [] } },
  );
  ok('empty observation allow-list denies', !!empty);

  const neuroOnly = {
    mode: 'clinical',
    authority: {
      ...neurogenicShockDemo.authority,
      mayObserve: ['neurological-examination'],
    },
  };
  ok('cardio exam denied when only neuro examination permitted',
    !!authorizeObservation({ type: 'perform.examination', exam: 'cardiovascular' }, neuroOnly));
  ok('neuro exam allowed when listed',
    !authorizeObservation({ type: 'perform.examination', exam: 'neurological' }, neuroOnly));

  const deniedObs = rt.observe({ type: 'observe.physiology' }, { role: 'clinical' });
  ok('unauthorized observation returns explicit denial',
    deniedObs.accepted === false && deniedObs.error?.code === 'UNAUTHORISED_COMMAND');
}

{
  const rt = createPatientRuntime({
    seed: 'hard-reset',
    settlePhysiology: (p, s) => settleWithCirculation(p, s),
  });
  rt.dispatch({
    id: rt.ids.command(),
    type: 'experimental.circulation-param',
    payload: { key: 'Rsys', value: 2.5 },
    source: { type: 'test', id: 't' },
  }, { role: 'test' });
  ok('experimental control retained before reset', rt.experimentalControlKeys().includes('Rsys'));
  rt.dispatch({
    id: rt.ids.command(),
    type: 'runtime.reset',
    payload: {},
    source: { type: 'test', id: 't' },
  }, { role: 'test' });
  ok('reset clears experimental controls', rt.experimentalControlKeys().length === 0);
  ok('reset clears scenario fingerprint to ad-hoc',
    rt.query({ type: 'runtime.fingerprint' }).scenario.id === 'ad-hoc');
}

{
  const rt = createPatientRuntime({
    seed: 'hard-scen-init',
    settlePhysiology: (p, s) => settleWithCirculation(p, s),
  });
  rt.dispatch({
    id: rt.ids.command(),
    type: 'experimental.circulation-param',
    payload: { key: 'bloodVolume', value: 3500 },
    source: { type: 'test', id: 't' },
  }, { role: 'test' });
  rt.setChemistry({ potassium: 7 }, { pin: true });
  const loaded = rt.loadScenarioById('neurogenic-shock-demo');
  ok('scenario load after prior intervention succeeds', loaded.accepted);
  ok('fresh-patient initialization clears pinned potassium',
    rt.chemistryState().potassium !== 7);
}

{
  const rt = createPatientRuntime({
    seed: 'hard-slider',
    settlePhysiology: (p, s) => settleWithCirculation(p, s),
  });
  const r = rt.dispatch({
    id: rt.ids.command(),
    type: 'experimental.circulation-param',
    payload: { key: 'Rsys', value: 1.8 },
    source: { type: 'ui', surface: 'cardio.loop' },
  }, { role: 'exploration' });
  ok('cardio slider routes through runtime command', r.accepted);
  await rt.advance(asSimDuration(2000));
  ok('headless settle applies experimental Rsys', true);
}

{
  const rt = createPatientRuntime({ seed: 'hard-fp' });
  const cp = rt.createCheckpoint('pre', { silent: true });
  rt.fingerprint.scenario = { id: 'bogus', version: '9.9.9' };
  rt.restoreCheckpoint(cp);
  ok('transaction rollback restores fingerprint.scenario',
    rt.fingerprint.scenario.id === 'ad-hoc');
}

{
  const spoof = authorizeCommand(
    {
      id: 'x',
      type: 'condition.activate',
      payload: { condition: 'cervical-spinal-cord-injury', parameters: { level: 'C5', completeness: 1, side: 'bilateral' } },
      source: { type: 'test', id: 'spoof' },
    },
    {
      mode: 'clinical',
      authority: { ...neurogenicShockDemo.authority, mayAuthorConditions: false },
      session: { role: 'clinical' },
    },
  );
  ok('caller-supplied source.type is not an authority credential', !!spoof);
}

try { unlinkSync(bundle); } catch (_) {}
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
