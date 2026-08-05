/* Phase 5: chemistry ground truth vs laboratory observation vs interpretation. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { unlinkSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const bundle = join(tmpdir(), `phase5-${Date.now()}.mjs`);
await esbuild.build({
  entryPoints: ['scripts/_phase5_entry.ts'],
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
  settleWithCirculation,
  CHEMISTRY_DEFAULTS,
  chemistryToLabBag,
  deriveChemistryFromHaemodynamics,
  CHEMISTRY_MODEL_MANIFEST,
  laboratoryPanelObservation,
  interpretAcidBaseFromChemistry,
  snapshotToCardiovascularPublic,
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

console.log('\nPhase 5 — chemistry, laboratory observation, interpretation');

ok('chemistry model declares laboratory capabilities',
  CHEMISTRY_MODEL_MANIFEST.capabilities.includes('laboratory.chemistry-panel')
  && CHEMISTRY_MODEL_MANIFEST.capabilities.includes('laboratory.acid-base'));

{
  const cv = snapshotToCardiovascularPublic({
    Pmean: 55, Psys: 80, Pdia: 45, HR: 110, CO: 2.8, EF: 50,
    CVP: 2, Pla: 4, Pmsf: 5, bloodVolume: 3700, Rsys: 1.2, baroEnabled: true,
  });
  const { statePatch, active } = deriveChemistryFromHaemodynamics(cv, CHEMISTRY_DEFAULTS);
  ok('hypoperfusion raises lactate in chemistry derivation', statePatch.lactate > 2.5,
    String(statePatch.lactate));
  ok('haemorrhage lowers haemoglobin in chemistry derivation', statePatch.haemoglobin < 150,
    String(statePatch.haemoglobin));
  ok('renal hypoperfusion raises urea', statePatch.urea > 5, String(statePatch.urea));
  ok('active derivations listed', active.length >= 2, String(active.map((a) => a.id)));
}

{
  const posts = [];
  const rt = createPatientRuntime({
    seed: 'phase5',
    cardioHost: { postMessage: (m) => posts.push(m) },
    settlePhysiology: (params, seconds) => settleWithCirculation(params, seconds),
  });

  ok('fingerprint includes chemistry model',
    rt.fingerprint.models.some((m) => m.id.includes('chemistry')));

  const phys0 = rt.query({ type: 'state.projection', projection: 'publicPhysiology' });
  ok('public physiology includes chemistry',
    phys0.chemistry && phys0.chemistry.potassium === 4.0);

  // Pin potassium via chemistry command — must reach channel mechanisms, not cardio.setParam from labs.
  const setK = rt.dispatch({
    id: createCommandId(),
    type: 'chemistry.set',
    payload: { values: { K: 7.2 }, pin: true },
    source: { type: 'test', id: 'phase5' },
  });
  ok('chemistry.set accepted', setK.accepted);
  ok('chemistry potassium updated', rt.chemistryState().potassium === 7.2);
  ok('potassium pin recorded', rt.chemistryPinKeys().includes('potassium'));

  const bag = chemistryToLabBag(rt.chemistryState());
  ok('lab bag mirrors chemistry', bag.K === 7.2);

  const panel = unwrapObs(rt.observe({ type: 'observe.laboratory-panel', includeInterpretation: true }));
  ok('laboratory observation provenance cites plugin',
    panel.provenance.modelId === laboratoryPanelObservation.manifest.id);
  ok('laboratory observation reports potassium', panel.value.results.K === 7.2);
  ok('pinned potassium marked as pinned source',
    panel.value.lines.find((l) => l.key === 'K')?.source === 'pinned');
  ok('interpretation is separate from chemistry ground truth',
    panel.value.interpretation && Array.isArray(panel.value.interpretation.steps));

  // Acid–base interpretation from chemistry alone (no observation).
  rt.dispatch({
    id: createCommandId(),
    type: 'chemistry.set',
    payload: { values: { pH: 7.1, HCO3: 10, PaCO2: 3.0, Na: 140, Cl: 100, lactate: 6 }, pin: true },
    source: { type: 'test', id: 'phase5' },
  });
  const abg = interpretAcidBaseFromChemistry(rt.chemistryState());
  ok('interpretation identifies metabolic acidosis',
    abg.primary.includes('metabolic acidosis'), abg.primary);
  ok('interpretation sees raised gap', abg.gapRaised === true);

  // Haemodynamic ingest updates unpinned chemistry.
  rt.dispatch({
    id: createCommandId(),
    type: 'chemistry.unpin',
    payload: { keys: ['lactate', 'pH', 'HCO3', 'Hb', 'urea', 'creat', 'arterialPH', 'bicarbonate', 'haemoglobin', 'creatinine'] },
    source: { type: 'test', id: 'phase5' },
  });
  // Clear pins that would block derivation (potassium stays pinned).
  rt.ingestCardioSnapshot({
    Pmean: 52, Psys: 75, Pdia: 42, HR: 118, CO: 2.5, EF: 48,
    CVP: 1, Pla: 3, Pmsf: 4, bloodVolume: 3600, Rsys: 1.3, baroEnabled: true,
    ecgValue: 0, qrsAxis: 60, pathology: 'normal',
  });
  ok('haemodynamic ingest raises lactate without labs→cardio',
    rt.chemistryState().lactate > 2.5, String(rt.chemistryState().lactate));
  ok('haemodynamic ingest lowers Hb',
    rt.chemistryState().haemoglobin < CHEMISTRY_DEFAULTS.haemoglobin);
  ok('pinned potassium survives haemodynamic ingest',
    rt.chemistryState().potassium === 7.2);

  const afterBleed = unwrapObs(rt.observe({ type: 'observe.laboratory-panel' }));
  ok('observation marks lactate as physiology-derived',
    afterBleed.value.lines.find((l) => l.key === 'lactate')?.source === 'physiology-derived',
    afterBleed.value.lines.find((l) => l.key === 'lactate')?.source);
  ok('active chemistry derivations exposed on observation',
    afterBleed.value.activeDerivations.some((d) => d.id === 'hypoperfusion-lactate'));

  // experimental.circulation-param — labs lessons use this instead of cardio.setParam
  posts.length = 0;
  const exp = rt.dispatch({
    id: createCommandId(),
    type: 'experimental.circulation-param',
    payload: { key: 'bloodVolume', value: 3500 },
    source: { type: 'lesson', id: 'lactate-loop' },
  });
  ok('experimental.circulation-param accepted', exp.accepted);
  ok('experimental command posts setParam to cardio host',
    posts.some((p) => p.type === 'setParam' && p.key === 'bloodVolume' && p.value === 3500),
    JSON.stringify(posts));

  const bad = rt.dispatch({
    id: createCommandId(),
    type: 'experimental.circulation-param',
    payload: { key: 'notARealParam', value: 1 },
    source: { type: 'test', id: 'phase5' },
  });
  ok('unknown circulation param rejected', !bad.accepted);

  const caps = rt.describeCapabilities();
  ok('capabilities include observation.laboratory-panel',
    caps.capabilities.includes('observation.laboratory-panel')
    || caps.observations.includes('laboratory-panel'));

  await rt.advance(asSimDuration(1000));
  ok('advance still works with chemistry model mounted', true);
}

// Architecture: labs domain must not call cardio.setParam
{
  const labsSrc = readFileSync(new URL('../src/domains/labs/index.js', import.meta.url), 'utf8');
  ok('labs domain does not call cardio?.setParam',
    !labsSrc.includes('setParam') && !labsSrc.includes("byId.get('cardio')"));
  ok('labs domain uses chemistry.set / experimental.circulation-param',
    labsSrc.includes('chemistry.set') && labsSrc.includes('experimental.circulation-param'));
  ok('labs domain observes laboratory-panel',
    labsSrc.includes('observe.laboratory-panel'));

  const linksSrc = readFileSync(new URL('../src/domains/labs/data/labs.js', import.meta.url), 'utf8');
  ok('LAB_LINKS no longer writes toPatient',
    !linksSrc.includes('toPatient'));
  ok('LAB_LINKS no longer applies mutable physiology patches',
    !linksSrc.includes('apply:'));
}

try { unlinkSync(bundle); } catch (_) {}
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
