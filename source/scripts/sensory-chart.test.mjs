/* The sensory chart (renderer 'svg.dermatomes'): drawn from the examination model's findings. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const bundle = join(tmpdir(), `sensory-${Date.now()}.mjs`);
await esbuild.build({ entryPoints: ['scripts/_sensory_entry.ts'], bundle: true, outfile: bundle, format: 'esm', target: 'es2022', platform: 'node', loader: { '.ts': 'ts', '.js': 'js', '.json': 'json' }, logLevel: 'error' });
const S = await import(pathToFileURL(bundle).href);
unlinkSync(bundle);

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); } };
const colors = { fg: '#111', muted: '#777', line: '#555', abn: '#c2410c', surface: '#fff' };
const chart = (nodes, lang = 'en') => {
  const m = S.healthyModel(); m.lesions = { nodes, complete: true };
  const input = S.sensoryInputFrom((ref, ctx) => S.neuroObserve(m, ref, ctx));
  return { input, svg: S.sensoryChartSvg(input, lang, colors) };
};
/* Well-formed enough for a browser: tags balance, attributes are quoted, no stray ampersands. */
function wellFormed(svg) {
  if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) return 'not an <svg> element';
  const stack = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"<]*")*)\s*(\/?)>|<|>/g)) {
    if (m[0] === '<' || m[0] === '>') return `stray ${m[0]} at ${m.index}: ${svg.slice(m.index - 30, m.index + 30)}`;
    if (m[1]) { if (stack.pop() !== m[2]) return `</${m[2]}> closes the wrong element at ${m.index}`; }
    else if (!m[4]) stack.push(m[2]);
  }
  if (stack.length) return `unclosed: ${stack.join(',')}`;
  if (/&(?!amp;|lt;|gt;|quot;|#39;)/.test(svg)) return 'unescaped &';
  return '';
}
const marked = (svg) => [...svg.matchAll(/<g data-seg="([^"]+)"(?: data-side="([RL])")? data-level="(reduced|absent)"/g)].map((m) => `${m[1]}${m[2] ?? ''}`);
const nerves = (svg) => [...svg.matchAll(/<g data-nerve="([^"]+)" data-side="([RL])"/g)].map((m) => `${m[1]}${m[2]}`);

console.log('\nThe sensory chart');
{
  for (const [name, nodes] of [['healthy', []], ['L5 root', ['R_nerve_L5', 'R_drg_L5']], ['peroneal nerve', ['R_n_peroneal_head']], ['hemicord', ['R_cst_T10', 'R_dc_asc', 'R_stt_asc']]])
    for (const lang of ['en', 'de']) { const e = wellFormed(chart(nodes, lang).svg); ok(`${name} (${lang}): the SVG is well-formed`, !e, e); }
  ok('a healthy patient: nothing marked', marked(chart([]).svg).length === 0 && nerves(chart([]).svg).length === 0);
  const l5 = chart(['R_nerve_L5', 'R_drg_L5']).svg, m = marked(l5);
  ok('the right L5 root marks L5 on the right leg, front and back', m.length > 0 && m.every((x) => x === 'L5R'), JSON.stringify(m));
  ok('… and nothing on the left', !m.some((x) => x.endsWith('L')));
  const per = chart(['R_n_peroneal_head']).svg;
  ok('the right peroneal nerve marks its territory', nerves(per).includes('peroneal' + 'R'), JSON.stringify(nerves(per)));
  ok('… and not the L5 dermatome', marked(per).length === 0, JSON.stringify(marked(per)));
  const sc = S.sensoryChartSvg({}, 'en', colors);
  ok('nothing examined: every band drawn as not tested', !/data-level="(normal|reduced|absent)"/.test(sc) && /data-level="untested"/.test(sc));
  const evil = S.sensoryChartSvg({ arm: { R: { C5: 'absent', territories: ['<script>', 'ulnar'] } } }, 'en', colors);
  ok('an unknown territory is ignored and text stays escaped', !evil.includes('<script>') && !wellFormed(evil));
  const en = chart([]).svg, de = chart([], 'de').svg;
  for (const t of ['normal', 'reduced', 'absent', 'not tested', 'Dermatomes overlap: the bands are approximate.']) ok(`legend (en): “${t}”`, en.includes(`>${t}<`));
  for (const t of ['normal', 'vermindert', 'aufgehoben', 'nicht geprüft', 'Dermatome überlappen: die Bänder sind ungefähr.']) ok(`legend (de): “${t}”`, de.includes(`>${t}<`));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
