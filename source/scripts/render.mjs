/* Boots the real bundle with node-canvas behind every <canvas>, runs the
   simulation until the traces have filled, then writes each panel to a PNG so
   the drawing code can actually be looked at. */
import * as esbuild from 'esbuild';
import { createCanvas } from 'canvas';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { installDOM } from './domstub.mjs';

const OUT = process.env.OUT || '/tmp/shots';
const THEME = process.env.THEME || 'monitor';
mkdirSync(OUT, { recursive: true });

/* --- real CSS custom properties so the palette is the true one ----------- */
const css = readFileSync('src/styles.css', 'utf8');
function vars(selector) {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 's');
  const m = re.exec(css);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split(';')) {
    const mm = /^\s*(--[\w-]+)\s*:\s*(.+)\s*$/.exec(line);
    if (mm) out[mm[1]] = mm[2].trim();
  }
  return out;
}
const TOKENS = { ...vars(':root'), ...(THEME === 'paper' ? vars('[data-theme="paper"]') : {}) };

const { doc } = installDOM();
globalThis.__forceFile = true;
globalThis.location = { protocol: 'file:', href: 'file:///x' };
globalThis.getComputedStyle = () => ({
  getPropertyValue: (n) => TOKENS[n] || '#888888',
});

/* --- give every canvas a real 2d context --------------------------------- */
const CANVASES = [];
const origCreate = doc.createElement;
doc.createElement = (tag) => {
  const n = origCreate(tag);
  if (n.tagName === 'CANVAS') {
    /* fit() rewrites style.height once it has drawn, so remember the height the
       component actually asked for. */
    const rawStyle = n.style;
    n.style = new Proxy({}, {
      get: (t, k) => (k in t ? t[k] : (k === 'setProperty' || k === 'removeProperty' ? () => {} : '')),
      set: (t, k, v) => {
        if (k === 'height' && n._declaredH == null && /px$/.test(String(v))) n._declaredH = parseFloat(v);
        t[k] = v; return true;
      },
    });
    let backing = null;
    Object.defineProperty(n, '_ctx', {
      get() {
        if (!backing || backing.width !== n.width || backing.height !== n.height) {
          backing = createCanvas(Math.max(1, n.width || 800), Math.max(1, n.height || 300));
          n._backing = backing;
        }
        return backing.getContext('2d');
      },
      configurable: true,
    });
    CANVASES.push(n);
  }
  return n;
};

/* --- sizes: pretend a 1440x900 window ------------------------------------ */
const WIDTH = 1440;
globalThis.innerWidth = WIDTH; globalThis.innerHeight = 900;
globalThis.devicePixelRatio = 2;

/* --- build + boot --------------------------------------------------------- */
const rawLoader = {
  name: 'raw',
  setup(build) {
    build.onResolve({ filter: /\?raw$/ }, (a) => ({
      path: new URL(a.path.replace(/\?raw$/, ''), 'file://' + a.resolveDir + '/').pathname,
      namespace: 'raw',
    }));
    build.onLoad({ filter: /.*/, namespace: 'raw' }, async (a) => {
      const b = await esbuild.build({ entryPoints: [a.path], bundle: true, write: false,
        format: 'esm', target: 'es2022', platform: 'browser' });
      return { contents: `export default ${JSON.stringify(b.outputFiles[0].text)};`, loader: 'js' };
    });
  },
};
const built = await esbuild.build({
  entryPoints: ['src/main.js'], bundle: true, write: false, format: 'iife',
  target: 'es2020', plugins: [rawLoader], minify: false,
});
doc.documentElement.dataset.theme = THEME;
(0, eval)(built.outputFiles[0].text);
const shell = globalThis.__shell;
console.log('booted, theme =', THEME);

/* --- run the model until the traces have filled --------------------------- */
const cardio = shell.byId.get('cardio');
const host = globalThis.__sim || globalThis.__worker;
/* The in-page host runs on setInterval, which would keep Node alive forever
   and redraw every panel continuously. Drive it by hand instead. */
host.postMessage({ type: 'pause' });
for (let i = 0; i < 10; i++) host.postMessage({ type: 'settle', seconds: 1.2 });
const snap = cardio.snapshot();
console.log('sim:', Math.round(snap.Psys) + '/' + Math.round(snap.Pdia),
  'beat samples:', snap.beat ? snap.beat.samples.length : 0,
  'ecg II:', (snap.ecgLeads?.II || []).length);

/* --- element sizing: emulate the CSS box for each canvas ------------------ */
/* Column widths that match the CSS grid at a 1440px viewport. */
const PANE = 1440 - 36;                 // .pane horizontal padding
const CARD_PAD = 28;                    // .card-b left+right

function hasAncestor(node, cls) {
  let n = node;
  while (n) { if (n.classList?.contains(cls)) return true; n = n.parentElement; }
  return false;
}

function widthFor(canvas, workspace) {
  let col;
  if (workspace === 'cardio.loop') col = PANE - 320 - 14;          // 1fr 320px
  else if (workspace.startsWith('neuro.') || workspace === 'cardio.ecg') col = (PANE - 14) * 7 / 12;
  else if (workspace === 'cardio.cases') col = PANE - 420 - 14;
  else col = PANE;
  if (hasAncestor(canvas, 'split2')) col = (col - 14) / 2;         // side-by-side pair
  return Math.round(col - CARD_PAD);
}

function sizeCanvases(workspace) {
  for (const c of CANVASES) {
    const h = c._declaredH || 300;
    if (c.parentElement) c.parentElement.clientWidth = widthFor(c, workspace);
    c.clientHeight = h;
    // let fit() notice the change
    c.width = 0; c.height = 0;
  }
}

const shots = [];

async function shoot(path, label) {
  shell.go(path);
  sizeCanvases(path);
  // two passes: first sizes the canvas, second draws into the right size
  for (let i = 0; i < 3; i++) {
    host.postMessage({ type: 'settle', seconds: 0.9 });
    sizeCanvases(path);
    shell.resizeActive();
  }
  const view = shell.active.space.view;
  try { view?.draw?.(); } catch {}
  try { view?.resize?.(); } catch {}

  // collect canvases currently mounted under the pane
  let n = 0;
  const mounted = [];
  const walk = (node) => {
    for (const ch of node.children) {
      if (ch.tagName === 'CANVAS') mounted.push(ch);
      walk(ch);
    }
  };
  walk(shell.pane);
  for (const c of mounted) {
    if (!c._backing) continue;
    const file = `${OUT}/${label}-${++n}.png`;
    writeFileSync(file, c._backing.toBuffer('image/png'));
    shots.push({ file, w: c._backing.width, h: c._backing.height });
  }
  console.log(`  ${label}: ${n} canvas${n === 1 ? '' : 'es'}`);
}

await shoot('cardio.loop', 'loop');
await shoot('cardio.ecg', 'ecg');
await shoot('cardio.cases', 'cases');
await shoot('neuro.localize', 'neuro-localize');
await shoot('neuro.exam', 'neuro-exam');
await shoot('labs.panel', 'labs');

console.log(`\n${shots.length} images written to ${OUT}`);
for (const s of shots) console.log(`  ${s.file}  ${s.w}x${s.h}`);
process.exit(0);
