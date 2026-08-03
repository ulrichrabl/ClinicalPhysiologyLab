/* Regression tests for the hybrid deterministic ECG engine. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const LEADS = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
const out = join(tmpdir(), `ecg-test-${Date.now()}.mjs`);
await esbuild.build({
  entryPoints: ['src/domains/cardio/ecg-engine/index.ts'],
  bundle: true, outfile: out, format: 'esm', target: 'es2022', platform: 'node',
  loader: { '.ts': 'ts' },
});
const { EcgEngine, einthovenError, LeadField, createDenseRegions, meshStats, anisotropicTravelMs } = await import(out);
const { synthesizeTissueLeads } = await import('../src/domains/cardio/ecg-engine/sources/tissue-synthesis.ts');

function runEngine(pathologyId, totalMs, seed = '10392042') {
  const engine = new EcgEngine();
  engine.initialize({
    version: '0.1', seed,
    patient: { phenotypeProfile: 'adult_profile_017', ageYears: 58 },
    conditions: [{ id: pathologyId, severity: 1, expression: 1 }],
    acquisition: { sampleRateHz: 500 },
  });
  for (let t = 0; t < totalMs; t += 2) engine.step(2);
  return { leads: engine.drain(), metrics: engine.getOutput().metrics };
}

function beat(pathologyId = 'normal', ms = 3000, seed = '10392042') {
  const { leads, metrics } = runEngine(pathologyId, ms, seed);
  const r = {};
  const ii = leads.II ?? [];
  let peak = Math.floor(ii.length * 0.5);
  let best = -Infinity;
  for (let i = Math.floor(ii.length * 0.2); i < Math.floor(ii.length * 0.85); i++) {
    if (ii[i] > best) { best = ii[i]; peak = i; }
  }
  for (const l of LEADS) {
    const b = leads[l] ?? [];
    if (b.length < 50) { r[l] = { R: 0, Q: 0, ST: 0, T: 0, NET: 0 }; continue; }
    /* TP baseline before the QRS — not the buffer tail (STEMI elevates the tail). */
    const pre = b.slice(Math.max(0, peak - 180), Math.max(1, peak - 100));
    const base = pre.length
      ? pre.reduce((a, c) => a + c, 0) / pre.length
      : b.slice(Math.floor(b.length * 0.88)).reduce((a, c) => a + c, 0) / Math.max(1, Math.floor(b.length * 0.12));
    const qrs = b.slice(Math.max(0, peak - 25), peak + 40).map((v) => v - base);
    const st = b.slice(peak + 40, peak + 85).map((v) => v - base);
    const tw = b.slice(peak + 90, peak + 160).map((v) => v - base);
    r[l] = {
      R: Math.max(...qrs, 0), Q: Math.min(...qrs, 0),
      ST: st.length ? st.reduce((a, c) => a + c, 0) / st.length : 0,
      T: tw.length ? tw.reduce((a, c) => a + c, 0) / tw.length : 0,
      NET: qrs.length ? qrs.reduce((a, c) => a + c, 0) / qrs.length : 0,
    };
  }
  r._metrics = metrics;
  r._rawII = leads.II;
  return r;
}

let pass = 0, fail = 0;
const ok = (n, c, d = '') => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`); } };

console.log('\nInvariants');
const regs = createDenseRegions();
const stats = meshStats(regs);
ok(`dense mesh has 200+ patches (${stats.total})`, stats.total >= 200, `${stats.total}`);
ok('ventricular patches carry fiberDir', regs.filter((r) => r.chamber === 'LV' || r.chamber === 'RV').every((r) => r.fiberDir), 'missing fiberDir');
const endo = regs.find((r) => r.id.includes('lv_anterior') && r.id.endsWith('_endo'));
const epi = regs.find((r) => r.id.includes('lv_anterior') && r.id.endsWith('_epi'));
const septOrigin = /** @type {[number, number, number]} */ ([0.2, -1.2, 0]);
const tEndo = anisotropicTravelMs(septOrigin, endo, 1);
const tEpi = anisotropicTravelMs(septOrigin, epi, 1);
ok('anisotropy: epi later than endo (same wall)', tEpi > tEndo + 4, `endo ${tEndo.toFixed(1)} epi ${tEpi.toFixed(1)}`);
regs[20].activationTimeMs = 500;
regs[20].repolarizationTimeMs = 780;
const lf = new LeadField(regs, { scale: 34 });
ok('Einthoven law holds', einthovenError(synthesizeTissueLeads(regs, 520, lf, {})) < 1e-6);

console.log('\nDeterminism');
const a = runEngine('normal', 2000, '42');
const b = runEngine('normal', 2000, '42');
ok('identical seed → identical II samples', a.leads.II.length > 0 && a.leads.II.every((v, i) => v === b.leads.II[i]));

console.log('\nNormal sinus');
const N = beat('normal', 3000);
ok('produces ECG samples', N._rawII.length > 500, `len ${N._rawII.length}`);
ok('heart rate 40–120', N._metrics.HR >= 40 && N._metrics.HR <= 120, `${N._metrics.HR}`);
ok('QRS 55–130 ms', N._metrics.QRS >= 55 && N._metrics.QRS <= 130, `${N._metrics.QRS}`);
ok('aVR predominantly negative', N.aVR.NET < 0, N.aVR.NET.toFixed(3));

console.log('\nIschemia');
const ANT = beat('stemi_ant', 4000);
ok('anterior STEMI: ST elevation in V2–V4', ANT.V2.ST > 0.08 || ANT.V3.ST > 0.08 || ANT.V4.ST > 0.08,
  `V2 ${ANT.V2.ST.toFixed(3)} V3 ${ANT.V3.ST.toFixed(3)} V4 ${ANT.V4.ST.toFixed(3)}`);
ok('anterior STEMI: V6 not soft-clip dominated', ANT.V6.R < 2.0, ANT.V6.R.toFixed(3));
ok('anterior STEMI: QRS not ST-inflated', ANT._metrics.QRS <= 140, `${ANT._metrics.QRS}`);
const INF = beat('stemi_inf', 4000);
ok('inferior STEMI: ST elevation in II or III', INF.II.ST > 0.08 || INF.III.ST > 0.08, `II ${INF.II.ST.toFixed(3)} III ${INF.III.ST.toFixed(3)}`);
ok('inferior STEMI: reciprocal I not extreme', INF.I.ST > -0.8, INF.I.ST.toFixed(3));

console.log('\nConduction');
const RBBB = beat('rbbb', 3000);
ok('RBBB widens QRS', RBBB._metrics.QRS >= 110, `${RBBB._metrics.QRS}`);
ok('RBBB terminal force in V1', RBBB.V1.R > 0.15 || RBBB.V1.NET > -0.05, `R ${RBBB.V1.R.toFixed(3)} NET ${RBBB.V1.NET.toFixed(3)}`);
const LBBB = beat('lbbb', 3000);
ok('LBBB widens QRS', LBBB._metrics.QRS >= 110, `${LBBB._metrics.QRS}`);

console.log('\nChannelopathy / pre-excitation');
const BR = beat('brugada1', 4000);
/* Coved type-1: J-point elevation can sit before the mid-ST sample window. */
ok('Brugada: right-precordial elevation or tall early V2', BR.V2.R > 0.15 || BR.V1.R > 0.12 || BR.V2.ST > 0.05,
  `V2.R ${BR.V2.R.toFixed(3)} V1.R ${BR.V1.R.toFixed(3)} V2.ST ${BR.V2.ST.toFixed(3)}`);
const WPW = beat('wpw_a', 4000);
ok('WPW: early positive force in V1', WPW.V1.R > 0.05 || WPW.V1.NET > -0.02, `R ${WPW.V1.R.toFixed(3)} NET ${WPW.V1.NET.toFixed(3)}`);
ok('WPW: PR shorter than normal sinus', WPW._metrics.PR < N._metrics.PR, `WPW ${WPW._metrics.PR} vs N ${N._metrics.PR}`);

console.log('\nElectrolytes');
ok('severe hyperkalaemia runs', beat('hyperk_sev', 3000)._rawII.length > 500);

console.log('\nArrhythmia');
ok('AF produces samples', beat('af', 4000)._rawII.length > 500);
const AF = beat('af', 5000);
ok('AF rate not runaway', AF._metrics.HR >= 50 && AF._metrics.HR <= 140, `${AF._metrics.HR}`);

try { unlinkSync(out); } catch (_) {}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
