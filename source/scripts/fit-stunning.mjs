/* Derive the post-arrest stunning's spread once (gap 26): arrest.stunMax, the largest stunning a shock that leaves an
   organised rhythm draws (uniformly from 0 to it), so that the pulseless organised rhythms that follow a shock come back
   to a circulation, under compressions, at Norvik 2022's time-average intensity: 0.15 per minute for PEA after VF/VT.

   How: the ward practice's patient, 4 min of untreated VF, 6 min of compressions, then a shock that leaves an organised
   rhythm with a given stunning S. Compressions go on, with a 5 s pause for a rhythm and pulse check every 2 min, as the
   guideline has them. T(S) is the time of the first check with a pulse (systolic 50 mmHg or more). PEA is what has no
   pulse at the first check; from there each such patient is followed for 20 min. The intensity is the number who come
   back over the minutes spent in PEA, for S drawn uniformly from 0 to stunMax.

   Run from source/: node scripts/fit-stunning.mjs (about an hour). Prints T(S) and the value to write into
   src/vp/evidence/arrest.ts. Validations are in scripts/arrest.test.mjs. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const bundle = join(tmpdir(), `fit-stunning-${Date.now()}.mjs`);
await esbuild.build({ entryPoints: ['scripts/_scenario_entry.ts'], bundle: true, outfile: bundle, format: 'esm', target: 'es2022', platform: 'node', loader: { '.ts': 'ts', '.js': 'js', '.json': 'json' }, logLevel: 'error' });
const S = await import(pathToFileURL(bundle).href);
unlinkSync(bundle);

export const TARGET = 0.15, CHECK = 120, PAUSE = 5, FOLLOW = 1200;
const P = structuredClone(S.SCENARIOS.find((s) => s.id === 'arrest-practice'));
for (const e of P.scene.equipment) e.present = true;
P.machine.states.arrest.enter = P.machine.states.arrest.enter.filter((d) => !('leave' in d) && !('arrive' in d));
const lying = (c) => ({ ...c, initialState: { ...c.initialState, position: 'supine' } });

/** Seconds from the shock to the first check with a pulse, or Infinity (followed to the first check plus FOLLOW). */
const timeToPulse = (stun) => {
  const r = new S.ScenarioRun(P, { seed: 7, caseDef: lying(S.FREE_CASE) });
  r.advanceTo(244); r.assign('compressions', 'nurse'); r.advanceTo(604);
  r.writeModel([['electrical.ventricular', 'none']]); r.live.run.arrest.stun = stun;
  const t0 = r.t;
  for (let k = 1; CHECK * k <= CHECK + FOLLOW; k++) {
    r.advanceTo(t0 + CHECK * k - PAUSE); r.release('compressions', 'nurse'); r.advanceTo(t0 + CHECK * k);
    if (r.rhythm() !== 'organised') return Infinity;
    if (r.live.snap.metrics.Psys >= 50) return CHECK * k;
    r.assign('compressions', 'nurse');
  }
  return Infinity;
};

const grid = [];
for (let s = 0.5; s <= 0.9001; s += 0.02) { const T = timeToPulse(+s.toFixed(2)); grid.push([+s.toFixed(2), T]); console.log(`  S ${s.toFixed(2)}: ${Number.isFinite(T) ? `pulse at ${T} s` : 'no pulse'}`); }

/* T(S) is a step function of S; between grid points the later step is taken (the conservative reading). */
const Tof = (s) => { for (const [g, T] of grid) if (s <= g) return T; return Infinity; };
const intensity = (smax) => {
  let back = 0, minutes = 0, pea = 0;
  for (let i = 0; i < 20000; i++) {
    const T = Tof((i + 0.5) / 20000 * smax);
    if (T <= CHECK) continue;
    pea++;
    const t = Math.min(T - CHECK, FOLLOW);
    minutes += t / 60; if (T - CHECK <= FOLLOW) back++;
  }
  return { intensity: back / minutes, peaShare: pea / 20000 };
};
let lo = 0.6, hi = 1;
for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (intensity(mid).intensity > TARGET) lo = mid; else hi = mid; }
const smax = (lo + hi) / 2, at = intensity(smax);
console.log(`stunMax = ${smax.toFixed(3)} (intensity ${at.intensity.toFixed(3)} per min; ${(at.peaShare * 100).toFixed(0)} % of organised rhythms after a shock are pulseless at the first check)`);
