/* First proof slice: C5 spinal cord injury → neurogenic shock through the
   Patient Runtime (spec §19 acceptance criteria VS-1 … VS-10). */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const outFile = join(tmpdir(), `runtime-slice-${Date.now()}.mjs`);

await esbuild.build({
  entryPoints: ['src/runtime/patient-runtime.ts'],
  bundle: true,
  outfile: outFile,
  format: 'esm',
  target: 'es2022',
  platform: 'node',
  loader: { '.ts': 'ts' },
});

/* Also bundle the adapter + scenario + condition for direct asserts. */
const bundleExtra = join(tmpdir(), `runtime-extra-${Date.now()}.mjs`);
await esbuild.build({
  entryPoints: ['scripts/_runtime_slice_entry.ts'],
  bundle: true,
  outfile: bundleExtra,
  format: 'esm',
  target: 'es2022',
  platform: 'node',
  loader: { '.ts': 'ts' },
});

const {
  createPatientRuntime,
  createCommandId,
  asSimDuration,
  neurogenicShockDemo,
  CIRCULATION_BASELINE,
  NEUROGENIC_COMPLETE_TARGETS,
  adaptCardioPrivateParams,
  composeEffects,
  settleWithCirculation,
} = await import(pathToFileURL(bundleExtra).href);

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

console.log('\nPatient Runtime — C5 neurogenic shock proof slice');

const settleCache = new Map();
function settlePhysiology(params, seconds) {
  const key = `${params.Rsys}|${params.HR}|${params.V0sv}|${params.baroEnabled}|${seconds}`;
  if (settleCache.has(key)) return settleCache.get(key);
  const snap = settleWithCirculation(params, seconds);
  settleCache.set(key, snap);
  return snap;
}

function makeRuntime(seed = 'proof-slice-seed') {
  return createPatientRuntime({
    seed,
    scenario: { id: neurogenicShockDemo.id, version: neurogenicShockDemo.version },
    settlePhysiology,
  });
}

const activateCmd = () => ({
  id: createCommandId(),
  type: neurogenicShockDemo.initialCommand.type,
  payload: { ...neurogenicShockDemo.initialCommand.payload },
  source: { ...neurogenicShockDemo.initialCommand.source },
});

/* VS-1 — no client knows cardiovascular private parameter names. */
{
  const payload = JSON.stringify(neurogenicShockDemo.initialCommand.payload);
  ok('VS-1 scenario payload has no Rsys/V0sv/Emax',
    !/Rsys|V0sv|Emax|baroEnabled/.test(payload), payload);
}

/* VS-2 — condition activates typed mechanisms with provenance. */
{
  const rt = makeRuntime();
  const result = rt.dispatch(activateCmd());
  ok('VS-2 command accepted', result.accepted, JSON.stringify(result.error));
  ok('VS-2 mechanisms include loss-of-sympathetic-outflow',
    result.mechanisms?.includes('loss-of-sympathetic-outflow'));
  const active = rt.query({ type: 'mechanisms.active' });
  ok('VS-2 active mechanism has effect targets',
    active[0]?.effectTargets?.includes('vascular.systemicArteriolarTone'));
  const resolved = rt.query({ type: 'effects.resolved' });
  ok('VS-2 effects carry provenance contributions',
    resolved['autonomic.sympatheticOutflow'].contributions.length >= 1);
}

/* VS-3 — effects compose deterministically with other active mechanisms. */
{
  const a = {
    id: 'eff_a', source: { type: 'condition', conditionId: 'x', instanceId: '1' },
    target: 'vascular.systemicArteriolarTone', operation: 'multiply', value: 0.5,
    onset: 0, provenance: [],
  };
  const b = {
    id: 'eff_b', source: { type: 'condition', conditionId: 'y', instanceId: '2' },
    target: 'vascular.systemicArteriolarTone', operation: 'multiply', value: 0.8,
    onset: 0, provenance: [],
  };
  const r1 = composeEffects([a, b], 0).get('vascular.systemicArteriolarTone').value;
  const r2 = composeEffects([b, a], 0).get('vascular.systemicArteriolarTone').value;
  ok('VS-3 composition is order-independent', r1 === r2 && near(r1, 0.4, 1e-9), `${r1} vs ${r2}`);
}

/* VS-4 — existing circulation receives inputs through one adapter. */
{
  const rt = makeRuntime();
  rt.dispatch(activateCmd());
  const priv = rt.query({ type: 'adapter.cardio.privateParams' });
  ok('VS-4 adapter Rsys matches validated target', near(priv.Rsys, NEUROGENIC_COMPLETE_TARGETS.Rsys, 1e-6), String(priv.Rsys));
  ok('VS-4 adapter HR matches validated target', near(priv.HR, NEUROGENIC_COMPLETE_TARGETS.HR, 1e-6), String(priv.HR));
  ok('VS-4 adapter V0sv matches validated target', near(priv.V0sv, NEUROGENIC_COMPLETE_TARGETS.V0sv, 1e-6), String(priv.V0sv));
  ok('VS-4 adapter disables baroreflex', priv.baroEnabled === false);
}

/* VS-5 — hypotension and bradycardia emerge within documented ranges. */
{
  const rt = makeRuntime();
  rt.dispatch(activateCmd());
  const adv = rt.advance(asSimDuration(8000)); // 8 s settle
  const phys = adv.publicPhysiology.cardiovascular;
  ok('VS-5 MAP is hypotensive (< 75)', phys.meanArterialPressure != null && phys.meanArterialPressure < 75,
    String(phys.meanArterialPressure));
  ok('VS-5 HR shows relative bradycardia (< 60)', phys.heartRate != null && phys.heartRate < 60,
    String(phys.heartRate));
  /* CO may remain near-normal when arteriolar tone falls faster than venous
     filling — the diagnostic pattern is hypotension *without* compensatory
     tachycardia, not a mandatory low-output number. */
  ok('VS-5 CO is not hyperdynamic compensation (> 8 would be)',
    phys.cardiacOutput != null && phys.cardiacOutput < 8,
    String(phys.cardiacOutput));

  const vitals = rt.observe({ type: 'observe.vital-signs' });
  ok('VS-5 vital observation interprets neurogenic shock pattern',
    vitals.interpretation?.some((i) => i.id === 'neurogenic-shock-pattern')
    || (vitals.value.pattern === 'hypotension-with-relative-bradycardia'),
    JSON.stringify(vitals.interpretation));
}

/* VS-6 — resolving the condition restores driven physiology. */
{
  const rt = makeRuntime();
  rt.dispatch(activateCmd());
  rt.advance(asSimDuration(2000));
  const mid = rt.query({ type: 'adapter.cardio.privateParams' });
  ok('VS-6 driven while active', mid.drivenKeys.includes('Rsys'));

  const resolved = rt.dispatch({
    id: createCommandId(),
    type: 'condition.resolve',
    payload: { condition: 'cervical-spinal-cord-injury' },
    source: { type: 'test', id: 'vs6' },
  });
  ok('VS-6 resolve accepted', resolved.accepted);
  const after = rt.query({ type: 'adapter.cardio.privateParams' });
  ok('VS-6 no driven keys after resolve', after.drivenKeys.length === 0, after.drivenKeys.join(','));
  ok('VS-6 Rsys restored to baseline', near(after.Rsys, CIRCULATION_BASELINE.Rsys, 1e-6), String(after.Rsys));
  ok('VS-6 baroreflex restored', after.baroEnabled === true);
  ok('VS-6 cord level cleared', rt.getActiveCordLevel() === null);
}

/* VS-7 — patient view / examination / vitals share canonical trajectory. */
{
  const rt = makeRuntime();
  rt.dispatch(activateCmd());
  rt.advance(asSimDuration(5000));
  const summary = rt.query({ type: 'state.projection', projection: 'clinicalSummary' });
  const exam = rt.observe({ type: 'perform.examination', exam: 'cardiovascular' });
  const vitals = rt.observe({ type: 'observe.vital-signs' });
  const phys = rt.query({ type: 'state.projection', projection: 'publicPhysiology' });
  ok('VS-7 clinical summary reflects cord level',
    summary.activeConditions?.[0]?.parameters?.level === 'C5');
  ok('VS-7 examination findings mention hypotension or bradycardia',
    exam.value.findings.some((f) => /Hypotension|Bradycard/i.test(f)),
    exam.value.findings.join('; '));
  ok('VS-7 vitals MAP matches public physiology',
    vitals.value.bloodPressure.mean === phys.cardiovascular.meanArterialPressure);
}

/* VS-8 — explanation trace links findings to injury → pathways → effects. */
{
  const rt = makeRuntime();
  rt.dispatch(activateCmd());
  rt.advance(asSimDuration(5000));
  const trace = rt.query({ type: 'explanation.vitals' });
  const kinds = new Set(trace.nodes.map((n) => n.kind));
  ok('VS-8 explanation has condition node', kinds.has('condition'));
  ok('VS-8 explanation has mechanism node', kinds.has('mechanism'));
  ok('VS-8 explanation has physiology node', kinds.has('physiology'));
  ok('VS-8 summary mentions C5', /C5/.test(trace.summary), trace.summary.slice(0, 120));
  ok('VS-8 evidence includes adapter.Rsys',
    trace.evidence.some((e) => e.path === 'adapter.Rsys'));
}

/* VS-9 — checkpoint before injury restores exactly. */
{
  const rt = makeRuntime();
  rt.advance(asSimDuration(3000));
  const before = rt.query({ type: 'adapter.cardio.privateParams' });
  const cp = rt.createCheckpoint('pre-injury');
  rt.dispatch(activateCmd());
  rt.advance(asSimDuration(3000));
  const injured = rt.query({ type: 'adapter.cardio.privateParams' });
  ok('VS-9 injury changed Rsys', !near(injured.Rsys, before.Rsys, 1e-6));

  const restored = rt.restoreCheckpoint(cp);
  ok('VS-9 restore accepted', restored.accepted);
  const after = rt.query({ type: 'adapter.cardio.privateParams' });
  ok('VS-9 Rsys restored', near(after.Rsys, before.Rsys, 1e-6), String(after.Rsys));
  ok('VS-9 no active conditions after restore',
    rt.query({ type: 'conditions.active' }).length === 0);
  ok('VS-9 cord level null after restore', rt.getActiveCordLevel() === null);
}

/* VS-10 — replay with same fingerprint and seed reproduces trajectory. */
{
  function runTrajectory(seed) {
    const rt = makeRuntime(seed);
    const fp = rt.fingerprint;
    rt.dispatch(activateCmd());
    rt.advance(asSimDuration(6000));
    const phys = rt.query({ type: 'state.projection', projection: 'publicPhysiology' });
    const priv = rt.query({ type: 'adapter.cardio.privateParams' });
    return {
      fp,
      map: phys.cardiovascular.meanArterialPressure,
      hr: phys.cardiovascular.heartRate,
      co: phys.cardiovascular.cardiacOutput,
      rsys: priv.Rsys,
    };
  }
  const a = runTrajectory('replay-seed');
  const b = runTrajectory('replay-seed');
  ok('VS-10 fingerprints match',
    a.fp.runtimeVersion === b.fp.runtimeVersion && a.fp.seed === b.fp.seed);
  ok('VS-10 MAP reproducible', near(a.map, b.map, 0.05), `${a.map} vs ${b.map}`);
  ok('VS-10 HR reproducible', near(a.hr, b.hr, 0.05), `${a.hr} vs ${b.hr}`);
  ok('VS-10 CO reproducible', near(a.co, b.co, 0.05), `${a.co} vs ${b.co}`);
  ok('VS-10 private Rsys identical', a.rsys === b.rsys);
}

/* Tool-client parity: same command schema works from a generic client. */
{
  const rt = makeRuntime();
  const toolCommand = {
    id: createCommandId(),
    type: 'condition.activate',
    payload: {
      condition: 'cervical-spinal-cord-injury',
      parameters: { level: 'C5', completeness: 1, side: 'bilateral' },
    },
    source: { type: 'agent', sessionId: 'tutor-1', toolCallId: 'activate_condition' },
  };
  const result = rt.dispatch(toolCommand);
  ok('tool client can activate C5 injury', result.accepted);
  ok('capabilities list the condition',
    rt.describeCapabilities().conditions.some((c) => c.id === 'cervical-spinal-cord-injury'));
}

/* Baseline control: healthy settle is not hypotensive. */
{
  const rt = makeRuntime();
  rt.advance(asSimDuration(8000));
  const phys = rt.query({ type: 'state.projection', projection: 'publicPhysiology' });
  ok('baseline MAP is not hypotensive',
    phys.cardiovascular.meanArterialPressure != null
    && phys.cardiovascular.meanArterialPressure > 80,
    String(phys.cardiovascular.meanArterialPressure));
}

try { unlinkSync(outFile); } catch (_) {}
try { unlinkSync(bundleExtra); } catch (_) {}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
