/* Runtime stabilization regressions (review blockers 1–5 + venous/Pmsf). */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const bundle = join(tmpdir(), `stab-${Date.now()}.mjs`);
await esbuild.build({
  entryPoints: ['scripts/_stabilization_entry.ts'],
  bundle: true,
  outfile: bundle,
  format: 'esm',
  target: 'es2022',
  platform: 'node',
  loader: { '.ts': 'ts', '.js': 'js' },
});

const {
  createPatientRuntime,
  createCommandId,
  asSimDuration,
  asSimTime,
  settleWithCirculation,
  NEUROGENIC_COMPLETE_TARGETS,
  CIRCULATION_BASELINE,
  adaptCardioPrivateParams,
  composeEffects,
  neurogenicShockMechanisms,
  RuntimeIdFactory,
  createEffectId,
  authorizeCommand,
  authorizeQuery,
  defaultAuthority,
  neurogenicShockDemo,
  compileScenario,
} = await import(pathToFileURL(bundle).href);

let pass = 0, fail = 0;

function unwrapObs(outcome) {
  if (!outcome) return null;
  if (outcome.accepted === false) return { denied: true, error: outcome.error, value: null };
  if (outcome.accepted === true) return outcome.observation;
  return outcome;
}

const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
};

console.log('\nRuntime stabilization');

{
  const base = settleWithCirculation({
    Rsys: CIRCULATION_BASELINE.Rsys,
    HR: CIRCULATION_BASELINE.HR,
    V0sv: CIRCULATION_BASELINE.V0sv,
    baroEnabled: true,
  }, 5);
  const neuro = settleWithCirculation({
    Rsys: NEUROGENIC_COMPLETE_TARGETS.Rsys,
    HR: NEUROGENIC_COMPLETE_TARGETS.HR,
    V0sv: NEUROGENIC_COMPLETE_TARGETS.V0sv,
    baroEnabled: false,
  }, 5);
  ok('venous pooling raises V0sv above baseline',
    NEUROGENIC_COMPLETE_TARGETS.V0sv > CIRCULATION_BASELINE.V0sv,
    String(NEUROGENIC_COMPLETE_TARGETS.V0sv));
  ok('loss of venous tone lowers mean filling pressure',
    neuro.Pmsf < base.Pmsf,
    `base ${base.Pmsf.toFixed(2)} vs neuro ${neuro.Pmsf.toFixed(2)}`);
  ok('complete neurogenic remains hypotensive', neuro.Pmean < 75, String(neuro.Pmean));
}

{
  const f1 = new RuntimeIdFactory('seedA');
  const f2 = new RuntimeIdFactory('seedA');
  const a = [f1.command('cmd'), f1.command('cmd'), f1.observation('obs')];
  const b = [f2.command('cmd'), f2.command('cmd'), f2.observation('obs')];
  ok('same seed tag yields identical ID sequences', a.join('|') === b.join('|'), `${a} vs ${b}`);
  ok('observation namespace does not advance command seq', f1.peek() === 2);
  ok('IDs include seed tag', a[0].includes('seedA'));

  const e1 = createEffectId({
    conditionId: 'c1', mechanismId: 'm1', port: 'vascular.venousTone', slot: 'ven',
  });
  const e2 = createEffectId({
    conditionId: 'c1', mechanismId: 'm1', port: 'vascular.venousTone', slot: 'ven',
  });
  ok('effect IDs from parts are stable', e1 === e2, `${e1} vs ${e2}`);
}

{
  const onset = asSimTime(0);
  const source = { type: 'condition', id: 'cervical-spinal-cord-injury', instanceId: 'i1' };
  const m1 = neurogenicShockMechanisms({
    level: 'C5', completeness: 1, side: 'bilateral', source, onset, conditionId: 'cervical-spinal-cord-injury',
  });
  const m2 = neurogenicShockMechanisms({
    level: 'C5', completeness: 1, side: 'bilateral', source, onset, conditionId: 'cervical-spinal-cord-injury',
  });
  const ids1 = m1.flatMap((m) => m.effects.map((e) => e.id)).sort().join('|');
  const ids2 = m2.flatMap((m) => m.effects.map((e) => e.id)).sort().join('|');
  ok('re-resolving mechanisms yields identical effect IDs', ids1 === ids2);

  const r1 = composeEffects(m1.flatMap((m) => m.effects), 0);
  const r2 = composeEffects([...m2.flatMap((m) => m.effects)].reverse(), 0);
  ok('composition order-independent with stable IDs',
    Number(r1.get('vascular.venousTone')?.value) === Number(r2.get('vascular.venousTone')?.value));
}

{
  const posts = [];
  const rt = createPatientRuntime({
    seed: 'stab-clock',
    cardioHost: { postMessage: (m) => posts.push(m) },
  });
  rt.play();
  const t0 = Number(rt.query({ type: 'runtime.time' }).simTimeMs);
  rt.ingestCardioSnapshot({ t: 0, Pmean: 90, Psys: 120, Pdia: 70, HR: 70, CO: 5, EF: 55, CVP: 4, Pla: 6, Pmsf: 6, bloodVolume: 5000, Rsys: 1.05, baroEnabled: true });
  rt.ingestCardioSnapshot({ t: 5, Pmean: 88, Psys: 118, Pdia: 68, HR: 70, CO: 5, EF: 55, CVP: 4, Pla: 6, Pmsf: 6, bloodVolume: 5000, Rsys: 1.05, baroEnabled: true });
  const t1 = Number(rt.query({ type: 'runtime.time' }).simTimeMs);
  ok('playing runtime advances simTime from model snapshot t', t1 >= t0 + 4900, `${t0} → ${t1}`);
}

{
  const rt = createPatientRuntime({
    seed: 'stab-advance',
    settlePhysiology: (params, seconds) => settleWithCirculation(params, seconds),
  });
  rt.dispatch({
    id: createCommandId(),
    type: 'condition.activate',
    payload: { condition: 'cervical-spinal-cord-injury', parameters: { level: 'C5', completeness: 1, side: 'bilateral' } },
    source: { type: 'test', id: 'stab' },
  });
  const adv = await rt.advance(asSimDuration(5000));
  ok('headless advance returns physiology for target time',
    adv.publicPhysiology.cardiovascular.meanArterialPressure != null
    && adv.publicPhysiology.cardiovascular.meanArterialPressure < 75);
  ok('headless advance bumps simTime before return', Number(adv.to) === 5000);
}

{
  const rt = createPatientRuntime({
    seed: 'stab-cp',
    settlePhysiology: (params, seconds) => settleWithCirculation(params, seconds),
  });
  rt.setChemistry({ potassium: 6.5, lactate: 4 }, { pin: true });
  rt.dispatch({
    id: rt.ids.command(),
    type: 'experimental.circulation-param',
    payload: { key: 'bloodVolume', value: 4200 },
    source: { type: 'test', id: 'stab' },
  }, { role: 'test' });
  const cp = rt.createCheckpoint('chem');
  rt.setChemistry({ potassium: 3.0 }, { pin: true });
  rt.dispatch({
    id: rt.ids.command(),
    type: 'experimental.circulation-param',
    payload: { key: 'bloodVolume', value: 5000 },
    source: { type: 'test', id: 'stab' },
  }, { role: 'test' });
  rt.restoreCheckpoint(cp);
  ok('checkpoint restores chemistry pins', rt.chemistryState().potassium === 6.5);
  ok('checkpoint restores chemistry lactate', rt.chemistryState().lactate === 4);
  ok('checkpoint restores potassium pin set', rt.chemistryPinKeys().includes('potassium'));
}

{
  const clinical = {
    mode: 'clinical',
    authority: {
      ...neurogenicShockDemo.authority,
      mayReadLatentState: false,
      mayUseExperimentalControls: false,
    },
  };
  const denied = authorizeQuery({ type: 'adapter.cardio.privateParams' }, clinical);
  ok('authority blocks latent adapter query', !!denied && denied.code === 'UNAUTHORISED_COMMAND');
  const allowed = authorizeQuery({ type: 'runtime.time' }, clinical);
  ok('authority allows runtime.time', allowed == null);

  const rt = createPatientRuntime({ seed: 'stab-auth' });
  rt.loadScenarioById('neurogenic-shock-demo');
  const latent = rt.query({ type: 'adapter.cardio.privateParams' });
  ok('loaded clinical scenario blocks privateParams query', latent == null);

  const exam = unwrapObs(rt.observe({ type: 'perform.examination', exam: 'cardiovascular' }));
  // After load without settle, sympathetic may already be low from condition
  ok('examination returns findings array', Array.isArray(exam.value?.findings));

  const rt2 = createPatientRuntime({ seed: 'stab-exam-normal' });
  const normalExam = unwrapObs(rt2.observe({ type: 'perform.examination', exam: 'cardiovascular' }));
  ok('normal exam does not claim loss of sympathetic tone',
    !(normalExam.value?.findings || []).some((f) => /loss of sympathetic/i.test(f)),
    JSON.stringify(normalExam.value?.findings));
}

{
  const rt = createPatientRuntime({
    seed: 'stab-ids',
    settlePhysiology: (params, seconds) => settleWithCirculation(params, seconds),
  });
  const r1 = createPatientRuntime({
    seed: 'stab-ids',
    settlePhysiology: (params, seconds) => settleWithCirculation(params, seconds),
  });
  const cmd = {
    type: 'condition.activate',
    payload: { condition: 'cervical-spinal-cord-injury', parameters: { level: 'C5', completeness: 1, side: 'bilateral' } },
    source: { type: 'test', id: 'stab' },
  };
  const a = rt.dispatch({ ...cmd, id: createCommandId() });
  // re-bind for second runtime
  const b = r1.dispatch({ ...cmd, id: createCommandId() });
  ok('rejects do not bump revision', (() => {
    const before = rt.query({ type: 'runtime.fingerprint' });
    void before;
    const revBefore = a.revision;
    const rej = rt.dispatch({
      id: createCommandId(),
      type: 'experimental.circulation-param',
      payload: { key: 'notARealParam', value: 1 },
      source: { type: 'ui', surface: 'x' },
    });
    return !rej.accepted && rej.revision === revBefore;
  })());
  void b;
}

{
  const priv = adaptCardioPrivateParams(new Map([
    ['vascular.venousTone', { portId: 'vascular.venousTone', value: 0.25, baseline: 1, contributions: [] }],
    ['vascular.systemicArteriolarTone', { portId: 'vascular.systemicArteriolarTone', value: 0.52 / 1.05, baseline: 1, contributions: [] }],
    ['autonomic.cardiacAcceleratorDrive', { portId: 'autonomic.cardiacAcceleratorDrive', value: 52 / 72, baseline: 1, contributions: [] }],
    ['cardiovascular.baroreflexEnabled', { portId: 'cardiovascular.baroreflexEnabled', value: 0, baseline: 1, contributions: [] }],
  ]));
  ok('adapter maps low venous tone to raised V0sv',
    priv.V0sv > CIRCULATION_BASELINE.V0sv && Math.abs(priv.V0sv - NEUROGENIC_COMPLETE_TARGETS.V0sv) < 1e-6,
    String(priv.V0sv));
}

{
  const compiled = compileScenario(neurogenicShockDemo, {
    availableCapabilities: createPatientRuntime({ seed: 'x' }).describeCapabilities().capabilities,
  });
  ok('demo still compiles after stabilization', compiled.ok);
}

try { unlinkSync(bundle); } catch (_) {}
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
