/* Phase 6: scenario compiler, triggers, and capability validation. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { unlinkSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const bundle = join(tmpdir(), `phase6-${Date.now()}.mjs`);
await esbuild.build({
  entryPoints: ['scripts/_phase6_entry.ts'],
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
  neurogenicShockDemo,
  compileScenario,
  materialiseSeedCommands,
  listScenarios,
  getScenario,
  evaluateTriggerPredicate,
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

console.log('\nPhase 6 — scenario compiler, triggers, patient-first IA hooks');

ok('registry lists neurogenic-shock-demo',
  listScenarios().some((s) => s.id === 'neurogenic-shock-demo')
  && getScenario('neurogenic-shock-demo')?.id === neurogenicShockDemo.id);

{
  const rt = createPatientRuntime({
    seed: 'phase6',
    settlePhysiology: (params, seconds) => settleWithCirculation(params, seconds),
  });
  const caps = rt.describeCapabilities().capabilities;
  const compiled = compileScenario(neurogenicShockDemo, { availableCapabilities: caps });
  ok('neurogenic demo compiles against runtime capabilities', compiled.ok === true);
  if (compiled.ok) {
    ok('compiled seed commands present', compiled.compiled.seedCommands.length >= 1);
    ok('compiled triggers armed', compiled.compiled.triggers.length >= 2);
    const seeds = materialiseSeedCommands(compiled.compiled);
    ok('materialised seeds have command ids', seeds.every((c) => typeof c.id === 'string' && c.id.length > 0));
    ok('seed source is scenario', seeds[0].source.type === 'scenario');
  }
}

{
  const missing = compileScenario(neurogenicShockDemo, {
    availableCapabilities: ['observation.vital-signs'],
  });
  ok('missing capabilities rejected with UNSUPPORTED_CAPABILITY',
    missing.ok === false && missing.error?.code === 'UNSUPPORTED_CAPABILITY',
    missing.ok === false ? missing.error?.code : 'compiled unexpectedly');
}

{
  const posts = [];
  const rt = createPatientRuntime({
    seed: 'phase6-load',
    cardioHost: { postMessage: (m) => posts.push(m) },
    settlePhysiology: (params, seconds) => settleWithCirculation(params, seconds),
  });

  const loaded = rt.loadScenarioById('neurogenic-shock-demo');
  ok('scenario.load via id accepted', loaded.accepted, JSON.stringify(loaded));
  ok('active scenario is set', rt.activeScenario()?.definition.id === 'neurogenic-shock-demo');
  ok('C5 condition active after load',
    rt.internalStateForModels({ type: 'conditions.active' }).some((c) =>
      c.conditionId === 'cervical-spinal-cord-injury'
      && c.parameters.level === 'C5'));

  await rt.advance(asSimDuration(5000));
  const notes = rt.scenarioAnnotationList();
  ok('sim-time trigger annotated after advance',
    notes.some((n) => n.id === 'five-second-settle-note'),
    JSON.stringify(notes.map((n) => n.id)));

  // Drive hypotension so vital-threshold trigger fires
  rt.ingestCardioSnapshot({
    Pmean: 58, Psys: 85, Pdia: 48, HR: 52, CO: 3.8, EF: 55,
    CVP: 3, Pla: 5, Pmsf: 7, bloodVolume: 5000, Rsys: 0.52, baroEnabled: false,
    ecgValue: 0, qrsAxis: 60, pathology: 'normal',
  });
  const notes2 = rt.scenarioAnnotationList();
  ok('vital-threshold trigger annotated on hypotension',
    notes2.some((n) => n.id === 'hypotension-recognised'),
    JSON.stringify(notes2.map((n) => n.id)));

  const viaCmd = rt.dispatch({
    id: createCommandId(),
    type: 'scenario.clear',
    payload: {},
    source: { type: 'test', id: 'phase6' },
  }, { role: 'test' });
  ok('scenario.clear accepted', viaCmd.accepted);
  ok('conditions cleared after scenario.clear',
    rt.internalStateForModels({ type: 'conditions.active' }).length === 0);
  ok('active scenario cleared', rt.activeScenario() == null);
}

{
  const rt = createPatientRuntime({
    seed: 'phase6-treat',
    cardioHost: { postMessage: () => {} },
  });
  rt.dispatch({
    id: createCommandId(),
    type: 'scenario.load',
    payload: { scenarioId: 'neurogenic-shock-demo' },
    source: { type: 'test', id: 'phase6' },
  }, { role: 'test' });
  const fluid = rt.dispatch({
    id: createCommandId(),
    type: 'treatment.fluid-bolus',
    payload: { volumeMl: 500 },
    source: { type: 'ui', surface: 'treat' },
  }, { role: 'clinical' });
  ok('treatment.fluid-bolus accepted under scenario authority', fluid.accepted, fluid.error?.message);
  const pressor = rt.dispatch({
    id: createCommandId(),
    type: 'treatment.vasopressor',
    payload: { intensity: 0.5 },
    source: { type: 'ui', surface: 'treat' },
  }, { role: 'clinical' });
  ok('treatment.vasopressor accepted', pressor.accepted, pressor.error?.message);

  // Experimental blocked for clinical UI while scenario forbids it
  const exp = rt.dispatch({
    id: createCommandId(),
    type: 'experimental.circulation-param',
    payload: { key: 'bloodVolume', value: 4000 },
    source: { type: 'ui', surface: 'explore' },
  }, { role: 'clinical' });
  ok('experimental circulation blocked for UI under scenario authority',
    !exp.accepted && exp.error?.code === 'UNAUTHORISED_COMMAND');

  // Lesson session may still use experimental
  const lesson = rt.dispatch({
    id: createCommandId(),
    type: 'experimental.circulation-param',
    payload: { key: 'bloodVolume', value: 3500 },
    source: { type: 'lesson', id: 'lactate-loop' },
  }, { role: 'lesson' });
  ok('experimental circulation allowed for lesson source', lesson.accepted);
}

{
  ok('vital-threshold predicate lt works',
    evaluateTriggerPredicate(
      {
        id: 't',
        repeat: false,
        fired: false,
        when: { kind: 'vital-threshold', vital: 'meanArterialPressure', op: 'lt', value: 75 },
        then: { kind: 'annotate', label: 'x' },
      },
      {
        simTimeMs: asSimTime(0),
        activeConditionIds: [],
        vitals: { meanArterialPressure: 60, heartRate: 52, cardiacOutput: 4 },
      },
    ));
}

// Architecture: shell exposes ADR-009 layers
{
  const mainSrc = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  ok('shell documents ADR-009 layers',
    mainSrc.includes('Patient')
    && mainSrc.includes('Examine')
    && mainSrc.includes('Investigate')
    && mainSrc.includes('Treat')
    && mainSrc.includes('Explore'));
  ok('shell keeps specialty domains as explore lenses',
    mainSrc.includes('lenses') && mainSrc.includes('cardioDomain'));
  ok('shell compiles scenario at boot without auto-dispatching injury',
    mainSrc.includes('compileScenario')
    && !mainSrc.includes("type: 'scenario.load'")
    && mainSrc.includes("go('patient.summary')"));
}

try { unlinkSync(bundle); } catch (_) {}
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
