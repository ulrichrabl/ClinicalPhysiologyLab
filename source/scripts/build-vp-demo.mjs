/* Build the standalone virtual-patient pages:
     dist/eye-bench.html   the eye examination model, animated
     dist/encounter.html   the full encounter (both example cases)

   The encounter page embeds each case's settled circulation snapshot. It is
   computed here, by the same closed-loop model, from the case's pathology;
   the static cases have no physiological course yet, so a snapshot is
   exactly what the live model would give. M1 runs it live in the runtime. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const only = process.argv[2];
mkdirSync('dist', { recursive: true });

async function bundle(entry) {
  const out = await esbuild.build({
    entryPoints: [entry], bundle: true, write: false, format: 'iife', target: 'es2020',
    minify: true, loader: { '.ts': 'ts', '.js': 'js', '.json': 'json' }, logLevel: 'error',
  });
  return out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
}

async function circulationSnapshots() {
  const tmp = join(tmpdir(), `vp-circ-${Date.now()}.mjs`);
  await esbuild.build({
    stdin: { contents: "export { settleCirculation } from './src/vp/engine/circulation-host.ts'; export { CASES } from './src/vp/index.ts';", resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, outfile: tmp, format: 'esm', platform: 'node', loader: { '.json': 'json' }, logLevel: 'error',
  });
  const { settleCirculation, CASES } = await import(pathToFileURL(tmp).href);
  const out = {};
  for (const c of CASES) {
    if (!c.pathology.physiology) continue;
    const s = settleCirculation(c, 12);
    const samples = s.beat.samples.filter((_, i) => i % 2 === 0).map((p) => ({ t: Math.round(p.t), Pa: Math.round(p.Pa * 10) / 10 }));
    const scalars = Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string'));
    out[c.id] = { ...scalars, metrics: s.metrics, beat: { dur: s.beat.dur, samples } };
    console.log(`  ${c.id}: aortic gradient ${s.metrics.aorticGradient.toFixed(0)} mmHg, BP ${s.metrics.Psys.toFixed(0)}/${s.metrics.Pdia.toFixed(0)}`);
  }
  return out;
}

if (!only || only === 'eye-bench') {
  const html = readFileSync('src/vp/demo/eye-bench.html', 'utf8').replace('/*BUNDLE*/', await bundle('src/vp/demo/eye-bench.ts'));
  writeFileSync('dist/eye-bench.html', html);
  console.log(`dist/eye-bench.html ${(html.length / 1024).toFixed(0)} KB`);
}
if (!only || only === 'encounter') {
  const data = `var __CIRCULATION__ = ${JSON.stringify(await circulationSnapshots())};`;
  const js = await bundle('src/vp/demo/encounter.ts');
  const html = readFileSync('src/vp/demo/encounter.html', 'utf8').replace('/*DATA*/', () => data).replace('/*BUNDLE*/', () => js);
  writeFileSync('dist/encounter.html', html);
  console.log(`dist/encounter.html ${(html.length / 1024).toFixed(0)} KB`);
}
