import { LoopView } from './ui/loop.js';
import { EcgView, LeadPanel } from './ui/ecg.js';
import { CaseRunner } from '../../core/ui/caserunner.js';
import { LessonRunner } from '../../core/ui/lessonrunner.js';
import { el } from '../../core/ui/kit.js';
import { CASE_SETS } from './data/cases.js';
import { LESSONS, BASELINE } from './data/lessons.js';
import workerSource from './sim/worker.ts?raw';
import { guard, record } from '../../core/diagnostics.js';

/* ---------------------------------------------------------------------------
   Cardiovascular domain.

   Declares what it publishes into the shared patient and what it listens for.
   The shell knows nothing about elastance or Windkessel terms — it only knows
   this manifest.
--------------------------------------------------------------------------- */
/* ---------------------------------------------------------------------------
   Simulation host.

   Normally the model runs in a Web Worker so a slow frame never stutters the
   traces. But Chrome refuses to start a blob-URL worker from a page opened as
   file://, and double-clicking the file is the whole point of shipping one
   self-contained HTML document. So when there is no origin to speak of, the
   same worker source is run on the main thread behind an identical interface.

   The cost is small: at 30 fps and dt = 0.5 ms the model only advances about
   67 integration steps per frame.
--------------------------------------------------------------------------- */
function createSimHost(source) {
  /* Classic blob Workers have been unreliable here; in-page sim is fast enough
     (≈67 steps/frame at 30 fps) and shares the main thread's Map/typed arrays. */
  if (typeof window !== 'undefined') window.__simHost = 'in-page (no Worker)';
  return inlineSimHost(source);

  /* Worker path kept for reference — re-enable once blob worker parity is verified.
  if (typeof Worker === 'function' && location.protocol !== 'file:') {
    try {
      const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      const w = new Worker(url);
      ...
    } catch (e) { ... }
  }
  return inlineSimHost(source);
  */
}

function inlineSimHost(source) {
  const pending = [];
  const host = {
    _onmessage: null,
    get onmessage() { return this._onmessage; },
    set onmessage(fn) {
      this._onmessage = fn;
      while (pending.length) fn({ data: pending.shift() });
    },
    postMessage(m) { inner?.({ data: m }); },
    terminate() {},
  };
  const emit = (m) => { if (host._onmessage) host._onmessage({ data: m }); else pending.push(m); };
  const factory = new Function('postMessage', 'setInterval', 'clearInterval', 'self',
    `${source}\n;return self.onmessage;`);
  const inner = factory(emit, setInterval.bind(globalThis), clearInterval.bind(globalThis), globalThis);
  return host;
}

export default function cardioDomain({ patient, shell, runtime }) {
  const worker = createSimHost(workerSource);
  /* Exposed for the diagnostic report and the offline render harness. */
  if (typeof window !== 'undefined') window.__sim = worker;

  const send = (m) => worker.postMessage(m);
  let base = {};          // what the learner set with the sliders
  let lastSnap = null;
  let defaults = {};      // the model's own defaults, for undoing overrides

  if (runtime && typeof runtime.bindCardioHost === 'function') {
    runtime.bindCardioHost(worker);
  }

  const setParam = (k, v) => {
    base[k] = v;
    if (k === 'K') patient.set('K', v, 'cardio');
    send({ type: 'setParam', key: k, value: v });
    // Learner slider changes are the baseline; re-sync channels so runtime
    // mechanisms still compose on top when relevant.
    if (runtime && k !== 'K') {
      /* non-channel sim params stay on the host directly */
    }
  };

  const loop = new LoopView({ patient, send, onParam: setParam });
  const ecg = new EcgView({ send, patient, getSnap: () => lastSnap });

  const lessons = new LessonRunner({
    lessons: LESSONS,
    apply: (s) => {
      if (!s) return;
      if (s.params) { Object.assign(base, s.params); send({ type: 'setParams', values: s.params }); }
      if (s.pathology) send({ type: 'setPathology', id: s.pathology });
      if (s.baro != null) send({ type: 'setBaro', value: s.baro });
      if (s.ghost === 'capture') loop.captureGhost();
      if (s.ghost === 'clear') loop.clearGhost();
      if (s.settle !== false) send({ type: 'settle', seconds: s.settle || 4 });
      loop.syncSliders({ ...BASELINE, ...base });
    },
  });

  /* The case needs a tracing to read, not just a vignette. */
  const casePanel = new LeadPanel({ height: 330, strip: true });
  let catalog = [];
  const cases = new CaseRunner({
    sets: CASE_SETS,
    stimulus: casePanel.node,
    optionLabel: (id) => catalog.find((p) => p.id === id)?.name || id,
    stage: (c) => {
      if (c.pathId) { casePanel.reset(); send({ type: 'setPathology', id: c.pathId }); }
    },
  });

  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'catalog') {
      catalog = m.pathologies;
      if (m.defaults) {
        defaults = m.defaults;
        if (runtime && typeof runtime.bindCardioHost === 'function') {
          runtime.bindCardioHost(worker, defaults);
        }
      }
      if (typeof globalThis !== 'undefined') globalThis.__catalogSeen = m.pathologies;
      ecg.setCatalog(m.pathologies);
      cases.render();
      send({ type: 'prime' });
      send({ type: 'play' });
      return;
    }
    if (m.type !== 'snapshot') return;
    const s = m.data;
    lastSnap = s;
    // Canonical public state lives on the runtime — cardio does not publish
    // haemodynamics into shared channels as ground truth.
    if (runtime && typeof runtime.ingestCardioSnapshot === 'function') {
      runtime.ingestCardioSnapshot(s);
    }
    guard('shell.vitals', () => shell.updateVitalsFromRuntime?.() ?? shell.updateVitals(s));
    loop.push(s);
    ecg.push(s);
    if (shell.activeWorkspace() === 'cardio.cases') casePanel.push(s);
  };

  /* A throw inside the handler would otherwise stall every later snapshot. */
  const rawHandler = worker.onmessage;
  worker.onmessage = (e) => guard('cardio.snapshot', () => rawHandler(e));

  /* Channel edits flow Patient → runtime.syncChannels → adapter → host.
     Cardio publishes haemodynamic snapshots back into channels. */
  if (runtime) {
    runtime.subscribe((ev) => {
      if (ev.type === 'command.accepted' || ev.type === 'channels.synced' || ev.type === 'checkpoint.restored') {
        const driven = new Set(Object.keys(runtime.cardioOverrides()));
        loop?.markDriven(driven);
      }
    });
  }

  return {
    id: 'cardio',
    name: 'Circulation',
    tagline: 'Pressures, volumes and the electrical trace that drives them',
    produces: [], // haemodynamics are runtime public state, not domain channel writes
    consumes: ['K', 'Ca', 'ICP', 'betaBlocker', 'atropine', 'vasopressor'],
    transport: true,
    workspaces: [
      { id: 'loop', label: 'Loop', node: loop.node, view: loop },
      { id: 'ecg', label: 'ECG', node: ecg.node, view: ecg },
      { id: 'cases', label: 'Cases', node: cases.node, view: { resize: () => casePanel.resize() } },
      { id: 'lessons', label: 'Lessons', node: lessons.node, view: lessons },
    ],
    control: { play: () => send({ type: 'play' }), pause: () => send({ type: 'pause' }),
      speed: (v) => send({ type: 'setSpeed', value: v }),
      reset: () => { base = {}; send({ type: 'reset' }); } },
    snapshot: () => lastSnap,
    setParam,
  };
}
