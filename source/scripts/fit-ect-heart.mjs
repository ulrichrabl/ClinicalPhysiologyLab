/* The ECT station's heart (part 2): three fits, once each. Run from source/: node scripts/fit-ect-heart.mjs [vagal|surge|esmolol].
   Prints the values to write into src/vp/evidence/ect.ts and drugs.ts; everything else is checked in scripts/ect.test.mjs.

   1. vagal: the direct vagal discharge while the current flows, per placement and pulse width, so that the heart rate
      during the stimulus falls as Stewart 2010 modelled it from 476 treatments: from 85 /min to 78 (bifrontal), 46
      (bitemporal), and from 86 to 26 (right unilateral, 1.0 ms) and 43 (right unilateral, 0.3 ms). The body is the lab's
      healthy adult with no premedication (Stewart's is not given); the stimulus lasts 5 s (theirs are not given); the
      heart rate during it is the beats it contains, averaged over eight starting moments in the cardiac cycle, as a
      ratio to the rate before.
   2. surge: the seizure's sympathetic drive (ect.seizureSympathetic), so that the peak heart rate after the stimulus is
      1.5 times the rate before it, as Nagler 2013 measured under etomidate with atropine 0.25 mg (90 ± 18 to 135 ± 20
      /min): the reference session (bitemporal, 30 % of the 0.5 ms program), atropine 0.25 mg given at the start.
   3. esmolol: the esmolol in the body that blocks half the β1 receptors (drugs.esmololHalfBlock), so that esmolol 1 mg/kg
      lowers the peak heart rate to 0.881 of the control's, as in Parikh 2017 (157.5 to 138.7 /min, glycopyrrolate 0.2 mg
      in both arms): the reference session, esmolol given 2 min before the stimulus. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const which = process.argv[2] ?? 'vagal';
const bundle = join(tmpdir(), `fit-ect-heart-${Date.now()}.mjs`);
const build = async (overrides) => {
  globalThis.__CONSTANT_OVERRIDES = overrides;
  const out = `${bundle}-${Math.random().toString(36).slice(2)}.mjs`;
  await esbuild.build({ stdin: { contents: "export { LivePatient } from './src/vp/live/live-patient.ts'; export { healthyModel } from './src/vp/physiology/state.ts'; export { EctSession, scriptedTreatment } from './src/vp/stations/ect-session.ts'; export { ECT } from './src/vp/evidence/ect.ts'; export { DRUGS } from './src/vp/evidence/drugs.ts';", resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, outfile: out, format: 'esm', platform: 'node', loader: { '.json': 'json' }, logLevel: 'error' });
  return import(pathToFileURL(out).href);
};

/** heart rate during a stimulus of D s with a vagal discharge v, over the rate before, averaged over starting moments */
export async function stimulusRatio(M, v, D = 5, offsets = 8) {
  let sum = 0;
  for (let k = 0; k < offsets; k++) {
    const p = new M.LivePatient(M.healthyModel()); p.settleNow(20); p.advance(5 + (k * 0.9) / offsets);
    const h = p.run.heart, t0 = h.timeMs;
    const before = h.activations.filter((a) => a.kind === 'ventricles' && a.t > t0 - 5000 && a.t <= t0).length / 5;
    p.run.external.vagalStim = v; p.advance(D); p.run.external.vagalStim = 0;
    const during = h.activations.filter((a) => a.kind === 'ventricles' && a.t > t0 && a.t <= t0 + D * 1000).length / D;
    sum += during / before;
  }
  return sum / offsets;
}

if (which === 'vagal') {
  const M = await build({});
  const targets = { vagalBifrontal: 78 / 85, vagalBitemporal: 46 / 85, vagalUnilateral: 26 / 86, vagalUnilateralUltrabrief: 43 / 86 };
  for (const [k, target] of Object.entries(targets)) {
    let lo = 0, hi = 1.2;
    for (let i = 0; i < 10; i++) { const m = (lo + hi) / 2; const r = await stimulusRatio(M, m); if (r > target) lo = m; else hi = m; }
    const v = (lo + hi) / 2;
    console.log(`${k} = ${v.toFixed(3)} (ratio ${(await stimulusRatio(M, v)).toFixed(3)}, target ${target.toFixed(3)})`);
  }
}

const session = (M, drugs) => {
  const s = new M.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 });
  for (const [d, mg, at] of drugs) if (at === 0) s.give(d, mg);
  return s;
};
const peakRatio = (M, s, r) => r.peakHr / r.baseHr;

if (which === 'surge') {
  let lo = 0, hi = 0.2;
  for (let i = 0; i < 8; i++) {
    const m = (lo + hi) / 2;
    const M = await build({ 'ect.seizureSympathetic': m });
    const s = session(M, [['atropine', 0.25, 0]]);
    const r = M.scriptedTreatment(s, { program: 'LOW_05', percent: 30, after: 60 });
    const q = peakRatio(M, s, r);
    console.log(`  ${m.toFixed(4)}: base ${r.baseHr.toFixed(0)}, peak ${r.peakHr.toFixed(0)}, ratio ${q.toFixed(3)}`);
    if (q < 1.5) lo = m; else hi = m;
  }
  console.log(`seizureSympathetic = ${((lo + hi) / 2).toFixed(4)}`);
}

if (which === 'esmolol') {
  const run = async (e50, esmolol) => {
    const M = await build({ 'drugs.esmololHalfBlock': e50 });
    const s = new M.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 });
    s.give('glycopyrrolate', 0.2);
    const d = s.device;
    /* the scripted treatment, with esmolol 2 min before the stimulus */
    d.power(true); s.advance(6);
    d.impedanceButton(true); s.advance(1.5); d.impedanceButton(false);
    if (esmolol) s.give('esmolol', 1 * s.body.model.patient.weightKg);
    s.advance(120);
    d.settings.percentIndex = d.settings.percentIndex; d.treatButton(true);
    while (d.treat !== 'done') s.advance(0.05);
    d.treatButton(false); s.advance(60); d.startStop(); s.advance(0.1);
    return s.lastReport().peakHr;
  };
  const control = await run(1, false);
  console.log(`  control peak ${control.toFixed(1)}`);
  let lo = 0.05, hi = 20;
  for (let i = 0; i < 9; i++) {
    const m = Math.sqrt(lo * hi), p = await run(m, true), q = p / control;
    console.log(`  ${m.toFixed(3)} mg/kg: peak ${p.toFixed(1)}, ratio ${q.toFixed(3)}`);
    if (q < 0.881) lo = m; else hi = m;
  }
  console.log(`esmololHalfBlock = ${Math.sqrt(lo * hi).toFixed(3)}`);
}
