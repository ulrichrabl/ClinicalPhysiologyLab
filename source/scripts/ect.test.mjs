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

{
  /* the device as it can be set up (the manual): doses up to 200 % where CE rules allow, ultrabrief 0.25 or 0.3 ms */
  const d = new S.EctDevice({ ...S.DEFAULT_SETTINGS, maxPercent: 200 }); d.power(true); d.tick(6);
  d.turnPercent(200); const top = d.percent, st = d.stimulusNow;
  d.pressPercent(true); const shown = d.right; d.pressPercent(false);
  ok('2X: the dial goes to 200 %, 1008 mC (the manual’s table: 1008 mC), within 8 s; pressed, PERCENT ENERGY shows “2x” for the 0.5 ms program', top === 200 && Math.abs(st.charge - 1008) < 1008 * 0.03 && st.duration <= 8.005 && shown === '2x', J({ top, charge: st.charge, duration: st.duration, shown }));
  const u3 = S.stimulusFor('LOW_UB', 50, {}, 0.3), u25 = S.stimulusFor('LOW_UB', 50, {}, 0.25);
  ok('the ultrabrief program set up for 0.3 ms gives 0.3 ms pulses, the same charge as with 0.25 ms (the manual’s tables)', u3.pulseWidth === 0.3 && u25.pulseWidth === 0.25 && Math.abs(u3.charge - u25.charge) < u25.charge * 0.03, J({ u3, u25 }));
  const d3 = new S.EctDevice({ ...S.DEFAULT_SETTINGS, ultrabrief: 0.3 });
  ok('a device set up for 0.3 ms has no 0.25 ms user setting (the manual, “Pulse width”)', !d3.pulseWidths().includes(0.25) && d3.pulseWidths()[0] === 0.3, J(d3.pulseWidths()));
  ok('INTERMIT is not offered: its intermittent train is not simulated', !S.PROGRAM_ORDER.includes('INTERMIT') && !new S.EctDevice().options('PROGRAMS').includes('INTERMIT'));
}

{
  /* the baseline (the manual: testing the impedance again does not affect it; IMPEDANCE TEST with the PERCENT ENERGY dial
     pressed resets it; it is kept for the baseline retention time after a treatment) */
  const ready = (s) => { const d = s.device; d.power(true); s.advance(6); d.impedanceButton(true); s.advance(1.5); d.impedanceButton(false); s.advance(9); };
  const s = new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 }), d = s.device;
  ready(s); const from = s.baselineFrom;
  d.impedanceButton(true); s.advance(1.5); d.impedanceButton(false); s.advance(0.5);
  ok('testing the impedance again keeps the READY baseline (the manual: it does not affect the baseline)', d.baseline === 'ready' && s.baselineFrom === from && d.left === 'READY', d.left);
  d.pressPercent(true); d.impedanceButton(true); s.advance(1.5); d.impedanceButton(false); d.pressPercent(false); s.advance(0.5);
  ok('…pressed together with the PERCENT ENERGY dial, a new baseline is collected (firmware 5.60)', d.baseline === 'collecting' && s.baselineFrom > from, d.left);
  s.advance(9);
  d.treatButton(true); while (d.treat !== 'done') s.advance(0.05); d.treatButton(false);
  s.advance(100); const kept = d.baseline; s.advance(25);
  ok('the baseline is kept for the retention time after the treatment (BLV, factory 2 min), then gone: NO BASE once the report is printed', kept === 'ready' && d.baseline === 'none', J({ kept, now: d.baseline }));
  const s3 = new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 }, { ...S.DEFAULT_SETTINGS, baselineRetention: 3 });
  ready(s3); s3.device.treatButton(true); while (s3.device.treat !== 'done') s3.advance(0.05); s3.device.treatButton(false); s3.advance(150);
  ok('…with BLV 3 min a restimulation at 150 s still has it', s3.device.baseline === 'ready');
  const nc = new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 }); nc.montage.ch[0] = { black: null, red: null };
  ready(nc);
  ok('no READY without EEG channel 1 (the manual: channel 1 must be used to obtain the baseline)', nc.device.baseline === 'collecting' && nc.device.left === 'BASELINE', nc.device.left);
  const open = new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 }); open.setPads(null); ready(open);
  open.device.treatButton(true); while (open.device.treat !== 'done') open.advance(0.05); open.device.treatButton(false); open.advance(1);
  ok('with the pads off nothing is delivered: charge 0 and the dynamic impedance out of range', open.stimuli[0].given.charge === 0 && !Number.isFinite(open.stimuli[0].dynamicOhm), J(open.stimuli[0].given));
  const hv = new S.EctSession({ placement: 'BT', prepared: true, skin: 14, seed: 7 });
  ok('above 500 Ω of dynamic impedance the 450 V limit lowers the current (the manual: 0.9 A, limited to 450 V)', hv.dynamicOhm > 500 && Math.abs(hv.stimulusCurrent - 450 / hv.dynamicOhm) < 1e-9 && new S.EctSession().stimulusCurrent === 0.9, `${hv.dynamicOhm.toFixed(0)} Ω → ${hv.stimulusCurrent.toFixed(2)} A`);
  const m = S.montageProblems({ ...S.HOSPITAL_MONTAGE, ch: [{ black: 'Fpz', red: 'M2' }, { black: 'Fpz', red: 'M1' }, S.HOSPITAL_MONTAGE.ch[2], S.HOSPITAL_MONTAGE.ch[3]] });
  ok('the manual’s preferred EEG montage, a forehead-centre electrode shared by both channels through the splitter, is accepted', !m.length, J(m));
}

{
  /* the physics explainer's numbers (ECT part 4) */
  const a = S.stimulusPhysics('LOW_05', 30, 242), b = S.stimulusPhysics(S.counterpart('LOW_05'), 30, 242), hi = S.stimulusPhysics('LOW_05', 30, 600), top = S.stimulusPhysics('LOW_05', 100, 220);
  ok('physics: 30 % of LOW 0.5 is 0.9 A × 0.5 ms × 336 pulses = 151 mC; into 242 Ω the current needs 218 V and gives about 33 J', Math.abs(a.charge - 151.2) < 0.6 && a.stimulus.pulses === 336 && Math.abs(a.voltage - 217.8) < 0.1 && Math.abs(a.energy - 32.9) < 0.3 && !a.limited, J({ q: a.charge, v: a.voltage, e: a.energy }));
  ok('…the ultrabrief program at the same percent gives the same charge with 0.25 ms pulses', b.stimulus.pulseWidth === 0.25 && Math.abs(b.charge - a.charge) < a.charge * 0.03, J({ w: b.stimulus.pulseWidth, q: b.charge }));
  ok('…above 500 Ω the 450 V limit lowers the current and the charge delivered (600 Ω: 0.75 A)', hi.limited && Math.abs(hi.current - 0.75) < 1e-9 && hi.voltage === 450 && hi.charge < hi.setCharge, J({ I: hi.current, q: hi.charge }));
  ok('…100 % at 220 Ω is about 100 J (the manual quotes the energy at 220 Ω; 504 mC × 0.9 A × 220 Ω)', Math.abs(top.energyAt220 - 99.8) < 1, `${top.energyAt220.toFixed(1)} J`);
  const st = a.stimulus, I = (t) => S.currentAt(st, t);
  ok('…the train alternates: +0.9 A for the pulse width at the start of each period, −0.9 A half a period later, nothing between or after', I(0.0001) === 0.9 && I(0.0006) === 0 && I(1 / 60 + 0.0001) === -0.9 && I(st.duration + 0.01) === 0);
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
  gap('…and no EEG endpoint, as on the published strip of an inadequate stimulus (neither endpoint detected)', rs.eegEndpoint == null, `EEG endpoint at ${f1(rs.eegEndpoint)} s: the stimulus’s after-effects still exceed the 20 µV baseline for a few seconds (gap 65)`);

  const nb = new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 });
  const d = nb.device; d.power(true); nb.advance(6); d.treatButton(true); while (d.treat !== 'done') nb.advance(0.1); d.treatButton(false); nb.advance(60); d.startStop(); nb.advance(0.1);
  const r = nb.lastReport();
  ok('treated before READY: “Baseline not available”, no EEG endpoint and no indices (manual)', !r.baselineAvailable && r.eegEndpoint == null && r.asei == null);
  const lines = S.reportLines({ percent: 30, charge: 151.2, current: 0.9, duration: 5.6, frequency: 30, pulseWidth: 0.5, staticOhm: null, dynamicOhm: 242, early: false, baselineAvailable: false, eegEndpoint: null, emgEndpoint: 40, baseHr: 75, peakHr: 75, asei: null, psi: null, msp: null, ttp: null, coh: null, ttc: null, program: 'Low 0.5 charge rate', indexes: true });
  ok('…and the report says so', lines.includes('Baseline not available'), J(lines));
}

console.log('\nThe heart (part 2)');
{
  /* the stimulus's vagal discharge on the lab's body: heart rate during a 5 s discharge over the rate before (as fitted) */
  const ratio = (v, D = 5, offsets = 8) => {
    let sum = 0;
    for (let k = 0; k < offsets; k++) {
      const p = new S.LivePatient(S.healthyModel()); p.settleNow(20); p.advance(5 + (k * 0.9) / offsets);
      const h = p.run.heart, t0 = h.timeMs;
      const before = h.activations.filter((a) => a.kind === 'ventricles' && a.t > t0 - 5000 && a.t <= t0).length / 5;
      p.run.external.vagalStim = v; p.advance(D); p.run.external.vagalStim = 0;
      sum += h.activations.filter((a) => a.kind === 'ventricles' && a.t > t0 && a.t <= t0 + D * 1000).length / D / before;
    }
    return sum / offsets;
  };
  const got = { BF: ratio(S.ECT.vagalBifrontal), BT: ratio(S.ECT.vagalBitemporal), RUL: ratio(S.ECT.vagalUnilateral), UB: ratio(S.ECT.vagalUnilateralUltrabrief) };
  const want = { BF: 78 / 85, BT: 46 / 85, RUL: 26 / 86, UB: 43 / 86 };
  ok('fitted: the heart rate during the stimulus, as a share of the rate before, by placement and pulse width (Stewart 2010; ± 0.04)', Object.keys(want).every((k) => Math.abs(got[k] - want[k]) <= 0.04), J(Object.fromEntries(Object.keys(got).map((k) => [k, `${f2(got[k])} vs ${f2(want[k])}`]))));
  ok('ultrabrief pulses slow the heart less than brief ones, for every placement', S.vagalDrive('BT', 0.25) < S.vagalDrive('BT', 0.5) && S.vagalDrive('RUL', 0.25) < S.vagalDrive('RUL', 1.0));

  const treat = (placement, program, percent, drugs = [], after = 60, seed = 7) => {
    const s = new S.EctSession({ placement, prepared: true, skin: 0, seed });
    for (const [d, mg] of drugs) s.give(d, mg);
    const r = S.scriptedTreatment(s, { program, percent, after });
    return { s, r };
  };
  /* Nagler's sessions: etomidate, atropine 0.25 mg; right unilateral and bifrontal */
  const rul = treat('RUL', 'LOW_UB', 60, [['atropine', 0.25]]), bf = treat('BF', 'LOW_05', 80, [['atropine', 0.25]]);
  const rp = rul.r.longestPause, bp = bf.r.longestPause;
  gap('right unilateral (atropine 0.25 mg): a pause during the stimulus within Nagler 2011’s 5.64 ± 2.88 s', rp >= 5.64 - 2.88 && rp <= 5.64 + 2.88, `${f2(rp)} s: atropine cuts the discharge in proportion to its block, where a massive discharge may surmount a competitive block; Stewart’s premedication, on which the discharge is fitted, is not given`);
  ok('bifrontal: no asystole, the longest interval within Nagler 2011’s 0.47–1.71 s', bp >= 0.47 && bp <= 1.71, `${f2(bp)} s`);
  const noAtro = treat('RUL', 'LOW_UB', 60, [], 30).r.longestPause, atro = treat('RUL', 'LOW_UB', 60, [['atropine', 1.0]], 30).r.longestPause;
  ok('atropine shortens the stimulus’s pause (Tominaga 2026: bradyarrhythmia RR 0.35; Mokriski 1992)', atro < noAtro, `${f2(noAtro)} s without, ${f2(atro)} s with 1 mg`);

  const ref = treat('BT', 'LOW_05', 30, [['atropine', 0.25]], 120);
  const q = ref.r.peakHr / ref.r.baseHr;
  ok('fitted: the seizure’s peak heart rate 1.5 times the rate before (Nagler 2013: 90 to 135 /min; ± 0.05)', Math.abs(q - 1.5) <= 0.05, `${ref.r.baseHr.toFixed(0)} to ${ref.r.peakHr.toFixed(0)} /min`);
  const st = ref.r.stimulus, peakAt = (() => { let b = 0, at = 0; for (let x = st.end; x < st.end + 60; x += 0.5) { const h = ref.s.heartRateAt(x); if (h > b) { b = h; at = x - st.end; } } return at; })();
  gap('the peak comes about 20 s after the stimulus (Nagler 2013: 20.2 ± 8.8 s, RUL)', peakAt >= 20.2 - 8.8 && peakAt <= 20.2 + 8.8, `${f1(peakAt)} s: the model’s seizure fires hardest in its first seconds`);
  const end = st.end + ref.r.eegEndpoint, hrEnd = ref.s.heartRateAt(end - 15), hrAfter = ref.s.heartRateAt(end + 15);
  ok('the heart rate falls as the seizure ends (Nagler 2013: a marked decline in 71 %)', hrAfter < hrEnd - 5, `${hrEnd.toFixed(0)} before the end, ${hrAfter.toFixed(0)} after`);
  gap('…to below the rate before the stimulus (Nagler 2013: in 78 %, by 30 ± 20 /min within 20 s)', hrAfter < ref.r.baseHr, `${hrAfter.toFixed(0)} against ${ref.r.baseHr.toFixed(0)} before`);
  const P = ref.s.pressure, sysBefore = P.filter((x) => x.t > st.at - 5 && x.t < st.at), sysAfter = P.filter((x) => x.t > st.end && x.t < st.end + 60);
  const rise = Math.max(...sysAfter.map((x) => x.sys)) - sysBefore.reduce((a, x) => a + x.sys, 0) / sysBefore.length;
  ok('the systolic pressure rises with the seizure, within what is measured without propofol (Rampton 1989: 27 mmHg with methohexital; Castelli 1995: 55 mmHg; 15–65)', rise >= 15 && rise <= 65, `${rise.toFixed(0)} mmHg`);

  const kg = ref.s.body.model.patient.weightKg;
  const esmo = (mg) => {
    const s = new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 });
    const d = s.device; d.power(true); s.advance(6); d.impedanceButton(true); s.advance(1.5); d.impedanceButton(false);
    if (mg) s.give('esmolol', mg); s.advance(120);
    d.treatButton(true); while (d.treat !== 'done') s.advance(0.05); d.treatButton(false); s.advance(60); d.startStop(); s.advance(0.1);
    return s.lastReport();
  };
  const c = esmo(0), e100 = esmo(100), e13 = esmo(1.3 * kg), e44 = esmo(4.4 * kg);
  const drop = 1 - e100.peakHr / c.peakHr;
  gap('esmolol 100 mg 2 min before: the maximum heart rate 23 ± 3 % lower (Kovac 1991; widened to 15–31 %)', drop >= 0.15 && drop <= 0.31, `${(100 * drop).toFixed(0)} % (${c.peakHr.toFixed(0)} to ${e100.peakHr.toFixed(0)} /min)`);
  const inc = (r) => r.peakHr - r.baseHr, half = inc(e13) / inc(c), gone = inc(e44) / inc(c);
  gap('esmolol 1.3 mg/kg about halves the rise, 4.4 mg/kg nearly abolishes it (Castelli 1995; 0.3–0.7, under 0.3)', half >= 0.3 && half <= 0.7 && gone < 0.3, `rise ${inc(c).toFixed(0)} /min; ${f2(half)} and ${f2(gone)} of it`);
}

console.log('\nThe treatment as a procedure (roles, order, the team)');
{
  /* run a procedure: the learner's own room steps through `learner(p)`, called each tick; the team does the rest */
  const run = (order, mode, roles, learner = () => {}, opts = {}) => {
    const s = new S.EctSession({ placement: order.placement, prepared: true, skin: opts.skin ?? 0, seed: 7 });
    const p = new S.Procedure(s, order, mode, roles);
    for (let k = 0; k < 1500 / 0.05 && !p.finished; k++) {   // the in-house procedure takes about 10 min, the recovery after sugammadex 7 more
      s.advance(0.05); p.tick(0.05); learner(p, s);
      if (p.waitingForNext) p.next();
    }
    return { s, p };
  };
  /* the learner's hands put every lead where the manual's montage has it */
  const placeAll = (p) => { S.STANDARD_MONTAGE.ch.forEach((l, ch) => { p.placeLead({ ch, pole: 'black' }, l.black); p.placeLead({ ch, pole: 'red' }, l.red); }); p.placeLead('ground', S.STANDARD_MONTAGE.ground); };
  const inOrder = (p) => S.STEPS.every((st) => !p.done.has(st.id) || st.after.every((a) => (!p.applies(a) && !p.done.has(a)) || (p.done.has(a) && p.done.get(a).at <= p.done.get(st.id).at)));
  for (const order of S.ECT_ORDERS) {
    const { s, p } = run(order, 'watch', []);
    const r = s.lastReport();
    ok(`watch (${order.id}): the team does every step, each after the steps it follows, without a mistake, and the report has its EEG endpoint`,
      p.finished && p.done.size === S.STEPS.filter((x) => p.applies(x.id)).length && inOrder(p) && !p.errors.length && r?.eegEndpoint != null && s.patient.placement === order.placement, J({ done: p.done.size, errors: p.errors.map((e) => e.code), eeg: r?.eegEndpoint }));
  }
  {
    /* the learner is the anaesthetist and does the anaesthetic steps as soon as each is open and its wait is over */
    const order = S.ECT_ORDERS[0];
    const { p } = run(order, 'practise', ['anaesthetist'], (q) => { const c = q.current(); if (c && q.waitFor(c) <= 0) q.act(c); });
    const mine = S.STEPS.filter((x) => x.role === 'anaesthetist' && p.applies(x.id)).every((x) => p.done.get(x.id)?.by === 'you');
    const theirs = S.STEPS.filter((x) => x.role !== 'anaesthetist' && p.applies(x.id)).every((x) => p.done.get(x.id)?.by === x.role);
    ok('practise as the anaesthetist: your steps are yours, the psychiatrist works the device and the patient’s skin, in order, without a mistake', p.finished && mine && theirs && inOrder(p) && !p.errors.length, J({ errors: p.errors.map((e) => e.code), log: p.log.map((l) => `${l.who}:${l.step}`) }));
  }
  {
    /* the anaesthetist's mistakes with the hospital's anaesthetic: the learner is the anaesthetist, the team the psychiatrist */
    const bt = S.ECT_ORDERS.find((o) => o.id === 'bt');
    const anaes = (order, slip) => run(order, 'practise', ['anaesthetist'], (q, s) => {
      const c = q.current(); if (!c || q.waitFor(c) > 0) {
        /* relaxometry skipped: the learner calls it relaxed at once */
        if (slip === 'no-relaxometry' && c === 'relaxometry') { q.done.set('relaxometry', { at: q.t, by: 'you' }); q.stamps?.set?.('relaxometry', q.t); }
        return;
      }
      if (slip === 'reverse-early' && c === 'biteBlock') { q.act('biteBlock'); s.reverse(152); return; }
      if (slip === 'no-flumazenil' && c === 'flumazenil') { const o = q.myOpen().find((x) => x !== 'flumazenil' && q.waitFor(x) <= 0); if (o) q.act(o); else if (q.isDone('oxygen') && !q.isDone('induction') && q.waitFor('induction') <= 0) q.act('induction'); return; }
      q.act(c);
    });
    const codes = (x) => x.p.errors.map((e) => e.code);
    const nr = anaes(bt, 'no-relaxometry');
    ok('stimulating before the rocuronium has set in (relaxometry skipped) is noticed: the convulsion was not modified', codes(nr).includes('not-relaxed') && nr.p.finished, J(codes(nr)));
    const er = anaes(bt, 'reverse-early');
    ok('sugammadex before the stimulus is noticed (the syringe swap of Uludag Yanaral 2026), and the convulsion comes unmodified', codes(er).includes('not-relaxed') && er.p.finished, J(codes(er)));
    const bz = S.ECT_ORDERS.find((o) => o.id === 'benzo'), nf = anaes(bz, 'no-flumazenil');
    ok('a patient on lorazepam stimulated without flumazenil is noticed', codes(nf).includes('no-flumazenil') && nf.p.finished, J(codes(nf)));
    /* the hypnotic wearing off before the stimulus, the rocuronium still acting: induced, cuffed, ventilated, relaxed, and no
       stimulus for 8 min */
    const late = new S.Procedure(new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 }), bt, 'practise', [...S.ECT_ROLES]);
    late.act('check'); late.act('oxygen'); late.act('induction'); late.cuffOn(); for (let k = 0; k < 12; k++) late.squeeze(); late.act('cuff'); late.act('ventilate'); late.act('relaxant');
    for (let k = 0; k < 480 / 0.1; k++) { late.session.advance(0.1); late.tick(0.1); }
    ok('the hypnotic wearing off before the stimulus, the muscles still blocked, is noticed: awake and paralysed', late.errors.some((e) => e.code === 'woke-blocked'), J(late.errors.map((e) => e.code)));
  }
  {
    /* the learner does everything but stimulates as soon as the device is ready: before the anaesthetic */
    const order = S.ECT_ORDERS.find((o) => o.id === 'rul');
    const s = new S.EctSession({ placement: order.placement, prepared: true, skin: 0, seed: 7 });
    const p = new S.Procedure(s, order, 'exam', [...S.ECT_ROLES]);
    p.act('check'); p.act('skin'); placeAll(p); p.act('leads');
    p.act('pads', 'you', { placement: order.placement });
    const d = s.device; d.power(true); for (let k = 0; k < 140; k++) { s.advance(0.05); p.tick(0.05); }
    d.impedanceButton(true); for (let k = 0; k < 32; k++) { s.advance(0.05); p.tick(0.05); } d.impedanceButton(false);
    for (let k = 0; k < 200; k++) { s.advance(0.05); p.tick(0.05); }
    d.settings.program = order.program; while (d.percent !== order.percent) d.turnPercent(d.percent < order.percent ? 1 : -1);
    p.room.coverUp = true; d.treatButton(true); while (d.treat !== 'done') { s.advance(0.05); p.tick(0.05); } d.treatButton(false);
    const codes = p.errors.map((e) => e.code);
    ok('a stimulus before the anaesthetic is noticed: an awake patient, no bite block, not ventilated, brakes off, paper not checked, no check strip and second impedance test; the impedance, dose and pads were right', codes.includes('awake-stimulus') && codes.includes('no-bite-block') && codes.includes('no-brakes') && codes.includes('no-paper') && codes.includes('no-precheck') && !codes.includes('no-impedance') && !codes.includes('wrong-dose') && !codes.includes('wrong-pads') && !codes.includes('no-leads'), J(codes));
    const q = new S.Procedure(new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 }), order, 'exam', [...S.ECT_ROLES]);
    q.act('relaxant');
    ok('the relaxant before the induction agent and before the cuff is noticed (an awake, paralysed patient; no cuffed arm)', q.errors.some((e) => e.code === 'awake-paralysis') && q.errors.some((e) => e.code === 'no-cuff'), J(q.errors.map((e) => e.code)));
    const w = new S.Procedure(new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 }), order, 'exam', [...S.ECT_ROLES]);
    w.act('check'); w.act('skin'); w.act('pads', 'you', { placement: 'BF' });
    ok('pads at another placement than the order are noticed, and the current then goes where they are', w.errors.some((e) => e.code === 'wrong-pads') && w.session.patient.placement === 'BF', J(w.errors.map((e) => e.code)));
  }
  {
    /* the exam always comes to an end: the learner does every step of every role at the device and in the room, with one
       slip each time. Each slip is a scored mistake, never a procedure that waits for good */
    const exam = (order, slip, roles = [...S.ECT_ROLES], pads = order.placement) => {
      const s = new S.EctSession({ placement: order.placement, prepared: true, skin: 0, seed: 7 });
      const p = new S.Procedure(s, order, 'exam', roles), d = s.device;
      const hosp = () => { S.HOSPITAL_MONTAGE.ch.forEach((l, ch) => { p.placeLead({ ch, pole: 'black' }, l.black); p.placeLead({ ch, pole: 'red' }, l.red); }); p.placeLead('ground', S.HOSPITAL_MONTAGE.ground); };
      const treat = function* () { p.room.coverUp = true; d.treatButton(true); while (d.treat !== 'done') yield 0.1; d.treatButton(false); p.room.coverUp = false; };
      const dial = function* (want) { while (d.percent !== want) { d.turnPercent(d.percent < want ? 1 : -1); yield 0.15; } yield 1; };
      const job = function* (id) {
        if (id === 'power') { d.power(true); while (!p.isDone(id)) yield 0.25; return; }
        if (id === 'impedance' || id === 'precheck') { d.impedanceButton(true); yield 1.6; d.impedanceButton(false); while (d.baseline !== 'ready') yield 0.25; if (id === 'precheck') { d.startStop(); yield 4; d.startStop(); } yield 1; return; }
        if (id === 'dose') { d.settings.program = order.program; yield* dial(order.percent); return; }
        if (id === 'strip') { d.startStop(); yield 6; d.startStop(); yield 1; return; }
        if (id === 'treat') { yield* treat(); if (slip === 'second-treat' || slip === 'treat-again-30') { yield slip === 'second-treat' ? 5 : 30; yield* treat(); } return; }
        if (id === 'retreat') { yield* treat(); return; }
        if (id === 'restimDose') { if (d.baseline !== 'ready') { d.impedanceButton(true); yield 1.6; d.impedanceButton(false); while (d.baseline !== 'ready') yield 0.25; } yield* dial(slip === 'restim-dose' ? S.PERCENT_STEPS[S.PERCENT_STEPS.indexOf(p.restimPercent) + 3] : p.restimPercent); if (slip === 'restim-dose') yield* treat(); return; }
        if (id === 'report' || id === 'rereport') { d.startStop(); while (!p.isDone(id)) yield 0.25; return; }
        if (id === 'cuff') { while (p.room.cuffMmHg < 230) { p.squeeze(); yield 0.3; } p.act('cuff'); return; }
        if (id === 'leads') { hosp(); p.act('leads'); return; }
        if (id === 'sams' || id === 'resams') { const t = p.samsTruth(); p.act(id, 'you', { sams: { points: t.items.map((x) => x.point), band: slip === 'sams-good' && id === 'sams' ? 'good' : t.band } }); return; }
        if (id === 'pads') { p.act('pads', 'you', { placement: pads }); return; }
        p.act(id);
      };
      let busy = null, wait = 0;
      for (let k = 0; k < 1200 / 0.05 && !p.finished; k++) {
        s.advance(0.05); p.tick(0.05);
        if (busy) { wait -= 0.05; while (busy && wait <= 0) { const r = busy.next(); if (r.done) busy = null; else wait += r.value; } }
        if (!busy) { const c = p.myOpen().find((id) => p.waitFor(id) <= 0); if (c) { busy = job(c); wait = 0; } }
      }
      return { s, p, codes: p.errors.map((e) => e.code) };
    };
    const bt = S.ECT_ORDERS.find((o) => o.id === 'bt'), re = S.ECT_ORDERS.find((o) => o.id === 'restim');
    const clean = exam(bt, null);
    ok('exam, every role, no slip: the treatment ends without a mistake', clean.p.finished && !clean.codes.length, J({ codes: clean.codes, open: S.STEPS.filter((x) => clean.p.open(x.id)).map((x) => x.id) }));
    const two = exam(bt, 'second-treat');
    ok('exam: TREAT pressed again during the first seizure is a stimulus before the rating, too early, and the treatment still ends (the watch moves to the second seizure)', two.p.finished && two.s.stimuli.length === 2 && two.codes.includes('restim-unrated') && two.codes.includes('restim-timing'), J({ codes: two.codes, open: S.STEPS.filter((x) => two.p.open(x.id)).map((x) => x.id) }));
    /* the owner's run: pads at the wrong placement, a stimulus and no seizure, TREAT pressed again 30 s later before the
       report; the second seizure rated poor must not plan a third stimulus */
    const none = exam(bt, 'treat-again-30', [...S.ECT_ROLES], 'BF');
    ok('exam: wrong pads, no seizure, TREAT again after 30 s before the report: wrong pads, a stimulus before the rating and too early are named; no third stimulus is asked for, and the treatment ends', none.p.finished && none.s.stimuli.length === 2 && ['wrong-pads', 'restim-unrated', 'restim-timing'].every((c) => none.codes.includes(c)) && !none.p.needsRestim, J({ codes: none.codes, open: S.STEPS.filter((x) => none.p.open(x.id)).map((x) => x.id) }));
    const noneOk = exam(bt, null, [...S.ECT_ROLES], 'BF');
    ok('exam: wrong pads and no seizure, rated poor and restimulated by the rules: the treatment ends with only the pads named', noneOk.p.finished && noneOk.s.stimuli.length === 2 && JSON.stringify(noneOk.codes) === '["wrong-pads"]', J({ codes: noneOk.codes }));
    for (const roles of [[...S.ECT_ROLES], ['psychiatrist']]) {
      const g = exam(re, 'sams-good', roles);
      ok(`exam (${roles.join(', ')}): a poor first seizure rated good is a wrong decision; the procedure follows the decision (no restimulation) and ends`, g.p.finished && g.s.stimuli.length === 1 && g.codes.includes('sams-decision') && g.p.restimIndicated && !g.p.needsRestim, J({ codes: g.codes, open: S.STEPS.filter((x) => g.p.open(x.id)).map((x) => x.id) }));
    }
    const w = exam(re, 'restim-dose');
    ok('exam: a restimulation at the wrong dose is a mistake, and the treatment still ends', w.p.finished && w.s.stimuli.length === 2 && w.codes.includes('restim-dose'), J({ codes: w.codes, open: S.STEPS.filter((x) => w.p.open(x.id)).map((x) => x.id) }));
    const e = new S.Procedure(new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 }), bt, 'exam', [...S.ECT_ROLES]);
    e.act('check'); e.end();
    ok('the learner can end the exam at any time: the debrief opens with the steps not done', e.over && !e.finished && e.endedAt != null && e.summary().some((x) => !x.status), '');
  }
  {
    /* the skin not cleaned: the team's impedance test reads 3000 and the procedure does not go on (the manual: unprepared skin is the usual cause) */
    const order = S.ECT_ORDERS.find((o) => o.id === 'rul');
    const s = new S.EctSession({ placement: order.placement, prepared: true, skin: 0, seed: 7 });
    const p = new S.Procedure(s, order, 'practise', [...S.ECT_ROLES]);
    p.act('check'); p.act('pads', 'you', { placement: order.placement }); placeAll(p); p.act('leads');   // the pads put on uncleaned skin
    const d = s.device; d.power(true); for (let k = 0; k < 140; k++) { s.advance(0.05); p.tick(0.05); }
    d.impedanceButton(true); for (let k = 0; k < 32; k++) { s.advance(0.05); p.tick(0.05); } d.impedanceButton(false);
    for (let k = 0; k < 200; k++) { s.advance(0.05); p.tick(0.05); }
    ok('pads on uncleaned skin: the impedance reads 3000 Ω and the impedance step stays open (the manual: unprepared skin is the usual cause)', !p.isDone('impedance') && d.lastStatic === 3000, J({ z: d.lastStatic }));
    ok('before the pads are on the head, the device reads an open circuit', (() => { const t = new S.Procedure(new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 }), order, 'practise', ['psychiatrist']); return t.session.staticOhm === Infinity && !t.session.circuit; })());
  }
  {
    /* time may run faster only while the learner waits */
    const order = S.ECT_ORDERS[0];
    const s = new S.EctSession({ placement: order.placement, prepared: true, skin: 0, seed: 7 });
    const p = new S.Procedure(s, order, 'practise', ['anaesthetist']);
    const a = p.canHurry;                                   // the anaesthetist's first step (glycopyrrolate) waits for the psychiatrist's check: they wait
    for (let k = 0; k < 120 && !p.open('premed'); k++) { s.advance(0.05); p.tick(0.05); }
    const b = p.canHurry;                                   // the premedication is theirs now
    ok('faster time is allowed while the learner waits for the team, not when a step of theirs is open', a === true && b === false, J({ a, b }));
  }
  {
    /* the patient, drawn (PR B): pad sites, the cuff */
    const pairs = Object.entries(S.PLACEMENT_SITES).every(([id, pair]) => S.placementOf(pair) === id && S.placementOf([pair[1], pair[0]]) === id);
    ok('each placement is made by its two pad sites, in either order; other pairs make none', pairs && S.placementOf(['Rtemp', 'Rfront']) === null && S.placementOf(['Ltemp']) === null, '');
    const site = Object.entries(S.SITES).every(([id, x]) => Object.values(S.PLACEMENTS).some((pl) => [pl.a, pl.b].some((c) => c[0] === x.sph[0] && c[1] === x.sph[1])));
    ok('every pad site is a pad of the placements as the modelling literature defines them', site, '');
    const F = S.ectFigure(S.ectLook());
    const ea = Math.hypot(F.ea.x, F.ea.y), eb = Math.hypot(F.eb.x, F.eb.y), dot = (F.ea.x * F.eb.x + F.ea.y * F.eb.y) / (ea * eb);
    ok('the head frame from the figure is square (its axes equal and at right angles) and the cuff’s place on the upper arm lies between the shoulder end and the EMG on the forearm', Math.abs(ea - eb) < 0.01 * ea && Math.abs(dot) < 0.01 && F.upperArmR.x < F.elbowR.x && F.elbowR.x < F.forearmR[0].x && F.forearmR[0].x < F.forearmR[1].x, J({ ea, eb, dot, arm: [F.upperArmR, F.elbowR, F.forearmR], o: F.o }));
    const order = S.ECT_ORDERS[0];
    const { p } = run(order, 'watch', []);
    ok('the team pumps the cuff above the systolic pressure, and lets it down at the end', p.errors.length === 0 && !p.room.cuffOn && p.log.some((l) => l.step === 'cuff'), J(p.errors.map((e) => e.code)));
    const q = new S.Procedure(new S.EctSession({ placement: 'RUL', prepared: true, skin: 0, seed: 7 }), order, 'practise', [...S.ECT_ROLES]);
    q.act('induction'); q.cuffOn(); q.squeeze(); q.squeeze(); q.act('cuff'); q.act('relaxant');
    ok('a cuff below the systolic pressure when the relaxant goes in is a mistake', q.room.cuffMmHg === 2 * S.CUFF_SQUEEZE && q.errors.some((e) => e.code === 'cuff-low') && !q.errors.some((e) => e.code === 'no-cuff'), J({ mmHg: q.room.cuffMmHg, sys: q.systolic, e: q.errors.map((e) => e.code) }));
    const svg = S.sceneSvg(F, { pads: ['Rtemp', 'vertexR'], cleaned: true, leads: true, cuff: { on: true, mmHg: 220 }, mask: true, bagging: true, biteBlock: true }, 1);
    const chest = S.chestCloseUp(S.ectLook(), { pads: [], cleaned: true, leads: true, cuff: { on: true, mmHg: 220 }, mask: false, bagging: false, biteBlock: false });
    ok('the chest from above draws the ECG, the ground, the cuff and the EMG without NaN', !/NaN|undefined/.test(chest) && (chest.match(/fill="#f7f7f4"/g) ?? []).length === 5 && chest.includes('#3e6f8f'), '');
    ok('the scene draws without NaN and its taps land on the head, the chest and the arm', !/NaN|undefined/.test(svg) && ['head', 'chest', 'arm'].every((h) => svg.includes(`data-hit="${h}"`)), '');
  }
  {
    /* the anaesthetic (PR C): breathing, oxygen, the relaxant and the cuffed arm */
    const order = S.ECT_ORDERS.find((o) => o.id === 'rul');
    const s = new S.EctSession({ placement: order.placement, prepared: true, skin: 0, seed: 7 });
    const p = new S.Procedure(s, order, 'watch', []);
    let minSpo2 = 100, back = null, stopped = false; const et = [];
    for (let k = 0; k < 1500 / 0.05 && !p.finished; k++) {
      s.advance(0.05); p.tick(0.05); if (p.waitingForNext) p.next();
      minSpo2 = Math.min(minSpo2, s.spo2);
      if (s.inducedAt != null && !s.breathing) stopped = true;
      if (stopped && back == null && s.breathing) back = s.t;
      if (p.room.ventilating && !p.isDone('recovery') && p.isDone('treat') === false && s.etco2 != null) et.push(s.etco2);
    }
    const r = s.lastReport();
    const rev = p.done.get('reversal')?.at;
    ok('the hospital’s anaesthetic: the induction stops the breathing; with rocuronium it returns only after the sugammadex, and the recovery waits for breathing and a TOF ratio of 0.9', back != null && rev != null && back > rev && p.done.get('recovery').at >= back && s.anaesthesia.tofRatio >= 0.9, J({ induced: s.inducedAt, reversal: rev, breathing: back, recovery: p.done.get('recovery')?.at }));
    ok('preoxygenated and bagged with 100 % oxygen, the lowest SpO₂ is at least 95 % (Deng 2026, facemask: lowest 97 %, IQR 97–98)', minSpo2 >= 95 && !p.errors.length, J({ minSpo2, errors: p.errors.map((e) => e.code) }));
    ok('with the cuff above systolic, the arm keeps its motor seizure: the EMG endpoint is found', r?.emgEndpoint != null && r?.eegEndpoint != null, J({ emg: r?.emgEndpoint, eeg: r?.eegEndpoint }));
    const mean = et.reduce((a, b) => a + b, 0) / Math.max(1, et.length);
    gap('bagged at 20/min before the stimulus, the end-tidal CO₂ is in the range the hyperventilation trials targeted (18–35 mmHg, Shen 2025) — known gap 72', mean >= 18 && mean <= 35, `${mean.toFixed(1)} mmHg: with the lab’s bag-mask breath (0.5 L, 30 % mask leak, both assumed) 20/min is ordinary ventilation (alveolar about 4 L/min); the anaesthetic’s lower CO₂ production is not modelled`);
    /* no oxygen, no breaths: the patient desaturates during the apnoea */
    const q = new S.Procedure(new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 }), order, 'practise', [...S.ECT_ROLES]);
    q.act('check'); q.act('induction'); q.session.relax(false, 'rocuronium', 30);
    let low = 100; for (let k = 0; k < 290 / 0.1; k++) { q.session.advance(0.1); q.tick(0.1); low = Math.min(low, q.session.spo2); }
    ok('induced and relaxed on room air and not ventilated, the patient desaturates to 92 % or below within 5 min, and the procedure notices', low <= 92 && q.errors.some((e) => e.code === 'desaturation'), J({ low, e: q.errors.map((e) => e.code) }));
    /* the cuff too low: the relaxant reaches the arm and its EMG is flat */
    const w = new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 });
    w.relax(false); w.advance(61);                     // the relaxant takes a minute to reach the arm
    const rr = S.scriptedTreatment(w, { program: 'LOW_05', percent: 30, after: 120 });   // past the EEG seizure's end (about 72 s)
    ok('with the cuff not above systolic, the relaxant reaches the arm: no EMG, while the EEG seizure is still seen', rr.emgEndpoint == null && rr.eegEndpoint != null && w.armRelaxed, J({ emg: rr.emgEndpoint, eeg: rr.eegEndpoint }));
  }
  {
    /* the anaesthetic's pharmacology (part 2b, second half): published human models, one fit, the rest checked */
    const P = S.ECT_PATIENT, A = (f) => { const a = new S.Anaesthesia(P); f(a); return a; };
    let peak = 0, at = 0; { const a = A((a) => a.give('propofol', P.weightKg)); for (let t = 1; t <= 300; t++) { a.step(1); if (a.propofolCe > peak) { peak = a.propofolCe; at = t; } } }
    ok('propofol (Schnider): the effect site peaks 1.5–2 min after a bolus (Schnider 1999: 1.6 min)', at >= 90 && at <= 120, `${at} s, ${f2(peak)} mg/L after 1 mg/kg`);
    { const a = A((a) => { a.give('propofol', P.weightKg); a.give('esketamine', 0.5 * P.weightKg); }); a.step(240); const asleep = a.asleep; let woke = null; for (let t = 241; t < 900 && woke == null; t++) { a.step(1); if (a.woken) woke = t; }
      ok('the hospital’s induction (propofol 1 + esketamine 0.5 mg/kg) is still asleep at the stimulus 4 min later, and wakes some minutes after it (return of consciousness at 1.8 mg/L, Iwakiri 2005)', asleep && woke != null && woke > 300, J({ woke })); }
    { const a = A((a) => { a.give('propofol', 1.75 * P.weightKg); a.give('succinylcholine', P.weightKg); }); let b = null, gone = null; for (let t = 1; t < 900 && b == null; t++) { a.step(1); if (gone == null && !a.breathes) gone = t; if (gone != null && a.breathes) b = t; }
      ok('propofol 1.75 mg/kg with succinylcholine: the breathing stops within a minute and is back within Deng 2026’s 4–6 min (the apnoea level is taken from their dose at 5 min; the diaphragm must be free too)', gone != null && gone <= 60 && b != null && b >= 240 && b <= 360, `stops ${gone} s, back ${b} s`); }
    const onset = (mgkg) => { const a = A((a) => a.give('rocuronium', mgkg * P.weightKg)); let t1 = 1, t5 = null, c1 = null; for (let t = 1; t < 900; t++) { a.step(1); t1 = Math.min(t1, a.t1); if (t5 == null && a.t1 <= 0.05) t5 = t; if (c1 == null && a.tofCount <= 1) c1 = t; } return { t1, t5, c1 }; };
    const r6 = onset(0.6), r3 = onset(0.3), r4 = onset(0.4);
    gap('rocuronium 0.6 mg/kg: the first twitch down to 5 % within Pühringer’s onset (100 ± 39 s) — known gap 74', r6.t5 != null && r6.t5 <= 139, `${r6.t5} s (Magorian’s pharmacokinetics with Vega’s effect model)`);
    gap('rocuronium 0.3 mg/kg: at least 95 % block, as for its ED95 — known gap 74', r3.t1 <= 0.05, `the first twitch down to ${f2(r3.t1)} only`);
    ok('rocuronium 0.4 mg/kg (the station’s dose): at most one twitch of the train of four within 4 min', r4.c1 != null && r4.c1 <= 240, `${r4.c1} s`);
    { const a = A((a) => { a.give('propofol', P.weightKg); a.give('rocuronium', 0.6 * P.weightKg); }); a.step(180); a.give('sugammadex', 8 * P.weightKg); let tof = null; for (let t = 1; t < 900 && tof == null; t++) { a.step(1); if (a.tofRatio >= 0.9) tof = t; }
      gap('sugammadex 3 min after rocuronium 0.6 mg/kg: TOF ratio 0.9 within Kadoi 2013’s young patients (403 ± 37 s; ± 2 SD) — known gap 75', tof != null && Math.abs(tof - 403) <= 2 * 37, `${tof} s: the effect site empties at its own rate`); }
    { const br = (sd) => { const a = A((a) => { a.give('propofol', P.weightKg); a.give('rocuronium', 0.4 * P.weightKg); }); a.step(240); a.give('sugammadex', sd * P.weightKg); for (let t = 1; t < 900; t++) { a.step(1); if (a.breathes) return t; } return null; };
      const b2 = br(2), b3 = br(3);
      gap('sugammadex 2 or 3 mg/kg after rocuronium 0.4 mg/kg: breathing back as Arslan 2024 measured (308 ± 26 and 281 ± 39 s) — known gap 75', b2 != null && Math.abs(b2 - 308) <= 52 && Math.abs(b3 - 281) <= 78, `${b2} and ${b3} s`); }
    { const a = A((a) => { a.benzoPerDay = 2.5; }); const l0 = a.load; a.give('flumazenil', 0.5);
      ok('a regular benzodiazepine adds to the anticonvulsant load; flumazenil 0.5 mg takes it away (Krystal 1998: 0.4–1.0 mg)', l0 > 0 && a.load === 0, `${f2(l0)} → ${f2(a.load)}`); }
  }
  {
    /* the anaesthetic on the seizure: the reference treatment with the drugs given before the stimulus */
    const seizureWith = (give, delay) => {
      const s = new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 }), d = s.device;
      d.settings.percentIndex = S.PERCENT_STEPS.indexOf(30);
      d.power(true); s.advance(6); d.impedanceButton(true); s.advance(1.5); d.impedanceButton(false);
      while (d.baseline !== 'ready') s.advance(0.5);
      give(s); s.advance(delay);
      d.treatButton(true); while (d.treat !== 'done') s.advance(0.05); d.treatButton(false);
      s.advance(150); d.startStop(); s.advance(0.1);
      return s.lastReport().eegEndpoint;
    };
    const W = S.ECT_PATIENT.weightKg;
    const none = seizureWith(() => {}, 120), p1 = seizureWith((s) => s.anaesthesia.give('propofol', W), 120);
    const p075 = seizureWith((s) => s.anaesthesia.give('propofol', 0.75 * W), 120), p15 = seizureWith((s) => s.anaesthesia.give('propofol', 1.5 * W), 120);
    ok('fitted: propofol 1.0 mg/kg 120 s before the stimulus shortens the EEG seizure to 0.65 of none (Avramov 1995: 50 against 77 s with etomidate; ± 0.03)', none != null && p1 != null && Math.abs(p1 / none - 0.649) <= 0.03, `${f1(p1)} / ${f1(none)} = ${f2(p1 / none)}`);
    ok('…0.75 mg/kg within 10 % of Avramov’s 56 s (0.727 of etomidate’s)', p075 != null && Math.abs(p075 / none - 0.727) <= 0.0727, `${f2(p075 / none)}`);
    gap('…1.5 mg/kg within 15 % of Avramov’s 33 s (0.429 of etomidate’s) — known gap 73', p15 != null && Math.abs(p15 / none - 0.429) <= 0.064, `${f2(p15 / none)}: the model’s dose–response is flatter`);
    ok('the dose and the timing matter: more propofol, or the stimulus sooner after it, gives a shorter seizure', p15 < p1 && p1 < p075 && seizureWith((s) => s.anaesthesia.give('propofol', W), 240) > p1, '');
    const ketofol = seizureWith((s) => { s.anaesthesia.give('propofol', 0.5 * W); s.anaesthesia.give('esketamine', 0.5 * W); }, 120);
    gap('ketofol (propofol 0.5 + ketamine 0.5 mg/kg) against propofol 1 mg/kg: within 15 % of Kayhan 2012’s ratio (41 / 38 s = 1.08)', ketofol != null && Math.abs(ketofol / p1 - 1.08) <= 0.16, `${f2(ketofol / p1)}: esketamine has no effect of its own on the seizure in the model, so the halved propofol decides`);
    const hosp = (flu) => seizureWith((s) => { s.anaesthesia.benzoPerDay = 2.5; if (flu) s.flumazenil(0.5); s.anaesthesia.give('propofol', W); s.anaesthesia.give('esketamine', 0.5 * W); }, 240);
    const off = hosp(false), on = hosp(true);
    ok('fitted: lorazepam 2.5 mg/day, reversed by flumazenil, the seizure 10.5 s longer (Gistelinck 2024; ± 2 s)', off != null && on != null && Math.abs(on - off - 10.5) <= 2, `${f1(off)} → ${f1(on)} s`);
  }
  {
    /* the awake patient's fist checks the EMG leads; under anaesthesia there is none */
    const s = new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 });
    s.advance(2); const n0 = s.rec.n; s.fist(); s.advance(2);
    let awake = 0; for (let i = n0; i < s.rec.n; i++) awake = Math.max(awake, Math.abs(s.rec.emg[i]));
    s.induce(); s.advance(1); const n1 = s.rec.n; s.fist(); s.advance(2);
    let asleep = 0; for (let i = n1; i < s.rec.n; i++) asleep = Math.max(asleep, Math.abs(s.rec.emg[i]));
    ok('awake, a fist shows on the EMG (the bedside check of its leads); once anaesthetised it does not', awake > 100 && asleep < 10, J({ awake, asleep }));
  }
  {
    /* the leads, placed by the learner: each channel is its red lead's potential minus its black lead's */
    const mk = (edit) => { const s = new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 }); edit(s.montage); s.advance(4); return s; };
    const a = mk(() => {}), b = mk((m) => { m.ch[0] = { black: 'M1', red: 'Fp1' }; }), c = mk((m) => { m.ch[1].red = null; }), g = mk((m) => { m.ground = null; });
    let inv = 0, flat = 0, hum = 0, same = 0;
    for (let i = 0; i < a.rec.n; i++) { inv = Math.max(inv, Math.abs(a.rec.eeg1[i] + b.rec.eeg1[i])); flat = Math.max(flat, Math.abs(c.rec.eeg2[i])); hum = Math.max(hum, Math.abs(g.rec.eeg1[i] - a.rec.eeg1[i])); same = Math.max(same, Math.abs(b.rec.eeg2[i] - a.rec.eeg2[i])); }
    ok('a channel is red minus black: swapping a channel’s leads inverts it and leaves the others alone; a lead not on gives no channel; without the ground the mains (50 Hz) is on every channel', inv < 1e-9 && same < 1e-9 && flat === 0 && Math.abs(hum - S.ECT.mainsHum) < 1, J({ inv, same, flat, hum }));
    let hi = 0, lo = 0; for (let i = 0; i < a.rec.n; i++) { hi = Math.max(hi, a.rec.ecg[i]); lo = Math.min(lo, a.rec.ecg[i]); }
    ok('channel 4 from below the right clavicle (black) to the left lower chest (red): the QRS is upright, of a monitor lead’s size (0.5–2.5 mV)', hi > -lo && hi > 500 && hi < 2500, J({ hi, lo }));
    const std = structuredClone(S.STANDARD_MONTAGE);
    const rev = S.montageProblems({ ...std, ch: [{ black: 'M1', red: 'Fp1' }, ...std.ch.slice(1)] });
    const both = S.montageProblems({ ...std, ch: [{ black: 'M1', red: 'Fp1' }, { black: 'M2', red: 'Fp2' }, ...std.ch.slice(2)] });
    const hosp = S.montageProblems(S.HOSPITAL_MONTAGE);
    const sameSide = S.montageProblems({ ...std, ch: [std.ch[0], { black: 'Fp1', red: 'M1' }, ...std.ch.slice(2)] });
    ok('channel 1 may be on the right (the owner’s hospital) or the left (the manual), but channels 1 and 2 not on the same side', !hosp.length && sameSide.length === 1 && sameSide[0].ch === 2, J({ hosp, sameSide }));
    const tp = S.montageProblems({ ...std, ch: [{ black: 'F7', red: 'Fp1' }, ...std.ch.slice(1)] });
    ok('the leads are checked as the manual and the owner’s hospital place them: the hospital’s montage has no problem; the EEG either way round on both sides is fine, one side reversed is named; a channel 1 not on the mastoid is wrong; an empty montage misses all four channels and the ground', !S.montageProblems(S.STANDARD_MONTAGE).length && !both.length && rev.length === 1 && rev[0].ch === 2 && rev[0].kind === 'reversed' && tp.length === 1 && tp[0].kind === 'wrong' && S.montageProblems(S.EMPTY_MONTAGE()).length === 5, J({ rev, both, tp }));
    const any = S.montageProblems({ ch: [S.STANDARD_MONTAGE.ch[0], S.STANDARD_MONTAGE.ch[1], { black: 'foreR2', red: 'foreR1' }, { black: 'chestLR', red: 'chestUL' }], ground: 'shoulderL' });
    const gOnEcg = S.montageProblems({ ...structuredClone(S.STANDARD_MONTAGE), ground: 'chestUR' });
    ok('the ground below a clavicle is fine, but not on an ECG electrode’s spot', gOnEcg.length === 1 && gOnEcg[0].ch === 'ground', J(gOnEcg));
    ok('EMG and ECG in any order of polarity, the ECG on any pair above and below the heart, the ground on either shoulder (the manual)', !any.length, J(any));
    const p = new S.Procedure(new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 }), S.ECT_ORDERS[0], 'practise', [...S.ECT_ROLES]);
    p.act('check'); p.act('skin'); p.act('leads'); const before = p.isDone('leads'); placeAll(p); p.act('leads');
    ok('the learner plugs the cable in only once all nine leads are on', !before && p.isDone('leads') && p.session.monitoringCable, J({ before }));
    /* the EMG on the arm the cuff did not spare: the relaxant reaches it */
    const w = new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 });
    w.montage.ch[2] = { black: 'foreL1', red: 'foreL2' };
    w.relax(true); w.advance(61);
    const rr = S.scriptedTreatment(w, { program: 'LOW_05', percent: 30, after: 120 });
    ok('EMG on the left forearm, the cuff on the right: the relaxant reaches the left arm and its EMG shows no motor seizure', rr.emgEndpoint == null && rr.eegEndpoint != null, J({ emg: rr.emgEndpoint, eeg: rr.eegEndpoint }));
  }
  {
    /* the awake background the device takes its baseline from, and its suppression after the seizure */
    const s = new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 });
    s.advance(20);
    const rms = (x, i0, i1) => { let m = 0; for (let i = i0; i < i1; i++) m += x[i]; m /= i1 - i0; let v = 0; for (let i = i0; i < i1; i++) v += (x[i] - m) ** 2; return Math.sqrt(v / (i1 - i0)); };
    const rest = 2 * Math.SQRT2 * rms(s.rec.eeg1, s.rec.n - 2000, s.rec.n);
    ok('awake, channel 1 shows a normal adult background: at least 20 µV peak to trough (Hirsch 2021), the floor taken (under 25)', rest >= 20 && rest < 25, rest.toFixed(1));
    const r = S.scriptedTreatment(s, { program: 'LOW_05', percent: 30, after: 150 });
    const e = Math.round((r.stimulus.end + r.eegEndpoint + 5) * S.FS), z = Math.round((r.stimulus.end + r.eegEndpoint + 25) * S.FS);
    const post = 2 * Math.SQRT2 * rms(s.rec.eeg1, e, z);
    ok('after the seizure the relays silence the background: suppressed, under 10 µV (Hirsch 2021), from 5 to 25 s after the EEG endpoint', post < 10, post.toFixed(1));
  }
  {
    /* the seizure adequacy markers score on the standard first treatment (bitemporal, 30 % of LOW 0.5) */
    const s = new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 });
    s.advance(4); const r = S.scriptedTreatment(s, { program: 'LOW_05', percent: 30, after: 120 });
    const sc = S.sams({ eegEndpoint: r.eegEndpoint, psi: r.psi, coherence: r.coherence, midictal: r.midictal, peakHr: r.peakHr });
    ok('the seizure adequacy markers score is read off the report and the strip: five items, the midictal amplitude measured on channel 1 (the device prints none)', sc.items.length === 5 && r.midictal != null && r.midictal > 0 && sc.points >= 0 && sc.points <= 5 && ['good', 'medium', 'poor'].includes(sc.band),
      J({ points: sc.points, items: sc.items.map((x) => `${x.label.en}: ${x.value}${x.point ? ' ✓' : ''}`) }));
    /* the learner rates it; the procedure checks the rating against the report and the strip */
    const good = new S.Procedure(s, S.ECT_ORDERS[0], 'practise', ['psychiatrist']); good.act('sams', 'you', { sams: { points: sc.items.map((x) => x.point), band: sc.band } });
    const bad = new S.Procedure(s, S.ECT_ORDERS[0], 'practise', ['psychiatrist']); bad.act('sams', 'you', { sams: { points: sc.items.map((x) => !x.point), band: sc.band === 'poor' ? 'good' : 'poor' } });
    ok('the learner rates the seizure; a rating that matches the report passes, a wrong item and a wrong decision are named', good.isDone('sams') && !good.errors.length && bad.errors.some((e) => e.code === 'sams-items') && bad.errors.some((e) => e.code === 'sams-decision'), J({ good: good.errors.map((e) => e.code), bad: bad.errors.map((e) => e.code) }));
    console.log(`    SAMS on the standard treatment: ${sc.points}/5 — ${sc.items.map((x) => `${x.value}${x.point ? '✓' : ''}`).join(', ')}`);
  }
  {
    /* the restimulation rules (the in-house procedure) */
    const s = new S.EctSession({ placement: 'BT', prepared: true, skin: 0, seed: 7 }); const p = new S.Procedure(s, S.ECT_ORDERS.find((o) => o.id === 'restim'), 'watch', []);
    s.stimuli.push({ at: 0, percent: 30 }); const thirty = [p.restimPercent, p.restimDoseOk(45), p.restimDoseOk(40)];
    s.stimuli[0].percent = 15; const fifteen = [p.restimDoseOk(22), p.restimDoseOk(23), p.restimDoseOk(25)];
    ok('restimulation at 1.5 times the first dose, as near as the dial allows: 30 % → 45 %; 15 % → 22 or 23 %', thirty[0] === 45 && thirty[1] && !thirty[2] && fifteen[0] && fifteen[1] && !fifteen[2], J({ thirty, fifteen }));
  }
  const texts = [...S.STEPS.flatMap((x) => [x.title, x.how, x.why, x.says]), ...S.ECT_ORDERS.flatMap((o) => [o.title, o.doseNote, ...S.orderLines(o)]), ...Object.values(S.ROLE_NAME), ...Object.values(S.MODE_NAME)];
  ok('every step, order, role and mode text exists in English and German', texts.every((x) => x.en && x.de && x.en !== x.de || ['Coach'].includes(x.en)), J(texts.filter((x) => !(x.en && x.de && x.en !== x.de)).map((x) => x.en)));
}

console.log('\nTexts');
{
  const n = (x, k = 0) => x.toFixed(k);
  const st = (o) => ({ on: true, booting: false, baseline: 'ready', testedOhm: 1272, staticHigh: 3000, staticLow: 100, treat: 'idle', early: false, printing: false, stimulusEnd: null, reported: false, seconds: 0, ...o });
  const steps = [st({ on: false }), st({ booting: true }), st({ baseline: 'none' }), st({ testedOhm: 3000 }), st({ testedOhm: 50 }), st({ baseline: 'collecting' }), st({}), st({ treat: 'warning' }), st({ treat: 'delivering' }), st({ stimulusEnd: 1, seconds: 5 }), st({ stimulusEnd: 1, seconds: 40 }), st({ reported: true, stimulusEnd: 1 })].map((x) => S.nextStep(x, n));
  const facts = S.explainStimulus({ percent: 30, charge: 151.2, current: 0.9, pulseWidth: 0.5, frequency: 30, pulses: 336, duration: 5.6, dynamicOhm: 242, energy: 32.9, brainShare: 0.66, medianField: 0.79, threshold: 0.31, excitedRegions: 8, placementName: { en: 'Bitemporal', de: 'Bitemporal' }, placementWhere: { en: 'x', de: 'x' } }, n).map((x) => x.body);
  const all = [...steps, ...facts, ...S.ECT_BACKGROUND.flatMap((x) => [x.title, x.body]), S.ECT_STATION.title, S.ECT_STATION.summary];
  ok('every ECT explanation exists in English and German, with its numbers filled in', all.length > 25 && all.every((x) => x.en && x.de && x.en !== x.de && !/\$\{|undefined|NaN|Infinity/.test(x.en + x.de)), `${all.length} texts`);
  const de = S.reportLines({ percent: 30, charge: 151.2, current: 0.9, duration: 5.6, frequency: 30, pulseWidth: 0.5, staticOhm: 1272, dynamicOhm: 242, early: false, baselineAvailable: true, eegEndpoint: 70, emgEndpoint: 50, baseHr: 75, peakHr: 75, asei: 700, psi: 90, msp: 1200, ttp: 10, coh: 80, ttc: 8, program: 'Low 0.5 charge rate', indexes: true });
  ok('the report prints as the device does, in English with decimal points, in either language of the app (owner, 2026-10-30)', de.some((l) => l === 'Charge delivered: 151.2 mC') && de.length >= 17 && !de.some((l) => /,\d/.test(l)), J(de));
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
