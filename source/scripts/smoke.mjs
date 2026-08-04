/* Boots the real bundle against the DOM stub, drives a real simulation
   snapshot through it, and visits every workspace of every domain.
   Catches the class of bug that only appears at runtime. */
import * as esbuild from 'esbuild';
import { installDOM } from './domstub.mjs';

const problems = [];
const origError = console.error;
console.error = (...a) => { problems.push(a.join(' ')); origError(...a); };

installDOM();

/* --- 1. build the UI bundle unminified so stacks are readable ------------- */
const rawLoader = {
  name: 'raw',
  setup(build) {
    build.onResolve({ filter: /\?raw$/ }, (a) => ({
      path: new URL(a.path.replace(/\?raw$/, ''), 'file://' + a.resolveDir + '/').pathname,
      namespace: 'raw',
    }));
    build.onLoad({ filter: /.*/, namespace: 'raw' }, async (a) => {
      const b = await esbuild.build({ entryPoints: [a.path], bundle: true, write: false,
        format: 'iife', target: 'es2022', platform: 'browser' });
      return { contents: `export default ${JSON.stringify(b.outputFiles[0].text)};`, loader: 'js' };
    });
  },
};

const built = await esbuild.build({
  entryPoints: ['src/main.js'], bundle: true, write: false, format: 'iife',
  target: 'es2020', plugins: [rawLoader], minify: false, sourcemap: false,
});
const code = built.outputFiles[0].text;

/* --- 2. boot ------------------------------------------------------------- */
let shellErr = null;
try {
  (0, eval)(code);
} catch (e) {
  shellErr = e;
  console.error('BOOT FAILED:', e.stack || e.message);
}
if (shellErr) process.exit(1);
console.log('✓ boot: shell constructed, domains mounted');

/* --- 3. produce a genuine snapshot from the simulation core --------------- */
const workerSrc = globalThis.__workerSource;
let snapshot = null, catalog = null;

if (!workerSrc) {
  /* file:// path — the model is already running in-page, so read it straight
     off the domain instead of standing up a second copy. */
  const cardio = globalThis.__shell.byId.get('cardio');
  snapshot = cardio.snapshot();
  catalog = globalThis.__catalogSeen || [];
  console.log('  (in-page simulation host — no Worker)');
} else {
  const sandbox = { postMessage: (m) => {
    if (m.type === 'snapshot') snapshot = m.data;
    if (m.type === 'catalog') catalog = m.pathologies;
  }, setInterval: () => 1, clearInterval: () => {}, console };
  const fn = new Function('postMessage', 'setInterval', 'clearInterval', 'console',
    workerSrc + '\n;return typeof onmessage!=="undefined"?onmessage:null;');
  sandbox.onmessage = fn(sandbox.postMessage, sandbox.setInterval, sandbox.clearInterval, console);
}
if (!snapshot) { console.error('no snapshot produced'); process.exit(1); }
console.log(`✓ sim: snapshot ok — ${Math.round(snapshot.Psys)}/${Math.round(snapshot.Pdia)}, `
  + `EF ${Math.round(snapshot.EF)}%, CO ${snapshot.CO.toFixed(1)}, ${catalog.length} pathologies`);

/* --- 4. push it through the UI ------------------------------------------- */
const w = globalThis.__worker || { onmessage: () => {} };
const push = (msg) => { if (w.onmessage) w.onmessage({ data: msg }); };
try {
  if (catalog.length) push({ type: 'catalog', pathologies: catalog });
  for (let i = 0; i < 3; i++) push({ type: 'snapshot', data: snapshot });
  console.log('✓ render: snapshot + catalog accepted');
} catch (e) {
  console.error('RENDER FAILED:', e.stack || e.message);
  process.exit(1);
}

/* --- 5. visit every workspace ------------------------------------------- */
const shell = globalThis.__shell;
if (!shell) { console.error('shell was not exposed for testing'); process.exit(1); }
let visited = 0;
for (const d of shell.domains) {
  for (const ws of d.workspaces) {
    try {
      shell.go(`${d.id}.${ws.id}`);
      push({ type: 'snapshot', data: snapshot });
      visited++;
    } catch (e) {
      console.error(`WORKSPACE ${d.id}.${ws.id} FAILED:`, e.stack || e.message);
    }
  }
}
console.log(`✓ workspaces: ${visited} visited`);

/* --- 6. exercise the runtime mechanisms --------------------------------- */
try {
  const p = shell.patient;
  const rt = shell.runtime;
  p.set('K', 7.2);
  if (!p.activeCouplings().some((c) => c.id === 'k-ecg')) throw new Error('K mechanism did not fire');
  p.set('ICP', 34);
  if (!p.activeCouplings().some((c) => c.id === 'cushing')) throw new Error('Cushing did not fire');
  const cushing = rt.cardioOverrides();
  if (cushing.HR == null && cushing.Rsys == null) throw new Error('Cushing produced no cardiac override');
  p.set('ICP', 10); // clear Cushing before isolating neurogenic shock
  p.set('K', 4.0);
  rt.dispatch({
    id: 'smoke_c5',
    type: 'condition.activate',
    payload: {
      condition: 'cervical-spinal-cord-injury',
      parameters: { level: 'C5', completeness: 1, side: 'bilateral' },
    },
    source: { type: 'test', id: 'smoke' },
  });
  const ov2 = rt.cardioOverrides();
  if (Math.abs(ov2.Rsys - 0.52) > 1e-6) throw new Error(`neurogenic shock override missing: Rsys ${ov2.Rsys}`);
  if (Math.abs(ov2.HR - 52) > 1e-6) throw new Error(`neurogenic HR missing: ${ov2.HR}`);
  console.log(`✓ mechanisms: ${p.activeCouplings().length} active, cardiac overrides ${JSON.stringify(ov2)}`);
  p.reset();
} catch (e) {
  console.error('MECHANISM FAILED:', e.stack || e.message);
}

/* --- 7. neuro localiser through the UI ----------------------------------- */
try {
  const neuro = shell.byId.get('neuro');
  neuro.applyLesion({ syndrome: 'wallenberg', side: 'R' });
  neuro.applyLesion({ nodes: ['L_cst_C5', 'R_cst_C5', 'L_ahn_C5', 'R_ahn_C5'] });
  if (shell.runtime.getActiveCordLevel() !== 'C5') throw new Error('cord level not activated on runtime');
  if (shell.patient.get('cordLevel') !== 'C5') throw new Error('cord level not projected to channels');
  console.log('✓ neuro: lesions applied, C5 injury activated via runtime');
} catch (e) {
  console.error('NEURO FAILED:', e.stack || e.message);
}

/* --- 8. theme switch ----------------------------------------------------- */
try {
  shell.toggleTheme();
  push({ type: 'snapshot', data: snapshot });
  shell.toggleTheme();
  console.log('✓ theme: both themes render');
} catch (e) {
  console.error('THEME FAILED:', e.stack || e.message);
}

/* --- 8b. case options must be human-readable ---------------------------- */
try {
  const cases = shell.byId.get('cardio').workspaces.find((w) => w.id === 'cases');
  shell.go('cardio.cases');
  const labels = [...cases.node.querySelectorAll('.opt-l')].map((n) => n.textContent);
  const sluggy = labels.filter((l) => /^[a-z0-9_]+$/.test(l));
  if (!labels.length) throw new Error('no case options rendered');
  if (sluggy.length) throw new Error('raw ids shown as labels: ' + sluggy.join(', '));
  console.log(`✓ cases: ${labels.length} options render as names (e.g. "${labels[0]}")`);
} catch (e) {
  console.error('CASES FAILED:', e.message);
}

/* --- 8c. cross-domain: circulation must write chemistry via the runtime --- */
try {
  const cardio = shell.byId.get('cardio');
  const labsDom = shell.byId.get('labs');
  /* Only the in-page host actually executes the model in this process; under
     the Worker path the stub swallows messages, so there is nothing to drive. */
  if (!workerSrc) {
  /* Clear anything earlier sections left on the patient — a cord lesion is
     still in place at this point, and neurogenic shock plus a large bleed is
     genuinely unsurvivable, which is not what this check is about. */
  shell.patient.reset();
  const simHost0 = globalThis.__sim || globalThis.__worker;
  for (let i = 0; i < 3; i++) simHost0.postMessage({ type: 'settle', seconds: 3 });
  const restored = cardio.snapshot();
  if (restored.baroEnabled !== true) throw new Error('mechanism override was not undone: baroreflex still off');
  if (Math.abs(restored.Rsys - 1.05) > 0.01) throw new Error(`mechanism override was not undone: Rsys ${restored.Rsys}`);
  console.log('✓ mechanism undo: clearing the lesion restored baroreflex and resistance');

  const before = labsDom.values();
  if (before.lactate > 1.6) throw new Error('baseline lactate already abnormal');

  // Bleed via the runtime experimental command — not a labs→cardio reach-through.
  const rt = shell.runtime;
  rt.dispatch({
    id: `smoke_bv_${Date.now()}`,
    type: 'experimental.circulation-param',
    payload: { key: 'bloodVolume', value: 3700 },
    source: { type: 'test', id: 'smoke' },
  });
  const simHost = globalThis.__sim || globalThis.__worker;
  for (let i = 0; i < 6; i++) simHost.postMessage({ type: 'settle', seconds: 4 });
  const snap2 = cardio.snapshot();
  if (!snap2 || snap2.Pmean == null) throw new Error('no snapshot after settling');
  // Snapshot ingest on the cardio host already updated chemistry; refresh the view.
  labsDom.refresh();
  const after = labsDom.values();

  if (!(after.lactate > 2.5)) throw new Error(`lactate did not rise: ${after.lactate}`);
  if (!(after.Hb < before.Hb)) throw new Error('haemoglobin did not fall');
  if (!(after.urea > before.urea)) throw new Error('urea did not rise');
  if (!(snap2.Pmean > 40)) throw new Error(`circulation collapsed at 3700 mL: MAP ${snap2.Pmean}`);
  console.log(`✓ cross-domain: haemorrhage → MAP ${Math.round(snap2.Pmean)}, CO ${snap2.CO.toFixed(1)}, `
    + `lactate ${after.lactate.toFixed(1)}, Hb ${Math.round(after.Hb)}, urea ${after.urea.toFixed(1)}`);
  rt.dispatch({
    id: `smoke_bv_restore_${Date.now()}`,
    type: 'experimental.circulation-param',
    payload: { key: 'bloodVolume', value: 5000 },
    source: { type: 'test', id: 'smoke' },
  });
  } else {
    console.log('  cross-domain: skipped (Worker path — model runs out of process)');
  }
} catch (e) {
  console.error('CROSS-DOMAIN FAILED:', e.message);
}

/* --- 9. fault injection: does a broken panel take the app down? ---------- */
{
  const before = problems.length;
  const loop = shell.byId.get('cardio').workspaces.find((w) => w.id === 'loop').view;
  const ecgView = shell.byId.get('cardio').workspaces.find((w) => w.id === 'ecg').view;
  let ecgDrew = 0;
  const realEcgDraw = ecgView.drawGrid.bind(ecgView);
  ecgView.drawGrid = () => { ecgDrew++; return realEcgDraw(); };
  loop.wiggers.draw = () => { throw new Error('injected fault: wiggers'); };

  shell.go('cardio.loop');
  let survived = true;
  try {
    for (let i = 0; i < 14; i++) push({ type: 'snapshot', data: snapshot });
  } catch (e) { survived = false; }

  shell.go('cardio.ecg');
  push({ type: 'snapshot', data: snapshot });

  const injected = problems.length - before;
  console.log(survived
    ? `✓ fault isolation: app survived a throwing panel (${injected} error(s) recorded, sibling panels still drew ${ecgDrew} times)`
    : '✗ fault isolation: a broken panel took the app down');
  if (!survived) process.exit(1);
  // the injected errors are expected — do not fail the run for them
  problems.length = before;
}

console.log(problems.length ? `\n✗ ${problems.length} problem(s)` : '\nAll checks passed.');
process.exit(problems.length ? 1 : 0);
