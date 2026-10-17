/* Build the standalone virtual-patient app:
     dist/encounter.html   the Clinical Physiology Lab app (cases, free patient,
                           bedside, tests, physiology chapters, Model Lab), as a
                           page fragment for hosts that add the document shell
     dist/lab.html         the same as a complete document (GitHub Pages)

   Everything runs in the page: the circulation and the heart's electrical
   model advance in real time in the browser, so nothing is precomputed. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

mkdirSync('dist', { recursive: true });

async function bundle(entry) {
  const out = await esbuild.build({
    entryPoints: [entry], bundle: true, write: false, format: 'iife', target: 'es2020',
    minify: true, loader: { '.ts': 'ts', '.js': 'js', '.json': 'json' }, logLevel: 'error',
  });
  return out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
}

/* Which build a problem report came from (report.ts): the commit, and when it was built. */
let commit = process.env.GITHUB_SHA ?? null;
if (!commit) try { commit = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { commit = null; }
const build = { commit, builtAt: new Date().toISOString() };
const js = `globalThis.__VP_BUILD__=${JSON.stringify(build)};` + await bundle('src/vp/app/app.ts');
const html = readFileSync('src/vp/app/app.html', 'utf8').replace('/*BUNDLE*/', () => js);
writeFileSync('dist/encounter.html', html);
/* The same page as a standalone document (GitHub Pages, or opened from disk): standards mode, UTF-8, mobile viewport. */
const page = `<!doctype html>\n<html lang="en">\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${html}\n</html>\n`;
writeFileSync('dist/lab.html', page);
console.log(`dist/encounter.html ${(html.length / 1024).toFixed(0)} KB, dist/lab.html`);
