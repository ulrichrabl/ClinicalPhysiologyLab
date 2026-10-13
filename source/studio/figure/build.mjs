/* Builds the figure bench (studio/figure/out/bench.html) from the real renderer and the app's own styles.
   The patients are the case library's (read from src/vp/cases/*.json) plus a few bench-only ones that widen the range
   (darker skin tones, other hair), so every look the app can produce is on the sheet. */
import * as esbuild from '../../node_modules/esbuild/lib/main.js';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '../../src/vp');
mkdirSync(join(here, 'out'), { recursive: true });

const cases = readdirSync(join(src, 'cases')).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(src, 'cases', f), 'utf8')))
  .map((c) => ({ id: c.id, label: c.patient.name, patient: c.patient }));
const extras = [
  { id: 'bench-m-28-tone6', label: 'Bench: young man, tone 6', synthetic: true, patient: { age: 28, sex: 'M', appearance: { skinTone: 6, hair: 'black, short curly', build: 'average' } } },
  { id: 'bench-f-55-tone5', label: 'Bench: woman, tone 5', synthetic: true, patient: { age: 55, sex: 'F', appearance: { skinTone: 5, hair: 'black, braids tied back', build: 'heavy' } } },
  { id: 'bench-m-45-free', label: 'Free patient', synthetic: true, patient: { age: 45, sex: 'M', appearance: { skinTone: 3, hair: 'brown, short', build: 'average', eyes: 'blue' } } },
];
const patients = [...cases, ...extras];
/* The default sheet: a spread of sex, age, build, skin and hair. */
const sheet = ['diabetic-ketoacidosis', 'graves-thyrotoxicosis', 'foot-drop-right-l5', 'hyponatraemia-thiazide', 'bench-f-55-tone5',
  'acute-stroke-left-mca', 'upper-gi-bleed-peptic-ulcer', 'addisonian-crisis', 'bench-m-28-tone6'];

const js = (await esbuild.build({
  entryPoints: [join(here, 'bench.ts')], bundle: true, write: false, format: 'iife', target: 'es2020', logLevel: 'error',
  define: { __PATIENTS__: JSON.stringify(patients), __SHEET_PATIENTS__: JSON.stringify(sheet) },
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
