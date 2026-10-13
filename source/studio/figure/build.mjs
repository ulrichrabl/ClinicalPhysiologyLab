/* Builds the figure bench (studio/figure/out/bench.html) from the real renderer and the app's own styles. */
import * as esbuild from '../../node_modules/esbuild/lib/main.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '../../src/vp');
mkdirSync(join(here, 'out'), { recursive: true });

/* Case patients with the body findings the model gives them (patients.json, written by snapshot.mjs), plus bench-only
   patients that widen the range: darker skin tones, other hair, and bodies the cases do not have yet. */
const cases = JSON.parse(readFileSync(join(here, 'patients.json'), 'utf8'));
const P = (id, label, age, sex, heightCm, weightKg, appearance, findings = {}) => ({ id, label, synthetic: true, patient: { age, sex, heightCm, weightKg, appearance }, findings });
const extras = [
  P('bench-m-28-tone6', 'Bench: young man, tone 6', 28, 'M', 184, 80, { skinTone: 6, hair: 'black, short curly', build: 'average' }),
  P('bench-f-55-tone5', 'Bench: woman, tone 5', 55, 'F', 166, 88, { skinTone: 5, hair: 'black, braids tied back', build: 'heavy' }),
  P('bench-m-45-free', 'Free patient', 45, 'M', 176, 76, { skinTone: 3, hair: 'brown, short', build: 'average', eyes: 'blue' }),
  /* bodies */
  P('body-obese-central', 'Bench: central obesity, BMI 38', 52, 'M', 176, 118, { skinTone: 2, hair: 'brown, short, receding', build: 'heavy', fat: 'central' }),
  P('body-obese-peripheral', 'Bench: peripheral obesity, BMI 36', 38, 'F', 165, 98, { skinTone: 3, hair: 'dark, long', build: 'heavy', fat: 'peripheral' }),
  P('body-cachexia', 'Bench: cancer cachexia, BMI 15.7', 66, 'M', 175, 48, { skinTone: 1, hair: 'grey, thin', build: 'slim', muscle: 'wasted' }, { colour: 'pale', pallor: 'mild' }),
  P('body-heart-failure', 'Bench: heart failure, oedema to the knees', 77, 'M', 172, 86, { skinTone: 2, hair: 'white, short', build: 'heavy' }, { oedema: 'knee', colour: 'grey', sweating: true, distress: 'moderate' }),
  P('body-jaundice', 'Bench: deep jaundice', 50, 'F', 163, 61, { skinTone: 2, hair: 'brown, bob', build: 'average' }, { colour: 'jaundiced', icterus: 'marked' }),
  P('body-cyanosis', 'Bench: cyanosed, severe distress', 60, 'M', 170, 66, { skinTone: 1, hair: 'grey, short', build: 'average' }, { colour: 'cyanosed', distress: 'severe', sweating: true, breathing: { hyperinflated: true, accessory: true, pursedLips: true } }),
];
const patients = [...cases, ...extras];
/* The default sheet: a spread of sex, age, build, skin, hair and illness. */
const sheet = ['diabetic-ketoacidosis', 'graves-thyrotoxicosis', 'foot-drop-right-l5', 'hyponatraemia-thiazide', 'bench-f-55-tone5',
  'acute-stroke-left-mca', 'decompensated-cirrhosis', 'copd-exacerbation', 'bench-m-28-tone6'];
const bodies = ['body-obese-central', 'body-obese-peripheral', 'body-cachexia', 'decompensated-cirrhosis', 'body-heart-failure', 'copd-exacerbation', 'body-jaundice', 'body-cyanosis'];

const js = (await esbuild.build({
  entryPoints: [join(here, 'bench.ts')], bundle: true, write: false, format: 'iife', target: 'es2020', logLevel: 'error',
  define: { __PATIENTS__: JSON.stringify(patients), __SHEET_PATIENTS__: JSON.stringify(sheet), __BODY_PATIENTS__: JSON.stringify(bodies) },
})).outputFiles[0].text;

/* The app's stylesheet, verbatim: same tokens, same dark mode, same figure rules. */
const appHtml = readFileSync(join(src, 'app/app.html'), 'utf8');
const style = appHtml.match(/<style>[\s\S]*?<\/style>/)[0];
const page = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Figure bench</title>${style}
<style>
body { margin: 0; padding: 16px; background: var(--bg); color: var(--fg); font-family: var(--font-body); }
.row { display: flex; gap: 8px; margin-bottom: 6px; }
.row.head div { font: 500 12px var(--font-mono); color: var(--muted); text-align: center; }
.label { font: 500 12px var(--font-mono); color: var(--muted); margin: 8px 0 4px; }
.cell { margin: 0; }
.cell svg#figure { max-height: none; }
.cell .figure-panel { padding: 6px; }
.cell figcaption { font: 11px var(--font-mono); color: var(--muted); text-align: center; }
</style>
<div id="bench"></div>
<script>${js.replace(/<\/script/gi, '<\\/script')}</script></html>`;
writeFileSync(join(here, 'out/bench.html'), page);
console.log(`bench: ${patients.length} patients (${extras.length} bench-only), sheet of ${sheet.length}`);
