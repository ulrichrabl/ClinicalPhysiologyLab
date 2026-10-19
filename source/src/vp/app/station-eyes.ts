import { healthyModel, type PatientModel } from '../physiology/state.ts';
import { LivePatient } from '../live/live-patient.ts';
import { getPath, setPath } from '../physiology/models.ts';
import type { VariableDef } from '../physiology/types.ts';
import { CATALOG } from '../data/catalog.ts';
import { REGISTRY } from '../registry.ts';
import { observe } from '../engine/observe.ts';
import { FORMATTERS } from '../text/formatters.ts';
import { tr, type LocalizedText } from '../model/i18n.ts';
import { EYE_STATION, stationSettings } from '../stations/station.ts';
import { EYE_PRESETS, EYE_PRESET_GROUPS, EYE_STRUCTURES, EYE_LOOK_ALIKE, applyEyePreset, lookAlike } from '../stations/eye-presets.ts';
import { eyeSignsOf, eyeView, eyeContext, eyeSignGroups } from '../stations/eye-signs.ts';
import { explainEye, EYE_TESTS, EYE_TEST_LABEL, BODY_TESTS, type EyeTest } from '../stations/eye-texts.ts';
import { sceneFindings, type SceneControls, type Scene } from '../render/eye-scene.ts';
import { EyeView } from '../render/eye-view.ts';
import { appearanceOf } from '../render/face-canvas.ts';
import { drawEyeMechanism, eyeMechanismHeight, type TracePoint } from '../render/eye-mechanism.ts';
import { KNOWLEDGE, labelOf } from '../knowledge/index.ts';
import { fmtValue } from './math.ts';
import type { Lang } from './diagrams.ts';
import { patientBanner, type StationHandle, type StationOptions } from './station-ecg.ts';
import type { ExamContext, Gaze, Side } from '../model/types.ts';

/* ---------------------------------------------------------------------------
   The eye station: Explore, Predict and Identify.

   A healthy adult's face, close up, examined test by test: pupils and lids,
   the swinging light, eye movements and pursuit, the cover test, nystagmus
   behind Frenzel goggles, the head impulse, the visual fields. The eyes are
   the eye view the encounter uses, drawn from the examination model's
   findings; beside them the pathway that test reads, lit by what the
   examiner is doing now. The settings are lesions of the nervous-system
   graph and a peripheral vestibular loss: nothing here decides how the eyes
   look.

   Predict: choosing a starting point first asks which signs it will bring,
   and scores the answer once the eyes (and the body, if it changed) show
   it. Identify hides a lesion, or a healthy patient, among the starting
   points: the learner examines with every test and control, but sees no
   finding text, signs, settings or pathway, then names the signs and the
   lesion. Scoring is the knowledge tables' own: the signs the eye
   examination finds, named and there, there but not named, named but not
   there.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });
const T: Record<string, LocalizedText> = {
  eyebrow: L('Station', 'Station'), back: L('Ward', 'Übersicht'),
  settings: L('What changes these eyes', 'Was diese Augen verändert'),
  settingsNote: L('Only the model settings that change this examination.', 'Nur die Modelleinstellungen, die diese Untersuchung verändern.'),
  startFrom: L('Start from', 'Ausgangspunkt'), choose: L('Choose a lesion…', 'Läsion wählen…'), healthy: L('Reset to healthy', 'Auf gesund zurücksetzen'),
  cutByHand: L('Cut a structure', 'Eine Struktur durchtrennen'),
  see: L('What you see', 'Was Sie sehen'), seeNote: L('The patient’s face, close up. The eyes move as the examination model computes them.', 'Das Gesicht des Patienten, aus der Nähe. Die Augen bewegen sich, wie das Untersuchungsmodell sie berechnet.'),
  test: L('Test', 'Test'), found: L('Findings', 'Befunde'),
  signsNow: L('Signs now', 'Zeichen jetzt'), noSigns: L('none: a normal eye examination', 'keine: eine normale Augenuntersuchung'), at: L('found with', 'gefunden mit'), compared: L('comparing tests', 'im Vergleich der Tests'),
  mechanism: L('The pathway this test reads', 'Die Bahn, die dieser Test prüft'),
  light: L('Light', 'Licht'), off: L('Off', 'Aus'), rightEye: L('Right eye', 'Rechtes Auge'), leftEye: L('Left eye', 'Linkes Auge'), alternate: L('Alternate', 'Abwechselnd'),
  room: L('Room light', 'Raumlicht'), dim: L('Dim light', 'Halbdunkel'),
  gaze: L('Gaze', 'Blick'), auto: L('Each in turn', 'Der Reihe nach'), primary: L('Ahead', 'Geradeaus'), left: L('Left', 'Links'), right: L('Right', 'Rechts'), up: L('Up', 'Oben'), down: L('Down', 'Unten'),
  pursuit: L('Follow a moving target', 'Bewegtem Ziel folgen'),
  cover: L('Cover', 'Abdecken'), uncovered: L('None', 'Keines'), coverR: L('Right eye', 'Rechtes Auge'), coverL: L('Left eye', 'Linkes Auge'),
  frenzel: L('Frenzel goggles (no fixation)', 'Frenzel-Brille (ohne Fixation)'), fixating: L('Fixating', 'Mit Fixation'),
  turnL: L('Turn head left', 'Kopf nach links'), turnR: L('Turn head right', 'Kopf nach rechts'),
  swing: L('The light swings from eye to eye every 1.6 s.', 'Das Licht wechselt alle 1,6 s von Auge zu Auge.'),
  fieldsNote: L('Confrontation, eye by eye: the pathway shows what each eye still sees.', 'Fingerperimetrie, Auge für Auge: Die Bahn zeigt, was jedes Auge noch sieht.'),
  face: L('The patient’s eyes, close up', 'Die Augen des Patienten, aus der Nähe'),
  diagram: L('Diagram of the pathway the test reads', 'Diagramm der Bahn, die der Test prüft'),
  complete: L('Complete lesion', 'Komplette Läsion'),
  side: L('Peripheral vestibular loss: side', 'Peripherer Vestibularisausfall: Seite'), none: L('None', 'Keine'),
  lift: L('Hold the lids up', 'Lider anheben'),
  daylight: L('In daylight, the patient looking up: the sclera below the iris shows the colour best.', 'Bei Tageslicht, der Patient blickt nach oben: Die Sklera unter der Iris zeigt die Farbe am besten.'),
  pullNote: L('Your thumb draws the lower lid down; the patient looks up.', 'Ihr Daumen zieht das Unterlid herab; der Patient blickt nach oben.'),
  followDown: L('Follow my finger down', 'Meinem Finger nach unten folgen'),
  running: L('The body is being run through the illness (days to weeks of it, in a few seconds)…', 'Der Körper wird durch die Erkrankung gerechnet (Tage bis Wochen davon, in wenigen Sekunden)…'),
  explore: L('Explore', 'Erkunden'), identify: L('Identify', 'Erkennen'), mode: L('Mode', 'Modus'),
  predict: L('Predict first', 'Erst vorhersagen'), predictNote: L('Choosing a starting point first asks which signs it will bring.', 'Bei der Wahl eines Ausgangspunkts fragt die Station zuerst, welche Zeichen er bringt.'),
  predictQ: L('Which signs will this bring to the eye examination?', 'Welche Zeichen wird das in der Augenuntersuchung bringen?'),
  showIt: L('Show it', 'Zeigen'), cancel: L('Cancel', 'Abbrechen'),
  brought: L('It brought', 'Es brachte'), took: L('It took away', 'Es nahm weg'), youMissed: L('Not predicted', 'Nicht vorhergesagt'), notCome: L('Predicted, did not come', 'Vorhergesagt, kam nicht'), nothing: L('nothing', 'nichts'),
  allRight: L('Every sign as you predicted.', 'Jedes Zeichen wie vorhergesagt.'), waiting: L('Examining the new patient…', 'Der neue Patient wird untersucht…'),
  unknown: L('Unknown', 'Unbekannt'), unknownNote: L('A healthy adult with a hidden lesion, or none. Examine as you would at the bedside: every test, every control. No findings are written for you; for the visual fields, the patient tells you what they see.', 'Ein gesunder Erwachsener mit einer verdeckten Läsion, oder ohne. Untersuchen Sie wie am Bett: jeder Test, jedes Bedienelement. Befunde werden Ihnen nicht vorgeschrieben; beim Gesichtsfeld sagt Ihnen der Patient, was er sieht.'),
  preparingUnknown: L('Preparing the patient…', 'Der Patient wird vorbereitet…'),
  nameSigns: L('Name the signs', 'Zeichen benennen'), nameSignsNote: L('Pick every sign you find. Naming one that is not there counts too.', 'Wählen Sie jedes Zeichen, das Sie finden. Ein Zeichen zu nennen, das nicht da ist, zählt auch.'),
  nameMech: L('Name the lesion', 'Die Läsion benennen'), healthyPatient: L('No lesion: a healthy patient', 'Keine Läsion: ein gesunder Patient'), chooseMech: L('Choose…', 'Wählen…'),
  check: L('Check', 'Prüfen'), next: L('Next unknown', 'Nächstes Unbekanntes'), seeWhy: L('See why, in Explore', 'Das Warum ansehen, im Erkunden-Modus'),
  hits: L('Named, and there', 'Benannt und vorhanden'), misses: L('There, not named', 'Vorhanden, nicht benannt'), over: L('Named, not there', 'Benannt, nicht vorhanden'),
  mechRight: L('Right', 'Richtig'), mechWrong: L('It was', 'Es war'), score: L('right this session', 'richtig in dieser Sitzung'), foundWhere: L('Where each is found', 'Wo jedes zu finden ist'),
  patientSays: L('The patient says', 'Der Patient sagt'),
  looksSame: L('looks the same at the bedside, so it counts', 'sieht am Bett genauso aus und zählt daher'),
};
/* Identify hides every starting point and a healthy patient. */
const IDENTIFY_POOL = ['healthy', ...EYE_PRESETS.map((p) => p.id)];
const SIDE2: Side[] = ['L', 'R'];
const GAZES: Gaze[] = ['primary', 'left', 'right', 'up', 'down'];
const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

interface Controls {
  light: Side | 'none' | 'alt'; ambient: 'room' | 'dim';
  gaze: Gaze | 'auto' | 'pursuit';
  cover: Side | 'none' | 'alt'; coverGaze: Gaze;
  fixation: boolean; nysGaze: Gaze;
  impulse: { to: Side; at: number } | null;
  lift: boolean;
  thyGaze: 'auto' | 'primary' | 'down';
}

export function mountEyeStation(host: HTMLElement, o: StationOptions): StationHandle {
  let lang = o.lang;
  const t = (k: string) => tr(T[k], lang);
  let model: PatientModel = structuredClone(o.patient?.model ?? healthyModel());
  /* The body runs its course here (bilirubin, haemoglobin and thyroid hormone take days to weeks); the neurological eye
     needs none of it. Until the course has run once, the body's signs are not read. */
  let live: LivePatient | null = null, bodyGen = 0;
  const snapNow = () => (live ? live.snap as Record<string, any> : undefined);
  const chemNow = () => live?.chemistry;
  /** Run the body through the illness for the present model; the newest run wins. */
  const runBody = () => {
    const my = ++bodyGen;
    live = null;
    const lp = new LivePatient(model);
    void lp.settle(8).then(() => { if (my !== bodyGen || stopped) return; live = lp; refresh(); });
  };
  let ev = eyeView(model);
  let test: EyeTest = 'pupils';
  const k: Controls = { light: 'alt', ambient: 'room', gaze: 'auto', cover: 'alt', coverGaze: 'primary', fixation: false, nysGaze: 'primary', impulse: null, lift: false, thyGaze: 'auto' };
  let t0 = performance.now();
  let view: EyeView | null = null;
  let trace: TracePoint[] = [];
  let ctxCache = eyeContext(model);
  let stopped = false;
  const settings = stationSettings(EYE_STATION);
  const open = new Set<string>(['nervous-system/lesions']);
  const signLabel = (x: string) => labelOf(KNOWLEDGE, `sign:${x}`, lang);
  let mode: 'explore' | 'identify' = 'explore';
  let predict = false;
  let pending: { id: string; picked: Set<string> } | null = null;
  let awaiting: { before: Set<string>; picked: string[] } | null = null;
  let feedback: { brought: string[]; took: string[]; picked: string[] } | null = null;
  const id: { pool: string[]; n: number; hidden: string; truth: ReturnType<typeof eyeSignsOf> | null; named: Set<string>; mech: string; checked: boolean; right: number; done: number } =
    { pool: [], n: 0, hidden: 'healthy', truth: null, named: new Set(), mech: '', checked: false, right: 0, done: 0 };
  const presetLabel = (pid: string) => (pid === 'healthy' ? t('healthyPatient') : tr(EYE_PRESETS.find((p) => p.id === pid)?.label ?? L(pid, pid), lang));
  const signsNow = () => eyeSignsOf(model, snapNow(), chemNow());
  const manoeuvreLabel = (m: string) => tr(CATALOG.manoeuvres[m]?.label ?? L(m, m), lang);

  /* what the examiner is doing now, as the eye view's controls */
  const controls = (now: number): SceneControls => {
    const el = Math.max(0, (now - t0) / 1000);
    const b: SceneControls = { gaze: 'primary', fixation: true, lightOn: 'none', ambient: 'room', cover: null, liftLids: k.lift };
    switch (test) {
      case 'pupils': return { ...b, ambient: k.ambient, lightOn: k.light === 'alt' ? (el % 6 < 2.4 ? 'R' : el % 6 >= 3 && el % 6 < 5.4 ? 'L' : 'none') : k.light };
      case 'swinging': return { ...b, lightOn: Math.floor(el / 1.6) % 2 ? 'L' : 'R' };
      case 'movements':
        if (k.gaze === 'pursuit') return { ...b, pursuit: el };
        return { ...b, gaze: k.gaze === 'auto' ? GAZES[Math.floor(el / 2.5) % 5] : k.gaze };
      case 'cover': return { ...b, gaze: k.coverGaze, cover: k.cover === 'alt' ? (Math.floor(el / 1.6) % 2 ? 'L' : 'R') : k.cover === 'none' ? null : k.cover };
      case 'nystagmus': return { ...b, fixation: k.fixation, gaze: k.nysGaze };
      case 'impulse': {
        /* an impulse every 2.4 s, alternating sides, unless the learner just asked for one */
        if (k.impulse && (now - k.impulse.at) / 1000 < 2.4) return { ...b, impulse: { to: k.impulse.to, t: (now - k.impulse.at) / 1000 } };
        const n = Math.floor(el / 2.4), ph = el % 2.4;
        return { ...b, impulse: ph < 1 ? { to: n % 2 ? 'R' : 'L', t: ph } : undefined };
      }
      case 'fields': return b;
      case 'sclera': return { ...b, gaze: 'up' };
      case 'conjunctiva': return { ...b, gaze: 'up', pullLowerLids: 1 };
      case 'thyroid': return { ...b, gaze: k.thyGaze === 'auto' ? (Math.floor(el / 2.5) % 2 ? 'down' : 'primary') : k.thyGaze };
    }
  };

  const head = () => `<div class="st-head">
        <button type="button" class="ghost" data-leave>← ${o.backLabel ? tr(o.backLabel, lang) : t('back')}</button>
        <div class="st-title"><div class="eyebrow">${t('eyebrow')}</div><h1>${esc(tr(EYE_STATION.title, lang))}</h1><p class="lede">${esc(tr(EYE_STATION.summary, lang))}</p></div>
        <span class="seg st-mode" role="radiogroup" aria-label="${t('mode')}">${(['explore', 'identify'] as const).map((m) => `<button type="button" role="radio" aria-checked="${mode === m}" data-mode="${m}">${t(m)}</button>`).join('')}</span>
      </div>
      ${mode === 'explore' ? patientBanner(o, lang) : ''}`;
  const testTabs = () => `<div class="st-tests" role="tablist" aria-label="${t('test')}">${EYE_TESTS.map((x) => `<button type="button" role="tab" class="tog" aria-selected="${x === test}" data-test="${x}">${esc(tr(EYE_TEST_LABEL[x], lang))}</button>`).join('')}</div>`;
  const chips = (ids: string[], on: Set<string>, attr: string, disabled = false) => ids.map((x) =>
    `<button type="button" class="chip st-chip" ${attr}="${x}" aria-pressed="${on.has(x)}" ${disabled ? 'disabled' : ''}>${esc(signLabel(x))}</button>`).join('');
  /* the signs grouped by the test that shows them */
  const groupedChips = (on: Set<string>, attr: string, disabled = false) => eyeSignGroups().map((g) =>
    `<div class="st-chip-group"><div class="muted small">${esc(tr(EYE_TEST_LABEL[g.test], lang))}</div><div class="st-chips">${chips(g.signs, on, attr, disabled)}</div></div>`).join('');
  const seg = (attr: string, items: Array<[string, string]>, cur: string, label: string) =>
    `<span class="seg" role="radiogroup" aria-label="${esc(label)}">${items.map(([v, lab]) => `<button type="button" role="radio" aria-checked="${v === cur}" ${attr}="${v}">${esc(lab)}</button>`).join('')}</span>`;
  const liftBox = () => `<label class="st-check st-lift"><input type="checkbox" data-lift ${k.lift ? 'checked' : ''}> ${t('lift')}</label>`;
  const testControls = () => {
    const lift = test === 'pupils' || test === 'movements' || test === 'cover' || test === 'swinging' ? liftBox() : '';
    return lift + testControlsOf();
  };
  const testControlsOf = () => {
    switch (test) {
      case 'pupils': return `${seg('data-light', [['alt', t('alternate')], ['none', t('off')], ['R', t('rightEye')], ['L', t('leftEye')]], k.light, t('light'))}
        ${seg('data-ambient', [['room', t('room')], ['dim', t('dim')]], k.ambient, t('light'))}`;
      case 'swinging': return `<span class="muted small">${t('swing')}</span>`;
      case 'movements': return seg('data-gaze', [['auto', t('auto')], ...GAZES.map((g) => [g, t(g)] as [string, string]), ['pursuit', t('pursuit')]], k.gaze, t('gaze'));
      case 'cover': return `${seg('data-cover', [['alt', t('alternate')], ['none', t('uncovered')], ['R', t('coverR')], ['L', t('coverL')]], k.cover, t('cover'))}
        ${seg('data-cgaze', (['up', 'primary', 'down'] as Gaze[]).map((g) => [g, t(g)] as [string, string]), k.coverGaze, t('gaze'))}`;
      case 'nystagmus': return `${seg('data-fix', [['0', t('frenzel')], ['1', t('fixating')]], k.fixation ? '1' : '0', t('frenzel'))}
        ${seg('data-ngaze', (['left', 'primary', 'right', 'up', 'down'] as Gaze[]).map((g) => [g, t(g)] as [string, string]), k.nysGaze, t('gaze'))}`;
      case 'impulse': return `<span class="st-row-buttons"><button type="button" class="ghost" data-hit="L">${t('turnL')}</button><button type="button" class="ghost" data-hit="R">${t('turnR')}</button></span>`;
      case 'fields': return `<span class="muted small">${t('fieldsNote')}</span>`;
      case 'sclera': return `<span class="muted small">${t('daylight')}</span>`;
      case 'conjunctiva': return `<span class="muted small">${t('pullNote')}</span>`;
      case 'thyroid': return seg('data-tgaze', [['auto', t('auto')], ['primary', t('primary')], ['down', t('followDown')]], k.thyGaze, t('gaze'));
    }
  };

  const render = () => {
    if (mode === 'identify') { renderIdentify(); return; }
    host.innerHTML = `${head()}
      <div class="st-grid">
        <aside class="panel st-settings" aria-labelledby="st-set-h">
          <h2 id="st-set-h">${t('settings')}</h2>
          <p class="layer-note">${t('settingsNote')}</p>
          <label class="st-preset">${t('startFrom')}
            <select data-preset><option value="">${t('choose')}</option>${EYE_PRESET_GROUPS.map((g) => `<optgroup label="${esc(tr(g.group, lang))}">${g.ids.map((id) => EYE_PRESETS.find((p) => p.id === id)!).map((p) => `<option value="${p.id}">${esc(tr(p.label, lang))}</option>`).join('')}</optgroup>`).join('')}</select>
          </label>
          <button type="button" class="ghost small" data-healthy>${t('healthy')}</button>
          <label class="st-predict"><input type="checkbox" data-predict ${predict ? 'checked' : ''}><span><b>${t('predict')}</b><br><span class="muted small">${t('predictNote')}</span></span></label>
          <div data-controls></div>
        </aside>
        <div class="st-main">
          <section class="panel st-signal" aria-labelledby="st-see-h">
            <div class="st-row"><div><h2 id="st-see-h">${t('see')}</h2><div class="muted small">${t('seeNote')}</div></div></div>
            <div data-predict-box></div>
            ${testTabs()}
            <div class="st-listen" data-test-controls>${testControls()}</div>
            <p class="muted small" data-running role="status" ${BODY_TESTS.includes(test) && !snapNow() ? '' : 'hidden'}>${t('running')}</p>
            <div class="eyehost st-eyes" role="img" aria-label="${t('face')}"></div>
            <ul class="st-findings plain small" data-findings aria-live="polite"></ul>
            <div class="st-signs" data-signs aria-live="polite"></div>
          </section>
          <section class="panel st-why st-why-wide" aria-labelledby="st-why-h">
            <div class="st-row"><div><h2>${t('mechanism')}</h2></div></div>
            <canvas class="st-mech" aria-label="${t('diagram')}"></canvas>
            <div class="st-text"><h3 id="st-why-h" data-title></h3><div data-body></div></div>
          </section>
        </div>
      </div>`;
    renderControls();
    wire();
    startView();
    renderFindings();
    renderPredict();
  };

  /* ---- predict -------------------------------------------------------------------------------------------------------- */
  const renderPredict = () => {
    const box = host.querySelector<HTMLElement>('[data-predict-box]');
    if (!box) return;
    if (pending) {
      box.innerHTML = `<div class="st-predict-q" role="group" aria-label="${t('predictQ')}">
        <div class="eyebrow">${t('predict')} · ${esc(presetLabel(pending.id))}</div>
        <p><b>${t('predictQ')}</b></p>
        ${groupedChips(pending.picked, 'data-pick')}
        <div class="st-row-buttons"><button type="button" class="primary" data-go>${t('showIt')}</button><button type="button" class="ghost" data-cancel>${t('cancel')}</button></div></div>`;
      box.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => b.onclick = () => {
        const x = b.dataset.pick!; pending!.picked.has(x) ? pending!.picked.delete(x) : pending!.picked.add(x);
        b.setAttribute('aria-pressed', String(pending!.picked.has(x)));
      });
      box.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick = () => { pending = null; host.querySelector<HTMLSelectElement>('[data-preset]')!.value = ''; renderPredict(); };
      box.querySelector<HTMLButtonElement>('[data-go]')!.onclick = () => {
        const pid = pending!.id;
        awaiting = { before: signsNow().present, picked: [...pending!.picked] };
        pending = null; feedback = null;
        applyPreset(pid);
      };
    } else if (awaiting) box.innerHTML = `<p class="muted">${t('waiting')}</p>`;
    else if (feedback) {
      const f = feedback, got = new Set(f.brought);
      const right = f.picked.filter((x) => got.has(x)), missed = f.brought.filter((x) => !f.picked.includes(x)), wrong = f.picked.filter((x) => !got.has(x));
      const list = (xs: string[]) => (xs.length ? xs.map((x) => esc(signLabel(x))).join(', ') : t('nothing'));
      box.innerHTML = `<div class="st-predict-a" role="status">
        <p><b>${t('brought')}:</b> ${list(f.brought)}${f.took.length ? `. <b>${t('took')}:</b> ${list(f.took)}` : ''}.</p>
        ${!missed.length && !wrong.length ? `<p class="ok">${t('allRight')}</p>` : `${missed.length ? `<p><b>${t('youMissed')}:</b> ${list(missed)}</p>` : ''}${wrong.length ? `<p><b>${t('notCome')}:</b> ${list(wrong)}</p>` : ''}`}
        ${right.length ? `<p class="muted small">✓ ${list(right)}</p>` : ''}</div>`;
    } else box.innerHTML = '';
  };
  /** Once the eyes (and the body, if it changed) show the new patient, the prediction is scored. */
  const resolvePrediction = () => {
    if (!awaiting || !snapNow()) return;
    const after = signsNow().present, a = awaiting;
    awaiting = null;
    feedback = { brought: [...after].filter((x) => !a.before.has(x)), took: [...a.before].filter((x) => !after.has(x)), picked: a.picked };
    renderPredict();
  };
  const applyPreset = (pid: string) => {
    const p = EYE_PRESETS.find((x) => x.id === pid);
    change(applyEyePreset(model, pid));
    if (p) { test = p.look; t0 = performance.now(); k.lift = SIDE2.some((S) => ctxCache.s.ptosisMm[S] >= 7); }
    render();
    const sel = host.querySelector<HTMLSelectElement>('[data-preset]');
    if (sel) sel.value = pid;
    resolvePrediction();
  };

  /* ---- identify ------------------------------------------------------------------------------------------------------- */
  const nextUnknown = () => {
    if (!id.pool.length) id.pool = [...IDENTIFY_POOL].sort(() => Math.random() - 0.5);
    id.hidden = id.pool.pop()!;
    id.n++; id.truth = null; id.named = new Set(); id.mech = ''; id.checked = false;
    test = 'pupils'; t0 = performance.now(); k.lift = false;
    model = applyEyePreset(model, id.hidden === 'healthy' ? '' : id.hidden);
    /* every unknown runs the body, so how long it takes says nothing about what it is */
    runBody();
    refresh();
  };
  const renderIdentify = () => {
    const ready = !!id.truth;
    host.innerHTML = `${head()}
      <div class="st-grid">
        <aside class="panel st-settings" aria-labelledby="st-name-h">
          <h2 id="st-name-h">${t('nameSigns')}</h2>
          <p class="layer-note">${t('nameSignsNote')}</p>
          ${groupedChips(id.named, 'data-name', id.checked)}
          <label class="st-preset">${t('nameMech')}
            <select data-mech ${id.checked ? 'disabled' : ''}><option value="">${t('chooseMech')}</option><option value="healthy" ${id.mech === 'healthy' ? 'selected' : ''}>${t('healthyPatient')}</option>
            ${EYE_PRESET_GROUPS.map((g) => `<optgroup label="${esc(tr(g.group, lang))}">${g.ids.map((x) => `<option value="${x}" ${id.mech === x ? 'selected' : ''}>${esc(presetLabel(x))}</option>`).join('')}</optgroup>`).join('')}</select>
          </label>
          ${id.checked ? `<button type="button" class="primary" data-next>${t('next')}</button>` : `<button type="button" class="primary" data-check ${ready && id.mech ? '' : 'disabled'}>${t('check')}</button>`}
          ${id.done ? `<p class="muted small">${id.right} / ${id.done} ${t('score')}</p>` : ''}
        </aside>
        <div class="st-main">
          <section class="panel st-signal" aria-labelledby="st-unk-h">
            <div class="st-row"><div><h2 id="st-unk-h">${t('unknown')} ${id.n}</h2><div class="muted small">${t('unknownNote')}</div></div></div>
            ${ready ? '' : `<p class="muted" data-recording role="status">${t('preparingUnknown')}</p>`}
            ${testTabs()}
            <div class="st-listen" data-test-controls>${testControls()}</div>
            <div class="eyehost st-eyes" role="img" aria-label="${t('face')}"></div>
            <ul class="st-findings plain small" data-findings aria-live="polite"></ul>
          </section>
          ${id.checked ? resultHtml() : ''}
        </div>
      </div>`;
    wire();
    startView();
    renderFindings();
    host.querySelectorAll<HTMLButtonElement>('[data-name]').forEach((b) => b.onclick = () => {
      const x = b.dataset.name!; id.named.has(x) ? id.named.delete(x) : id.named.add(x);
      b.setAttribute('aria-pressed', String(id.named.has(x)));
    });
    host.querySelector<HTMLSelectElement>('[data-mech]')!.onchange = (e) => { id.mech = (e.target as HTMLSelectElement).value; const c = host.querySelector<HTMLButtonElement>('[data-check]'); if (c) c.disabled = !(id.truth && id.mech); };
    host.querySelector<HTMLButtonElement>('[data-check]')?.addEventListener('click', () => {
      id.checked = true; id.done++;
      const tp = id.truth!.present;
      if (lookAlike(id.mech, id.hidden) && [...id.named].every((x) => tp.has(x)) && [...tp].every((x) => id.named.has(x))) id.right++;
      renderIdentify();
    });
    host.querySelector<HTMLButtonElement>('[data-next]')?.addEventListener('click', () => { nextUnknown(); renderIdentify(); });
    host.querySelector<HTMLButtonElement>('[data-why]')?.addEventListener('click', () => { mode = 'explore'; render(); });
  };
  const resultHtml = () => {
    const truth = id.truth!;
    const hits = [...id.named].filter((x) => truth.present.has(x)), misses = [...truth.present].filter((x) => !id.named.has(x)), over = [...id.named].filter((x) => !truth.present.has(x));
    const col = (title: string, xs: string[], cls: string) => `<div class="st-res ${cls}"><h3>${title}</h3>${xs.length ? `<ul>${xs.map((x) => `<li>${esc(signLabel(x))}</li>`).join('')}</ul>` : `<p class="muted small">—</p>`}</div>`;
    const right = lookAlike(id.mech, id.hidden);
    const alike = right && id.mech !== id.hidden ? EYE_LOOK_ALIKE.find((g) => g.ids.includes(id.hidden)) : undefined;
    const where = [...truth.present].map((x) => { const w = truth.where.get(x) ?? []; return `<li><b>${esc(signLabel(x))}</b>: ${esc(w.length ? w.map(manoeuvreLabel).join('; ') : t('compared'))}</li>`; }).join('');
    return `<section class="panel st-result" aria-labelledby="st-res-h">
      <h2 id="st-res-h" class="${right ? 'ok' : 'abn'}">${right ? t('mechRight') : t('mechWrong')}: ${esc(presetLabel(id.hidden))}</h2>
      ${alike ? `<p class="muted small">${esc(presetLabel(id.mech))} ${t('looksSame')}: ${esc(tr(alike.why, lang))}</p>` : ''}
      <div class="st-res-grid">${col(t('hits'), hits, 'hit')}${col(t('misses'), misses, 'miss')}${col(t('over'), over, 'over')}</div>
      ${where ? `<div><h3 class="small">${t('foundWhere')}</h3><ul class="small">${where}</ul></div>` : ''}
      <button type="button" class="ghost" data-why>${t('seeWhy')}</button>
    </section>`;
  };

  /* ---- settings ----------------------------------------------------------------------------------------------------------- */
  const renderControls = () => {
    const box = host.querySelector<HTMLElement>('[data-controls]')!;
    const cut = new Set(model.lesions.nodes);
    const control = (v: VariableDef) => {
      const val = getPath(model, v.key);
      const label = esc(tr(v.label, lang));
      if (v.control === 'lesions') return EYE_STRUCTURES.map((g) => `<fieldset class="st-lesions"><legend>${esc(tr(g.group, lang))}</legend>${g.nodes.map((n) =>
        `<label class="st-var st-check"><input type="checkbox" data-node="${n.id}" ${cut.has(n.id) ? 'checked' : ''}><span>${esc(tr(n.label, lang))}</span></label>`).join('')}</fieldset>`).join('');
      if (v.control === 'toggle') return `<label class="st-var st-check"><input type="checkbox" data-k="${v.key}" ${val ? 'checked' : ''}><span>${label}</span></label>`;
      if (v.control === 'side') return `<label class="st-var"><span>${label}</span><select data-k="${v.key}">${([['none', t('none')], ['L', t('left')], ['R', t('right')]] as const).map(([x, lab]) => `<option value="${x}" ${x === val ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select></label>`;
      return `<label class="st-var"><span>${label} <output data-out="${v.key}">${esc(fmtValue(v, val, lang))} ${esc(v.unit)}</output></span>
        <input type="range" data-k="${v.key}" min="${v.min}" max="${v.max}" step="${v.step}" value="${Number(val)}"></label>`;
    };
    box.innerHTML = settings.map((g) => `<details class="grp" data-sec="${g.id}" ${open.has(g.id) ? 'open' : ''}><summary>${esc(tr(g.label, lang))}</summary>
      ${g.why ? `<p class="muted small">${esc(tr(g.why, lang))}</p>` : ''}${g.vars.map(control).join('')}</details>`).join('');
    box.querySelectorAll<HTMLDetailsElement>('details[data-sec]').forEach((d) => d.addEventListener('toggle', () => { d.open ? open.add(d.dataset.sec!) : open.delete(d.dataset.sec!); }));
    box.querySelectorAll<HTMLInputElement>('[data-node]').forEach((el) => el.addEventListener('change', () => {
      const next = structuredClone(model), id = el.dataset.node!;
      next.lesions.nodes = el.checked ? [...new Set([...next.lesions.nodes, id])] : next.lesions.nodes.filter((x) => x !== id);
      change(next);
    }));
    box.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-k]').forEach((el) => {
      const key = el.dataset.k!;
      const handler = () => {
        let v: unknown;
        if (el instanceof HTMLInputElement && el.type === 'checkbox') v = el.checked;
        else if (el instanceof HTMLInputElement) v = Number(el.value);
        else v = el.value;
        const next = structuredClone(model);
        setPath(next, key, v);
        change(next);
        const out = box.querySelector<HTMLOutputElement>(`[data-out="${CSS.escape(key)}"]`);
        const def = settings.flatMap((g) => g.vars).find((x) => x.key === key);
        if (out && def) out.textContent = `${fmtValue(def, v as number, lang)} ${def.unit}`;
      };
      el.addEventListener(el instanceof HTMLInputElement && el.type === 'range' ? 'input' : 'change', handler);
    });
  };
  const change = (next: PatientModel) => {
    const bodyMoved = JSON.stringify(next.body) !== JSON.stringify(model.body);
    model = next;
    if (bodyMoved) runBody();   // the course runs again; the body's signs return when it has
    refresh();
  };
  const refresh = () => {
    const snap = snapNow();
    ev = eyeView(model, snap, chemNow());
    ctxCache = eyeContext(model, snap, chemNow());
    view?.invalidate();
    renderFindings();
    const run = host.querySelector<HTMLElement>('[data-running]');
    if (run) run.hidden = !(BODY_TESTS.includes(test) && !snap);
    resolvePrediction();
    if (mode === 'identify' && !id.truth && snap) { id.truth = signsNow(); renderIdentify(); }
  };
  runBody();

  /* ---- the eyes and the pathway --------------------------------------------------------------------------------------- */
  const css = (n: string) => getComputedStyle(host).getPropertyValue(n).trim() || '#888';
  const startView = () => {
    view?.stop();
    const eh = host.querySelector<HTMLElement>('.st-eyes')!;
    view = new EyeView(eh, appearanceOf(ev.c.patient as any, 7));
    trace = [];
    const canvas = host.querySelector<HTMLCanvasElement>('.st-mech');
    const colors = { fg: css('--fg'), muted: css('--muted'), accent: css('--accent'), abn: css('--abn'), line: css('--line'), surface: css('--surface'), light: '#e8a317' };
    view.show((sc) => sceneFindings(CATALOG, REGISTRY, ev.c, ev.view, sc), controls, (sc: Scene, kk: SceneControls, now: number) => {
      if (stopped) return;
      trace.push({ t: now / 1000, h: sc.R.h, v: sc.R.v, head: sc.head, vR: sc.R.v, vL: sc.L.v });
      while (trace.length && trace[0].t < now / 1000 - 8) trace.shift();
      if (!canvas) return;   // Identify draws no pathway
      const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth || 600, h = eyeMechanismHeight(test, w);
      if (canvas.style.height !== `${h}px`) canvas.style.height = `${h}px`;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      const g = canvas.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawEyeMechanism(g, w, h, { test, s: ctxCache.s, lesions: new Set(model.lesions.nodes), controls: kk, scene: sc, trace, verticalPD: ctxCache.verticalPD, gain: ctxCache.gain,
        body: ctxCache.body, findings: ctxCache.findings, lang, colors });
    });
  };

  /* what the examiner would write down for this test, as the encounter words it */
  const findingLines = (): string[] => {
    const o = (ref: string, ctx: ExamContext = {}) => {
      const f = observe(CATALOG, REGISTRY.resolvers, ev.c, ev.view, ref, ctx);
      const prop = ref.replace(/\.(L|R)$/, ''), side = /\.(L|R)$/.exec(ref)?.[1] as Side | undefined;
      const text = FORMATTERS[CATALOG.properties[prop]?.formatter ?? prop]?.(f.value, ctx, lang, CATALOG, { property: prop, side } as any) ?? JSON.stringify(f.value);
      return { text, normal: f.normal };
    };
    const side = (S: Side) => (S === 'L' ? t('leftEye') : t('rightEye'));
    const line = (label: string | null, r: { text: string; normal: boolean }) => `${r.normal ? '' : '<b class="abn" aria-label="abnormal">●</b> '}${label ? `<b>${esc(label)}</b>: ` : ''}${esc(r.text)}`;
    const out: string[] = [];
    switch (test) {
      case 'pupils':
        for (const S of ['R', 'L'] as Side[]) out.push(line(null, o(`eye.pupil.${S}`, { lightOn: 'none', ambient: 'room' })));
        for (const S of ['R', 'L'] as Side[]) out.push(line(null, o(`eye.pupil.${S}`, { lightOn: 'none', ambient: 'dim' })));
        for (const lit of ['R', 'L'] as Side[]) for (const S of ['R', 'L'] as Side[]) out.push(line(`${t('light')} → ${side(lit)}`, o(`eye.pupil.${S}`, { lightOn: lit, ambient: 'room' })));
        for (const S of ['R', 'L'] as Side[]) out.push(line(null, o(`eye.lid.${S}`)));
        break;
      case 'swinging': out.push(line(null, o('eyes.swinging-light'))); break;
      case 'movements':
        for (const S of ['R', 'L'] as Side[]) out.push(line(null, o(`eye.motility.${S}`)));
        for (const g of GAZES) out.push(line(null, o('eyes.nystagmus', { gaze: g, fixation: true })));
        out.push(line(null, o('eyes.pursuit')));
        break;
      case 'cover': for (const g of ['up', 'primary', 'down'] as Gaze[]) out.push(line(t(g), o('eyes.alignment', { gaze: g }))); break;
      case 'nystagmus': for (const g of ['left', 'primary', 'right'] as Gaze[]) out.push(line(null, o('eyes.nystagmus', { gaze: g, fixation: false }))); break;
      case 'impulse': for (const S of ['L', 'R'] as Side[]) out.push(line(null, o(`eye.head-impulse.${S}`, { headImpulseTo: S }))); break;
      case 'fields': for (const S of ['R', 'L'] as Side[]) out.push(line(null, o(`eye.field.${S}`))); break;
      case 'sclera': if (snapNow()) out.push(line(tr(CATALOG.properties['eyes.sclera'].label, lang), o('eyes.sclera'))); break;
      case 'conjunctiva': if (snapNow()) out.push(line(tr(CATALOG.properties['eyes.conjunctiva'].label, lang), o('eyes.conjunctiva'))); break;
      case 'thyroid': if (snapNow()) out.push(line(null, o('eyes.thyroid'))); break;
    }
    return out;
  };
  const renderFindings = () => {
    const box = host.querySelector<HTMLElement>('[data-findings]');
    if (!box) return;
    if (mode === 'identify') {
      /* the eyes show everything but the fields, which only the patient can report */
      box.innerHTML = test === 'fields' && id.truth ? `<li><b>${t('patientSays')}:</b></li>${findingLines().map((x) => `<li>${x.replace(/<b class="abn"[^>]*>●<\/b> /, '')}</li>`).join('')}` : '';
      return;
    }
    box.innerHTML = findingLines().map((x) => `<li>${x}</li>`).join('');
    const snap = snapNow();
    const r = eyeSignsOf(model, snap, chemNow());
    const sb = host.querySelector<HTMLElement>('[data-signs]')!;
    sb.innerHTML = `<span class="muted small">${t('signsNow')}:</span> ${r.present.size
      ? [...r.present].map((x) => { const w = r.where.get(x) ?? []; return `<span class="sign" title="${esc(`${t('at')}: ${w.length ? w.map(manoeuvreLabel).join('; ') : t('compared')}`)}">${esc(signLabel(x))}</span>`; }).join('')
      : `<span class="muted small">${t('noSigns')}</span>`}`;
    const ex = explainEye(test, ctxCache);
    host.querySelector<HTMLElement>('[data-title]')!.textContent = tr(ex.title, lang);
    host.querySelector<HTMLElement>('[data-body]')!.innerHTML = ex.body.map((p) => `<p>${esc(tr(p, lang))}</p>`).join('');
  };

  const wire = () => {
    host.querySelector<HTMLButtonElement>('[data-leave]')!.onclick = () => { stop(); o.onLeave(); };
    host.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => b.onclick = () => {
      const m = b.dataset.mode as typeof mode;
      if (m === mode) return;
      mode = m; pending = null; awaiting = null; feedback = null;
      if (mode === 'identify') { if (!id.n || id.checked) nextUnknown(); }
      else change(applyEyePreset(model, id.hidden === 'healthy' ? '' : id.hidden));   // Explore opens on the patient just identified
      render();
    });
    const sel = host.querySelector<HTMLSelectElement>('[data-preset]');
    if (sel) sel.onchange = () => {
      const pid = sel.value;
      if (!pid) return;
      if (predict) { pending = { id: pid, picked: new Set() }; awaiting = null; feedback = null; renderPredict(); return; }
      feedback = null;
      applyPreset(pid);
    };
    const pr = host.querySelector<HTMLInputElement>('[data-predict]');
    if (pr) pr.onchange = () => { predict = pr.checked; };
    const hb = host.querySelector<HTMLButtonElement>('[data-healthy]');
    if (hb) hb.onclick = () => { pending = null; feedback = null; change(applyEyePreset(model, '')); render(); };
    host.querySelectorAll<HTMLButtonElement>('[data-test]').forEach((b) => b.onclick = () => { test = b.dataset.test as EyeTest; t0 = performance.now(); mode === 'identify' ? renderIdentify() : render(); });
    wireTestControls();
  };
  const wireTestControls = () => {
    const box = host.querySelector<HTMLElement>('[data-test-controls]')!;
    const on = (attr: string, f: (v: string) => void) => box.querySelectorAll<HTMLButtonElement>(`[${attr}]`).forEach((b) => b.onclick = () => {
      f(b.getAttribute(attr)!); t0 = performance.now();
      box.innerHTML = testControls(); wireTestControls();
    });
    on('data-light', (v) => { k.light = v as Controls['light']; });
    on('data-ambient', (v) => { k.ambient = v as Controls['ambient']; });
    on('data-gaze', (v) => { k.gaze = v as Controls['gaze']; });
    on('data-cover', (v) => { k.cover = v as Controls['cover']; });
    on('data-cgaze', (v) => { k.coverGaze = v as Gaze; });
    on('data-fix', (v) => { k.fixation = v === '1'; });
    on('data-ngaze', (v) => { k.nysGaze = v as Gaze; });
    on('data-tgaze', (v) => { k.thyGaze = v as Controls['thyGaze']; });
    const lb = box.querySelector<HTMLInputElement>('[data-lift]');
    if (lb) lb.onchange = () => { k.lift = lb.checked; };
    box.querySelectorAll<HTMLButtonElement>('[data-hit]').forEach((b) => b.onclick = () => { k.impulse = { to: b.dataset.hit as Side, at: performance.now() }; });
  };

  const stop = () => { stopped = true; view?.stop(); bodyGen++; };
  render();
  return {
    stop,
    setLang(l: Lang) { lang = l; render(); },
  };
}
