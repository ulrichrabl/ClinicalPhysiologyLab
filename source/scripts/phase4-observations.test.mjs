/* Phase 4: canonical cardiovascular public state + observation plugins. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const bundle = join(tmpdir(), `phase4-${Date.now()}.mjs`);
await esbuild.build({
  entryPoints: ['scripts/_phase4_entry.ts'],
  bundle: true,
  outfile: bundle,
  format: 'esm',
  target: 'es2022',
  platform: 'node',
  loader: { '.ts': 'ts' },
});

const {
  createPatientRuntime,
  createCommandId,
  asSimDuration,
  settleWithCirculation,
  snapshotToCardiovascularPublic,
  CIRCULATION_MODEL_MANIFEST,
  ELECTROPHYSIOLOGY_MODEL_MANIFEST,
  vitalSignsObservation,
  twelveLeadEcgObservation,
} = await import(pathToFileURL(bundle).href);

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
};

console.log('\nPhase 4 — canonical CV state and observations');

ok('circulation model declares closed-loop capability',
  CIRCULATION_MODEL_MANIFEST.capabilities.includes('cardiovascular.closed-loop'));
ok('ECG model declares twelve-lead capability',
  ELECTROPHYSIOLOGY_MODEL_MANIFEST.capabilities.includes('ecg.twelve-lead'));

{
  const raw = { Pmean: 78, Psys: 110, Pdia: 62, HR: 52, CO: 4.1, EF: 55, CVP: 3, Pla: 5, Pmsf: 7, bloodVolume: 5000, Rsys: 0.52, baroEnabled: false, ecgValue: 0.1, qrsAxis: 60, pathology: 'normal', ecgLeads: { II: [0, 0.1, 0.2] } };
  const pub = snapshotToCardiovascularPublic(raw);
  ok('adapter maps Pmean → meanArterialPressure', pub.meanArterialPressure === 78);
  ok('adapter does not expose Rsys as a public concept name on the object keys used by UI',
    !('Rsys' in pub) && pub.systemicVascularResistance === 0.52);
  ok('private snapshot field Pmean is not copied through', !('Pmean' in pub));
}

{
  const projections = [];
  const rt = createPatientRuntime({
    seed: 'phase4',
    settlePhysiology: (params, seconds) => settleWithCirculation(params, seconds),
    projectChannels: (patch) => projections.push({ ...patch }),
  });

  rt.dispatch({
    id: createCommandId(),
    type: 'condition.activate',
    payload: {
      condition: 'cervical-spinal-cord-injury',
      parameters: { level: 'C5', completeness: 1, side: 'bilateral' },
    },
    source: { type: 'test', id: 'phase4' },
  });
  rt.advance(asSimDuration(5000));

  const phys = rt.query({ type: 'state.projection', projection: 'publicPhysiology' });
  ok('canonical public state has MAP after advance',
    phys.cardiovascular.meanArterialPressure != null
    && phys.cardiovascular.meanArterialPressure < 75,
    String(phys.cardiovascular.meanArterialPressure));
  ok('electrophysiology public state is present',
    phys.electrophysiology && 'effectiveHeartRate' in phys.electrophysiology);
  ok('channel projections emitted for labs consumers',
    projections.some((p) => p.MAP != null), JSON.stringify(projections.slice(-1)));

  const vitals = rt.observe({ type: 'observe.vital-signs' });
  ok('vital observation provenance cites observation plugin',
    vitals.provenance.modelId === vitalSignsObservation.manifest.id);
  ok('vital observation is not the raw snapshot',
    !('Pmean' in vitals.value) && vitals.value.bloodPressure?.mean != null);
  ok('ground truth and observation agree on MAP',
    vitals.value.bloodPressure.mean === phys.cardiovascular.meanArterialPressure);

  const ecg = rt.observe({ type: 'observe.twelve-lead-ecg' });
  ok('ECG observation provenance cites ECG plugin',
    ecg.provenance.modelId === twelveLeadEcgObservation.manifest.id);
  ok('ECG observation has a report string', typeof ecg.value.report === 'string' && ecg.value.report.length > 10);
  ok('ECG observation separates features from latent leads',
    'features' in ecg.value && 'leads' in ecg.value);

  const caps = rt.describeCapabilities();
  ok('capabilities include observation.twelve-lead-ecg',
    caps.capabilities.includes('observation.twelve-lead-ecg')
    || caps.observations.includes('twelve-lead-ecg'));
  ok('fingerprint lists both CV models',
    rt.fingerprint.models.length >= 2
    && rt.fingerprint.models.some((m) => m.id.includes('circulation'))
    && rt.fingerprint.models.some((m) => m.id.includes('electrophysiology')));

  const monitor = rt.monitorSnapshot();
  ok('monitor snapshot exposes Pmean for existing VITALS readers', monitor.Pmean != null);
}

try { unlinkSync(bundle); } catch (_) {}
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
