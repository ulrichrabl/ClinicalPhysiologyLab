/* The EEG station, part 2a: the corticothalamic model and generalised seizures, against the published model and against
   what is measured in people (scripts/seizure.test.mjs, in npm test). Comparisons were fixed before the model was run
   against them; a mismatch is a known gap, reported with its numbers. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const bundle = join(tmpdir(), `seizure-${Date.now()}.mjs`);
await esbuild.build({ entryPoints: ['scripts/_seizure_entry.ts'], bundle: true, outfile: bundle, format: 'esm', target: 'es2022', platform: 'node', loader: { '.ts': 'ts', '.js': 'js', '.json': 'json' }, logLevel: 'error' });
const S = await import(pathToFileURL(bundle).href);
unlinkSync(bundle);

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); } };
const gaps = [];
const gap = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { gaps.push(name); console.log(`  △ known gap: ${name}${detail ? ' — ' + detail : ''}`); } };
const J = (x) => JSON.stringify(x);
const f1 = (x) => (x == null ? '—' : x.toFixed(1)), f2 = (x) => (x == null ? '—' : x.toFixed(2));
const median = (a) => { const s = [...a].sort((x, y) => x - y); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };

/* one region of the published model, with the seizure's slow processes held off */
const region = (nuSE) => { const r = new S.Region({ ...S.DEFAULT_PARAMS, nuSE }); r.rest = 1e9; return r; };
const run = (r, seconds, fn) => { const n = Math.round(seconds / r.dt); for (let k = 0; k < n; k++) { fn?.(k * r.dt); r.step(0); } };
const sdOver = (r, seconds) => { const v = []; const n = Math.round(seconds / r.dt); for (let k = 0; k < n; k++) { r.step(0); if (k % 10 === 0) v.push(r.x[0]); } const m = v.reduce((s, x) => s + x, 0) / v.length; return { sd: Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length), v }; };

console.log('\nThe published model (Deeba 2020)');
{
  /* stable: a perturbation shrinks (its size over the first 2 s against 4–6 s later); near the threshold it shrinks slowly */
  const stable = (nuSE) => { const r = region(nuSE); run(r, 8); r.x[0] += 1; const a = sdOver(r, 2).sd; run(r, 2); return sdOver(r, 2).sd < 0.8 * a; };
  ok('the resting state is stable at νse 1.00 and unstable at 1.05 mV·s (Deeba: the instability at 1.025)', stable(1.0) && !stable(1.05));
  const r = region(1.1); run(r, 6); const { v } = sdOver(r, 4); const m = v.reduce((s, x) => s + x, 0) / v.length;
  let zc = 0; for (let i = 1; i < v.length; i++) if (v[i - 1] < m && v[i] >= m) zc++;
  ok('beyond it the seizure cycle runs near 10 Hz', zc / 4 > 8.5 && zc / 4 < 11.5, `${(zc / 4).toFixed(1)} Hz`);
  const kicked = (mV) => { const q = region(S.CT.nuSE); run(q, 6); run(q, 0.05, () => { q.kick = mV; }); q.kick = 0; run(q, 6); return sdOver(q, 2).sd; };
  const small = kicked(2), big = kicked(20);
  ok(`at rest (νse ${S.CT.nuSE}) the model is bistable: a 20 mV, 50 ms kick to the relay starts a lasting cycle, a 2 mV kick does not (a threshold)`, big > 5 && small < 0.5, `SD ${f2(small)} vs ${f2(big)} /s`);
}

console.log('\nA generalised seizure, started in every region (three noise seeds)');
const trials = [7, 11, 23].map((seed) => S.seizureTrial({ seed, seconds: 240 }));
{
  const d = trials.map((t) => t.duration);
  ok('every trial seizes, and it ends', d.every((x) => x != null && x < 230), J(d.map(f1)));
  ok('duration within a first ECT treatment’s mean ± SD (Luccarelli 2021: 71.5 ± 34.7 s; the median is fitted, the spread is not)', d.every((x) => x >= 71.5 - 34.7 && x <= 71.5 + 34.7), J(d.map(f1)));
  const fr = trials.map((t) => { const f = t.frequency.map((x) => x.hz), q = Math.max(1, Math.floor(f.length / 4)); return { first: f.slice(0, q).reduce((s, x) => s + x, 0) / q, last: f.slice(-q).reduce((s, x) => s + x, 0) / q, min: Math.min(...f) }; });
  ok('it begins fast: the first quarter at 8 Hz or more (Deeba: the 10 Hz cycle; ECT: 6–12 Hz, Pottkämper 2021)', fr.every((x) => x.first >= 8), J(fr.map((x) => f1(x.first))));
  ok('it slows: the last quarter slower than the first (Pottkämper 2021, every seizure; Stuiver 2025)', fr.every((x) => x.last < x.first - 2), J(fr.map((x) => `${f1(x.first)}→${f1(x.last)}`)));
  gap('…to the spike-and-wave of the late phase: the last quarter at 3.5 Hz or less (Pottkämper 2021: 2.5–3.5 Hz; ends near 2 Hz)', fr.every((x) => x.last <= 3.5), J(fr.map((x) => `last quarter ${f1(x.last)} Hz, slowest 2 s ${f1(x.min)} Hz`)));
  const sup = trials.map((t) => t.sdAfter / t.sdBefore);
  ok('afterwards the cortex is quieter than before the seizure (postictal suppression)', sup.every((x) => x < 0.5), J(sup.map(f2)));
  const g = trials.map((t) => t.gainsPost), gr = trials[0].gainsRest;
  console.log(`    gains at rest X ${f2(gr.X)} Y ${f2(gr.Y)} Z ${f2(gr.Z)}; postictal ${g.map((x) => x ? `X ${f2(x.X)} Y ${f2(x.Y)} Z ${f2(x.Z)}` : '—').join('; ')}`);
  ok('right after the seizure the intrathalamic gain is near zero (Stuiver 2026: Z ≈ 0; |Z| < 0.1)', g.every((x) => x && Math.abs(x.Z) < 0.1));
  gap('…the corticothalamic loop gain negative (Stuiver 2026: Y < 0)', g.every((x) => x && x.Y < 0), J(g.map((x) => f2(x?.Y))));
  gap('…and the cortical gain close to 1 (Stuiver 2026; here at least 0.74, their lower bound at reorientation)', g.every((x) => x && x.X >= 0.74), J(g.map((x) => f2(x?.X))));
}

console.log('\nAt the scalp (the regions through part 1’s head)');
{
  const largest = (tr) => { const fc = S.frontocentral(S.scalpFromActivity(tr.activity)), fs = tr.fs; let b = 0; for (let k = 0; k + 2 * fs <= fc.length; k += fs) { let lo = Infinity, hi = -Infinity; for (let i = k; i < k + 2 * fs; i++) { lo = Math.min(lo, fc[i]); hi = Math.max(hi, fc[i]); } b = Math.max(b, hi - lo); } return b; };
  const each = trials.map(largest), best = median(each);
  ok('the scale is fitted: the largest 2 s at Fz against the linked ears reach 275 µV peak to peak, median of the seeds (± 15 %)', Math.abs(best - 275) / 275 < 0.15, `${each.map((x) => x.toFixed(0)).join(', ')} µV`);
  ok('…each seizure within Pottkämper 2021’s 150–400 µV frontocentrally', each.every((x) => x >= 150 && x <= 400), `${each.map((x) => x.toFixed(0)).join(', ')} µV`);
  const t = trials[0], scalp = S.scalpFromActivity(t.activity), fc = S.frontocentral(scalp), fs = t.fs;
  const swing = Math.max(...t.activity.map((a) => Math.max(...Array.from(a).map(Math.abs))));
  ok('the moment density it implies stays within the human cortex’s (Murakami & Okada 2015: 0.16–0.77, at most 1–2 nAm/mm²)', swing * S.CT.firingToMoment <= 2, `${(swing * S.CT.firingToMoment).toFixed(2)} nAm/mm² at the largest swing`);
  const e = Math.max(...t.end.filter((x) => x != null));
  const after = (from) => { let lo = Infinity, hi = -Infinity; for (let i = Math.round(from * fs); i < Math.round((from + 2) * fs); i++) { const m = fc.slice(Math.round(from * fs), Math.round((from + 2) * fs)).reduce((s, x) => s + x, 0) / (2 * fs); lo = Math.min(lo, fc[i] - m); hi = Math.max(hi, fc[i] - m); } return (hi - lo) / 2; };
  const pges = Math.max(after(e + 5), after(e + 15), after(e + 25));
  ok('postictal suppression at the scalp: under 10 µV within 30 s of the end (the PGES definition, Lhatoo 2010; ECT: Pottkämper 2021)', pges < 10, `${pges.toFixed(1)} µV`);
  /* the background before the stimulus, at the same derivation, 2 s windows, mean removed */
  const pre = (() => { const b = new S.Brain({ seed: 7 }); b.settle(6); const N = 20 * 200, rec = b.regions.map(() => new Float32Array(N)); for (let k = 0; k < N; k++) { b.advance(0.005); const a = b.activity(); for (let r = 0; r < a.length; r++) rec[r][k] = a[r]; } return S.frontocentral(S.scalpFromActivity(rec)); })();
  const pp = []; for (let k = 0; k + 400 <= pre.length; k += 400) { let m = 0; for (let i = k; i < k + 400; i++) m += pre[i] / 400; let lo = Infinity, hi = -Infinity; for (let i = k; i < k + 400; i++) { lo = Math.min(lo, pre[i] - m); hi = Math.max(hi, pre[i] - m); } pp.push(hi - lo); }
  gap('the background before the stimulus is of normal voltage (ACNS 2021: under 20 µV is low voltage)', median(pp) >= 20, `${median(pp).toFixed(1)} µV peak to peak at Fz against the ears: the scale is fitted to the seizure, and the resting loop’s answer to its noise is small; raising the noise makes the model seize by itself (part 1b, the background)`);
}

console.log('\nOne side first');
{
  const t = S.seizureTrial({ seed: 7, stimulated: [5], seconds: 200 });
  const right = Math.max(...t.onset.slice(5).map((x) => x ?? Infinity)), left = Math.max(...t.onset.slice(0, 5).map((x) => x ?? Infinity));
  ok('a right frontal seizure takes the right hemisphere, then the left (the cross-hemisphere coupling is fitted to Kim 2004: 7–23 s)', Number.isFinite(left) && left - right >= 7 && left - right <= 23, `right by ${f1(right)} s, left by ${f1(left)} s`);
}

console.log('\nThe stimulus');
{
  const weak = S.seizureTrial({ seed: 7, kick: 3, seconds: 20 });
  ok('a stimulus below threshold starts nothing', weak.duration == null, `duration ${f1(weak.duration)}`);
  const strong = S.seizureTrial({ seed: 7, kick: 40, kickSeconds: 0.5, seconds: 200 });
  gap('a stronger stimulus gives a shorter seizure (Krystal 1993; Luccarelli 2021: shorter with a higher dose)', strong.duration < trials[0].duration - 5, `${f1(trials[0].duration)} s at 20 mV for 50 ms, ${f1(strong.duration)} s at 40 mV for 500 ms: once on the cycle the model forgets the stimulus`);
}

console.log('\nReplay');
{
  const a = S.seizureTrial({ seed: 5, seconds: 15 }), b = S.seizureTrial({ seed: 5, seconds: 15 });
  ok('the same seed gives the same seizure, sample for sample', a.activity.every((x, i) => x.every((v, k) => v === b.activity[i][k])));
}

console.log('\nEvidence');
{
  const own = Object.values(S.CONSTANTS).filter((c) => c.group === 'seizure' || c.group === 'seizure-coupling');
  ok('the model’s constants are registered with their evidence', own.length >= 20 && S.constantIssues().filter((x) => x.startsWith('seizure')).length === 0, J(S.constantIssues().filter((x) => x.startsWith('seizure'))));
  ok('every reference it cites exists', own.every((c) => (c.refs ?? []).every((r) => S.REFERENCES[r])));
}

console.log(`\n${pass} passed, ${fail} failed, ${gaps.length} known gaps`);
if (fail) process.exit(1);
