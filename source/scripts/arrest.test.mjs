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
const mech60 = S.cprTrial({ itp: S.CPR.itpMechanical, rate: 60 });
const mech140 = S.cprTrial({ itp: S.CPR.itpMechanical, rate: 140 });
const manual = S.cprTrial({ itp: S.CPR.itpManual, rate: 110 });
{
  ok('fitted: a mechanical compressor at 60/min gives Ornato’s systolic pressure (59 ± 5 mmHg; the one constant fitted here, cpr.cardiacExtra)', Math.abs(mech60.Psys - 59) <= 5, reading(mech60));
  ok('compressions make flow and a positive coronary perfusion pressure out of a circulation at a standstill', mech60.CO > 0.5 && mech60.CPP > 5, reading(mech60));
  gap('validated: …and its diastolic pressure is Ornato’s, about 23 mmHg (within 5)', Math.abs(mech60.Pdia - 23) <= 5,
    `${f1(mech60.Pdia)} mmHg. The model’s vessels keep a fresh arrest’s maximal reflex tone (sympathetic drive 1.0), so the arteries drain slowly between compressions; Ornato’s patients were prehospital arrests of long duration, whose vessels have lost tone. How vascular tone fails in arrest is not modelled.`);
  gap('validated: systolic pressure falls with rate on the same machine (Ornato: 59 at 60/min, 46 at 140/min)', mech60.Psys - mech140.Psys >= 8,
    `model ${f1(mech60.Psys)} at 60/min, ${f1(mech140.Psys)} at 140/min. Not a clean comparison: Ornato’s Thumper held its force, and on a manikin the same force gave less sternal displacement and pressure at higher rates (shorter compressions). The model holds the intrathoracic pressure constant; with the applied pressure’s fall unknown, the rate effect cannot be separated from the device’s.`);
  ok('validated: Ornato’s diastolic pressure stays flat across rates (model within 5 mmHg from 60 to 140/min)', Math.abs(mech140.Pdia - mech60.Pdia) <= 5, `${f1(mech60.Pdia)} and ${f1(mech140.Pdia)} mmHg`);
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

console.log(`\n${pass} passed, ${fail} failed, ${gaps.length} known gaps`);
if (fail) process.exit(1);
