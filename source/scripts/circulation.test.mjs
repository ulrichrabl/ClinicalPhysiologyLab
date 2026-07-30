/* Regression tests for the closed-loop circulation.

   These assert facts about the circulation rather than about the code: that
   volume is conserved, that the venous return curve behaves, that each valve
   lesion produces its own signature, and that the right heart fails the way a
   right heart does. A refactor that quietly breaks the physiology fails here. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';

const built = await esbuild.build({
  entryPoints: ['src/domains/cardio/sim/worker.js'],
  bundle: true, write: false, format: 'esm', target: 'es2022', platform: 'browser',
});
const code = built.outputFiles[0].text;

function sim(params = {}, seconds = 30) {
  let snap = null;
  const fn = new Function('postMessage', 'setInterval', 'clearInterval',
    code + ';return onmessage;');
  const on = fn((m) => { if (m.type === 'snapshot') snap = m.data; }, () => 1, () => {});
  on({ data: { type: 'pause' } });
  for (const [k, v] of Object.entries(params)) on({ data: { type: 'setParam', key: k, value: v } });
  on({ data: { type: 'settle', seconds } });
  return snap;
}

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

console.log('\nBaseline');
const b = sim();
ok('systolic 105–125', b.Psys > 105 && b.Psys < 125, b.Psys.toFixed(0));
ok('diastolic 65–85', b.Pdia > 65 && b.Pdia < 85, b.Pdia.toFixed(0));
ok('cardiac output 4.5–6.0', b.CO > 4.5 && b.CO < 6.0, b.CO.toFixed(1));
ok('ejection fraction 50–62%', b.EF > 50 && b.EF < 62, b.EF.toFixed(0));
ok('CVP 1–8', b.CVP > 1 && b.CVP < 8, b.CVP.toFixed(1));
ok('PA mean 10–22', b.PpaMean > 10 && b.PpaMean < 22, b.PpaMean.toFixed(1));
ok('PA systolic 15–30', b.PpaSys > 15 && b.PpaSys < 30, b.PpaSys.toFixed(1));
ok('LA pressure 3–10', b.Pla > 3 && b.Pla < 10, b.Pla.toFixed(1));
ok('mean filling pressure 5–10', b.Pmsf > 5 && b.Pmsf < 10, b.Pmsf.toFixed(1));
ok('regurgitant fraction ~0 with competent valves', b.metrics.regurgFraction < 0.05);

console.log('\nConservation of blood');
ok('total volume is preserved', near(b.totalVolume, 5000, 1), b.totalVolume.toFixed(1));
const bv = sim({ bloodVolume: 4200 });
ok('rescaling preserves the new total', near(bv.totalVolume, 4200, 1), bv.totalVolume.toFixed(1));

console.log('\nVenous return (the closed loop)');
const bleeds = [5000, 4500, 4000, 3600].map((v) => sim({ bloodVolume: v }));
ok('filling pressure falls monotonically with volume',
  bleeds.every((x, i) => i === 0 || x.Pmsf < bleeds[i - 1].Pmsf));
ok('cardiac output falls monotonically with volume',
  bleeds.every((x, i) => i === 0 || x.CO < bleeds[i - 1].CO));
ok('the circulation does not stop at a 28% bleed', bleeds[3].Pmean > 40, bleeds[3].Pmean.toFixed(0));
ok('heart rate rises as volume falls', bleeds[3].HR > bleeds[0].HR + 15,
  `${bleeds[0].HR.toFixed(0)} → ${bleeds[3].HR.toFixed(0)}`);

const withReflex = sim({ bloodVolume: 4000 });
const without = sim({ bloodVolume: 4000, baroEnabled: false });
ok('the baroreflex is worth having in haemorrhage', withReflex.Pmean > without.Pmean + 20,
  `${without.Pmean.toFixed(0)} → ${withReflex.Pmean.toFixed(0)} mmHg`);

const veno = sim({ V0sv: 2100 });
ok('venoconstriction raises filling pressure without adding blood',
  veno.Pmsf > b.Pmsf + 1 && near(veno.totalVolume, 5000, 1));

console.log('\nLeft heart');
const hf = sim({ Emax: 1.0 });
ok('low contractility drops EF below 40%', hf.EF < 40, hf.EF.toFixed(0));
ok('...and raises left atrial pressure', hf.Pla > b.Pla + 3, hf.Pla.toFixed(1));
const hfpef = sim({ edpB: 0.05 });
ok('a stiff ventricle keeps EF but raises LA pressure',
  hfpef.EF > 45 && hfpef.Pla > b.Pla + 5, `EF ${hfpef.EF.toFixed(0)} LAP ${hfpef.Pla.toFixed(1)}`);
const stiff = sim({ Csa: 0.6 });
ok('a stiff aorta widens pulse pressure', (stiff.Psys - stiff.Pdia) > (b.Psys - b.Pdia) + 20,
  `${(b.Psys - b.Pdia).toFixed(0)} → ${(stiff.Psys - stiff.Pdia).toFixed(0)} mmHg`);

console.log('\nRight heart');
const pe = sim({ Rpul: 0.45 });
ok('PE raises pulmonary artery pressure', pe.PpaMean > b.PpaMean + 12, pe.PpaMean.toFixed(0));
ok('PE lowers left atrial pressure (less gets through the lung)', pe.Pla < b.Pla, pe.Pla.toFixed(1));
ok('PE lowers cardiac output', pe.CO < b.CO - 0.6, pe.CO.toFixed(1));
const rvmi = sim({ EmaxRv: 0.18 });
ok('RV infarct raises CVP', rvmi.CVP > b.CVP + 2, rvmi.CVP.toFixed(1));
ok('...while lowering PA pressure', rvmi.PpaMean < b.PpaMean - 3,
  `${b.PpaMean.toFixed(1)} → ${rvmi.PpaMean.toFixed(1)}`);
ok('...and lowering left-sided filling', rvmi.Pla < b.Pla, rvmi.Pla.toFixed(1));
ok('RV infarct and PE differ in PA pressure — the discriminator',
  rvmi.PpaMean < b.PpaMean && pe.PpaMean > b.PpaMean,
  `RVMI ${rvmi.PpaMean.toFixed(0)} vs PE ${pe.PpaMean.toFixed(0)} vs normal ${b.PpaMean.toFixed(0)}`);

console.log('\nValve lesions');
const as = sim({ Raortic: 1.2 });
ok('aortic stenosis: gradient between ventricle and aorta', as.aorticGradient > 20,
  `${as.aorticGradient.toFixed(0)} mmHg (LV peak ${as.metrics.PvPeak.toFixed(0)}, aortic ${as.Psys.toFixed(0)})`);
ok('a competent valve has essentially no gradient', b.aorticGradient < 8, b.aorticGradient.toFixed(1));
ok('aortic stenosis: EF falls, LA pressure rises', as.EF < b.EF - 8 && as.Pla > b.Pla + 3);

const ar = sim({ regAortic: 0.8 });
ok('aortic regurgitation: wide pulse pressure', (ar.Psys - ar.Pdia) > (b.Psys - b.Pdia) + 20,
  `${(ar.Psys - ar.Pdia).toFixed(0)} mmHg`);
ok('aortic regurgitation: low diastolic pressure', ar.Pdia < b.Pdia - 12, ar.Pdia.toFixed(0));
ok('aortic regurgitation: significant regurgitant fraction', ar.metrics.regurgFraction > 0.25,
  `${(ar.metrics.regurgFraction * 100).toFixed(0)}%`);

const ms = sim({ Rmitral: 0.2 });
ok('mitral stenosis: high LA pressure with a small ventricle',
  ms.Pla > b.Pla + 12 && ms.EDV < b.EDV, `LAP ${ms.Pla.toFixed(0)} EDV ${ms.EDV.toFixed(0)}`);
ok('mitral stenosis: the ventricle itself is not the problem',
  Math.abs(ms.metrics.Ees - b.metrics.Ees) < 0.01);

const mr = sim({ regMitral: 0.8 });
ok('mitral regurgitation: EF rises while forward output falls',
  mr.EF > b.EF + 5 && mr.CO < b.CO, `EF ${mr.EF.toFixed(0)}% CO ${mr.CO.toFixed(1)}`);
ok('mitral regurgitation: total stroke volume exceeds forward stroke volume',
  mr.metrics.SVtotal > mr.metrics.SV + 15,
  `${mr.metrics.SVtotal.toFixed(0)} vs ${mr.metrics.SV.toFixed(0)} mL`);

const tr = sim({ regTricuspid: 0.9 });
/* The signature of tricuspid regurgitation is a large systolic wave in the
   venous pulse, so the peak is the number that moves, not the mean. */
ok('tricuspid regurgitation gives a giant v wave',
  tr.metrics.CVPmax > b.metrics.CVPmax + 2.5,
  `peak CVP ${b.metrics.CVPmax.toFixed(1)} → ${tr.metrics.CVPmax.toFixed(1)} mmHg`);
ok('...and raises mean venous pressure', tr.CVP > b.CVP + 0.4,
  `${b.CVP.toFixed(1)} → ${tr.CVP.toFixed(1)}`);

console.log('\nGrading is monotonic');
const arGrades = [0, 0.3, 0.6, 0.9].map((g) => sim({ regAortic: g }));
ok('regurgitant fraction increases with severity',
  arGrades.every((x, i) => i === 0 || x.metrics.regurgFraction > arGrades[i - 1].metrics.regurgFraction));
const asGrades = [0.09, 0.4, 0.9, 1.6].map((r) => sim({ Raortic: r }));
ok('stenosis progressively lowers ejection fraction',
  asGrades.every((x, i) => i === 0 || x.EF < asGrades[i - 1].EF));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
