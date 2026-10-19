/* Fit the cardiac pump's share of chest compressions (cpr.cardiacExtra) once, to Ornato 1988: arterial systolic
   59 mmHg on a mechanical compressor at 60/min, 50:50 (the mechanical intrathoracic rise of Charbonney 2018).
   Run from source/: node scripts/fit-cpr.mjs. Prints the value to write into src/vp/evidence/cpr.ts; nothing else
   is fitted to Ornato (the diastolic pressure and the rate dependence are validations, in scripts/scenario.test.mjs). */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const bundle = join(tmpdir(), `fit-cpr-${Date.now()}.mjs`);
await esbuild.build({ stdin: { contents: "export { cprTrial } from './src/vp/physiology/cpr/trial.ts'; export { CPR } from './src/vp/evidence/cpr.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, outfile: bundle, format: 'esm', platform: 'node', loader: { '.json': 'json' }, logLevel: 'error' });

const TARGET = 59;
let n = 0;
const systolic = async (k) => {
  globalThis.__CONSTANT_OVERRIDES = { 'cpr.cardiacExtra': k };
  const M = await import(`${pathToFileURL(bundle).href}?k=${n++}`);
  const r = M.cprTrial({ itp: M.CPR.itpMechanical, rate: 60 });
  console.log(`  cardiacExtra ${k.toFixed(3)}: ${r.Psys.toFixed(1)}/${r.Pdia.toFixed(1)} mmHg`);
  return r.Psys;
};
let lo = 0, hi = 0.4, flo = await systolic(lo) - TARGET, fhi = await systolic(hi) - TARGET;
if (flo > 0 || fhi < 0) { console.log('target not bracketed'); process.exit(1); }
for (let i = 0; i < 7; i++) {
  const mid = (lo + hi) / 2, f = await systolic(mid) - TARGET;
  if (f < 0) lo = mid; else hi = mid;
}
console.log(`cardiacExtra = ${((lo + hi) / 2).toFixed(2)}`);
unlinkSync(bundle);
