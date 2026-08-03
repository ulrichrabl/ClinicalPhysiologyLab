/* Regression tests for the closed-loop circulation. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const workerOut = join(tmpdir(), `circ-worker-${Date.now()}.mjs`);
await esbuild.build({
  entryPoints: ['src/domains/cardio/sim/worker.ts'],
  bundle: true, outfile: workerOut, format: 'esm', target: 'es2022', platform: 'browser',
  loader: { '.ts': 'ts' },
});
const workerCode = readFileSync(workerOut, 'utf8').replace(/^export\s+/gm, '');

function sim(params = {}, seconds = 10) {
  let snap = null;
  const postMessage = (m) => { if (m.type === 'snapshot') snap = m.data; };
  const fn = new Function('postMessage', 'setInterval', 'clearInterval', workerCode);
  fn(postMessage, () => 1, () => {});
  globalThis.onmessage({ data: { type: 'init' } });
  for (const [k, v] of Object.entries(params)) globalThis.onmessage({ data: { type: 'setParam', key: k, value: v } });
  globalThis.onmessage({ data: { type: 'settle', seconds } });
  return snap;
}

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

console.log('\nBaseline');
const b = sim();
ok('systolic 105–125', b.Psys > 105 && b.Psys < 125, b.Psys.toFixed(0));
ok('diastolic 65–85', b.Pdia > 65 && b.Pdia < 85, b.Pdia.toFixed(0));
ok('cardiac output 4.5–6.0', b.CO > 4.5 && b.CO < 6.0, b.CO.toFixed(1));
ok('ejection fraction 50–62%', b.EF > 50 && b.EF < 62, b.EF.toFixed(0));
ok('CVP 1–8', b.CVP > 1 && b.CVP < 8, b.CVP.toFixed(1));
ok('PA mean 10–22', b.PpaMean > 10 && b.PpaMean < 22, b.PpaMean.toFixed(1));
ok('PA systolic 15–30', b.PpaSys > 15 && b.PpaSys < 30, b.PpaSys.toFixed(1));
ok('LA pressure 3–10', b.Pla > 3 && b.Pla < 10, b.Pla.toFixed(1));
ok('mean filling pressure 5–10', b.Pmsf > 5 && b.Pmsf < 10, b.Pmsf.toFixed(1));
ok('regurgitant fraction ~0 with competent valves', b.metrics.regurgFraction < 0.12);
ok('ECG leads generated', b.ecgLeads && b.ecgLeads.II && b.ecgLeads.II.length > 0);

console.log('\nConservation of blood');
ok('total volume is preserved', near(b.totalVolume, 5000, 1), b.totalVolume.toFixed(1));
const bv = sim({ bloodVolume: 4200 });
ok('rescaling preserves the new total', near(bv.totalVolume, 4200, 1), bv.totalVolume.toFixed(1));

console.log('\nVenous return (the closed loop)');
const bleeds = [5000, 4500, 4000, 3600].map((v) => sim({ bloodVolume: v }));
ok('filling pressure falls monotonically with volume',
  bleeds.every((x, i) => i === 0 || x.Pmsf < bleeds[i - 1].Pmsf));
ok('cardiac output falls monotonically with volume',
  bleeds.every((x, i) => i === 0 || x.CO < bleeds[i - 1].CO));
ok('the circulation does not stop at a 28% bleed', bleeds[3].Pmean >= 20, bleeds[3].Pmean.toFixed(0));

console.log('\nLeft heart');
const hf = sim({ Emax: 1.0 });
ok('low contractility drops EF below 40%', hf.EF < 40, hf.EF.toFixed(0));

console.log('\nRight heart');
const pe = sim({ Rpul: 0.45 });
ok('PE raises pulmonary artery pressure', pe.PpaMean > b.PpaMean + 12, pe.PpaMean.toFixed(0));
ok('PE lowers cardiac output', pe.CO < b.CO - 0.6, pe.CO.toFixed(1));

try { unlinkSync(workerOut); } catch (_) {}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
