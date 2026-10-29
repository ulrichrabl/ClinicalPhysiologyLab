/* The ECT station, part 1: the device against its manual, the stimulus in the head against the field models and
   measurements, the seizure threshold against what was measured in patients, and the device's reading of the seizure
   (scripts/ect.test.mjs, in npm test). Comparisons were fixed before the model was run against them; a mismatch is a
   known gap, reported with its numbers. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const bundle = join(tmpdir(), `ect-${Date.now()}.mjs`);
await esbuild.build({ entryPoints: ['scripts/_ect_entry.ts'], bundle: true, outfile: bundle, format: 'esm', target: 'es2022', platform: 'node', loader: { '.ts': 'ts', '.js': 'js', '.json': 'json' }, logLevel: 'error' });
const S = await import(pathToFileURL(bundle).href);
unlinkSync(bundle);

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); } };
const gaps = [];
const gap = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { gaps.push(name); console.log(`  △ known gap: ${name}${detail ? ' — ' + detail : ''}`); } };
const J = (x) => JSON.stringify(x);
const f1 = (x) => (x == null ? '—' : x.toFixed(1)), f2 = (x) => (x == null ? '—' : x.toFixed(2));
const median = (a) => { const s = [...a].sort((x, y) => x - y); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };
const ladder = (prog, user = { frequency: 30, pulseWidth: 0.5 }) => S.PERCENT_STEPS.filter((p) => p <= 100).map((p) => S.stimulusFor(prog, p, user)).filter(Boolean);
const fixedWidth = (frequency, pulseWidth) => S.PERCENT_STEPS.filter((p) => p <= 100).map((p, i) => ({ frequency, pulseWidth, pulses: Math.round(S.CHARGE_MC[i] / (0.9 * pulseWidth)) }));

console.log('\nThe device against its manual');
{
  const ids = Object.keys(S.PROGRAM_TABLES);
  const bad = [];
  for (const id of ids) S.PERCENT_STEPS.forEach((p, i) => {
    const T = S.PROGRAM_TABLES[id], q = 0.9 * T.pulseWidth[i] * T.pulses[i];
    if (Math.abs(q - S.CHARGE_MC[i]) > Math.max(0.9 * T.pulseWidth[i], 0.01 * S.CHARGE_MC[i])) bad.push(`${id} ${p}%: ${q.toFixed(1)} vs ${S.CHARGE_MC[i]}`);
    if (id !== 'INTERMIT' && T.pulses[i] / (2 * T.frequency[i]) > 8.005) bad.push(`${id} ${p}% over 8 s`);
  });
  ok('every program table gives its percent’s charge (0.9 A × pulse width × pulses, to within one pulse or 1 %: the manual rounds) and stays within 8 s', !bad.length, bad.slice(0, 4).join('; '));
  ok('100 % is 504 mC (manual: maximum output 504 mC)', Math.abs(S.CHARGE_MC[S.PERCENT_STEPS.indexOf(100)] - 504) < 0.5);
  const fig1 = S.stimulusFor('LOW_05', 100, {}), fig2 = S.stimulusFor('LOW_UB', 15, {});
  ok('the published strips’ stimuli (Kawashima 2018): 100 % of LOW 0.5 is 70 Hz, 0.5 ms, 8.0 s; 15 % of LOW 0.25 is 30 Hz, 0.25 ms, 5.6 s',
    fig1.frequency === 70 && fig1.pulseWidth === 0.5 && Math.abs(fig1.duration - 8) < 0.02 && fig2.frequency === 30 && fig2.pulseWidth === 0.25 && Math.abs(fig2.duration - 5.6) < 0.03, J([fig1, fig2]));
  ok('a user setting that would last over 8 s is refused (manual: “>8 S”)', S.stimulusFor('USER', 100, { frequency: 10, pulseWidth: 0.25 }) == null);

  /* the sequence */
  const s = new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 });
  const d = s.device, seen = [];
  d.power(true); s.advance(1); seen.push(d.left); s.advance(2.5); seen.push(d.left); s.advance(2); seen.push(d.left);
  d.impedanceButton(true); s.advance(0.5); seen.push(d.left); s.advance(1); seen.push(d.left); d.impedanceButton(false); s.advance(0.5); seen.push(d.left);
  s.advance(8); seen.push(d.left);
  ok('power on: the self test, then NO BASE; the impedance test: TESTING, then the ohms; released: BASELINE, then READY', J(seen) === J(['*#*#*#*#', 'SELFTEST', 'NO BASE', 'TESTING', '1272', 'BASELINE', 'READY']), J(seen));
  ok('the PRESET light is on with LOW 0.5', d.lights.preset && !d.lights.userSet);
  d.turnPercent(1); ok('turning the dial shows the charge for a second, then the percent', d.right === '176' && (s.advance(1.1), d.right === '35'), d.right);
  d.turnPercent(-1);
  d.treatButton(true); s.advance(0.9); const warn = d.tone; s.advance(0.2); const deliv = d.tone;
  ok('held, the treatment button gives 1 s of warning tone before the current', warn === 'warning' && deliv === 'delivering');
  s.advance(6); d.treatButton(false); s.advance(3);
  ok('afterwards the left display counts the seconds since the stimulus and the printer runs', /^\d+$/.test(d.left) && Number(d.left) >= 2 && d.printing, d.left);
  ok('the stimulus given is the dial’s: 30 % of LOW 0.5, 151 mC in 5.6 s', Math.abs(s.stimuli[0].given.charge - 151.2) < 0.6 && Math.abs(s.stimuli[0].given.duration - 5.6) < 0.05, J(s.stimuli[0].given));

  const u = new S.EctSession({ placement: 'BT', prepared: false, skin: 0, seed: 7 });
  u.device.power(true); u.advance(6); u.device.impedanceButton(true); u.advance(1.5);
  ok('unprepared skin reads 3000 and flashes (manual: over 3000 Ω), and the warning tone then lasts 3 s', u.device.left === '3000' && u.device.leftFlashes);
  u.device.impedanceButton(false); u.advance(9); u.device.treatButton(true); u.advance(2.5);
  const w3 = u.device.tone; u.advance(0.7);
  ok('…the warning tone still sounding at 2.5 s, then the current', w3 === 'warning' && u.device.tone === 'delivering'); u.device.treatButton(false);

  const e = new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 });
  e.device.power(true); e.advance(6); e.device.impedanceButton(true); e.advance(1.5); e.device.impedanceButton(false); e.advance(9);
  e.device.treatButton(true); e.advance(3); e.device.treatButton(false); e.advance(1);
  const g = e.stimuli[0];
  ok('releasing the button early stops the stimulus: a smaller charge than set, marked as stopped early', g.early && g.given.charge < 0.5 * 151.2 && g.given.charge > 0.2 * 151.2, J(g.given));

  const f = new S.EctSession();
  f.device.power(true); f.advance(6);
  f.device.pressFlex(); const fn0 = f.device.left; f.device.turnFlex(1); const fn1 = f.device.left; f.device.pressFlex(); f.device.turnFlex(2); f.device.pressFlex(); f.device.impedanceButton(true); f.device.impedanceButton(false);
  ok('FlexDial: press to enter (PROGRAMS), rotate to FREQUENC, press, rotate, press: a user frequency, which leaves the preset program; the impedance button exits', fn0 === 'PROGRAMS' && fn1 === 'FREQUENC' && f.device.settings.program === 'USER' && f.device.settings.user.frequency === 50 && !f.device.flex, J([fn0, fn1, f.device.settings.user]));
}

console.log('\nThe stimulus in the head (by reciprocity through part 1’s head)');
const F = Object.fromEntries(['BT', 'BF', 'RUL', 'LART'].map((p) => [p, S.fieldFor(p)]));
const brainSample = (f, I) => {
  const rb = f.model.head.radii[0], v = [];
  for (let i = 0; i < 400; i++) { const z = 1 - (2 * (i + 0.5)) / 400, t = Math.acos(z), ph = i * 2.39996; const rr = Math.cbrt((((i * 7) % 400) + 0.5) / 400) * (rb - 1); v.push(f.magnitude([Math.sin(t) * Math.cos(ph) * rr, Math.sin(t) * Math.sin(ph) * rr, z * rr], I) / 100); }
  return v.sort((a, b) => a - b);
};
const surfacePeak = (f, I) => { const rb = f.model.head.radii[0] - 1; let pk = 0; for (let i = 0; i < 1500; i++) { const z = 1 - (2 * (i + 0.5)) / 1500, t = Math.acos(z), ph = i * 2.39996; pk = Math.max(pk, f.magnitude([Math.sin(t) * Math.cos(ph) * rb, Math.sin(t) * Math.sin(ph) * rb, z * rb], I) / 100); } return pk; };
{
  const bt = brainSample(F.BT, 0.8), med = bt[bt.length >> 1];
  ok('bitemporal at 800 mA: the brain’s median field within the cadaver measurements Deng 2011 cite (0.7–1.8 V/cm)', med >= 0.7 && med <= 1.8, `${f2(med)} V/cm`);
  const pk = surfacePeak(F.BT, 0.8);
  ok('…its peak in the brain within 25 % of Deng 2011’s spherical model (2.14–2.51 V/cm at 800 mA)', pk >= 0.75 * 2.14 && pk <= 1.25 * 2.51, `${f2(pk)} V/cm`);
  const meds = Object.fromEntries(Object.entries(F).map(([k, f]) => { const v = brainSample(f, 0.9); return [k, v[v.length >> 1]]; }));
  ok('bitemporal drives the whole brain most strongly (Lee 2012: median BL 3.9, RUL 2.3, BF 1.5 V/cm)', meds.BT > meds.RUL && meds.BT > meds.BF, J(Object.fromEntries(Object.entries(meds).map(([k, v]) => [k, +v.toFixed(2)]))));
  const rul = S.dosesFor('RUL', 0.25), R = median(rul.filter((x) => x.def.hemisphere === 'R').map((x) => x.field)), Lh = median(rul.filter((x) => x.def.hemisphere === 'L').map((x) => x.field));
  ok('right unilateral drives the right hemisphere more (Lee 2012: right to left 2.1)', R / Lh > 1.5, `${f2(R / Lh)}`);
  const sym = S.dosesFor('BT', 0.5), pairs = S.REGIONS.filter((r) => r.hemisphere === 'L').map((r) => [sym.find((x) => x.def.id === r.id).field, sym.find((x) => x.def.id === r.id.replace('L-', 'R-')).field]);
  ok('bitemporal is symmetric', pairs.every(([a, b]) => Math.abs(a - b) / a < 0.02));
  const lin = F.BT.magnitude([10, 20, 30], 0.45) * 2 - F.BT.magnitude([10, 20, 30], 0.9);
  ok('the field is proportional to the current', Math.abs(lin) < 1e-6 * F.BT.magnitude([10, 20, 30], 0.9));
  ok('the excitation threshold: 0.35 V/cm at 0.3 ms (Deng 2013), higher for shorter pulses, toward a floor for longer', Math.abs(S.thresholdField(0.3) - 0.35) < 1e-9 && S.thresholdField(0.25) > S.thresholdField(0.5) && S.thresholdField(1.5) / S.thresholdField(1.0) > 0.99);
  ok('at the device’s current most of the brain is above threshold (Deng 2011: bilateral 100 %, unilateral and bifrontal over 90 %)', bt.filter((x) => x > S.thresholdField(0.3)).length / bt.length > 0.9);
  /* the regions sit under their electrodes (a test of part 2a's geometry) */
  const nearest = (d) => { let best = null, bd = 9; for (const e of S.E1020) { const x = S.vec.norm(S.vec.sub(S.electrodeDir(e), d)); if (x < bd) { bd = x; best = e; } } return best; };
  const expect = { frontal: ['F3', 'F4', 'F7', 'F8', 'Fp1', 'Fp2'], central: ['C3', 'C4'], temporal: ['T7', 'T8'], parietal: ['P3', 'P4', 'P7', 'P8'], occipital: ['O1', 'O2'] };
  const wrong = S.REGIONS.map((r) => [r.id, nearest(S.sphericalDir(r.theta, r.phi))]).filter(([id, e]) => !expect[id.split('-')[1]].includes(e) || (id[0] === 'L') !== /[13579]$/.test(e));
  ok('each region of the seizure model lies under its own electrodes, on its own side', !wrong.length, J(wrong));
}

console.log('\nThe seizure threshold');
{
  const bt = S.thresholdCharge('BT', ladder('LOW_05'), 3);
  ok('fitted: bitemporal with the 0.5 ms program, the reference adult (van Waarde 2012: 95.4 mC; ± 10 %)', bt != null && Math.abs(bt - 95.4) < 9.5, `${f1(bt)} mC`);
  const rul = S.thresholdCharge('RUL', ladder('LOW_UB'), 3);
  gap('right unilateral with the 0.25 ms program within van Waarde 2012’s mean ± SD (45.6 ± 16.8 mC)', rul != null && rul >= 45.6 - 16.8 && rul <= 45.6 + 16.8, `${f1(rul)} mC`);
  const rul05 = S.thresholdCharge('RUL', ladder('LOW_05'), 3);
  gap('with equal pulses, right unilateral below bitemporal (Coffey 1995, 1.0 ms: RUL 40–67, BL 72–80 mC; Sackeim 1987)', rul05 != null && rul05 < bt, `RUL ${f1(rul05)} vs BT ${f1(bt)} mC at 0.5 ms`);
  const bf = S.thresholdCharge('BF', ladder('LOW_05'), 3);
  ok('bifrontal above bitemporal (Viswanath 2011)', bf != null && bf > bt, `${f1(bf)} vs ${f1(bt)} mC`);
  const ub = S.thresholdCharge('RUL', fixedWidth(30, 0.3), 3), br = S.thresholdCharge('RUL', fixedWidth(30, 1.0), 3);
  ok('ultrabrief against brief, right unilateral: 0.3 against 1.0 ms within 40 % of Loo 2014’s ratio (26.8 / 74.1 = 0.36)', ub != null && br != null && Math.abs(ub / br - 0.36) <= 0.4 * 0.36, `${f1(ub)} / ${f1(br)} = ${f2(ub / br)}`);
  const lo = S.thresholdCharge('BT', fixedWidth(30, 1.0), 3), hi = S.thresholdCharge('BT', fixedWidth(70, 1.0), 3);
  ok('a lower pulse frequency needs less charge (Girish 2003: 50 against 200 pulses/s; Kotresh 2004)', lo != null && hi != null && lo < hi, `30 Hz ${f1(lo)}, 70 Hz ${f1(hi)} mC`);
  ok('1 % starts nothing and 100 % starts a seizure (bitemporal, LOW 0.5)', !S.seizes('BT', S.stimulusFor('LOW_05', 1, {}), 3) && S.seizes('BT', S.stimulusFor('LOW_05', 100, {}), 3));
  ok('half the age (30 % for 59 years), the manual’s first bilateral dose, is above threshold (Petrides & Fink 1996: a seizure at the first stimulus in every patient)', S.seizes('BT', S.stimulusFor('LOW_05', 30, {}), 3));
}

console.log('\nThe seizure as the device reads it');
{
  const runs = [3, 7, 11, 19, 23, 31].map((seed) => { const s = new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed }); return S.scriptedTreatment(s, { program: 'LOW_05', percent: 30, after: 150 }); });
  const eeg = runs.map((r) => r.eegEndpoint), emg = runs.map((r) => r.emgEndpoint);
  ok('the EEG endpoint is found, each within Luccarelli 2021’s first treatment (71.5 ± 34.7 s)', eeg.every((x) => x != null && x >= 71.5 - 34.7 && x <= 71.5 + 34.7), J(eeg.map(f1)));
  const ratio = runs.reduce((a, r) => a + r.emgEndpoint / r.eegEndpoint, 0) / runs.length;
  ok('fitted: the motor seizure ends first, EMG over EEG endpoint 0.755, the mean over the fit’s six seeds (Gazdag 2004, etomidate; ± 0.05)', Math.abs(ratio - 0.755) <= 0.05 && emg.every((x, i) => x != null && x < eeg[i]), `${f2(ratio)}; ${J(emg.map(f1))}`);
  const psi = runs.map((r) => r.psi);
  gap('the postictal suppression index within the Thymatron IV medians (Shen 2026: 58–67 %; widened to 45–80 %)', psi.every((x) => x != null && x >= 45 && x <= 80), J(psi.map(f1)));
  const msp = runs.map((r) => r.msp);
  gap('the maximum sustained power within half and twice the Thymatron IV medians (Shen 2026: 30,834–38,198 µV²)', msp.every((x) => x != null && x >= 15000 && x <= 76000), J(msp.map((x) => Math.round(x))));
  console.log(`    coherence ${J(runs.map((r) => f1(r.coherence)))} % (one published strip: 91 %, right unilateral)`);

  const sub = new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 });
  const rs = S.scriptedTreatment(sub, { program: 'LOW_05', percent: 5, after: 40 });
  ok('below threshold (5 %): no seizure in the model and no EMG activity', !sub.seizing && rs.emgEndpoint == null, J([rs.eegEndpoint, rs.emgEndpoint]));
  gap('…and no EEG endpoint, as on the published strip of an inadequate stimulus (neither endpoint detected)', rs.eegEndpoint == null, `EEG endpoint at ${f1(rs.eegEndpoint)} s: the stimulus’s after-effects exceed a baseline that is far too small (gap 63)`);

  const nb = new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 });
  const d = nb.device; d.power(true); nb.advance(6); d.treatButton(true); while (d.treat !== 'done') nb.advance(0.1); d.treatButton(false); nb.advance(60); d.startStop(); nb.advance(0.1);
  const r = nb.lastReport();
  ok('treated before READY: “Baseline not available”, no EEG endpoint and no indices (manual)', !r.baselineAvailable && r.eegEndpoint == null && r.asei == null);
  const lines = S.reportLines({ percent: 30, charge: 151.2, current: 0.9, duration: 5.6, frequency: 30, pulseWidth: 0.5, staticOhm: null, dynamicOhm: 242, early: false, baselineAvailable: false, eegEndpoint: null, emgEndpoint: 40, baseHr: 75, peakHr: 75, asei: null, psi: null, msp: null, ttp: null, coh: null, ttc: null, program: 'Low 0.5 charge rate', indexes: true }, 'en', (x, k = 0) => x.toFixed(k));
  ok('…and the report says so', lines.includes('Baseline not available'), J(lines));
}

console.log('\nTexts');
{
  const n = (x, k = 0) => x.toFixed(k);
  const st = (o) => ({ on: true, booting: false, baseline: 'ready', testedOhm: 1272, staticHigh: 3000, staticLow: 100, treat: 'idle', early: false, printing: false, stimulusEnd: null, reported: false, seconds: 0, ...o });
  const steps = [st({ on: false }), st({ booting: true }), st({ baseline: 'none' }), st({ testedOhm: 3000 }), st({ testedOhm: 50 }), st({ baseline: 'collecting' }), st({}), st({ treat: 'warning' }), st({ treat: 'delivering' }), st({ stimulusEnd: 1, seconds: 5 }), st({ stimulusEnd: 1, seconds: 40 }), st({ reported: true, stimulusEnd: 1 })].map((x) => S.nextStep(x, n));
  const facts = S.explainStimulus({ percent: 30, charge: 151.2, current: 0.9, pulseWidth: 0.5, frequency: 30, pulses: 336, duration: 5.6, dynamicOhm: 242, energy: 32.9, brainShare: 0.66, medianField: 0.79, threshold: 0.31, excitedRegions: 8, placementName: { en: 'Bitemporal', de: 'Bitemporal' }, placementWhere: { en: 'x', de: 'x' } }, n).map((x) => x.body);
  const all = [...steps, ...facts, ...S.ECT_BACKGROUND.flatMap((x) => [x.title, x.body]), S.ECT_STATION.title, S.ECT_STATION.summary];
  ok('every ECT explanation exists in English and German, with its numbers filled in', all.length > 25 && all.every((x) => x.en && x.de && x.en !== x.de && !/\$\{|undefined|NaN|Infinity/.test(x.en + x.de)), `${all.length} texts`);
  const de = S.reportLines({ percent: 30, charge: 151.2, current: 0.9, duration: 5.6, frequency: 30, pulseWidth: 0.5, staticOhm: 1272, dynamicOhm: 242, early: false, baselineAvailable: true, eegEndpoint: 70, emgEndpoint: 50, baseHr: 75, peakHr: 75, asei: 700, psi: 90, msp: 1200, ttp: 10, coh: 80, ttc: 8, program: 'Low 0.5 charge rate', indexes: true }, 'de', n);
  ok('the report prints in German too', de.some((l) => l.startsWith('Abgegebene Ladung')) && de.length >= 17, J(de));
}

console.log('\nEvidence');
{
  const issues = S.constantIssues().filter((x) => x.startsWith('ect.'));
  ok('the ECT constants are registered with their evidence', Object.keys(S.CONSTANTS).filter((k) => k.startsWith('ect.')).length > 20 && !issues.length, J(issues));
  const refs = Object.values(S.CONSTANTS).filter((c) => c.group === 'ect').flatMap((c) => c.refs ?? []);
  ok('every reference they cite exists', refs.every((r) => S.REFERENCES[r]), J(refs.filter((r) => !S.REFERENCES[r])));
}

console.log(`\n${pass} passed, ${fail} failed, ${gaps.length} known gaps`);
if (fail) process.exit(1);
