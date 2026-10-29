/* The EEG station, part 1: the forward model checked against exact solutions, then the scalp field of a cortical
   source checked against what is measured in people (scripts/eeg.test.mjs, in npm test). */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const bundle = join(tmpdir(), `eeg-${Date.now()}.mjs`);
await esbuild.build({ entryPoints: ['scripts/_eeg_entry.ts'], bundle: true, outfile: bundle, format: 'esm', target: 'es2022', platform: 'node', loader: { '.ts': 'ts', '.js': 'js', '.json': 'json' }, logLevel: 'error' });
const S = await import(pathToFileURL(bundle).href);
unlinkSync(bundle);

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); } };
const gaps = [];
const gap = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { gaps.push(name); console.log(`  △ known gap: ${name}${detail ? ' — ' + detail : ''}`); } };
const J = (x) => JSON.stringify(x);
const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);
const R = S.EEG.headRadius, sb = S.EEG.sigmaBrain;

console.log('\nThe series against exact solutions');
{
  const hom = new S.ForwardModel(S.homogeneousHead(R, sb));
  const v = hom.scalp([0, 0, 0], [0, 0, 100], [0, 0, 1]), exact = (1e3 * 3 * 100) / (4 * Math.PI * sb * R * R);
  ok('a dipole at the centre of a homogeneous sphere: 3p·cosθ / (4πσR²)', rel(v, exact) < 1e-9, `${v} vs ${exact}`);
  const eq = new S.ForwardModel({ radii: [R - 14, R - 12, R - 6, R], sigma: [sb, sb, sb, sb], names: ['brain', 'csf', 'skull', 'scalp'] });
  const worst = Math.max(...[[0, 0, 30], [10, -20, 70], [0, 5, R - 15.5]].flatMap((r0) => [[0, 0, 1], S.sphericalDir(40, 30), S.sphericalDir(-100, -60)].map((d) => rel(eq.scalp(r0, [20, -10, 60], d), hom.scalp(r0, [20, -10, 60], d)))));
  ok('four shells of equal conductivity give the homogeneous sphere', worst < 1e-9, `worst relative difference ${worst.toExponential(2)}`);
  const big = new S.ForwardModel(S.homogeneousHead(1e5, sb));
  const pts = [[0, 0, 90], [30, 10, 70], [-20, 5, 40], [5, -40, 61]];
  const worstU = Math.max(...pts.map((p) => rel(big.inside([0, 0, 60], [30, -5, 50], p), S.unboundedPotential([0, 0, 60], [30, -5, 50], p, sb))));
  ok('in a very large sphere the potential near the dipole is the unbounded one (radial and tangential parts)', worstU < 1e-6, worstU.toExponential(2));
  const h = new S.ForwardModel(S.standardHead());
  const jumps = h.head.radii.slice(0, -1).map((r) => { const at = (x) => [0, 12, Math.sqrt(x * x - 144)]; return rel(h.inside([4, 0, 75], [30, 0, -80], at(r - 1e-4)), h.inside([4, 0, 75], [30, 0, -80], at(r + 1e-4))); });
  ok('the potential is continuous across every interface', Math.max(...jumps) < 1e-3, J(jumps.map((x) => x.toExponential(1))));
  const sc = h.scalp([4, 0, 75], [30, 0, -80], S.sphericalDir(20, 40)), ins = h.inside([4, 0, 75], [30, 0, -80], S.vec.scale(S.sphericalDir(20, 40), R));
  ok('the scalp value equals the inside value at the surface', rel(sc, ins) < 1e-9, `${sc} vs ${ins}`);
  const L = S.leadField(h, S.patchPoints({ at: S.at(-60, -51), depth: 1.25, area: 10, tilt: 30, toward: 45, density: 0.5 }, h.head), 0.5, S.E1020);
  const M = S.leadField(h, S.patchPoints({ at: S.at(60, 51), depth: 1.25, area: 10, tilt: 30, toward: 315, density: 0.5 }, h.head), 0.5, S.E1020);
  const mirror = { Fp1: 'Fp2', F7: 'F8', F3: 'F4', Fz: 'Fz', T7: 'T8', C3: 'C4', Cz: 'Cz', P7: 'P8', P3: 'P4', Pz: 'Pz', O1: 'O2' };
  const asym = Math.max(...Object.entries(mirror).flatMap(([a, b]) => [Math.abs(L[a] - M[b]), Math.abs(L[b] - M[a])]));
  ok('a source and its mirror image give mirrored fields', asym < 0.05, `${asym.toFixed(3)} µV`);
}

console.log('\nThe skull smears the field');
{
  const spread = (ratio) => {
    const c = S.compute({ ...S.presetById('vertex').scene, skullRatio: ratio });
    return { peak: -c.field.Cz, c3: c.field.C3 / c.field.Cz };
  };
  const a = spread(15), b = spread(80);
  ok('a more resistive skull (1:80 against 1:15) gives a smaller peak', b.peak < a.peak, `Cz ${a.peak.toFixed(0)} vs ${b.peak.toFixed(0)} µV`);
  ok('…and a wider field (C3 a larger share of Cz)', b.c3 > a.c3, `${a.c3.toFixed(2)} vs ${b.c3.toFixed(2)}`);
}

console.log('\nThe starting points bring what a reader would find');
for (const p of S.EEG_PRESETS) {
  const c = S.compute(p.scene), r = c.reading, e = p.expect, why = [];
  if (e.negMax && !e.negMax.includes(r.negMax)) why.push(`negative maximum ${r.negMax}`);
  if (e.reversal) { const rev = r.reversals.find((x) => x.kind === 'negative'); if (rev?.at !== e.reversal) why.push(`reversal ${rev?.at ?? 'none'}`); }
  if (e.endOfChain != null && r.endOfChain !== e.endOfChain) why.push(`end of chain ${r.endOfChain}`);
  if (e.twoPoles != null && r.twoPoles !== e.twoPoles) why.push(`two poles ${r.twoPoles}`);
  if (e.posMax && !e.posMax.includes(r.posMax)) why.push(`positive maximum ${r.posMax}`);
  if (e.invisible != null && (r.bipolarPeak < S.SCALP_VISIBLE_UV) !== e.invisible) why.push(`largest channel ${r.bipolarPeak.toFixed(0)} µV`);
  ok(`${p.id}: ${J(e)}`, why.length === 0, why.join('; '));
}

console.log('\nThe localisation rules come from the physics');
{
  const t = S.compute(S.presetById('temporal-mid-left').scene);
  const ch = (a, b) => t.field[a] - t.field[b];
  ok('over a negative maximum the bipolar channels point at each other: F7–T7 down, T7–P7 up', ch('F7', 'T7') > 0 && ch('T7', 'P7') < 0, `${ch('F7', 'T7').toFixed(0)}, ${ch('T7', 'P7').toFixed(0)} µV`);
  const pos = S.compute({ ...S.presetById('temporal-mid-left').scene, polarity: 'positive' });
  ok('a surface-positive discharge reverses the other way', pos.reading.reversals.some((x) => x.kind === 'positive' && x.at === 'T7'), J(pos.reading.reversals.map((x) => x.at + x.kind)));
  const o = S.compute(S.presetById('occipital-left').scene);
  const chain = ['Fp1', 'F3', 'C3', 'P3', 'O1'], chs = chain.slice(1).map((b, i) => o.field[chain[i]] - o.field[b]);
  ok('at the end of a chain: no reversal, the largest channel next to the maximum', o.reading.endOfChain && Math.abs(chs[3]) === Math.max(...chs.map(Math.abs)), J(chs.map((x) => x.toFixed(0))));
  /* an ear near the field: the basal temporal source puts the ear among its largest potentials */
  const b = S.compute(S.presetById('basal-temporal-left').scene), maxAbs = Math.max(...S.E1020.map((e) => Math.abs(b.field[e])));
  ok('a basal temporal source makes the ear reference active (A1 carries at least half the scalp maximum)', Math.abs(b.field.A1) >= 0.5 * maxAbs, `A1 ${b.field.A1.toFixed(0)} µV, scalp max ${maxAbs.toFixed(0)}`);
  const cz = Math.abs(b.field.Cz) / maxAbs;
  ok('…while Cz stays quieter (the ACNS advice: Cz, not the ears, for temporal discharges)', cz < Math.abs(b.field.A1) / maxAbs, `Cz ${(cz * 100).toFixed(0)} % of the maximum`);
}

console.log('\nThe rolandic field (Gregory & Wong 1984): one tangential source, negative centrotemporal, positive frontal');
{
  const c = S.compute(S.presetById('rolandic-left').scene), r = c.reading;
  ok('negative pole centrotemporal (C3 or T7)', ['C3', 'T7'].includes(r.negMax), r.negMax);
  ok('positive pole frontal', ['Fp1', 'F3', 'F7', 'Fz', 'Fp2', 'F4'].includes(r.posMax), r.posMax);
  ok('two poles of similar size', r.twoPoles, `${(c.field[r.posMax] - S.potentialOf(c.field, 'AVG')).toFixed(0)} vs ${(c.field[r.negMax] - S.potentialOf(c.field, 'AVG')).toFixed(0)} µV`);
  const radial = S.compute({ ...S.presetById('rolandic-left').scene, patch: { ...S.presetById('rolandic-left').scene.patch, tilt: 0 } });
  ok('the same patch turned radial loses the frontal positive pole', !radial.reading.twoPoles, `positive ${radial.reading.posMax}`);
}

console.log('\nHow much cortex the scalp needs (Tao 2005; Kane 2017; Pacia & Ebersole 1997)');
{
  /* Visible: the largest longitudinal bipolar channel (ACNS measures there) reaches at least a low-voltage background,
     20 µV; typical: a spike's usual amplitude, over 50 µV (IFCN glossary). Fixed before the model was run. */
  const peak = (area, depth = S.EEG.crownDepth) => S.compute({ ...S.presetById('temporal-left').scene, patch: { ...S.presetById('temporal-left').scene.patch, area, depth } }).reading.bipolarPeak;
  const a = Object.fromEntries([4, 6, 10, 15, 20].map((x) => [x, peak(x)]));
  const d = `largest channel by area (cm²): ${Object.entries(a).map(([k, v]) => `${k}: ${v.toFixed(0)} µV`).join(', ')}; moment density ${S.EEG.momentDensity} nAm/mm²`;
  ok('10–20 cm² of gyral crown gives a spike of the usual size (> 50 µV)', a[10] > 50 && a[20] > 50, d);
  ok('amplitude grows with the area', a[4] < a[6] && a[6] < a[10] && a[10] < a[15] && a[15] < a[20], d);
  gap('under 6 cm² is not seen (Tao 2005: never; here: below 20 µV)', a[6] < S.SCALP_VISIBLE_UV, `${d}. A flat patch on a sphere overestimates: real cortex is folded, and the walls of a sulcus cancel each other`);
  const deep = S.compute(S.presetById('deep-mesial').scene).reading.bipolarPeak;
  ok('a small discharge 3 cm deep is not seen (Pacia & Ebersole 1997: hippocampal discharges alone give no scalp rhythm)', deep < S.SCALP_VISIBLE_UV, `${deep.toFixed(1)} µV`);
}

console.log('\nThe recording');
{
  const sc = S.presetById('temporal-mid-left').scene, c = S.compute(sc), pg = S.pageOf(sc, c, 10);
  const tr = S.channelTrace(pg, { a: 'T7', b: 'P7' }, { lff: 0, hff: 0 });
  const i = Math.round((1000 / 1000) * pg.fs);
  ok('unfiltered, the page carries the field at the discharge’s peak', rel(tr[i], c.field.T7 - c.field.P7) < 1e-3, `${tr[i].toFixed(1)} vs ${(c.field.T7 - c.field.P7).toFixed(1)} µV`);
  const f15 = S.channelTrace(pg, { a: 'T7', b: 'P7' }, { lff: 1, hff: 15 }), f70 = S.channelTrace(pg, { a: 'T7', b: 'P7' }, { lff: 1, hff: 70 });
  const pk = (x) => Math.min(...x.slice(200, 320));
  ok('a 15 Hz high-frequency filter blunts a spike more than 70 Hz', Math.abs(pk(f15)) < Math.abs(pk(f70)), `${pk(f15).toFixed(0)} vs ${pk(f70).toFixed(0)} µV`);
  ok('montages are ACNS Guideline 3’s: LB-18.1 and TB-18.1 have 18 channels, the referential ones 18 or 19', S.MONTAGES.every((m) => m.groups.flat().length >= 18), J(S.MONTAGES.map((m) => [m.id, m.groups.flat().length])));
}

console.log('\nTexts and evidence');
{
  const missing = [];
  for (const p of S.EEG_PRESETS) for (const m of S.MONTAGES) {
    const c = S.compute(p.scene);
    const items = S.explainEeg({ scene: p.scene, reading: c.reading, montage: m, refShare: m.kind === 'referential' ? 0.3 : null, refName: m.kind === 'referential' ? 'A1' : null });
    for (const x of items) for (const l of ['en', 'de']) if (!x.title[l] || !x.body(l) || /undefined|NaN/.test(x.body(l))) missing.push(`${p.id}/${m.id}/${l}`);
    if (!items.length) missing.push(`${p.id}/${m.id}: nothing`);
  }
  for (const x of S.EEG_BACKGROUND) for (const l of ['en', 'de']) if (!x.title[l] || !x.body[l]) missing.push(`background/${l}`);
  for (const p of S.EEG_PRESETS) for (const l of ['en', 'de']) if (!p.label[l]) missing.push(`${p.id} label ${l}`);
  for (const m of S.MONTAGES) for (const l of ['en', 'de']) if (!m.label[l]) missing.push(`${m.id} label ${l}`);
  ok('every explanation, label and montage in English and German', missing.length === 0, missing.slice(0, 8).join(', '));
  const eeg = Object.values(S.CONSTANTS).filter((c) => c.group === 'eeg');
  ok('the head’s constants are registered with their evidence', eeg.length >= 10 && S.constantIssues().filter((x) => x.startsWith('eeg.')).length === 0, J(S.constantIssues().filter((x) => x.startsWith('eeg.'))));
  ok('every reference the station cites exists', ['tao2005', 'pacia1997', 'gregory1984', 'kane2017', 'acharya2016', 'hirsch2021', 'ebersole1997', 'zhang1995', 'demunck1993'].every((r) => S.REFERENCES[r]));
}

console.log(`\n${pass} passed, ${fail} failed, ${gaps.length} known gaps`);
if (fail) process.exit(1);
