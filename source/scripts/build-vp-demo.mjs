/* Build the standalone Eye Exam Bench page: dist/eye-bench.html. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const out = await esbuild.build({
  entryPoints: ['src/vp/demo/eye-bench.ts'], bundle: true, write: false, format: 'iife', target: 'es2020',
  minify: true, loader: { '.ts': 'ts', '.js': 'js', '.json': 'json' }, logLevel: 'error',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync('src/vp/demo/eye-bench.html', 'utf8').replace('/*BUNDLE*/', () => js);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/eye-bench.html', html);
console.log(`dist/eye-bench.html ${(html.length / 1024).toFixed(0)} KB`);
