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

console.log(`\n${pass} passed, ${fail} failed, ${gaps.length} known gaps`);
if (fail) process.exit(1);
