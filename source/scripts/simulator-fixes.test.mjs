/* Regression tests for four simulator bugs:
   1. the runtime rejected every valve parameter (Bench valve sliders did nothing);
   2. the adapter forwarded only six keys to the circulation, dropping the rest;
   3. the baroreflex heart rate was overwritten each step, so bleeding gave no tachycardia;
   4. single-muscle neuro tests ignored upper motor neuron lesions above them. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { BODY_REGIONS } from '../src/domains/neuro/data/exam.js';
import { findingsForNodes } from '../src/domains/neuro/model/localize.js';

let pass = 0; let fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
};

const entryOut = join(tmpdir(), `fixes-entry-${Date.now()}.mjs`);
await esbuild.build({ entryPoints: ['scripts/_fixes_entry.ts'], bundle: true, outfile: entryOut,
  format: 'esm', target: 'es2022', platform: 'node', loader: { '.ts': 'ts' } });
const { createPatientRuntime, applyCardioAdapterToHost, CIRCULATION_BASELINE, createHeadlessCardioHost } = await import(pathToFileURL(entryOut).href);

console.log('\nValve and right-heart parameters reach the circulation');
{
  const sent = [];
  const inner = createHeadlessCardioHost();
  const host = { get onmessage() { return inner.onmessage; }, set onmessage(f) { inner.onmessage = f; },
    postMessage(m) { sent.push(m); inner.postMessage(m); } };
  const rt = createPatientRuntime({ seed: 'fixes-valves', cardioHost: host });
  const set = (key, value) => rt.dispatch({ id: rt.ids.command(), type: 'experimental.circulation-param',
    payload: { key, value }, source: { type: 'ui', surface: 'cardio.loop' } }, { role: 'exploration' });
  const keys = { Raortic: 0.6, Rmitral: 0.1, regAortic: 0.5, regMitral: 0.5, regTricuspid: 0.4, EmaxRv: 0.4, edpB: 0.03 };
  const rejected = Object.entries(keys).filter(([k, v]) => !set(k, v).accepted).map(([k]) => k);
  ok('runtime accepts every Bench valve and right-heart key', rejected.length === 0, rejected.join(', '));
  ok('legacy alias C is accepted as arterial compliance', set('C', 0.6).accepted && rt.experimentalControlKeys().includes('Csa'));
  const forwarded = Object.assign({}, ...sent.filter((m) => m.type === 'setParams').map((m) => m.values));
  const missing = Object.keys(keys).filter((k) => forwarded[k] !== keys[k]);
  ok('every accepted key is forwarded to the circulation host', missing.length === 0, missing.join(', '));
  /* Loading a fresh-patient scenario clears experimental controls without a
     host reset; the adapter must send every cleared key back to normal. */
  sent.length = 0;
  ok('scenario loads', rt.loadScenarioById('neurogenic-shock-demo').accepted);
  const restored = Object.assign({}, ...sent.filter((m) => m.type === 'setParams').map((m) => m.values));
  ok('clearing controls restores a healthy aortic valve', restored.Raortic === 0.02, JSON.stringify(restored.Raortic));
  ok('clearing controls removes the regurgitation', restored.regMitral === 0 && restored.regAortic === 0);
  // A full reset goes through the host's own reset; check the circulation itself.
  let snap = null;
  inner.onmessage = (e) => { if (e.data?.type === 'snapshot') snap = e.data.data; };
  set('Raortic', 0.8);
  rt.dispatch({ id: rt.ids.command(), type: 'runtime.reset', payload: {}, source: { type: 'test', id: 't' } }, { role: 'test' });
  ok('after reset the circulation has a healthy aortic valve', snap?.Raortic === 0.02, JSON.stringify(snap?.Raortic));
}
{
  const sent = [];
  applyCardioAdapterToHost({ postMessage: (m) => sent.push(m) },
    { drivenKeys: ['Csa', 'Rpul', 'Rsys'], Csa: 0.7, Rpul: 0.2, Rsys: 1.4 }, new Set(), CIRCULATION_BASELINE);
  const v = sent.find((m) => m.type === 'setParams')?.values || {};
  ok('adapter forwards compliance and pulmonary resistance, not just six fixed keys', v.Csa === 0.7 && v.Rpul === 0.2 && v.Rsys === 1.4);
}

console.log('\nThe baroreflex drives the heart rate');
{
  const workerOut = join(tmpdir(), `fixes-worker-${Date.now()}.mjs`);
  await esbuild.build({ entryPoints: ['src/domains/cardio/sim/worker.ts'], bundle: true, outfile: workerOut,
    format: 'esm', target: 'es2022', platform: 'browser', loader: { '.ts': 'ts' } });
  const workerCode = readFileSync(workerOut, 'utf8').replace(/^export\s+/gm, '');
  const sim = (params = {}, { baro = true, seconds = 14 } = {}) => {
    let snap = null;
    const fn = new Function('postMessage', 'setInterval', 'clearInterval', 'self', workerCode);
    fn((m) => { if (m.type === 'snapshot' || m.type === 'advanced') snap = m.data; }, () => 1, () => {}, globalThis);
    globalThis.onmessage({ data: { type: 'init' } });
    if (!baro) globalThis.onmessage({ data: { type: 'setBaro', value: false } });
    for (const [k, v] of Object.entries(params)) globalThis.onmessage({ data: { type: 'setParam', key: k, value: v } });
    globalThis.onmessage({ data: { type: 'settle', seconds } });
    return snap;
  };
  const base = sim();
  const bleed = sim({ bloodVolume: 3900 });
  const bleedNoReflex = sim({ bloodVolume: 3900 }, { baro: false });
  ok('a 1.1 L bleed raises the heart rate by at least 15/min', bleed.HR - base.HR >= 15, `${base.HR.toFixed(0)} → ${bleed.HR.toFixed(0)}`);
  ok('without the reflex the rate stays at its set point', Math.abs(bleedNoReflex.HR - 72) <= 3, bleedNoReflex.HR.toFixed(0));
  ok('the reflex defends pressure', bleed.metrics.Pmean > bleedNoReflex.metrics.Pmean + 5,
    `${bleed.metrics.Pmean.toFixed(0)} vs ${bleedNoReflex.metrics.Pmean.toFixed(0)}`);
  const as = sim({ Raortic: 0.35 });
  ok('aortic stenosis produces a transvalvular gradient', as.metrics.aorticGradient > 50, as.metrics.aorticGradient.toFixed(0));
  // The Bench slider's grade labels must match the clinical peak-gradient grades.
  const { BENCH } = await import('../src/domains/cardio/data/reference.js');
  const ctl = BENCH.flatMap((g) => g.items || []).find((c) => c.key === 'Raortic');
  const graded = [['mild', 0, 36], ['moderate', 36, 64], ['severe', 64, 400]].every(([label, lo, hi]) => {
    const vs = [];
    for (let v = ctl.min; v <= ctl.max + 1e-9; v += 0.01) if (ctl.fmt(+v.toFixed(2)) === label) vs.push(+v.toFixed(2));
    const mid = vs[Math.floor(vs.length / 2)];
    const g = sim({ Raortic: mid }).metrics.aorticGradient;
    if (!(g >= lo && g < hi)) console.log(`    ${label} at ${mid}: ${g.toFixed(0)} mmHg`);
    return g >= lo && g < hi;
  });
  ok('Bench aortic stenosis grades match peak gradients (mild < 36, moderate 36–64, severe > 64 mmHg)', graded);
  ok('the slider cannot reach an unsurvivable gradient', sim({ Raortic: ctl.max }).metrics.aorticGradient < 180);
  try { unlinkSync(workerOut); } catch {}
}

console.log('\nUpper motor neuron lesions weaken the muscles below them');
{
  const c5 = ['L_cst_C5', 'R_cst_C5', 'L_ahn_C5', 'R_ahn_C5'];
  const findings = findingsForNodes(c5, true);
  const test = (region, id) => BODY_REGIONS.find((r) => r.id === region).tests.find((t) => t.id === id);
  const hits = (t, f) => f.some((x) => { try { return t.match(x); } catch { return false; } });
  ok('knee extension is weak below a C5 cord lesion', hits(test('R_leg', 'pm_R_quads'), findings));
  ok('finger abduction is weak below a C5 cord lesion', hits(test('L_arm', 'pm_L_fdi'), findings));
  ok('the same tests are normal with no lesion', !hits(test('R_leg', 'pm_R_quads'), []));
  const ulnar = findingsForNodes(['L_nerve_ulnar_elbow'].filter(Boolean), true);
  ok('a nerve lesion does not leak into unrelated leg muscles', !hits(test('R_leg', 'pm_R_quads'), ulnar));
}

try { unlinkSync(entryOut); } catch {}
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
