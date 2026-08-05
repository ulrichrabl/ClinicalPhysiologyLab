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

   All learner mutations that change model state go through PatientRuntime
   commands when a runtime is bound. The host transport remains runtime-owned
   for play/pause/reset/settle; Explore UI no longer posts setParam directly.
--------------------------------------------------------------------------- */
function createSimHost(source) {
  /* Classic blob Workers have been unreliable here; in-page sim is fast enough
     (≈67 steps/frame at 30 fps) and shares the main thread's Map/typed arrays. */
  if (typeof window !== 'undefined') window.__simHost = 'in-page (no Worker)';
  return inlineSimHost(source);
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
  if (typeof window !== 'undefined') window.__sim = worker;

  const send = (m) => worker.postMessage(m);
  let base = {};
  let lastSnap = null;
  let defaults = {};
  let catalog = [];

  if (runtime && typeof runtime.bindCardioHost === 'function') {
    runtime.bindCardioHost(worker);
  }

  const session = () => ({ role: 'exploration' });

  /** Route slider / lesson params through the runtime when bound. */
  const setParam = (k, v) => {
    base[k] = v;
    if (runtime) {
      if (k === 'K') {
        runtime.dispatch({
          id: runtime.ids.command('cardio'),
          type: 'chemistry.set',
          payload: { values: { K: v }, pin: true },
          source: { type: 'ui', surface: 'cardio.loop' },
        }, session());
        runtime.dispatch({
          id: runtime.ids.command('cardio'),
          type: 'experimental.circulation-param',
          payload: { key: 'K', value: v },
          source: { type: 'ui', surface: 'cardio.loop' },
        }, session());
        return;
      }
      runtime.dispatch({
        id: runtime.ids.command('cardio'),
        type: 'experimental.circulation-param',
        payload: { key: k, value: v },
        source: { type: 'ui', surface: 'cardio.loop' },
      }, session());
      return;
    }
    if (k === 'K') patient.set('K', v, 'cardio');
    send({ type: 'setParam', key: k, value: v });
  };

  const loop = new LoopView({
    patient,
    send: (m) => {
      if (runtime && m.type === 'setBaro') {
        runtime.dispatch({
          id: runtime.ids.command('cardio'),
          type: 'model.set-baro',
          payload: { enabled: !!m.value },
          source: { type: 'ui', surface: 'cardio.loop' },
        }, session());
        return;
      }
      send(m);
    },
    onParam: setParam,
  });
  const ecg = new EcgView({
    send: (m) => {
      if (!runtime) return send(m);
      if (m.type === 'setPathology') {
        runtime.dispatch({
          id: runtime.ids.command('ecg'),
          type: 'model.set-pathology',
          payload: { pathologyId: m.id },
          source: { type: 'ui', surface: 'cardio.ecg' },
        }, session());
        return;
      }
      if (m.type === 'prime') {
        // Warm-up remains a host transport message (not a learner mutation).
        send(m);
        return;
      }
      send(m);
    },
    patient,
    getSnap: () => lastSnap,
  });

  const lessons = new LessonRunner({
    lessons: LESSONS,
    apply: (s) => {
      if (!s) return;
      if (s.params) {
        Object.assign(base, s.params);
        if (runtime) {
          for (const [k, v] of Object.entries(s.params)) {
            runtime.dispatch({
              id: runtime.ids.command('lesson'),
              type: 'experimental.circulation-param',
              payload: { key: k, value: v },
              source: { type: 'lesson', id: 'cardio' },
            }, { role: 'lesson' });
          }
        } else {
          send({ type: 'setParams', values: s.params });
        }
      }
      if (s.pathology) {
        if (runtime) {
          runtime.dispatch({
            id: runtime.ids.command('lesson'),
            type: 'model.set-pathology',
            payload: { pathologyId: s.pathology },
            source: { type: 'lesson', id: 'cardio' },
          }, { role: 'lesson' });
        } else {
          send({ type: 'setPathology', id: s.pathology });
        }
      }
      if (s.baro != null) {
        if (runtime) {
          runtime.dispatch({
            id: runtime.ids.command('lesson'),
            type: 'model.set-baro',
            payload: { enabled: !!s.baro },
            source: { type: 'lesson', id: 'cardio' },
          }, { role: 'lesson' });
        } else {
          send({ type: 'setBaro', value: s.baro });
        }
      }
      if (s.ghost === 'capture') loop.captureGhost();
      if (s.ghost === 'clear') loop.clearGhost();
      if (s.settle !== false) {
        if (runtime) {
          void runtime.advance(s.settle ? s.settle * 1000 : 4000);
        } else {
          send({ type: 'settle', seconds: s.settle || 4 });
        }
      }
      loop.syncSliders({ ...BASELINE, ...base });
    },
  });

  const casePanel = new LeadPanel({ height: 330, strip: true });
  const cases = new CaseRunner({
    sets: CASE_SETS,
    stimulus: casePanel.node,
    optionLabel: (id) => catalog.find((p) => p.id === id)?.name || id,
    stage: (c) => {
      if (!c.pathId) return;
      casePanel.reset();
      if (runtime) {
        runtime.dispatch({
          id: runtime.ids.command('case'),
          type: 'model.set-pathology',
          payload: { pathologyId: c.pathId },
          source: { type: 'lesson', id: 'cardio.case' },
        }, { role: 'lesson' });
      } else {
        send({ type: 'setPathology', id: c.pathId });
      }
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
      // Prime physiology for the UI; playback ownership stays with the runtime.
      send({ type: 'prime' });
      return;
    }
    if (m.type === 'modelState') {
      if (runtime && typeof runtime.ingestModelState === 'function') {
        runtime.ingestModelState(m.state);
      }
      return;
    }
    if (m.type === 'modelStateRestored') {
      lastSnap = m.data;
      if (runtime && typeof runtime.ingestCardioSnapshot === 'function') {
        runtime.ingestCardioSnapshot(m.data);
      }
      return;
    }
    if (m.type === 'advanced') {
      lastSnap = m.data;
      if (runtime && typeof runtime.completeAdvance === 'function') {
        runtime.completeAdvance(m.requestId, m.data, m.advancedMs);
      } else if (runtime && typeof runtime.ingestCardioSnapshot === 'function') {
        runtime.ingestCardioSnapshot(m.data);
      }
      guard('shell.vitals', () => shell.updateVitalsFromRuntime?.() ?? shell.updateVitals(m.data));
      loop.push(m.data);
      ecg.push(m.data);
      if (shell.activeWorkspace() === 'cardio.cases') casePanel.push(m.data);
      return;
    }
    if (m.type !== 'snapshot') return;
    const s = m.data;
    lastSnap = s;
    if (runtime && typeof runtime.ingestCardioSnapshot === 'function') {
      runtime.ingestCardioSnapshot(s);
    }
    guard('shell.vitals', () => shell.updateVitalsFromRuntime?.() ?? shell.updateVitals(s));
    loop.push(s);
    ecg.push(s);
    if (shell.activeWorkspace() === 'cardio.cases') casePanel.push(s);
  };

  const rawHandler = worker.onmessage;
  worker.onmessage = (e) => guard('cardio.snapshot', () => rawHandler(e));

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
    produces: [],
    consumes: ['K', 'Ca', 'ICP', 'betaBlocker', 'atropine', 'vasopressor'],
    transport: true,
    workspaces: [
      { id: 'loop', label: 'Loop', node: loop.node, view: loop },
      { id: 'ecg', label: 'ECG', node: ecg.node, view: ecg },
      { id: 'cases', label: 'Cases', node: cases.node, view: { resize: () => casePanel.resize() } },
      { id: 'lessons', label: 'Lessons', node: lessons.node, view: lessons },
    ],
    control: {
      play: () => (runtime ? runtime.play() : send({ type: 'play' })),
      pause: () => (runtime ? runtime.pause() : send({ type: 'pause' })),
      speed: (v) => {
        if (runtime) runtime.play({ speed: v });
        else send({ type: 'setSpeed', value: v });
      },
      reset: () => {
        base = {};
        if (runtime) {
          runtime.dispatch({
            id: runtime.ids.command('cardio'),
            type: 'runtime.reset',
            payload: {},
            source: { type: 'ui', surface: 'cardio' },
          }, session());
        } else {
          send({ type: 'reset' });
        }
      },
    },
    snapshot: () => lastSnap,
    setParam,
  };
}
