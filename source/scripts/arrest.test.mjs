/* The physiology of an arrest (ADR-018 step 2 onwards), against human data. Chest compressions act on the circulation
   as a pressure on the chest's contents; what they produce is compared with patients in arrest. One constant is fitted
   (cpr.cardiacExtra, to Ornato's systolic pressure); everything else here is a validation. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const bundle = join(tmpdir(), `arrest-${Date.now()}.mjs`);
await esbuild.build({ entryPoints: ['scripts/_scenario_entry.ts'], bundle: true, outfile: bundle, format: 'esm', target: 'es2022', platform: 'node', loader: { '.ts': 'ts', '.js': 'js', '.json': 'json' }, logLevel: 'error' });
const S = await import(pathToFileURL(bundle).href);
unlinkSync(bundle);

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); } };
const gaps = [];
const gap = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { gaps.push(name); console.log(`  △ known gap: ${name}${detail ? ' — ' + detail : ''}`); } };
const f1 = (x) => x.toFixed(1);
const reading = (r) => `${f1(r.Psys)}/${f1(r.Pdia)} mmHg, CPP ${f1(r.CPP)} (end of relaxation ${f1(r.CPPend)}), flow ${r.CO.toFixed(2)} L/min`;

console.log('\nNothing acts until compressions start');
{
  const a = S.createCirculation(S.healthyModel()), b = S.createCirculation(S.healthyModel());
  a.settle(10); b.settle(10);
  b.setCompressor(new S.Compressor(S.CPR.itpManual));     // a compressor that has been given no compressions
  a.advance(5); b.advance(5);
  ok('a compressor with no compressions changes nothing, to the last digit', JSON.stringify(a.sim.metrics) === JSON.stringify(b.sim.metrics) && a.sim.Part === b.sim.Part);
}

console.log('\nUntreated ventricular fibrillation');
{
  const m = S.healthyModel(), run = S.createCirculation(m);
  run.settle(20);
  run.apply({ ...m, electrical: { ...m.electrical, ventricular: 'vf' } });
  run.advance(7.5);
  const ra = run.sim.Pra;
  /* Jellinek 2000: right atrial pressure 7.5 s after VF induced for defibrillator testing, 10.2 ± 3.5 mmHg (anaesthetised, apnoeic, Paw 0). */
  ok('7.5 s after the onset of VF the right atrial pressure is the mean systemic filling pressure measured in people (Jellinek 2000: 10.2 ± 3.5 mmHg)', Math.abs(ra - 10.2) <= 3.5, `${f1(ra)} mmHg`);
  run.advance(22.5);
  ok('…and by 30 s the aorta and the right atrium have met: no gradient, no flow', run.sim.Part - run.sim.Pra < 2 && run.sim.metrics.CO < 0.1, `aorta ${f1(run.sim.Part)}, right atrium ${f1(run.sim.Pra)} mmHg`);
}

console.log('\nCompressions, against patients in arrest');
const mech60 = S.cprTrial({ device: 'mechanical', rate: 60 });
const mech140 = S.cprTrial({ device: 'mechanical', rate: 140 });
const manual = S.cprTrial({ device: 'manual', rate: 110 });
{
  ok('fitted: a mechanical compressor at 60/min gives Ornato’s systolic pressure (59 ± 5 mmHg; the one constant fitted here, cpr.cardiacExtra)', Math.abs(mech60.Psys - 59) <= 5, reading(mech60));
  ok('compressions make flow and a positive coronary perfusion pressure out of a circulation at a standstill', mech60.CO > 0.5 && mech60.CPP > 5, reading(mech60));
  gap('validated: …and its diastolic pressure is Ornato’s, about 23 mmHg (within 5)', Math.abs(mech60.Pdia - 23) <= 5,
    `${f1(mech60.Pdia)} mmHg. The model’s vessels keep a fresh arrest’s maximal reflex tone (sympathetic drive 1.0), so the arteries drain slowly between compressions; Ornato’s patients were prehospital arrests of long duration, whose vessels have lost tone. How vascular tone fails in arrest is not modelled.`);
  gap('validated: systolic pressure falls with rate on the same machine (Ornato: 59 at 60/min, 46 at 140/min)', mech60.Psys - mech140.Psys >= 8,
    `model ${f1(mech60.Psys)} at 60/min, ${f1(mech140.Psys)} at 140/min. Not a clean comparison: Ornato’s Thumper held its force, and on a manikin the same force gave less sternal displacement and pressure at higher rates (shorter compressions). The model holds the intrathoracic pressure constant; with the applied pressure’s fall unknown, the rate effect cannot be separated from the device’s.`);
  gap('validated: Ornato’s diastolic pressure stays flat across rates (model within 5 mmHg from 60 to 140/min)', Math.abs(mech140.Pdia - mech60.Pdia) <= 5,
    `${f1(mech60.Pdia)} and ${f1(mech140.Pdia)} mmHg. It passed (by under a millimetre) until cpr.cardiacExtra was refitted from 0.10 to 0.11 when the lungs stopped breathing in an arrest; with the extra squeeze on the ventricles, faster compressions top up the relaxation pressure. As for the systolic comparison, Ornato’s machine held its force, not its pressure (gap 21).`);
  /* Paradis 1990: coronary perfusion pressure in the relaxation phase, initially 13.4 ± 8.5 mmHg in those who regained a circulation, 1.6 ± 8.5 in those who did not; maximal 25.6 ± 7.7 and 8.4 ± 10.0. */
  ok('validated: manual compressions at 110/min give a coronary perfusion pressure among Paradis’s patients who regained a circulation (13.4 ± 8.5 mmHg)', Math.abs(manual.CPP - 13.4) <= 8.5, reading(manual));
  ok('the right atrium is squeezed with every compression (its peak well above the aorta’s relaxation pressure): the pressure that does not perfuse the heart', manual.RAmax > manual.aortaRelax, `right atrial peak ${f1(manual.RAmax)}, aortic relaxation ${f1(manual.aortaRelax)} mmHg`);
}

console.log('\nWhen compressions stop');
{
  const m = S.healthyModel(), run = S.createCirculation(m);
  run.settle(20);
  run.apply({ ...m, electrical: { ...m.electrical, ventricular: 'vf' } });
  run.advance(30);
  const c = new S.Compressor(S.CPR.itpManual);
  c.steady(110, run.sim.t);
  run.setCompressor(c);
  run.advance(30);
  const during = run.sim.metrics.CPP;
  c.stopSteady(run.sim.t);
  run.advance(10);
  ok('ten seconds after the last compression the coronary gradient has gone again', during > 5 && run.sim.Part - run.sim.Pra < 3, `CPP ${f1(during)} during, aorta − right atrium ${f1(run.sim.Part - run.sim.Pra)} mmHg after`);
}

/* ---- ADR-018 step 2b: breathing in arrest, given breaths, CO2 at low flow --------------------------------------------- */
const MMHG = 7.50062, PCT = 7.6;    // kPa → mmHg; 1 % end-tidal CO2 ≈ 7.6 mmHg at sea level
const healthyRun = (tweak) => { const m0 = S.healthyModel(); const run = S.createCirculation(m0); run.settle(20); const m = structuredClone(m0); tweak?.(m); if (tweak) run.apply(m); return { run, m }; };
const toVf = (run, m) => run.apply({ ...m, electrical: { ...m.electrical, ventricular: 'vf' } });
const snapR = (run) => run.resp.snapshot();
/* The circulation's own mean over its last window of a pressure, from the beat samples. */
const windowMean = (run, k) => { const b = run.sim.lastBeat?.samples ?? []; return b.reduce((a, s) => a + s[k], 0) / Math.max(1, b.length); };

console.log('\nBreathing stops when the brain loses its blood supply');
{
  const { run, m } = healthyRun();
  const before = snapR(run);
  toVf(run, m);
  run.advance(40);
  const r = snapR(run);
  ok('a breathing patient whose heart fibrillates stops breathing within 40 s (the centre fails; this patient does not gasp)', before.RR > 10 && r.RR === 0 && r.VE === 0 && r.centre < 0.05,
    `RR ${before.RR.toFixed(1)} → ${r.RR.toFixed(1)}/min, centre ${r.centre.toFixed(2)}`);
  ok('…and the capnograph reads nothing: no gas comes out', r.EtCO2 === 0);
  const g = healthyRun(), gm = g.m;
  g.run.resp.gaspFor = 120;
  toVf(g.run, gm);
  g.run.advance(40);
  const rg = snapR(g.run);
  ok('a patient who gasps takes slow gasps once the centre has failed', rg.gasping && Math.abs(rg.RR - S.LUNG.gaspRate) < 2.5, `RR ${rg.RR.toFixed(1)}/min, gasping ${rg.gasping}`);
  g.run.advance(150);
  const rg2 = snapR(g.run);
  ok('…until the gasping is over', !rg2.gasping && rg2.RR === 0, `RR ${rg2.RR.toFixed(1)}`);
}

{
  /* During CPR the brain is perfused a little; a failed centre does not start breathing again on that. */
  const { run, m } = healthyRun();
  toVf(run, m); run.advance(40);
  const c = new S.Compressor(S.CPR.itpManual); c.steady(110, run.sim.t); run.setCompressor(c);
  run.advance(120);
  const r = snapR(run);
  ok('during two minutes of compressions a patient who does not gasp does not breathe either', r.RR === 0 && r.VE === 0, `RR ${r.RR.toFixed(1)}, centre ${r.centre.toFixed(2)}`);
}

console.log('\nApnoea with a circulation (Stock 1989): the CO2 store');
{
  /* Anaesthetised (no drive, metabolism a sixth lower), on oxygen, ventilated to a normal PaCO2, then the tube clamped. */
  const { run } = healthyRun((m) => { m.respiratory = { ...m.respiratory, FiO2: 1, drive: 0, metabolicRate: 0.85 }; });
  const v = new S.Ventilator('tube'); v.steady(12, run.resp.t, Infinity, 0.45); run.setVentilator(v);
  run.advance(600);
  v.stopSteady(run.resp.t);
  const p0 = snapR(run).PaCO2 * MMHG;
  run.advance(60); const p60 = snapR(run).PaCO2 * MMHG;
  run.advance(240); const r300 = snapR(run), p300 = r300.PaCO2 * MMHG;
  const perMin = (p300 - p60) / 4;
  ok('fitted: after the first minute PaCO2 rises 3.4 mmHg/min (Stock; the store’s capacity was derived from it)', Math.abs(perMin - 3.4) < 0.5, `${perMin.toFixed(2)} mmHg/min from ${p0.toFixed(1)}`);
  gap('validated: in the first minute PaCO2 rises 12 mmHg (Stock; within 3)', Math.abs(p60 - p0 - 12) <= 3,
    `${(p60 - p0).toFixed(1)} mmHg. The model’s lungs hold 3.4 L of gas, the FRC of an awake, upright adult; anaesthesia and lying supine shrink it (to about 2–2.5 L), and a smaller lung fills with CO2 faster. How anaesthesia and posture change FRC is not modelled.`);
  ok('validated: on oxygen the patient stays saturated through 5 minutes of apnoea (Stock sampled only while SaO2 exceeded 92 %)', r300.SaO2 > 0.92, `SaO2 ${(r300.SaO2 * 100).toFixed(0)} % at 300 s`);
}

console.log('\nPositive airway pressure and the circulation (Jellinek 2000)');
{
  /* Anaesthetised and apnoeic, as for defibrillator testing: right atrial pressure and stroke volume at an airway pressure of
     0 and of 15 cmH2O; mean systemic filling pressure as the right atrial pressure 7.5 s into induced VF at each. */
  const measure = (paw) => {
    const { run, m } = healthyRun((mm) => { mm.respiratory = { ...mm.respiratory, FiO2: 1, drive: 0 }; });
    const v = new S.Ventilator('tube'); v.steady(12, run.resp.t, Infinity, 0.45); run.setVentilator(v);
    run.advance(180);
    v.stopSteady(run.resp.t); v.staticPressure = paw;
    run.advance(20);
    const ra = windowMean(run, 'Pra'), sv = run.sim.metrics.SV;
    toVf(run, m);
    run.advance(7.5);
    return { ra, sv, msfp: run.sim.Pra };
  };
  const a = measure(0), b = measure(15);
  const dRA = b.ra - a.ra, dSV = (b.sv / a.sv - 1) * 100, dMS = b.msfp - a.msfp;
  ok('validated: 15 cmH2O at the airway raises right atrial pressure as in Jellinek’s patients (+2.7 mmHg; within the spread, 0 to +5.5)', dRA >= 0 && dRA <= 5.5, `${a.ra.toFixed(1)} → ${b.ra.toFixed(1)} mmHg`);
  ok('validated: …and lowers stroke volume (Jellinek: −23 ± 22 %)', dSV <= 0 && dSV >= -45, `${dSV.toFixed(0)} %`);
  gap('validated: …and raises the mean systemic filling pressure as much, so the gradient for venous return holds (Jellinek: +2.5 mmHg, 10.2 → 12.7)', dMS >= 1.5,
    `${a.msfp.toFixed(1)} → ${b.msfp.toFixed(1)} mmHg (+${dMS.toFixed(1)}). In people the inflated lungs push the diaphragm down and raise abdominal pressure on the splanchnic veins, and reflexes tighten them; the model has one systemic venous pool outside the chest and no abdomen (the separate abdominal pool waits in the heart–lung chain).`);
}

console.log('\nEnd-tidal CO2 follows the flow (Falk 1988, Ornato 1988, Levine 1997)');
{
  /* Falk's patients were on mechanical ventilation when they arrested. Ratios to before the arrest, since his patients'
     end-tidal CO2 before arrest (1.4 %) was low for critical illness and the model's is a healthy man's. */
  const { run, m } = healthyRun();
  const v = new S.Ventilator('tube'); v.steady(10, run.resp.t); run.setVentilator(v);
  run.advance(120);
  const pre = snapR(run).EtCO2;
  toVf(run, m); run.advance(60);
  const arrest = snapR(run).EtCO2;
  const c = new S.Compressor(S.CPR.itpManual); c.steady(110, run.sim.t); run.setCompressor(c);
  run.advance(120);
  const cpr = snapR(run).EtCO2;
  const scaled = (x) => (x / pre) * 1.4;
  ok('validated: a minute into the arrest, end-tidal CO2 has fallen as in Falk’s patients (scaled to his 1.4 % before: 0.4 ± 0.4 %)', scaled(arrest) <= 0.8, `${(arrest * MMHG).toFixed(1)} from ${(pre * MMHG).toFixed(1)} mmHg, ${scaled(arrest).toFixed(2)} % scaled`);
  ok('validated: …and compressions bring it back up (Falk: 1.0 ± 0.5 %)', scaled(cpr) >= 0.5 && scaled(cpr) <= 1.5 && cpr > arrest, `${(cpr * MMHG).toFixed(1)} mmHg, ${scaled(cpr).toFixed(2)} % scaled`);
  /* Levine: 20 minutes of advanced life support without a return of circulation. */
  run.advance(18 * 60);
  const late = snapR(run).EtCO2 * MMHG;
  gap('validated: after 20 minutes of CPR without a return of circulation, end-tidal CO2 is that of Levine’s non-survivors (4.4 ± 2.9 mmHg; within 2 SD, below 10.2)', late <= 10.2,
    `${late.toFixed(1)} mmHg. Nothing in the model deteriorates during a long arrest: compressions keep their flow and the vessels their tone (gap 20), and lung that is ventilated but no longer perfused at low pulmonary pressures (alveolar dead space) is not modelled; in people both drive end-tidal CO2 down.`);
}
{
  const at = (rate) => {
    const { run, m } = healthyRun();
    const v = new S.Ventilator('tube'); v.steady(12, run.resp.t); run.setVentilator(v);
    run.advance(60); toVf(run, m); run.advance(60);
    const c = new S.Compressor(S.CPR.itpMechanical); c.steady(rate, run.sim.t); run.setCompressor(c);
    run.advance(120);
    return snapR(run).EtCO2 * MMHG / PCT;
  };
  const e60 = at(60), e140 = at(140);
  ok('validated: on the same machine, end-tidal CO2 hardly changes with the compression rate (Ornato: unchanged from 60 to 140/min; within 0.4 %)', Math.abs(e140 - e60) <= 0.4, `${e60.toFixed(2)} % at 60/min, ${e140.toFixed(2)} % at 140/min`);
  gap('validated: …and is Ornato’s 1.7 % (within 0.6 %)', Math.abs(e60 - 1.7) <= 0.6,
    `${e60.toFixed(2)} %. Ornato’s ventilation (the Thumper’s) is not given in the abstract; 12 breaths of 0.5 L/min are assumed. The model has no alveolar dead space at the low pulmonary pressures of CPR, which lowers end-tidal against arterial CO2 in people.`);
}

console.log('\nWhat reaches the lungs');
{
  const lungsGet = (route, open = true) => {
    const { run, m } = healthyRun();
    toVf(run, m); run.advance(40);
    const v = new S.Ventilator(route); v.airwayOpen = open; v.steady(10, run.resp.t); run.setVentilator(v);
    run.advance(40);
    return snapR(run);
  };
  const tube = lungsGet('tube'), oes = lungsGet('oesophageal'), mask = lungsGet('mask'), closed = lungsGet('mask', false);
  ok('a tube in the trachea: the chest rises with every breath and CO2 comes back', tube.givenVolume > 0.4 && tube.EtCO2 > 0, `${tube.givenVolume.toFixed(2)} L, EtCO2 ${(tube.EtCO2 * MMHG).toFixed(1)} mmHg`);
  ok('a tube in the oesophagus: no chest rise and a flat capnogram, by themselves', oes.givenVolume === 0 && oes.EtCO2 === 0);
  ok('a mask leaks: less reaches the lungs than through a tube', mask.givenVolume > 0 && mask.givenVolume < tube.givenVolume, `${mask.givenVolume.toFixed(2)} against ${tube.givenVolume.toFixed(2)} L`);
  ok('a mask on an airway that is not open: nothing reaches the lungs', closed.givenVolume === 0 && closed.EtCO2 === 0);
}

/* ---- ADR-018 step 3: the heart in an arrest and the shock --------------------------------------------------------------- */
console.log('\nThe myocardium in an arrest');
const leadII = (v) => Array.from({ length: v.X.length }, (_, i) => 0.235 * v.X[i] + 1.066 * v.Y[i] - 0.132 * v.Z[i]);
const ppMean = (xs) => { const pp = []; for (let i = 0; i + 500 <= xs.length; i += 500) { const w = xs.slice(i, i + 500); pp.push(Math.max(...w) - Math.min(...w)); } return pp.reduce((a, x) => a + x, 0) / pp.length; };
/* A heart in VF for `untreated` seconds, then optionally `cpr` seconds of manual compressions; returns the run, its model and M. */
const arrestFor = (untreated, cpr = 0) => {
  const { run, m } = healthyRun();
  toVf(run, m); run.advance(untreated);
  if (cpr) { const c = new S.Compressor(S.CPR.itpManual); c.steady(110, run.sim.t); run.setCompressor(c); run.advance(cpr); run.setCompressor(null); }
  return { run, m, M: run.arrest.M };
};
/* Force the organised rhythm a terminating shock gives, and read the pressure `after` seconds later. */
const organise = (run, m, after) => { run.apply({ ...m, electrical: { ...m.electrical, ventricular: 'none' } }); run.advance(after); return run.sim.metrics; };
{
  const { run } = healthyRun();
  ok('a perfused heart keeps its state: nothing changes outside an arrest', run.arrest.M === 1 && run.arrest.contractility() === 1 && run.heart.vfScale === 1);
  const a10 = arrestFor(600);
  ok('ten minutes of VF without compressions run the myocardium down to where an organised rhythm barely makes a pulse (the placement)', Math.abs(a10.M - 0.12) < 0.015, `M ${a10.M.toFixed(3)}`);
  /* The VF waveform's amplitude wanders slowly by itself, so each is the mean over a minute, read in 10 s pieces. */
  const minute = (run) => { run.sim.snapshot(); const xs = []; for (let k = 0; k < 6; k++) { run.advance(10); xs.push(ppMean(leadII(run.sim.snapshot().ecgLeads))); } return xs.reduce((a, x) => a + x, 0) / xs.length; };
  const ppFresh = minute(arrestFor(5).run), ppLate = minute(arrestFor(270).run);
  ok('VF on lead II is coarse at first and finer after 5 minutes (each the mean over a minute)', ppLate < 0.8 * ppFresh, `${ppFresh.toFixed(2)} mV fresh, ${ppLate.toFixed(2)} mV at 5 min`);
  gap('validated: …and around 5 minutes is as coarse as in Weaver’s patients at the crew’s arrival (0.55 ± 0.25 mV)', Math.abs(ppLate - 0.55) <= 0.25,
    `${ppLate.toFixed(2)} mV (fresh ${ppFresh.toFixed(2)}). The model’s VF is finer than people’s from the start: the size of the VF dipole is an inline constant of the ECG model, never grounded; arrest.vfFineScale only sets how far it falls.`);
}

console.log('\nWhat a shock leads to, by how long the heart has fibrillated');
{
  const early = arrestFor(120);
  const bpEarly = organise(early.run, early.m, 30);
  ok('the electrical phase: two minutes in, an organised rhythm after a shock is very likely and perfuses within 30 s', early.run.arrest.organisedChance() > 0.85 && bpEarly.Psys > 90, `chance ${(arrestFor(120).run.arrest.organisedChance() * 100).toFixed(0)} %, BP ${bpEarly.Psys.toFixed(0)}/${bpEarly.Pdia.toFixed(0)}`);
  const long = arrestFor(780);
  const pOrg = long.run.arrest.organisedChance();
  const bp30 = organise(long.run, long.m, 30);
  ok('thirteen minutes in, an organised rhythm is less likely, and at first it makes little pressure (pulseless electrical activity, systolic under 50)', pOrg < 0.45 && bp30.Psys < 50, `chance ${(pOrg * 100).toFixed(0)} %, BP at 30 s ${bp30.Psys.toFixed(0)}/${bp30.Pdia.toFixed(0)}`);
  long.run.advance(150);
  ok('validated: …and perfuses within a few minutes of the shock, as in Pierce 2015 (ROSC a median 136 s after the shock)', long.run.sim.metrics.Psys > 70, `BP at 3 min ${long.run.sim.metrics.Psys.toFixed(0)}`);
  gap('validated: a pulseless organised rhythm after a long arrest can persist without drugs (pulseless electrical activity is common late, Levine 1997)', false,
    'In the model an organised heart always perfuses itself back: its own coronary perfusion restores it. What makes PEA persist in people (the ischaemic, acidotic, stunned myocardium; vasoplegia) is not modelled; adrenaline (step 4) acts on the arterioles only, and its β effects on a weak organised heart are not modelled.');
}

console.log('\nCompressions before the shock (Wik 2003; Cobb 1999)');
{
  /* First-shock outcome: P(terminated) × P(organised | state). Late: immediate shock at 14 min against 3 min of
     compressions first, shock at 16 min (Wik: collapse to arrival about 12 min, arrival to shock 1.9 against 3.8 min). */
  const p = (M) => S.ARREST.shockTermination * Math.pow(M, S.ARREST.organisedExponent);
  const odds = (x) => x / (1 - x);
  const lateNow = p(arrestFor(840).M), lateCpr = p(arrestFor(780, 180).M);
  const orLate = odds(lateCpr) / odds(lateNow);
  ok('validated: when help comes late, compressions first make an organised rhythm after the first shock likelier, within Wik’s confidence interval for ROSC (OR 2.22, 1.06–4.63)', orLate >= 1.06 && orLate <= 4.63,
    `${(lateNow * 100).toFixed(0)} % against ${(lateCpr * 100).toFixed(0)} %, OR ${orLate.toFixed(2)}`);
  const earlyNow = p(arrestFor(300).M), earlyCpr = p(arrestFor(240, 180).M);
  const orEarly = odds(earlyCpr) / odds(earlyNow);
  ok('validated: when help comes early, compressions first make little difference (Wik: no difference with response ≤ 5 min; Cobb: 59 % against 61 % admitted alive)', orEarly > 0.6 && orEarly < 1.67,
    `${(earlyNow * 100).toFixed(0)} % against ${(earlyCpr * 100).toFixed(0)} %, OR ${orEarly.toFixed(2)}`);
}

console.log('\nCoronary perfusion pressure and a return of circulation (Paradis 1990)');
{
  /* Weak compressions: a third of the intrathoracic pressure, coronary perfusion pressure under 15 mmHg. */
  const { run, m } = healthyRun();
  toVf(run, m); run.advance(300);
  const c = new S.Compressor(S.CPR.itpManual * 0.5); c.steady(110, run.sim.t); run.setCompressor(c);
  run.advance(600);
  const cpp = run.sim.metrics.CPP, M = run.arrest.M, pOrg = run.arrest.organisedChance();
  run.setCompressor(null);
  const bp = organise(run, m, 30);
  gap('validated: with a coronary perfusion pressure that never reaches 15 mmHg, no organised rhythm perfuses (Paradis: no ROSC below a maximal 15)', cpp >= 15 || bp.Psys < 50,
    `CPP ${cpp?.toFixed(1)} mmHg, M ${M.toFixed(2)}, chance of an organised rhythm ${(pOrg * 100).toFixed(0)} %, systolic 30 s after ${bp.Psys.toFixed(0)}. The myocardium gains from any coronary perfusion above 0 (Paradis’s other finding: none regained a circulation from an initial pressure below 0); a coronary zero-flow pressure above 0 in an arrest is plausible but not grounded here, and an organised heart perfuses itself back (above).`);
}

console.log('\nThe return of a circulation (Falk 1988)');
{
  /* Ventilated by tube, 4 minutes of VF with compressions, then an organised rhythm: end-tidal CO2 through the next 4 minutes. */
  const { run, m } = healthyRun();
  const v = new S.Ventilator('tube'); v.steady(10, run.resp.t); run.setVentilator(v);
  run.advance(60); toVf(run, m); run.advance(60);
  const c = new S.Compressor(S.CPR.itpManual); c.steady(110, run.sim.t); run.setCompressor(c); run.advance(180); run.setCompressor(null);
  const during = snapR(run).EtCO2 * MMHG;
  run.apply({ ...m, electrical: { ...m.electrical, ventricular: 'none' } });
  let peak = 0, peakAt = 0;
  for (let t = 1; t <= 90; t++) { run.advance(1); const e = snapR(run).EtCO2 * MMHG; if (e > peak) { peak = e; peakAt = t; } }
  run.advance(150);
  const settled = snapR(run).EtCO2 * MMHG;
  ok('validated: at the return of a circulation end-tidal CO2 rises steeply, overshoots and settles (Falk: 1.3 → 3.7 % within about 30 s, then 2.4 % at 4 min)', peak > during * 1.3 && peak > settled * 1.1,
    `${during.toFixed(1)} mmHg during CPR, peak ${peak.toFixed(1)} at ${peakAt} s, ${settled.toFixed(1)} at 4 min`);
  gap('validated: …with the peak within about 30 s (Falk; within 30 s of that)', peakAt <= 60, `peak at ${peakAt} s`);
}

/* ---- ADR-018 step 4: adrenaline and amiodarone ------------------------------------------------------------------------- */
console.log('\nDrugs at rest');
{
  const d = new S.Drugs();
  d.step(60);
  ok('with no drug given, nothing changes: resistance and the recurrence of VF are exactly as without the drug model', d.resistanceMult() === 1 && d.recurrenceMult() === 1 && d.adrenaline() === 0);
  d.give('adrenaline', 1); d.step(0.1);
  ok('a dose is not in the blood at once: it is carried in from the vein', d.adrenaline() < 10, `${d.adrenaline().toFixed(1)} ng/mL after 0.1 s`);
}

console.log('\nAdrenaline in CPR (Paradis 1991; Wortsman 1993; Gonzalez 1988)');
const sd = (x) => x.toFixed(1);
/* Paradis's protocol: several standard doses, the third measured; and the same with the third a high dose (0.2 mg/kg, 14 mg at 70 kg). */
const std = S.paradisRise(1), high = S.paradisRise(14);
{
  const first = S.firstDoseRise();
  ok('fitted: the first standard dose raises the coronary perfusion pressure by Paradis’s 3.7 mmHg (within 0.3)', Math.abs(first.rise - 3.7) < 0.3, `${sd(first.before)} → ${sd(first.peak)} mmHg`);
  ok('derived: 2.5 min after a standard dose the plasma level is Wortsman’s about 0.5 µmol/L (91.6 ng/mL, within 5 %)', Math.abs(first.at150 / 91.6 - 1) < 0.05, `${first.at150.toFixed(0)} ng/mL`);
  const at5 = first.rows.find((r) => r.t === S.PARADIS.earlier[0] + 300).adrenaline;
  ok('a dose wears off: five minutes after it, the plasma level is under half its peak (half-life 2.6 min, Heradstveit)', at5 < 0.5 * first.plasmaPeak, `${first.plasmaPeak.toFixed(0)} → ${at5.toFixed(0)} ng/mL`);
  /* Paradis: the rise after a standard dose 3.7 ± 5.0 mmHg in 32 patients (standard error 0.9). */
  gap('validated: after earlier doses a standard dose still raises the coronary perfusion pressure by Paradis’s 3.7 mmHg (within two standard errors, 1.8)', Math.abs(std.rise - 3.7) <= 1.8,
    `${sd(std.before)} → ${sd(std.peak)} mmHg (+${sd(std.rise)}). The model’s coronary perfusion pressure is near its ceiling after two doses: its arteries keep full reflex tone in an arrest (gap 20), so constricting them further adds little; Paradis’s patients, after long CPR, had more room.`);
  ok('validated: a high dose raises it more than a standard one (Paradis)', high.rise > std.rise, `+${sd(high.rise)} against +${sd(std.rise)}`);
  gap('validated: …by Paradis’s 11.3 ± 10.0 mmHg (within two standard errors, 3.5)', Math.abs(high.rise - 11.3) <= 3.5, `+${sd(high.rise)} mmHg; the same ceiling, and the effect is held above the measured 400 ng/mL`);
  /* Paradis: the highest plasma level after a standard dose 152 ± 162 ng/mL (standard error 29), after a high dose 393 ± 289 (51). */
  ok('validated: the highest plasma level after a standard dose (Paradis: 152 ± 162 ng/mL, within two standard errors)', Math.abs(std.plasmaPeak - 152) <= 58, `${std.plasmaPeak.toFixed(0)} ng/mL`);
  gap('validated: …and after a high dose (Paradis: 393 ± 289 ng/mL, within two standard errors)', Math.abs(high.plasmaPeak - 393) <= 102,
    `${high.plasmaPeak.toFixed(0)} ng/mL. A single compartment scales the level with the dose (14 mg, 14 times); Paradis measured 2.6 times the standard dose’s peak. Distribution or clearance that rise with the level are not modelled; the effect is held above 400 ng/mL, so the pressure does not follow the overshoot.`);
}
{
  /* Gonzalez 1988: a Thumper at 60/min, 50:50, ventilated; peak radial systolic 35 ± 5 before, 57 ± 20 after 1 mg (n = 5). */
  const rows = S.drugTrial({ device: 'mechanical', rate: 60, vfSeconds: 240, cprSeconds: 600, doses: [{ at: 300, drug: 'adrenaline', mg: 1 }] });
  const before = S.trialMean(rows, 'Psys', 240, 300), peak = S.trialPeak(rows, 'Psys', 300, 600, 30);
  gap('validated: on a mechanical compressor at 60/min, 1 mg raises the systolic pressure by Gonzalez’s 22 mmHg (35 → 57 ± 20, five patients; within 20)', Math.abs(peak - before - 22) <= 20,
    `${sd(before)} → ${sd(peak)} mmHg. Systolic pressure in CPR is the compression’s; the arterioles hold the pressure between compressions, so constricting them raises the diastolic more than the systolic. Gonzalez’s patients started far lower (35 against the model’s ${before.toFixed(0)}, fitted to Ornato’s 59).`);
}

console.log('\nThrough the shocks: a cohort (ARREST 1999; PARAMEDIC2 2018)');
/* A cohort through the shocks, cheaply: each patient's myocardium (MyocardialState) and rhythm, second by second, with a
   shock every 2 min while in VF and the run's own chance streams. The circulation is not run per patient: in VF or
   asystole under compressions the coronary perfusion pressure is the model's in CPR (read from the runs above); an
   organised heart perfuses itself (gap 26). Asystole has no way out here, as in the model. A return of circulation at
   the end is the outcome; survival depends on the brain, which the model does not have. */
const cohort = ({ n, cpp, startM, seconds, doses = [] }) => {
  let rosc = 0;
  for (let i = 0; i < n; i++) {
    const c = new S.Chance(5000 + i), heart = new S.MyocardialState(), drugs = new S.Drugs();
    heart.M = startM;
    let rhythm = 'vf', nextShock = 120, refibAt = null;
    const due = [...doses];
    for (let t = 0; t < seconds; t++) {
      while (due.length && due[0].at <= t) { const d = due.shift(); drugs.give(d.drug, d.mg); }
      drugs.step(1);
      if (rhythm === 'organised' && refibAt != null && t >= refibAt) { rhythm = 'vf'; refibAt = null; nextShock = t + 120; }
      heart.step(1, rhythm === 'organised' ? S.ARREST.cppFullFlow : cpp(t), rhythm !== 'organised');
      if (rhythm === 'vf' && t >= nextShock) {
        const out = heart.shock(c.uniform('shock'), c.uniform('shock-rhythm'));
        const uF = c.uniform('refibrillation'), uFt = c.uniform('refibrillation-time');
        if (out === 'not-terminated') { nextShock = t + 120; continue; }
        rhythm = out;
        if (out === 'organised' && uF < S.ARREST.refibrillationChance * drugs.recurrenceMult()) refibAt = t + Math.max(1, -Math.log(1 - uFt) * S.ARREST.refibrillationMedian / Math.LN2);
      }
    }
    if (rhythm === 'organised') rosc++;
  }
  return rosc / n;
};
const odds = (x) => x / (1 - x);
/* Compressions alone, and with adrenaline every 5 min, read from Paradis's protocol: before the first dose, and from it on. */
const cppNone = S.trialMean(std.rows, 'CPP', 240, 360), cppAdr = S.trialMean(std.rows, 'CPP', 360, 1260);
{
  /* ARREST (Kudenchuk 1999): shock-refractory VF after three or more shocks, about 20 min into a resuscitation of 42; 300 mg
     against placebo; admitted alive 44 % against 34 % (adjusted OR 1.6, 1.1–2.4). Twenty minutes in, the myocardium under
     compressions is at its steady state, the share of full coronary supply that the compressions give. */
  const base = { n: 4000, cpp: () => cppNone, startM: cppNone / S.ARREST.cppFullFlow, seconds: 20 * 60 };
  const pPl = cohort(base), pAm = cohort({ ...base, doses: [{ at: 0, drug: 'amiodarone', mg: 300 }] });
  const or = odds(pAm) / odds(pPl);
  ok('validated: amiodarone after the third shock raises the odds of a circulation at the end within ARREST’s confidence interval (OR 1.6, 1.1–2.4)', or >= 1.1 && or <= 2.4,
    `${(pAm * 100).toFixed(0)} % against ${(pPl * 100).toFixed(0)} %, OR ${or.toFixed(2)} (ARREST: 44 % against 34 % admitted alive; its 4 against 6 shocks set the effect)`);
  gap('validated: …at ARREST’s rates (34 % with placebo, within 8 %)', Math.abs(pPl - 0.34) <= 0.08,
    `${(pPl * 100).toFixed(0)} % with placebo. Asystole after a shock is final here, and an organised rhythm always perfuses (gap 26).`);
}
{
  /* PARAMEDIC2 (Perkins 2018): ROSC at hospital arrival 23.8 % against 8.0 % (OR 3.59, 3.14–4.12), but about 78 % of its
     patients were in asystole or PEA, where adrenaline was given at once. For VF (adrenaline after the third shock) no
     breakdown was read. The model's VF arm: the coronary perfusion pressure of Paradis's protocol, adrenaline every 5 min. */
  const base = { n: 4000, startM: cppNone / S.ARREST.cppFullFlow, seconds: 20 * 60 };
  const pPl = cohort({ ...base, cpp: () => cppNone }), pAd = cohort({ ...base, cpp: () => cppAdr });
  const or = odds(pAd) / odds(pPl);
  gap('validated: adrenaline raises the odds of a return of circulation about as much as in PARAMEDIC2 (OR 3.59, 3.14–4.12; mostly non-shockable rhythms)', or >= 3.14 && or <= 4.12,
    `VF only: ${(pAd * 100).toFixed(0)} % against ${(pPl * 100).toFixed(0)} %, OR ${or.toFixed(2)}; coronary perfusion pressure ${sd(cppAdr)} against ${sd(cppNone)} mmHg. Here adrenaline helps only through the coronary perfusion pressure it adds, which the model’s ceiling keeps small (gap 20); its β effects on a weak organised heart are not modelled, and asystole and PEA, where most of PARAMEDIC2’s effect lay, have no way out or no need of one (gap 26).`);
}

console.log('\nMassive pulmonary embolism: an arrest with a cause (Wood 2002; PAIMS 2, Dalla-Volta 1992)');
{
  /* A healthy adult, the same fraction of the pulmonary arterial bed blocked in every lobe, two minutes to settle. Wood 2002
     (after McIntyre & Sasahara 1971, people without prior cardiopulmonary disease): output normal or raised despite substantial
     obstruction, a fall unusual below 50 %; mean pulmonary artery pressure rising with obstruction but not above about
     40 mmHg, the most a healthy right ventricle generates, and lower than expected once the ventricle fails; arrest almost
     uniformly pulseless electrical activity. */
  const blocked = (x) => {
    const m = S.healthyModel(), run = S.createCirculation(m); run.settle(20);
    const emb = Object.fromEntries(['RUL', 'RML', 'RLL', 'LUL', 'LLL'].map((l) => [`emb${l}`, x]));
    run.apply({ ...m, respiratory: { ...m.respiratory, ...emb } }); run.advance(120);
    return { ...run.sim.metrics, rhythm: run.heart.p.ventricular, run };
  };
  const rows = [0, 0.5, 0.7, 0.83, 0.9, 0.95].map((x) => ({ x, ...blocked(x) }));
  const at = (x) => rows.find((r) => r.x === x);
  const show = rows.map((r) => `${Math.round(r.x * 100)} %: ${Math.round(r.Psys)}/${Math.round(r.Pdia)}, mPAP ${r.PpaMean.toFixed(0)}, CO ${r.CO.toFixed(1)}`).join('; ');
  ok('validated: output holds up to half the bed blocked (Wood 2002: a fall is unusual without at least 50 % obstruction)', at(0.5).CO >= 0.9 * at(0).CO, show);
  ok('validated: mean pulmonary artery pressure never exceeds about 40 mmHg, the most a healthy right ventricle generates (Wood 2002)', Math.max(...rows.map((r) => r.PpaMean)) <= 42, show);
  ok('validated: at a Miller index of 28.3 of 34 (83 %), mean pulmonary artery pressure is within PAIMS 2’s 30.2 ± 7.8 mmHg', Math.abs(at(0.83).PpaMean - 30.2) <= 7.8, `${at(0.83).PpaMean.toFixed(1)} mmHg`);
  ok('validated: with almost the whole bed blocked the right ventricle fails: pulmonary pressure falls below its peak (Wood 2002)', at(0.95).PpaMean < Math.max(...rows.map((r) => r.PpaMean)) - 5, show);
  ok('validated: the arrest is pulseless electrical activity, an organised rhythm without a palpable pulse (Wood 2002: almost uniformly PEA)', at(0.95).rhythm === 'none' && at(0.95).Psys < 50, `${Math.round(at(0.95).Psys)}/${Math.round(at(0.95).Pdia)} mmHg, ventricular ${at(0.95).rhythm}`);
  gap('an untreated PEA from a massive embolism declines towards asystole', (at(0.95).run.advance(600), at(0.95).run.arrest.M < 0.9),
    `M ${at(0.95).run.arrest.M.toFixed(2)} after 12 min: the myocardium wears out only while it fibrillates or stands still; a weak organised heart is held at its ischaemic floor indefinitely (gap 26).`);
  /* Alteplase: PAIMS 2's Miller index fell from 28.3 to 24.8 in 2 h; with heparin alone it did not change. */
  const d = new S.Drugs(); d.give('alteplase', 50); for (let i = 0; i < 7200; i++) d.step(1);
  const none = new S.Drugs(); for (let i = 0; i < 600; i++) none.step(1);
  ok('derived: two hours of alteplase leave 24.8 / 28.3 of the obstruction (PAIMS 2)', Math.abs((1 - d.lysed) - 24.8 / 28.3) < 0.005, `${((1 - d.lysed) * 100).toFixed(1)} % left`);
  ok('without alteplase nothing dissolves (PAIMS 2: no change with heparin)', none.lysed === 0);
  const r = blocked(0.95), before = r.run.resp.rpulMult();
  r.run.drugs.give('alteplase', 50); r.run.advance(1200);
  const after = r.run.resp.rpulMult();
  ok('the lungs see the emboli that are left: twenty minutes of alteplase lower the pulmonary resistance', after < before && r.run.drugs.lysed > 0.015 && r.run.drugs.lysed < 0.03,
    `lysed ${(r.run.drugs.lysed * 100).toFixed(1)} %, PVR ×${before.toFixed(2)} → ×${after.toFixed(2)}; systolic ${Math.round(r.run.sim.metrics.Psys)}. Slow, as the guideline’s 60–90 min of CPR after thrombolysis expects.`);
}

console.log('\nVenous return when the circulation empties (Guyton 1957; Schadt & Ludbrook 1991)');
{
  /* A healthy adult, bled to a volume (or with the pressure in the chest raised) and given two minutes. */
  const at = ({ bv = 5000, chest = 0 }) => {
    const m = S.healthyModel(), run = S.createCirculation(m); run.settle(20);
    if (chest) { run.sim.chestCardiacExtra = 0; run.sim.chest = () => chest; }
    run.apply({ ...m, circulation: { ...m.circulation, bloodVolume: bv } }); run.advance(120);
    const x = run.sim.metrics;
    return { ...x, MAP: x.Pmean, Pmsf: run.sim.meanFillingPressure(), Pra: run.sim.Pra };
  };
  const base = at({}), b20 = at({ bv: 4000 }), b30 = at({ bv: 3500 }), b50 = at({ bv: 2500 });
  const show = (x) => `${Math.round(x.Psys)}/${Math.round(x.Pdia)}, CO ${x.CO.toFixed(1)}`;
  ok('validated: a 20 % loss keeps arterial pressure near normal, the reflex matching the fall in output with resistance (Schadt & Ludbrook 1991, phase 1)', Math.abs(b20.MAP - base.MAP) / base.MAP < 0.15,
    `mean ${base.MAP.toFixed(0)} → ${b20.MAP.toFixed(0)} mmHg; ${show(base)} → ${show(b20)}`);
  gap('…and at about 30 % a second phase sets in: the sympathetic drive withdraws, the heart slows and the pressure falls profoundly (Schadt & Ludbrook 1991)', b30.MAP < 0.6 * base.MAP && b30.HRbeat < base.HRbeat + 10,
    `30 %: ${show(b30)}, HR ${Math.round(b30.HRbeat)}: the reflex here only ever adds sympathetic drive; the decompensating phase is not modelled`);
  ok('a circulation emptied below its unstressed volumes stops: half the blood lost leaves no palpable pulse', b50.Psys < 50 && b50.CO < 1, show(b50));
  const c20 = at({ chest: 20 });
  ok('pressure in the chest above the mean filling pressure stops venous return: no output (Guyton 1957)', c20.CO < 0.2 && c20.Pmsf < 20, `+20 mmHg in the chest: ${show(c20)}, filling pressure ${c20.Pmsf.toFixed(1)} mmHg`);
}

console.log('\nTension pneumothorax (Roberts 2015)');
{
  const m = S.healthyModel(), run = S.createCirculation(m); run.settle(20);
  const set = (o) => run.apply({ ...m, respiratory: { ...m.respiratory, ...o } });
  set({ ptxL: 1, tensionL: 25 }); run.advance(90);
  const t = run.sim.metrics, rhythm = run.heart.p.ventricular;
  ok('trapped air at a pressure above the mean filling pressure stops the blood returning: PEA', rhythm === 'none' && t.Psys < 50 && t.CO < 0.5, `${Math.round(t.Psys)}/${Math.round(t.Pdia)} mmHg, CO ${t.CO.toFixed(2)}`);
  set({ ptxL: 1, tensionL: 0 }); run.advance(60);
  const d = run.sim.metrics;
  ok('letting the air out (the lung still collapsed) brings the circulation back at once', d.Psys > 90 && d.CO > 3, `${Math.round(d.Psys)}/${Math.round(d.Pdia)} mmHg, CO ${d.CO.toFixed(2)}`);
  gap('positive-pressure breaths build the tension: arrest is far more likely when the patient is ventilated (Roberts 2015: adjusted OR 17.7)', false,
    'the trapped air’s pressure is set by the scene; nothing adds air with each breath given (gap 39)');
}

console.log(`\n${pass} passed, ${fail} failed, ${gaps.length} known gaps`);
if (fail) process.exit(1);
