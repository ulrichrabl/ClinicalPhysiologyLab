/* ===========================================================================
   The playtest recording (owner, 2026-10-23: "use it for everything …
   in a mirrored version of the app, with some extra URL").

   The same app is published twice: at the site's root, and under
   /playtest/. Only the playtest copy records. It keeps, on this device and
   nowhere else, what the person did and when, across every screen (the
   ward, cases, stations, the practice arrest): each tap and each setting
   changed, the screen it happened on, the app's state whenever the screen
   changes, the messages and refusals a screen reports, and each finished
   practice run with what replays it exactly. "Save session" downloads it
   as one file; nothing is sent anywhere. A report made in the playtest copy
   carries the last part of the trail.

   `node scripts/playtest-report.mjs <files>` reads the files.
=========================================================================== */

type Lang = 'en' | 'de';

export const SESSION_SCHEMA = 'vp.playtest-session/1';

/** Is this the playtest copy? Its path contains /playtest/, or ?playtest is in the address (for trying it locally). */
export function playtestMode(): boolean {
  try { return /\/playtest(\/|$)/.test(location.pathname) || new URLSearchParams(location.search).has('playtest'); } catch { return false; }
}

interface Step { t: number; screen: string; what: string }
interface Snapshot { t: number; screen: string; app: unknown }
interface RunRecord { t: number; kind: string; data: unknown }

const S: { on: boolean; started: number; id: string; steps: Step[]; snapshots: Snapshot[]; runs: RunRecord[]; screen: string; app: (() => { screen: string } & Record<string, unknown>) | null } =
  { on: false, started: 0, id: '', steps: [], snapshots: [], runs: [], screen: '', app: null };
const MAX_STEPS = 20000;
const now = () => Math.round((performance.now() - S.started) / 100) / 10;

/** A screen's own note: a message it showed, an action it refused. Does nothing outside the playtest copy. */
export function note(what: string): void {
  if (!S.on) return;
  S.steps.push({ t: now(), screen: S.screen, what });
  if (S.steps.length > MAX_STEPS) S.steps.shift();
}

/** A finished run a screen can replay (the practice arrest's seed, nudge and input log). */
export function recordRun(kind: string, data: unknown): void {
  if (!S.on) return;
  S.runs.push({ t: now(), kind, data });
  save(true);
}

/** The last part of the trail, for a report made in the playtest copy. */
export function trailTail(n = 60): Step[] | null { return S.on ? S.steps.slice(-n) : null; }

function sessionFile() {
  return {
    schema: SESSION_SCHEMA, id: S.id, started: new Date(Date.now() - (performance.now() - S.started)).toISOString(), saved: new Date().toISOString(),
    seconds: now(), url: location.href.split('#')[0],
    screen: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1, touch: 'ontouchstart' in window },
    steps: S.steps, snapshots: S.snapshots, runs: S.runs,
  };
}

/** Kept on this device as it goes (a closed tab loses nothing); downloaded on "Save session". */
function save(quiet: boolean): void {
  const file = sessionFile();
  try { localStorage.setItem(`cpl.playtest.${S.id}`, JSON.stringify(file)); } catch { /* storage full or blocked: the download still works */ }
  if (quiet) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }));
  a.download = `playtest-${file.saved.slice(0, 16).replace(/[:T]/g, '-')}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Start recording, in the playtest copy only. `app` gives the app's state as reports do (report.ts). */
export function installRecorder(opts: { root: HTMLElement; lang: () => Lang; app: () => { screen: string } & Record<string, unknown> }): void {
  if (!playtestMode()) return;
  S.on = true; S.started = performance.now(); S.id = Math.random().toString(36).slice(2, 10); S.app = opts.app;
  const L = (en: string, de: string) => (opts.lang() === 'de' ? de : en);
  /* the screen, and a snapshot of the app whenever it changes */
  const screenNow = () => { try { return S.app!().screen; } catch { return '?'; } };
  const look = () => {
    const sc = screenNow();
    if (sc !== S.screen) {
      S.screen = sc;
      let app: unknown = null;
      try { const a = S.app!(); app = { screen: a.screen, caseId: a.caseId, lang: a.lang, free: a.free, layer: a.layer, tab: a.tab, visual: a.visual, station: a.station, events: Array.isArray(a.events) ? (a.events as unknown[]).length : undefined }; } catch { /* the snapshot is a courtesy */ }
      S.snapshots.push({ t: now(), screen: sc, app });
    }
  };
  /* what was touched: the element's first data attribute, else its label */
  const name = (el: Element): string => {
    const attr = Array.from(el.attributes).find((a) => a.name.startsWith('data-') && !/^data-(k|out)$/.test(a.name));
    if (attr) return `${attr.name.slice(5)}${attr.value ? `=${attr.value}` : ''}`;
    const text = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${text ? ` "${text}"` : ''}`;
  };
  opts.root.addEventListener('click', (ev) => {
    const el = (ev.target as Element).closest?.('button, summary, a, [data-hit], [role="radio"], [role="tab"], canvas');
    if (!el || el.closest('.pt-bar')) return;
    look(); note(`tap ${name(el)}`);
    setTimeout(look, 0); setTimeout(look, 600);
  }, true);
  opts.root.addEventListener('change', (ev) => {
    const el = ev.target as HTMLInputElement | HTMLSelectElement;
    const key = el.dataset?.k ?? name(el);
    note(`set ${key} = ${el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value}`);
    setTimeout(look, 0); setTimeout(look, 600);
  }, true);
  look();
  /* screens also change without a tap (a run ends, a timer fires): look every two seconds */
  setInterval(look, 2000);
  setInterval(() => save(true), 30000);
  /* the bar: says it records, and saves */
  const bar = document.createElement('div');
  bar.className = 'pt-bar';
  const draw = () => {
    bar.innerHTML = `<span>${L('Playtest version: what you do is recorded on this device only.', 'Testversion: Was Sie tun, wird nur auf diesem Gerät aufgezeichnet.')}</span>
      <button type="button" class="primary small" data-pt-save>${L('Save session', 'Sitzung speichern')}</button>`;
    bar.querySelector<HTMLButtonElement>('[data-pt-save]')!.onclick = () => { note('saved the session'); save(false); };
  };
  draw();
  document.body.appendChild(bar);
  document.body.classList.add('playtest');
  /* the language may change: redraw the bar's words now and then */
  let last = opts.lang();
  setInterval(() => { if (opts.lang() !== last) { last = opts.lang(); draw(); } }, 1000);
}
