/* The patient figure's contract with the app, checked without a browser (part of `npm test`).
   The app relies on exactly these things; everything else about the figure is free to change.

   1. Exports: figureSvg(pose, look) → SVG markup for <g id="fig"> inside viewBox 0 0 360 380;
      figureLookFor(patient, state, seed) → FigureLook; POSES (at least the positions the app uses); lerpPose(a, b, t).
   2. Touch regions: data-region="head|neck|chest|abdomen" and data-region="arm|legs" with data-side="R|L".
   3. The look follows the state: exposing a structure changes the drawing; oxygen on the patient changes it.
   4. Valid, finite, deterministic markup, fast enough to redraw every animation frame.
   (Tap reachability and the frame are checked in the browser by shoot.py.) */
import * as esbuild from '../../node_modules/esbuild/lib/main.js';
import { JSDOM } from '../../node_modules/jsdom/lib/api.js';
import { readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(tmpdir(), `figure-contract-${Date.now()}.mjs`);
await esbuild.build({ entryPoints: [join(here, '../../src/vp/render/patient-figure.ts')], bundle: true, outfile: out, format: 'esm', platform: 'node', logLevel: 'error' });
const fig = await import(pathToFileURL(out).href);
unlinkSync(out);

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); } };
console.log('\nPatient figure contract');

const APP_POSES = ['supine', 'reclined-45', 'sitting', 'sitting-forward', 'left-lateral', 'standing', 'prone', 'head-hanging-left', 'head-hanging-right'];
ok('exports figureSvg, figureLookFor, lerpPose and POSES', ['figureSvg', 'figureLookFor', 'lerpPose'].every((k) => typeof fig[k] === 'function') && typeof fig.POSES === 'object');
ok('every position the app can set has a pose', APP_POSES.every((k) => fig.POSES[k]), APP_POSES.filter((k) => !fig.POSES[k]).join(', '));

const src = join(here, '../../src/vp/cases');
const patients = readdirSync(src).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(src, f), 'utf8')).patient);
patients.push({ age: 28, sex: 'M', appearance: { skinTone: 6, hair: 'black, short curly', build: 'average' } }, { age: 55, sex: 'F', appearance: { skinTone: 5, hair: 'black, braids', build: 'heavy' } });
const states = [{ exposure: [] }, { exposure: ['chest', 'neck', 'arm'] }, { exposure: ['abdomen'] }, { exposure: [], oxygen: { device: 'nasal cannula 2 L/min', fio2: 0.28 } }];

const parse = (markup) => new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 380"><g id="fig">${markup}</g></svg>`, { contentType: 'image/svg+xml' }).window.document;
const REGIONS = [['head'], ['neck'], ['chest'], ['abdomen'], ['arm', 'R'], ['arm', 'L'], ['legs', 'R'], ['legs', 'L']];
const problems = [];
for (const [pi, p] of patients.entries()) for (const st of states) for (const k of APP_POSES) {
  const svg = fig.figureSvg(fig.POSES[k], fig.figureLookFor(p, st, pi + 1));
  if (/NaN|undefined|Infinity/.test(svg)) { problems.push(`${k} p${pi}: NaN/undefined in markup`); continue; }
  const doc = parse(svg);
  if (doc.getElementsByTagName('parsererror').length) { problems.push(`${k} p${pi}: not well-formed`); continue; }
  for (const [r, side] of REGIONS) if (!doc.querySelector(`[data-region="${r}"]${side ? `[data-side="${side}"]` : ''}`)) problems.push(`${k} p${pi}: no ${r}${side ? ' ' + side : ''}`);
}
ok('every patient × pose × state renders well-formed, finite markup with every touch region', problems.length === 0, problems.slice(0, 5).join('; '));

const p0 = patients[0];
const look = (st) => fig.figureLookFor(p0, st, 1);
const draw = (st, k = 'reclined-45') => fig.figureSvg(fig.POSES[k], look(st));
ok('exposing the chest or abdomen changes the drawing', draw({ exposure: ['chest'] }) !== draw({ exposure: [] }) && draw({ exposure: ['abdomen'] }) !== draw({ exposure: [] }));
ok('figureLookFor carries age, sex, build, hair and oxygen from the case', (() => {
  const l = fig.figureLookFor({ age: 70, sex: 'F', appearance: { skinTone: 2, hair: 'grey, bob', build: 'heavy' } }, { oxygen: { device: 'mask', fio2: 0.4 } }, 1);
  return l.age === 70 && l.sex === 'F' && l.build === 'heavy' && /bob/.test(l.hairText) && l.oxygen === 'mask';
})());
ok('the same patient and pose always draw the same markup', draw({ exposure: [] }) === draw({ exposure: [] }));
ok('lerpPose interpolates between every pair of poses without NaN', APP_POSES.every((a) => APP_POSES.every((b) => {
  const m = fig.lerpPose(fig.POSES[a], fig.POSES[b], 0.37); return Object.values(m).flat().every((v) => typeof v !== 'number' || Number.isFinite(v));
})));
const t0 = performance.now(); let n = 0;
for (let i = 0; i < 300; i++) { fig.figureSvg(fig.lerpPose(fig.POSES.supine, fig.POSES.standing, i / 300), look({ exposure: [] })); n++; }
const ms = (performance.now() - t0) / n;
ok('fast enough to redraw every frame of a transition (under 2 ms per figure)', ms < 2, `${ms.toFixed(2)} ms`);

ok('figureLookFor carries the body: BMI from height and weight, fat and muscle, the model\'s findings', (() => {
  const l = fig.figureLookFor({ age: 66, sex: 'M', heightCm: 175, weightKg: 48, appearance: { skinTone: 1, hair: 'grey', build: 'slim' } }, {}, 1, { oedema: 'knee', ascites: 'tense', colour: 'jaundiced' });
  return Math.abs(l.body.bmi - 15.7) < 0.1 && l.body.muscle === 'wasted' && l.body.fat === 'central' && l.body.oedema === 'knee' && l.body.ascites === 'tense' && l.body.colour === 'jaundiced';
})());

/* Acceptance for the redesign (run.sh runs it; not part of npm test until the new figure lands): the drawing must
   respond to everything the look carries. Each pair differs in one thing only. */
if (process.env.FIGURE_ACCEPTANCE) {
  console.log('\nAcceptance: the drawing responds to the patient');
  const base = { age: 45, sex: 'M', heightCm: 176, weightKg: 76, appearance: { skinTone: 2, hair: 'brown, short', build: 'average' } };
  const d = (patient, findings = {}, state = { exposure: ['chest', 'neck', 'arm', 'abdomen'] }, k = 'reclined-45') => fig.figureSvg(fig.POSES[k], fig.figureLookFor(patient, state, 1, findings));
  const same = (a, b) => a === b;
  const pairs = [
    ['sex', d(base), d({ ...base, sex: 'F' })],
    ['age', d(base), d({ ...base, age: 85 })],
    ['BMI (weight)', d(base), d({ ...base, weightKg: 118 })],
    ['fat distribution', d({ ...base, weightKg: 105 }), d({ ...base, weightKg: 105, appearance: { ...base.appearance, fat: 'peripheral' } })],
    ['muscle wasting', d(base), d({ ...base, appearance: { ...base.appearance, muscle: 'wasted' } })],
    ['long hair', d(base), d({ ...base, appearance: { ...base.appearance, hair: 'brown, long' } })],
    ['baldness only when described', d(base), d({ ...base, appearance: { ...base.appearance, hair: 'brown, receding' } })],
    ['oedema', d(base), d(base, { oedema: 'knee' })],
    ['ascites', d(base), d(base, { ascites: 'tense' })],
    ['jaundice', d(base), d(base, { colour: 'jaundiced', icterus: 'marked' })],
    ['pallor', d(base), d(base, { colour: 'pale' })],
    ['cyanosis', d(base), d(base, { colour: 'cyanosed' })],
    ['sweating', d(base), d(base, { sweating: true })],
    ['hyperinflated chest', d(base), d(base, { breathing: { hyperinflated: true, accessory: true, pursedLips: false } })],
    ['oxygen', d(base, {}, { exposure: [] }), d(base, {}, { exposure: [], oxygen: { device: 'nasal cannula 2 L/min', fio2: 0.28 } })],
  ];
  for (const [what, a, b] of pairs) ok(`the figure shows ${what}`, !same(a, b));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
