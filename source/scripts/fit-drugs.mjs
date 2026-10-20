/* Fit adrenaline's two derived constants once (ADR-018 step 4):
     - drugs.adrenalineVolume, so that 2.5 min after a standard dose the plasma level is Wortsman 1993's about
       0.5 µmol/L (91.6 ng/mL; molar mass 183.2 g/mol). The level scales exactly as 1 / volume, so this is one step.
     - drugs.adrenalineResistanceGain, so that the first standard dose in CPR raises the coronary perfusion pressure by
       Paradis 1991's 3.7 mmHg (firstDoseRise in src/vp/physiology/drugs/trial.ts; why the first dose, and not the
       several-dose protocol Paradis measured, is in the constant's derivation).
   Run from source/: node scripts/fit-drugs.mjs. Prints the values to write into src/vp/evidence/drugs.ts; Paradis's own
   protocol, his high dose, the plasma peak and a mechanical compressor's pressures are validations
   (scripts/arrest.test.mjs). */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const bundle = join(tmpdir(), `fit-drugs-${Date.now()}.mjs`);
await esbuild.build({ stdin: { contents: "export { firstDoseRise } from './src/vp/physiology/drugs/trial.ts'; export { DRUGS } from './src/vp/evidence/drugs.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, outfile: bundle, format: 'esm', platform: 'node', loader: { '.json': 'json' }, logLevel: 'error' });

const PLASMA = 0.5 * 183.2, RISE = 3.7;
let n = 0;
const trial = async (volume, gain) => {
  globalThis.__CONSTANT_OVERRIDES = { 'drugs.adrenalineVolume': volume, 'drugs.adrenalineResistanceGain': gain };
  const M = await import(`${pathToFileURL(bundle).href}?k=${n++}`);
  const r = M.firstDoseRise();
  console.log(`  volume ${volume.toFixed(2)} L, gain ${gain.toFixed(4)}: plasma ${r.at150.toFixed(1)} ng/mL at 2.5 min (peak ${r.plasmaPeak.toFixed(0)}), CPP ${r.before.toFixed(1)} → ${r.peak.toFixed(1)} (+${r.rise.toFixed(2)})`);
  return r;
};

const first = await trial(5, 0);
const volume = 5 * first.at150 / PLASMA;
let lo = 0.005, hi = 0.05;
for (let i = 0; i < 8; i++) {
  const mid = Math.sqrt(lo * hi), f = (await trial(volume, mid)).rise - RISE;
  if (f < 0) lo = mid; else hi = mid;
}
const gain = Math.sqrt(lo * hi), last = await trial(volume, gain);
console.log(`adrenalineVolume = ${volume.toFixed(2)} L; adrenalineResistanceGain = ${gain.toFixed(4)} per ng/mL (rise ${last.rise.toFixed(2)} mmHg, plasma at 2.5 min ${last.at150.toFixed(1)} ng/mL)`);
unlinkSync(bundle);
