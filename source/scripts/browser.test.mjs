/* Boots the *shipped* dist/index.html in a real DOM implementation.

   Every other suite bundles from src/, which means none of them ever exercised
   the step that inlines the bundle into the HTML — and that is exactly where a
   build can break. This one loads the file a user actually opens. */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { createCanvas } from 'canvas';

const html = readFileSync('dist/index.html', 'utf8');
const errors = [];

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'http://localhost/',
  beforeParse(w) {
    w.addEventListener('error', (e) => errors.push(e.error?.stack || e.message));
    w.onerror = (m, s, l, c, err) => { errors.push(err?.stack || String(m)); return true; };
    const realError = w.console.error;
    w.console = { log() {}, warn() {}, info() {}, debug() {},
      error: (...a) => errors.push('console.error: ' + a.map(String).join(' ')) };
    /* jsdom does no layout, so clientWidth/clientHeight are always zero — and
       fit() returns null on a zero-width parent, which means every canvas draws
       nothing and a test that only checks for thrown errors passes anyway.
       That is exactly the hole that let a blank-canvas build ship. Give the
       elements plausible geometry so the drawing code actually runs. */
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', {
      get() {
        const st = this.getAttribute('style') || '';
        const m = /width:\s*(\d+)px/.exec(st);
        if (m) return +m[1];
        if (this.tagName === 'CANVAS') return 900;
        return 900;
      }, configurable: true,
    });
    Object.defineProperty(w.HTMLElement.prototype, 'clientHeight', {
      get() {
        const st = this.getAttribute('style') || '';
        const m = /height:\s*(\d+)px/.exec(st);
        return m ? +m[1] : 300;
      }, configurable: true,
    });
    // Real 2d contexts, backed by node-canvas, so pixels can be counted.
    w.HTMLCanvasElement.prototype.getContext = function (kind) {
      if (kind !== '2d') return null;
      const wNeed = this.width || 800, hNeed = this.height || 300;
      if (!this.__c || this.__c.width !== wNeed || this.__c.height !== hNeed) {
        this.__c = createCanvas(wNeed, hNeed);
      }
      return this.__c.getContext('2d');
    };
    w.getComputedStyle = ((orig) => function (el, pe) {
      const cs = orig.call(this, el, pe);
      /* jsdom does not resolve custom properties. Serve them from the inlined
         stylesheet so palette() returns real colours rather than empty strings —
         an empty fillStyle is silently ignored by canvas, which would make every
         stroke invisible without raising a single error. */
      return new Proxy(cs, {
        get(t, k) {
          if (k === 'getPropertyValue') {
            return (n) => {
              if (n.startsWith('--')) return (w.__tokens && w.__tokens[n]) || '#888888';
              return t.getPropertyValue(n);
            };
          }
          const v = t[k];
          return typeof v === 'function' ? v.bind(t) : v;
        },
      });
    })(w.getComputedStyle);
  },
});

/* Parse the design tokens out of the inlined stylesheet. */
{
  const css = /:root\s*\{([^}]*)\}/s.exec(html);
  const tokens = {};
  if (css) for (const line of css[1].split(';')) {
    const m = /^\s*(--[\w-]+)\s*:\s*(.+)\s*$/.exec(line);
    if (m) tokens[m[1]] = m[2].trim();
  }
  dom.window.__tokens = tokens;
}

await new Promise((r) => setTimeout(r, 1200));
const doc = dom.window.document;

/* How much of a canvas is not background? */
function inkOf(canvas) {
  const c = canvas.__c;
  if (!c) return -1;
  const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 8) n++;
  return n / (c.width * c.height);
}

let pass = 0, fail = 0;
const ok = (n, c, d = '') => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`); } };

console.log('\nThe file a user opens');
ok('no script errors', errors.length === 0, errors.slice(0, 2).map((e) => String(e).split('\n')[0]).join(' | '));
ok('#app has content', doc.getElementById('app')?.children.length > 0);
ok('command rail rendered', !!doc.querySelector('.rail'));
ok('domain tabs present', doc.querySelectorAll('.tab.domain, .tabs.domains .tab').length >= 3,
  String(doc.querySelectorAll('.tabs.domains .tab').length));
ok('a workspace mounted into the pane', doc.querySelector('.pane')?.children.length > 0);
ok('canvases created', doc.querySelectorAll('canvas').length > 0,
  String(doc.querySelectorAll('canvas').length));
ok('stylesheet inlined', !!doc.querySelector('style') && doc.querySelector('style').textContent.length > 1000);
ok('no placeholder survived', !html.includes('<!--JS-->') && !html.includes('<!--CSS-->'));
ok('first-run overlay shown', !!doc.querySelector('.first-run'));

console.log('\nNavigation');
try {
  const shell = dom.window.__shell;
  ok('shell exposed', !!shell);
  if (shell) {
    let visited = 0;
    for (const d of shell.domains) for (const w of d.workspaces) { shell.go(`${d.id}.${w.id}`); visited++; }
    ok('every workspace mounts in a real DOM', visited >= 12, String(visited));
    ok('still no errors after navigating', errors.length === 0,
      errors.slice(0, 2).map((e) => String(e).split('\n')[0]).join(' | '));
  }
} catch (e) {
  ok('navigation did not throw', false, e.message);
}

console.log('\nCanvases actually draw');
try {
  const shell = dom.window.__shell;
  const report = [];
  for (const [path, expect] of [
    ['cardio.loop', 3], ['cardio.ecg', 3], ['neuro.localize', 1], ['neuro.exam', 1],
  ]) {
    shell.go(path);
    await new Promise((r) => setTimeout(r, 120));
    shell.resizeActive();
    const cvs = [...doc.querySelector('.pane').querySelectorAll('canvas')];
    const inks = cvs.map(inkOf);
    const drawn = inks.filter((i) => i > 0.002).length;
    report.push(`${path}: ${drawn}/${cvs.length} drawn`);
    ok(`${path} draws on its canvases`, drawn >= Math.min(expect, cvs.length) && cvs.length > 0,
      `sizes ${cvs.map((c) => (c.__c ? c.__c.width + 'x' + c.__c.height : 'none')).join(' ')} ink ${inks.map((i) => (i * 100).toFixed(1) + '%').join(' ')}`);
  }
  console.log('  ' + report.join(' · '));
} catch (e) {
  ok('canvas drawing check ran', false, e.message);
}

/* --- the hostile layout ------------------------------------------------- */
console.log('\nSurvives a layout that reports zero clientWidth');
{
  const errors2 = [];
  const dom2 = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(w) {
      w.onerror = (m, s2, l, c, err) => { errors2.push(err?.stack || String(m)); return true; };
      w.console = { log() {}, warn() {}, info() {}, debug() {}, error: (...a) => errors2.push(a.join(' ')) };
      /* clientWidth/clientHeight stay zero — the exact condition that made every
         panel blank — but the bounding rect is honest, as it is in a browser
         that has finished laying out. */
      Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get: () => 0, configurable: true });
      Object.defineProperty(w.HTMLElement.prototype, 'clientHeight', { get: () => 0, configurable: true });
      w.Element.prototype.getBoundingClientRect = function () {
        const st = this.getAttribute('style') || '';
        const m = /height:\s*(\d+)px/.exec(st);
        return { width: 900, height: m ? +m[1] : 300, top: 0, left: 0, right: 900, bottom: 300, x: 0, y: 0 };
      };
      w.HTMLCanvasElement.prototype.getContext = function (kind) {
        if (kind !== '2d') return null;
        const wN = this.width || 800, hN = this.height || 300;
        if (!this.__c || this.__c.width !== wN || this.__c.height !== hN) this.__c = createCanvas(wN, hN);
        return this.__c.getContext('2d');
      };
      w.getComputedStyle = ((orig) => function (el, pe) {
        const cs = orig.call(this, el, pe);
        return new Proxy(cs, { get(t, k) {
          if (k === 'getPropertyValue') return (n) => (n.startsWith('--') ? (w.__tokens && w.__tokens[n]) || '#888888' : t.getPropertyValue(n));
          const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
        } });
      })(w.getComputedStyle);
    },
  });
  dom2.window.__tokens = dom.window.__tokens;
  await new Promise((r) => setTimeout(r, 1200));
  const shell2 = dom2.window.__shell;
  ok('app still boots', !!shell2);
  if (shell2) {
    shell2.go('cardio.loop');
    await new Promise((r) => setTimeout(r, 150));
    shell2.resizeActive();
    const cvs = [...dom2.window.document.querySelector('.pane').querySelectorAll('canvas')];
    const drawn = cvs.filter((c) => inkOf(c) > 0.002).length;
    ok('canvases still draw via the measurement fallback', drawn > 0,
      `${drawn}/${cvs.length} drawn`);
  }
}

if (errors.length) {
  console.log('\nErrors:');
  for (const e of errors.slice(0, 5)) console.log('  ' + String(e).split('\n').slice(0, 3).join('\n    '));
}
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
