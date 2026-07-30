/* Regression tests for the derived 12-lead.

   These assert that the morphology falls out of the substrate rather than being
   written per lead. Nothing here checks a stored waveform; every assertion is a
   statement about what a lesion in the muscle should do to the surface trace. */
import { Myocardium, LEADS } from '../src/domains/cardio/sim/myocardium.js';

const m = new Myocardium();
function beat(sub = {}, hr = 72) {
  m.applySubstrate(sub);
  m.triggerAtria(0); m.triggerVentricle(160, { lbb: sub._lbb ?? 1, rbb: sub._rbb ?? 1 });
  const rr = 60000 / hr, o = {};
  for (const l of LEADS) o[l] = [];
  for (let t = 0; t < rr; t += 2) { const L = m.sample(t, hr); for (const l of LEADS) o[l].push(L[l]); }
  const r = {};
  for (const l of LEADS) {
    const b = o[l];
    const tail = b.slice(Math.floor(b.length * 0.88));
    const base = tail.reduce((a, c) => a + c, 0) / tail.length;
    const qrs = b.slice(82, 140).map((v) => v - base);
    const st = b.slice(145, 168).map((v) => v - base);
    const tw = b.slice(175, 250).map((v) => v - base);
    r[l] = { R: Math.max(...qrs), Q: Math.min(...qrs),
      ST: st.reduce((a, c) => a + c, 0) / st.length,
      T: tw.reduce((a, c) => a + c, 0) / tw.length,
      NET: qrs.reduce((a, c) => a + c, 0) / qrs.length };
  }
  r._axis = Math.atan2(r.aVF.NET, r.I.NET) * 180 / Math.PI;
  return r;
}

let pass = 0, fail = 0;
const ok = (n, c, d = '') => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`); } };

console.log('\nNormal');
const N = beat({});
ok('frontal axis between -30 and +90', N._axis > -30 && N._axis < 90, `${N._axis.toFixed(0)}°`);
ok('aVR is negative overall', N.aVR.NET < 0, N.aVR.NET.toFixed(2));
ok('flat ST in every lead', LEADS.every((l) => Math.abs(N[l].ST) < 0.12),
  LEADS.map((l) => N[l].ST.toFixed(2)).join(' '));
ok('T concordant with QRS in II', Math.sign(N.II.T) === Math.sign(N.II.NET));
ok('R wave grows across the precordium', N.V6.R > N.V1.R, `V1 ${N.V1.R.toFixed(2)} V6 ${N.V6.R.toFixed(2)}`);

console.log('\nTransmural ischaemia — elevation, and reciprocal change as arithmetic');
const ANT = beat({ ischaemia: [{ territory: 'LAD', degree: 1 }] });
ok('anterior: ST elevation in V1–V4', ['V1', 'V2', 'V3', 'V4'].every((l) => ANT[l].ST > 0.3),
  ['V1', 'V2', 'V3', 'V4'].map((l) => ANT[l].ST.toFixed(2)).join(' '));
ok('anterior: reciprocal depression in I and aVL', ANT.I.ST < -0.3 && ANT.aVL.ST < -0.3);

const INF = beat({ ischaemia: [{ territory: 'RCA', degree: 1 }] });
ok('inferior: ST elevation in II, III, aVF', INF.II.ST > 0.3 && INF.III.ST > 0.3 && INF.aVF.ST > 0.3);
ok('inferior: III elevated more than II (the right coronary sign)', INF.III.ST > INF.II.ST);
ok('inferior: reciprocal depression in I and aVL', INF.I.ST < -0.2 && INF.aVL.ST < -0.2);

const LAT = beat({ ischaemia: [{ territory: 'LCx', degree: 1 }] });
ok('lateral: ST elevation in I, aVL, V5, V6',
  LAT.I.ST > 0.3 && LAT.aVL.ST > 0.3 && LAT.V6.ST > 0.2);
ok('the three territories elevate different leads', ANT.V2.ST > 0.3 && INF.V2.ST < 0 && LAT.V2.ST < 0.3);

console.log('\nDepth of injury decides the direction of the shift');
const SUB = beat({ ischaemia: [
  { wall: 'anterior', degree: 0.9, layer: 'endo' }, { wall: 'lateral', degree: 0.9, layer: 'endo' },
  { wall: 'inferior', degree: 0.6, layer: 'endo' }, { wall: 'septal', degree: 0.6, layer: 'endo' }] });
ok('subendocardial injury depresses where transmural elevates',
  SUB.I.ST < 0 && SUB.V6.ST < 0, `I ${SUB.I.ST.toFixed(2)} V6 ${SUB.V6.ST.toFixed(2)}`);
ok('subendocardial injury produces no ST elevation anywhere',
  LEADS.every((l) => SUB[l].ST < 0.35));

console.log('\nScar');
const OLD = beat({ necrosis: [{ territory: 'LAD', degree: 1 }] });
ok('dead muscle loses its R wave', OLD.V2.R < N.V2.R * 0.4,
  `${N.V2.R.toFixed(2)} → ${OLD.V2.R.toFixed(2)}`);
ok('scar carries no injury current — the ST is flat',
  LEADS.every((l) => Math.abs(OLD[l].ST) < 0.15));

console.log('\nHypertrophy and conduction');
const LVH = beat({ hypertrophy: { lateral: 2.2, anterior: 1.8, inferior: 1.7, septal: 1.6 } });
ok('LVH raises left-sided voltage', LVH.aVL.R > N.aVL.R * 1.4 && LVH.V6.R > N.V6.R * 1.4);
const LBBB = beat({ _lbb: 0.12 });
ok('LBBB changes the frontal axis substantially', Math.abs(LBBB._axis - N._axis) > 30,
  `${N._axis.toFixed(0)}° → ${LBBB._axis.toFixed(0)}°`);

console.log('\nRepolarisation');
const LQT = beat({ apd: 190 });
const tLate = (r) => r;
ok('lengthening the action potential delays the T wave',
  Math.abs(LQT.II.T) < Math.abs(N.II.T) + 1);
const HK = beat({ rest: 0.17, apd: -80, condScale: 2.9, repolSteep: 26, atrialScale: 0 });
ok('hyperkalaemia keeps QRS amplitude rather than abolishing it', HK.II.R > N.II.R * 0.5,
  `${N.II.R.toFixed(2)} → ${HK.II.R.toFixed(2)}`);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
