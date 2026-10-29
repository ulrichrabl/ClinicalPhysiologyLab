/* Two fits, once each.
   1. The drive of one ECT pulse (ect.pulseDrive), so that a reference adult's seizure threshold with
   bitemporal pads and the 0.5 ms program is 95.4 mC, the mean van Waarde 2012 measured with this device (bilateral,
   0.5 ms, 0.9 A, etomidate: 95.4 ± 59.5 mC; 91 patients).
   The stimulus fitted is the 0.5 ms program's own at that charge: 20 Hz (the program's frequency from 11 to 25 %),
   0.5 ms, 212 pulses (5.3 s). For each of six noise seeds the drive at which it is exactly at threshold is found by
   bisection; the median is the value. Everything else (unilateral and ultrabrief thresholds, the frequency, the
   placements) is checked in scripts/ect.test.mjs, not fitted.
   2. (--emg) The motor cortex's firing above which the cuffed foot's muscles fire (ect.emgThreshold), so that the
   device's EMG endpoint over its EEG endpoint is 0.755, the ratio of the means Gazdag 2004 measured in the same
   seizures under etomidate (EMG 46.3 ± 23.8 s, EEG 61.3 ± 22.4 s): the reference adult, bitemporal, the 0.5 ms
   program at half the age (30 %), median of six seeds.
   Run from source/: node scripts/fit-ect.mjs [--emg]. Prints the values to write into src/vp/evidence/ect.ts. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const bundle = join(tmpdir(), `fit-ect-${Date.now()}.mjs`);
await esbuild.build({ stdin: { contents: "export { seizes } from './src/vp/physiology/brain/ect-trial.ts'; export { ECT } from './src/vp/evidence/ect.ts'; export { EctSession, scriptedTreatment, emgSample, noiseSource, FS } from './src/vp/stations/ect-session.ts'; export { emgEndpoint, eegEndpoint } from './src/vp/stations/ect-indices.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, outfile: bundle, format: 'esm', platform: 'node', loader: { '.json': 'json' }, logLevel: 'error' });
const M = await import(pathToFileURL(bundle).href);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };

if (process.argv.includes('--emg')) {
  const TARGET_RATIO = 46.3 / 61.29, SEEDS2 = [3, 7, 11, 19, 23, 31];
  const runs = SEEDS2.map((seed) => {
    const s = new M.EctSession({ placement: 'BT', prepared: true, skin: 0, seed });
    const r = M.scriptedTreatment(s, { program: 'LOW_05', percent: 30, after: 150 });
    console.log(`  seed ${seed}: EEG endpoint ${r.eegEndpoint?.toFixed(1)} s`);
    return { s, r };
  });
  const ratio = (theta) => {
    const q = runs.map(({ s, r }) => {
      const n = s.rec.n, noise = M.noiseSource(s.patient.seed), emg = new Float32Array(n);
      for (let i = 0; i < n; i++) emg[i] = M.emgSample(s.rec.motor[i], noise, theta);
      const st = r.stimulus, b = [Math.round(s.baselineFrom * M.FS), Math.round(s.readyAt * M.FS)];
      const e = M.emgEndpoint(emg, M.FS, Math.round(st.end * M.FS), b[0], b[1], n);
      return (e ?? 0) / r.eegEndpoint;
    });
    return median(q);
  };
  let lo = 0, hi = 120;
  for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (ratio(m) > TARGET_RATIO) lo = m; else hi = m; }
  console.log(`emgThreshold = ${((lo + hi) / 2).toFixed(2)} (ratio ${ratio((lo + hi) / 2).toFixed(3)})`);
  process.exit(0);
}
const TARGET = 95.4, SEEDS = [3, 7, 11, 19, 23, 31];
const pulses = Math.round(TARGET / (M.ECT.current * 0.5));
const stim = { frequency: 20, pulseWidth: 0.5, pulses };
const scales = SEEDS.map((seed) => {
  let lo = 0.1, hi = 4;
  for (let k = 0; k < 12; k++) { const m = Math.sqrt(lo * hi); if (M.seizes('BT', stim, seed, m)) hi = m; else lo = m; }
  const s = Math.sqrt(lo * hi);
  console.log(`  seed ${seed}: drive at threshold ${(s * M.ECT.pulseDrive).toFixed(4)} mV·s`);
  return s;
});
console.log(`stimulus: ${stim.frequency} Hz, ${stim.pulseWidth} ms, ${pulses} pulses (${(M.ECT.current * 0.5 * pulses).toFixed(1)} mC, ${(pulses / 40).toFixed(2)} s)`);
console.log(`pulseDrive = ${(median(scales) * M.ECT.pulseDrive).toFixed(4)}`);
