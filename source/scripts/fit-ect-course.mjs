/* The ECT course (part 3): one fit, once. Run from source/:
     node scripts/fit-ect-course.mjs [drive ...]
   For each drive scale (default 0.97 0.94 0.92 0.91 0.90), the threshold charge on the 0.5 ms program (seed 3) for
   bitemporal, right unilateral and bifrontal placement, as a ratio to the full drive. ect-course.driveDrop is 1 minus
   the drive at which the bitemporal ratio reaches 1 + ect-course.thresholdRise (Coffey 1995: about 47 % by the sixth
   treatment); the other two placements are checks. The check itself is in scripts/ect.test.mjs. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const out = join(tmpdir(), `fit-ect-course-${Date.now()}.mjs`);
await esbuild.build({ entryPoints: ['scripts/_ect_entry.ts'], bundle: true, outfile: out, format: 'esm', target: 'es2022', platform: 'node', loader: { '.ts': 'ts', '.js': 'js', '.json': 'json' }, logLevel: 'error' });
const S = await import(pathToFileURL(out).href);
const drives = process.argv.slice(2).map(Number);
const ladder = S.PERCENT_STEPS.filter((p) => p <= 100).map((p) => S.stimulusFor('LOW_05', p, { frequency: 30, pulseWidth: 0.5 })).filter(Boolean);
for (const pl of ['BT', 'RUL', 'BF']) {
  const t1 = S.thresholdCharge(pl, ladder, 3, 1);
  const row = (drives.length ? drives : [0.97, 0.94, 0.92, 0.91, 0.9]).map((d) => { const t = S.thresholdCharge(pl, ladder, 3, d); return `${d}: ${t == null ? '—' : (t / t1).toFixed(2)}`; });
  console.log(`${pl} (${t1.toFixed(1)} mC)  ${row.join('  ')}`);
}
