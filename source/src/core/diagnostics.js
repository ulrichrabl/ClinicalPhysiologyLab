import { el, clear } from './ui/kit.js';
import { canvasSizes } from './ui/draw.js';

/* ---------------------------------------------------------------------------
   Diagnostics.

   Canvas code fails silently. A panel that throws mid-draw leaves a blank
   rectangle, and if that throw happens inside the snapshot handler it takes
   every other panel down with it — the app looks frozen and says nothing.

   So: every panel draws inside a guard. A panel that throws is isolated, its
   siblings keep running, and the failure becomes visible instead of mysterious.
   Press D for a report that can be pasted straight into a bug description.
--------------------------------------------------------------------------- */

const MAX_ERRORS = 40;
const errors = [];
const counts = new Map();
const disabled = new Set();
let banner = null;
let panel = null;

export function record(where, err) {
  const msg = (err && (err.stack || err.message)) || String(err);
  const key = `${where}::${(err && err.message) || msg}`.slice(0, 200);
  const n = (counts.get(key) || 0) + 1;
  counts.set(key, n);

  if (n === 1) {
    errors.push({ where, msg, at: new Date().toISOString(), count: 1 });
    if (errors.length > MAX_ERRORS) errors.shift();
    console.error(`[${where}]`, err);
  } else {
    const hit = errors.find((e) => e.where === where && e.msg === msg);
    if (hit) hit.count = n;
  }

  /* A panel that has failed ten times is not going to recover; stop calling it
     so the rest of the app stays responsive. */
  if (n === 10) disabled.add(where);
  showBanner();
}

/* Run a panel's draw. Never lets one panel break another. */
export function guard(where, fn) {
  if (disabled.has(where)) return undefined;
  try {
    return fn();
  } catch (err) {
    record(where, err);
    return undefined;
  }
}

export function installErrorHandlers() {
  window.addEventListener('error', (e) => {
    record('window', e.error || new Error(e.message + ` (${e.filename}:${e.lineno})`));
  });
  window.addEventListener('unhandledrejection', (e) => {
    record('promise', e.reason || new Error('unhandled rejection'));
  });
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'd' && !e.target.matches?.('input, select, textarea')) togglePanel();
  });
}

function showBanner() {
  if (!banner) {
    banner = el('button', {
      class: 'diag-banner',
      onclick: () => togglePanel(),
    });
    document.body.appendChild(banner);
  }
  const nPanels = disabled.size;
  banner.textContent = nPanels
    ? `${nPanels} panel${nPanels === 1 ? '' : 's'} stopped · ${errors.length} error${errors.length === 1 ? '' : 's'} · press D`
    : `${errors.length} error${errors.length === 1 ? '' : 's'} · press D for details`;
  banner.hidden = false;
}

/* ---------------------------------------------------------------------------
   The report.
--------------------------------------------------------------------------- */
function features() {
  const c = document.createElement('canvas');
  const ctx = c.getContext && c.getContext('2d');
  const supports = (prop, val) => {
    try { return CSS.supports(prop, val); } catch { return false; }
  };
  return {
    'canvas 2d': !!ctx,
    'ctx.roundRect': !!(ctx && ctx.roundRect),
    'Web Worker': typeof Worker === 'function',
    'ResizeObserver': typeof ResizeObserver === 'function',
    'CSS color-mix': supports('color', 'color-mix(in srgb, red 50%, blue)'),
    'CSS backdrop-filter': supports('backdrop-filter', 'blur(4px)'),
    'font IBM Plex Sans': documentHasFont('IBM Plex Sans'),
  };
}

function documentHasFont(name) {
  try { return document.fonts ? document.fonts.check(`12px "${name}"`) : false; }
  catch { return false; }
}

export function report() {
  const shell = window.__shell;
  const lines = [];
  lines.push('Clinical Physiology Lab — diagnostic report');
  lines.push(new Date().toISOString());
  lines.push('');
  lines.push('ENVIRONMENT');
  lines.push(`  user agent      ${navigator.userAgent}`);
  lines.push(`  viewport        ${window.innerWidth}x${window.innerHeight} @ dpr ${window.devicePixelRatio}`);
  lines.push(`  protocol        ${location.protocol}`);
  lines.push(`  theme           ${document.documentElement.dataset.theme}`);
  lines.push(`  sim host        ${window.__simHost || 'unknown'}`);
  lines.push('');
  lines.push('FEATURES');
  for (const [k, v] of Object.entries(features())) lines.push(`  ${v ? 'yes' : 'NO '}  ${k}`);
  lines.push('');
  lines.push('STATE');
  if (shell) {
    lines.push(`  workspace       ${shell.activeWorkspace()}`);
    const snap = shell.byId.get('cardio')?.snapshot?.();
    lines.push(snap
      ? `  haemodynamics   ${Math.round(snap.Psys)}/${Math.round(snap.Pdia)} HR ${Math.round(snap.HR)} `
        + `EF ${Math.round(snap.EF)}% CO ${snap.CO?.toFixed(1)}`
      : '  haemodynamics   no snapshot yet  ← the simulation is not running');
    const p = shell.patient;
    lines.push(`  couplings       ${p.activeCouplings().map((c) => c.id).join(', ') || 'none active'}`);
    lines.push(`  cord lesion     ${p.get('cordLevel') || 'none'}`);
  } else {
    lines.push('  shell           NOT CONSTRUCTED  ← boot failed');
  }
  lines.push('');
  lines.push('CANVASES  (a zero width is why a panel is blank)');
  try {
    const inPane = document.querySelectorAll('.pane canvas');
    if (!inPane.length) lines.push('  none in the current workspace');
    for (const c of inPane) {
      const m = canvasSizes.get(c) || {};
      const r = c.getBoundingClientRect();
      lines.push(`  css ${m.w ?? '?'}x${m.h ?? '?'}  backing ${c.width}x${c.height}  `
        + `rect ${Math.round(r.width)}x${Math.round(r.height)}  `
        + `parent ${c.parentElement ? c.parentElement.clientWidth : '?'}`);
    }
  } catch (e) { lines.push('  could not measure: ' + e.message); }
  lines.push('');
  lines.push(`ERRORS (${errors.length})`);
  if (!errors.length) lines.push('  none');
  for (const e of errors) {
    lines.push(`  [${e.where}]${e.count > 1 ? ` x${e.count}` : ''}`);
    for (const l of String(e.msg).split('\n').slice(0, 6)) lines.push(`      ${l.trim()}`);
  }
  if (disabled.size) {
    lines.push('');
    lines.push(`STOPPED PANELS: ${[...disabled].join(', ')}`);
  }
  return lines.join('\n');
}

function togglePanel() {
  if (panel && !panel.hidden) { panel.hidden = true; return; }
  if (!panel) {
    panel = el('div', { class: 'diag-panel' });
    document.body.appendChild(panel);
  }
  const text = report();
  clear(panel);
  panel.append(
    el('div', { class: 'diag-h' },
      el('strong', {}, 'Diagnostics'),
      el('div', { class: 'rail-spacer' }),
      el('button', { class: 'btn sm', onclick: () => {
        navigator.clipboard?.writeText(text).then(
          () => { copyBtn.textContent = 'Copied'; },
          () => { copyBtn.textContent = 'Select the text below'; });
      } }, 'Copy report'),
      el('button', { class: 'btn ghost sm', onclick: () => { panel.hidden = true; } }, 'Close')),
    el('pre', { class: 'diag-pre' }, text),
  );
  const copyBtn = panel.querySelector('.btn');
  panel.hidden = false;
}

export { errors, disabled };
