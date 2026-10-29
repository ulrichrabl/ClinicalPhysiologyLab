/* Two fits, once each.
   1. The relay's activity-driven inhibition (seizure.relayInhibitionRate), so that a seizure started at rest in
   every region lasts as long as a first ECT treatment's EEG seizure: Luccarelli 2021, 71.5 ± 34.7 s (3648 patients).
   The median over six noise seeds.
   2. The scale from cortical firing to dipole moment (seizure.firingToMoment), so that the largest 2 s of that seizure at
   Fz against the linked ears reach 275 µV peak to peak, the middle of Pottkämper 2021's 150–400 µV frontocentrally.
   Run from source/: node scripts/fit-seizure.mjs [--scale-only]. Prints the values to write into
   src/vp/evidence/seizure.ts; the slowing, the suppression afterwards and the postictal gains are validations
   (scripts/seizure.test.mjs), not fitted. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const bundle = join(tmpdir(), `fit-seizure-${Date.now()}.mjs`);
await esbuild.build({ stdin: { contents: "export { seizureTrial } from './src/vp/physiology/brain/trial.ts'; export { scalpFromActivity, frontocentral } from './src/vp/stations/eeg-seizure.ts'; export { CT } from './src/vp/evidence/seizure.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, outfile: bundle, format: 'esm', platform: 'node', loader: { '.json': 'json' }, logLevel: 'error' });

const TARGET = 71.5, SEEDS = [3, 7, 11, 19, 23, 31];
let n = 0;
const median = (a) => { const s = [...a].sort((x, y) => x - y); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };
const duration = async (k) => {
  globalThis.__CONSTANT_OVERRIDES = { 'seizure.relayInhibitionRate': k };
  const M = await import(`${pathToFileURL(bundle).href}?k=${n++}`);
  const d = SEEDS.map((seed) => M.seizureTrial({ seed, seconds: 200 }).duration ?? 0);
  console.log(`  relayInhibitionRate ${k.toFixed(4)}: ${d.map((x) => x.toFixed(0)).join(' ')} s, median ${median(d).toFixed(1)}`);
  return median(d);
};
if (!process.argv.includes('--scale-only')) {
  let lo = 0.005, hi = 0.04, flo = await duration(lo) - TARGET, fhi = await duration(hi) - TARGET;
  if (flo < 0 || fhi > 0) { console.log('target not bracketed'); process.exit(1); }
  for (let i = 0; i < 6; i++) {
    const mid = Math.sqrt(lo * hi), f = await duration(mid) - TARGET;
    if (f > 0) lo = mid; else hi = mid;
  }
  console.log(`relayInhibitionRate = ${Math.sqrt(lo * hi).toFixed(4)}`);
}
{
  globalThis.__CONSTANT_OVERRIDES = {};
  const M = await import(`${pathToFileURL(bundle).href}?scale=${n++}`);
  const best = SEEDS.map((seed) => {
    const t = M.seizureTrial({ seed, seconds: 200 }), fc = M.frontocentral(M.scalpFromActivity(t.activity));
    let b = 0; for (let k = 0; k + 2 * t.fs <= fc.length; k += t.fs) { let lo = Infinity, hi = -Infinity; for (let i = k; i < k + 2 * t.fs; i++) { lo = Math.min(lo, fc[i]); hi = Math.max(hi, fc[i]); } b = Math.max(b, hi - lo); }
    return b;
  });
  const m = median(best);
  console.log(`  at firingToMoment ${M.CT.firingToMoment}: largest 2 s at Fz–ears ${best.map((x) => x.toFixed(0)).join(' ')} µV, median ${m.toFixed(0)}`);
  console.log(`firingToMoment = ${(M.CT.firingToMoment * 275 / m).toPrecision(3)}`);
}
unlinkSync(bundle);
