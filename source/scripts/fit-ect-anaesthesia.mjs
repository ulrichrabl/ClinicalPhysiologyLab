/* The ECT station's anaesthetic (part 2b, second half): two fits, once each. Run from source/:
     node scripts/fit-ect-anaesthesia.mjs propofol [k ...]   – the EEG seizure with propofol 0.75, 1.0, 1.5 mg/kg against none
     node scripts/fit-ect-anaesthesia.mjs benzo [b ...]      – the seizure with lorazepam 2.5 mg/day, with and without flumazenil
     node scripts/fit-ect-anaesthesia.mjs pressure v [e ...]  – the systolic pressure with propofol, and with ketofol
   Prints what to write into src/vp/evidence/ect-anaesthesia.ts; the checks are in scripts/ect.test.mjs.

   1. propofol: ect-anaesthesia.loadTermination, so that propofol 1.0 mg/kg with the stimulus 120 s after it gives an
      EEG seizure 0.65 times as long as with no anticonvulsant load: Avramov 1995's crossover, 50 against 77 s with
      etomidate, whose duration did not depend on its dose (the model's reference is etomidate's: its threshold was fitted
      under etomidate). The reference treatment: bitemporal, 30 % of the 0.5 ms program, the baseline collected first.
   2. benzo: ect-anaesthesia.benzoLoad, so that reversing lorazepam 2.5 mg/day with flumazenil lengthens the EEG seizure of
      the same treatment under the hospital's induction (propofol 1 mg/kg with esketamine 0.5 mg/kg, the stimulus 240 s
      after it) by 10.5 s (Gistelinck 2024).
   3. pressure: ect-anaesthesia.propofolVasodilation, then ect-anaesthesia.esketamineSympathetic, so that the systolic
      pressure after the induction (before the shock) changes from the baseline as in Gaddam 2022's two arms: propofol
      1 mg/kg −4.84 %, ketofol (propofol 0.5 with racemic ketamine 0.5 mg/kg, taken as esketamine 0.25: S-ketamine about
      twice as potent) −1.13 %. Their protocol: the baseline before glycopyrrolate 0.004 mg/kg, the induction 2 min after
      it, succinylcholine 0.75 mg/kg, a bitemporal stimulus; here the stimulus 2 min after the induction, the pressure
      after the induction the mean of 60–90 s. Checked, not fitted: the highest systolic of the readings at 0–5 min after
      the shock, +9.8 % (propofol) and +19.7 % (ketofol). */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const which = process.argv[2] ?? 'propofol';
const values = process.argv.slice(3).map(Number);
const build = async (overrides) => {
  globalThis.__CONSTANT_OVERRIDES = overrides;
  const out = join(tmpdir(), `fit-ect-anaes-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  await esbuild.build({ stdin: { contents: "export { EctSession } from './src/vp/stations/ect-session.ts'; export { PERCENT_STEPS } from './src/vp/stations/ect-programs.ts'; export { ECT_PATIENT } from './src/vp/physiology/drugs/anaesthetics.ts';", resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, outfile: out, format: 'esm', platform: 'node', loader: { '.json': 'json' }, logLevel: 'error' });
  return import(pathToFileURL(out).href);
};

/** the reference treatment with drugs given `delay` s before the stimulus: its EEG seizure (s) */
export function seizureWith(M, give, delay, seed = 7) {
  const s = new M.EctSession({ placement: 'BT', prepared: true, skin: 0, seed }), d = s.device;
  d.settings.percentIndex = M.PERCENT_STEPS.indexOf(30);
  d.power(true); s.advance(6); d.impedanceButton(true); s.advance(1.5); d.impedanceButton(false);
  while (d.baseline !== 'ready') s.advance(0.5);
  give(s); s.advance(delay);
  d.treatButton(true); while (d.treat !== 'done') s.advance(0.05); d.treatButton(false);
  s.advance(150); d.startStop(); s.advance(0.1);
  return s.lastReport().eegEndpoint;
}

const W = 76;

/** Gaddam 2022's protocol in the session (see the header): the systolic change after the induction and the highest after
    the shock, as % of the baseline before glycopyrrolate */
export function pressureWith(M, ind, seed = 7) {
  const s = new M.EctSession({ placement: 'BT', prepared: true, skin: 0, seed }), d = s.device;
  const sys = (a, b) => { const x = s.pressure.filter((p) => p.t >= a && p.t < b); return x.reduce((u, p) => u + p.sys, 0) / x.length; };
  d.settings.percentIndex = M.PERCENT_STEPS.indexOf(30);
  d.power(true); s.advance(6); d.impedanceButton(true); s.advance(1.5); d.impedanceButton(false);
  while (d.baseline !== 'ready') s.advance(0.5);
  s.advance(30); const t0 = s.pressure.at(-1).t, base = sys(t0 - 30, t0 + 1);
  s.give('glycopyrrolate', 0.004 * W); s.advance(120);
  const ti = s.pressure.at(-1).t; s.induce(ind); s.relax(false, 'succinylcholine', 0.75 * W); s.advance(120);
  const induction = sys(ti + 60, ti + 90);
  d.treatButton(true); while (d.treat !== 'done') s.advance(0.05); d.treatButton(false);
  const te = s.stimuli[0].end; s.advance(310);
  const shock = Math.max(...[0, 1, 2, 3, 4, 5].map((m) => sys(te + 60 * m, te + 60 * m + 5)));
  return { induction: 100 * (induction / base - 1), shock: 100 * (shock / base - 1) };
}
if (which === 'propofol') {
  for (const k of values.length ? values : [0.1, 0.2, 0.4]) {
    const M = await build({ 'ect-anaesthesia.loadTermination': k });
    const none = seizureWith(M, () => {}, 120);
    const at = (mgkg) => seizureWith(M, (s) => s.anaesthesia.give('propofol', mgkg * W), 120);
    const r = [0.75, 1.0, 1.5].map((x) => { const e = at(x); return `${x} mg/kg ${e?.toFixed(1)} s (${(e / none).toFixed(3)})`; });
    console.log(`loadTermination ${k}: none ${none?.toFixed(1)} s; ${r.join('; ')}   [Avramov: 0.727, 0.649, 0.429]`);
  }
} else if (which === 'pressure') {
  const v = values[0] ?? 0, es = values.length > 1 ? values.slice(1) : [0];
  for (const e of es) {
    const M = await build({ 'ect-anaesthesia.propofolVasodilation': v, 'ect-anaesthesia.esketamineSympathetic': e });
    const r = [['propofol 1', { propofol: W }], ['ketofol', { propofol: 0.5 * W, esketamine: 0.25 * W }], ['hospital', { propofol: W, esketamine: 0.5 * W }]].map(([n, ind]) => { const q = pressureWith(M, ind); return `${n}: induction ${q.induction.toFixed(2)} %, shock ${q.shock.toFixed(1)} %`; });
    console.log(`vasodilation ${v}, esketamine ${e}: ${r.join('; ')}   [Gaddam: propofol -4.84, +9.8; ketofol -1.13, +19.7]`);
  }
} else {
  for (const b of values.length ? values : [0.05, 0.1, 0.2]) {
    const M = await build({ 'ect-anaesthesia.benzoLoad': b });
    const ind = (s, flu) => { s.anaesthesia.benzoPerDay = 2.5; if (flu) s.flumazenil(0.5); s.anaesthesia.give('propofol', W); s.anaesthesia.give('esketamine', 0.5 * W); };
    const off = seizureWith(M, (s) => ind(s, false), 240), on = seizureWith(M, (s) => ind(s, true), 240);
    console.log(`benzoLoad ${b}: without flumazenil ${off?.toFixed(1)} s, with ${on?.toFixed(1)} s: +${(on - off).toFixed(1)} s   [Gistelinck: +10.5]`);
  }
}
