/* Bedside findings: assert clinical facts about what the examination returns
   for a given physiological state, and that the patients are internally
   consistent. Pure modules, so this runs without a DOM or the simulator. */
import * as F from '../src/bedside/findings.js';
import { synthBeat, synthBreath } from '../src/bedside/sound.js';
import { PERSONAS, QUESTIONS } from '../src/bedside/personas.js';
import { BODY_REGIONS } from '../src/domains/neuro/data/exam.js';
import { findingsForNodes, sparedForNodes, cordLevelOf } from '../src/domains/neuro/model/localize.js';

let pass = 0; let fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name); } };

/* A snapshot shaped like the circulation's, with overrides. Values for the
   abnormal states are the model's own settled outputs for each patient. */
const snap = (m = {}, top = {}) => ({
  HR: 72, sympathetic: 0.5, pathology: 'normal', Raortic: 0.02, Rmitral: 0.01, regAortic: 0, regMitral: 0, regTricuspid: 0,
  ...top,
  metrics: { Psys: 113, Pdia: 73, Pmean: 95, SV: 69, CO: 5, EF: 57, EDV: 124, ESV: 55, CVPmean: 3.9, PlaMean: 6.1,
    PpaSys: 22, SVR: 1500, aorticGradient: 2, regurgFraction: 0.03, ...m },
});
const ctx = (m, top, extra = {}) => F.makeContext({ snap: snap(m, top), chem: { lactate: 1, haemoglobin: 150 }, ...extra });

console.log('\nNormal volunteer');
{
  const c = ctx();
  ok('no murmurs anywhere', ['aortic', 'pulmonary', 'tricuspid', 'mitral'].every((a) => /No murmurs/.test(F.heart(c, a).text)));
  ok('JVP not raised', /not raised/.test(F.jvp(c).text));
  ok('apex in the normal place', /fifth intercostal space, mid-clavicular/.test(F.apex(c).text) && !F.apex(c).abnormal);
  ok('clear lungs', /Vesicular/.test(F.lungs(c).text));
  ok('warm peripheries, brisk refill', !F.peripheries(c).abnormal);
}

console.log('\nAortic stenosis (gradient 90 mmHg)');
{
  const c = ctx({ aorticGradient: 90, Psys: 112, Pdia: 78, EF: 47, EDV: 135 }, { Raortic: 0.35 });
  const h = F.heart(c, 'aortic');
  ok('ejection systolic murmur loudest at the aortic area', /ejection systolic/.test(h.text) && h.sound.murmurs[0].w === 1);
  ok('murmur grade stays within 1–4/6 without a thrill-only grade inflation', /Grade [1-4]\/6/.test(h.text));
  ok('soft single S2', /soft, single S2/.test(h.text));
  ok('slow-rising carotid pulse', /slow-rising/.test(F.pulse(c, 'carotid').text));
  ok('heaving sustained apex', /heaving and sustained/.test(F.apex(c).text));
  ok('murmur radiates to the carotid', F.carotidAuscultation(c).abnormal);
}

console.log('\nHeart failure with functional MR');
{
  const c = ctx({ EF: 38, EDV: 190, CVPmean: 6, PlaMean: 23, regurgFraction: 0.08 }, { regMitral: 0.3, HR: 84 }, { persona: { chronicCongestion: true } });
  ok('pansystolic murmur at the apex', /pansystolic/.test(F.heart(c, 'mitral').text));
  ok('third heart sound', /third heart sound/.test(F.heart(c, 'mitral').text));
  ok('basal crackles from raised left atrial pressure', /crackles/.test(F.lungs(c).text));
  ok('displaced, diffuse apex', /displaced/.test(F.apex(c).text) && /diffuse/.test(F.apex(c).text));
  ok('oedema', F.oedema(c).abnormal);
  ok('respiratory rate is labelled as a heuristic', F.observations(c)[2].kind === 'heuristic');
}

console.log('\nHaemorrhage');
{
  const c = F.makeContext({ snap: snap({ Psys: 70, Pdia: 56, Pmean: 64, SV: 23, CO: 2.3, CVPmean: 1.4, PlaMean: 1.7, EDV: 56 }, { HR: 101, sympathetic: 0.94 }), chem: { lactate: 4.5, haemoglobin: 128 } });
  ok('tachycardic', F.observations(c)[0].abnormal);
  ok('flat neck veins', /flat/.test(F.jvp(c).text));
  ok('thready pulse', /thready|barely palpable/.test(F.pulse(c).text));
  ok('cool, clammy peripheries with slow refill', /cool and clammy/.test(F.peripheries(c).text) && F.capillaryRefill(c) >= 3);
  ok('pale and sweaty', F.appearance(c).some((x) => /sweaty/.test(x.text)));
}

console.log('\nC5 cord injury: neurogenic shock and spinal shock');
{
  const nodes = PERSONAS.find((p) => p.id === 'c5').setup.neuro.nodes;
  ok('lesion localises to C5', cordLevelOf(nodes) === 'C5');
  const c = F.makeContext({ snap: snap({ Psys: 78, Pdia: 42, Pmean: 54 }, { HR: 62 }), chem: {}, cordLevel: 'C5', persona: { immobile: true } });
  ok('warm peripheries despite hypotension', /warm and dry/.test(F.peripheries(c).text));
  ok('paradoxical breathing, and not "sitting upright"', F.appearance(c).some((x) => x.key === 'look.paradox') && !F.appearance(c).some((x) => /sitting upright/.test(x.text)));
  ok('palpable bladder', F.abdomen(c).some((x) => x.key === 'feel.bladder'));
  const neuro = { findings: findingsForNodes(nodes, true), spared: sparedForNodes(nodes, true) };
  const leg = BODY_REGIONS.find((r) => r.id === 'R_leg');
  const quads = leg.tests.find((t) => t.id === 'pm_R_quads');
  const r = F.neuroTest(quads, neuro, { spinalShock: true });
  ok('knee extension is plegic below a C5 lesion (upper motor neuron)', r.abnormal && /0\/5/.test(r.text));
  ok('acute cord injury is flaccid and areflexic (spinal shock)', /flaccid/.test(r.text) && /absent/.test(r.text) && !/clonus/.test(r.text));
  const normal = F.neuroTest(quads, { findings: [], spared: [] });
  ok('the same test is normal with no lesion', !normal.abnormal && /5\/5/.test(normal.text));
}

console.log('\nSound synthesis');
{
  const samples = []; const n = 320;
  for (let i = 0; i < n; i++) {
    const phase = i / n;
    samples.push({ Qao: phase > 0.05 && phase < 0.4 ? 600 * Math.sin(Math.PI * (phase - 0.05) / 0.35) : 0, Qmit: 0, Pv: phase < 0.45 ? 110 : 5, Pla: 8 });
  }
  const beat = { samples, events: { mvc: 3, avo: 16, avc: 130, mvo: 150 }, dur: 800 };
  const quiet = synthBeat(beat, { area: 'aortic', murmurs: [], extras: {} }, 8000);
  const noisy = synthBeat(beat, { area: 'aortic', murmurs: [{ id: 'as', w: 1, grade: 4 }], extras: {}, gradient: 90 }, 8000);
  const energy = (a, lo, hi) => { let s = 0; for (let i = Math.floor(lo * a.length); i < hi * a.length; i++) s += a[i] * a[i]; return s; };
  ok('one beat lasts the model cycle length', quiet.length === 6400);
  ok('an AS murmur adds energy during ejection, between S1 and S2', energy(noisy, 0.12, 0.32) > 5 * energy(quiet, 0.12, 0.32));
  ok('no clipping', noisy.every((x) => Math.abs(x) <= 1));
  const crackly = synthBreath({ rr: 20, crackles: 1 }, 8000); const clear = synthBreath({ rr: 20, crackles: 0 }, 8000);
  ok('breath length follows respiratory rate', clear.length === 24000);
  ok('crackles are audible', Math.max(...crackly) > Math.max(...clear) * 0.9);
}

console.log('\nPatients');
{
  const qids = new Set(QUESTIONS.flatMap((g) => g.items.map((i) => i.id)));
  ok('every history answer belongs to a question the learner can ask',
    PERSONAS.every((p) => Object.keys(p.history).every((k) => qids.has(k))));
  ok('every patient with a diagnosis has four options and a teaching point',
    PERSONAS.filter((p) => p.diagnosis).every((p) => p.diagnosis.options.length === 4 && p.diagnosis.teaching.length > 100));
  const historyKeys = new Set(PERSONAS.flatMap((p) => Object.values(p.history).map((h) => h.key).filter(Boolean)));
  const reachable = PERSONAS.every((p) => p.keyFindings.every((kf) => kf.keys.some((k) => !k.startsWith('hx.') || historyKeys.has(k))));
  ok('every history key finding can actually be elicited', reachable);
  ok('persona ids are unique', new Set(PERSONAS.map((p) => p.id)).size === PERSONAS.length);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
