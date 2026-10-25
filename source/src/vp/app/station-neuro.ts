import { healthyModel, type PatientModel } from '../physiology/state.ts';
import { CATALOG } from '../data/catalog.ts';
import { FORMATTERS } from '../text/formatters.ts';
import { tr, type LocalizedText } from '../model/i18n.ts';
import { NEURO_STATION } from '../stations/station.ts';
import { NEURO_PRESETS, NEURO_PRESET_GROUPS, NEURO_STRUCTURES, applyNeuroPreset } from '../stations/neuro-presets.ts';
import { neuroObserve, neuroSignsOf, neuroSignGroups } from '../stations/neuro-signs.ts';
import { NEURO_TESTS, NEURO_TEST_BY_ID, NEURO_GROUP_LABEL, NEURO_TEST_LABEL, type NeuroTest } from '../stations/neuro-tests.ts';
import { explainNeuro } from '../stations/neuro-texts.ts';
import { neuroChartFor, neuroMotionFor } from './neuro-visual.ts';
import { neuroLadderSvg } from '../render/neuro-mechanism.ts';
import { figureLookFor } from '../render/patient-figure.ts';
import { FREE_CASE } from './free-case.ts';
import { neuroFrame, neuroViewBox, type NeuroMotion } from './neuro-motion-view.ts';
import { FaceView } from '../render/face-view.ts';
import { speechScript } from '../text/speech-script.ts';
import { EyeView } from '../render/eye-view.ts';
import { sceneFindings, type SceneControls } from '../render/eye-scene.ts';
import { REGISTRY } from '../registry.ts';
import { neuroView } from '../stations/neuro-signs.ts';
import { appearanceOf } from '../render/face-canvas.ts';
import { KNOWLEDGE, labelOf } from '../knowledge/index.ts';
import type { Lang } from './diagrams.ts';
import { patientBanner, type StationHandle, type StationOptions } from './station-ecg.ts';
import type { ExamContext, LesionProcess, Side } from '../model/types.ts';

/* ---------------------------------------------------------------------------
   The neurological station (ADR-017 decision 10, step 8a): Explore.

   A healthy adult sitting on the edge of the bed does pronator drift,
   finger–nose and the knee jerk on the bedside figure, moved by the
   examination model's finding; beside it the ladder of the nervous system
   with the lesion on it, and why. The settings are lesions of the
   nervous-system graph: nothing here decides what the limbs do. Predict
   and Identify come with step 8c.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });
const T: Record<string, LocalizedText> = {
  eyebrow: L('Station', 'Station'), back: L('Ward', 'Übersicht'),
  settings: L('What changes this examination', 'Was diese Untersuchung verändert'),
  settingsNote: L('A lesion on one rung of the nervous system. The examination model derives the rest.', 'Eine Läsion auf einer Stufe des Nervensystems. Das Untersuchungsmodell leitet den Rest ab.'),
  startFrom: L('Start from', 'Ausgangspunkt'), choose: L('Choose a lesion…', 'Läsion wählen…'), healthy: L('Reset to healthy', 'Auf gesund zurücksetzen'),
  complete: L('Complete lesion', 'Komplette Läsion'),
  process: L('What the lesion is', 'Art der Läsion'), notSaid: L('Not said', 'Nicht angegeben'),
  processNote: L('Only dying motor neurons (motor neurone disease) fasciculate; a compressed root or nerve is weak partly by conduction block, which does not waste the muscle.', 'Nur sterbende Motoneurone (Motoneuronerkrankung) faszikulieren; eine komprimierte Wurzel oder ein komprimierter Nerv ist zum Teil durch Leitungsblock schwach, der den Muskel nicht atrophieren lässt.'),
  since: L('Time since onset', 'Zeit seit Beginn'),
  sinceNote: L('A cut nerve weakens at once; its muscle wastes from about three weeks. Where some fibres survive they sprout over months and win back strength.', 'Ein durchtrennter Nerv schwächt sofort; sein Muskel atrophiert ab etwa drei Wochen. Wo Fasern überleben, sprossen sie über Monate aus und gewinnen Kraft zurück.'),
  completeNote: L('A partial lesion of the corticospinal tract leaves the arm strong enough to hold up, and drifting.', 'Eine partielle Läsion der Pyramidenbahn lässt den Arm kräftig genug, ihn zu halten, und er driftet.'),
  see: L('What you see', 'Was Sie sehen'), seeNote: L('The patient on the edge of the bed. The limbs move as the examination model’s finding says.', 'Der Patient auf der Bettkante. Die Glieder bewegen sich, wie es der Befund des Untersuchungsmodells sagt.'),
  test: L('Test', 'Test'), side: L('Side', 'Seite'), right: L('Right', 'Rechts'), left: L('Left', 'Links'),
  eyes: L('Eyes', 'Augen'), open: L('Open', 'Offen'), closed: L('Closed', 'Geschlossen'),
  signsNow: L('Signs now', 'Zeichen jetzt'), noSigns: L('none: a normal examination of these tests', 'keine: eine normale Untersuchung dieser Tests'), at: L('found with', 'gefunden mit'),
  mechanism: L('Where the lesion is', 'Wo die Läsion liegt'), diagram: L('The nervous system as a ladder, with the lesion on it', 'Das Nervensystem als Leiter, mit der Läsion darauf'),
  figure: L('The patient doing the test', 'Der Patient beim Test'),
  basis: L('The model’s reason', 'Die Begründung des Modells'),
  explore: L('Explore', 'Erkunden'), identify: L('Identify', 'Erkennen'), mode: L('Mode', 'Modus'),
  predict: L('Predict first', 'Erst vorhersagen'), predictNote: L('Choosing a starting point first asks which signs it will bring.', 'Bei der Wahl eines Ausgangspunkts fragt die Station zuerst, welche Zeichen er bringt.'),
  predictQ: L('Which signs will this lesion bring?', 'Welche Zeichen wird diese Läsion bringen?'),
  showIt: L('Show it', 'Zeigen'), cancel: L('Cancel', 'Abbrechen'),
  brought: L('It brought', 'Es brachte'), youMissed: L('Not predicted', 'Nicht vorhergesagt'), notCome: L('Predicted, did not come', 'Vorhergesagt, kam nicht'), nothing: L('nothing', 'nichts'),
  allRight: L('Every sign as you predicted.', 'Jedes Zeichen wie vorhergesagt.'),
  unknown: L('Unknown', 'Unbekannt'), unknownNote: L('A healthy adult with a hidden lesion, or none. Examine as at the bedside: every test, both sides, eyes open and closed. No findings are written for you; what the patient says, you hear.', 'Ein gesunder Erwachsener mit einer verdeckten Läsion, oder ohne. Untersuchen Sie wie am Bett: jeder Test, beide Seiten, Augen offen und geschlossen. Befunde werden Ihnen nicht vorgeschrieben; was der Patient sagt, hören Sie.'),
  nameSigns: L('Name the signs', 'Zeichen benennen'), nameSignsNote: L('Pick every sign you find. Naming one that is not there counts too.', 'Wählen Sie jedes Zeichen, das Sie finden. Ein Zeichen zu nennen, das nicht da ist, zählt auch.'),
  nameMech: L('Where is the lesion?', 'Wo liegt die Läsion?'), healthyPatient: L('No lesion: a healthy patient', 'Keine Läsion: ein gesunder Patient'), chooseMech: L('Choose…', 'Wählen…'),
  check: L('Check', 'Prüfen'), next: L('Next unknown', 'Nächstes Unbekanntes'), seeWhy: L('See why, in Explore', 'Das Warum ansehen, im Erkunden-Modus'),
  hits: L('Named, and there', 'Benannt und vorhanden'), misses: L('There, not named', 'Vorhanden, nicht benannt'), over: L('Named, not there', 'Benannt, nicht vorhanden'),
  mechRight: L('Right', 'Richtig'), mechWrong: L('It was', 'Es war'), score: L('right this session', 'richtig in dieser Sitzung'), foundWhere: L('Where each is found', 'Wo jedes zu finden ist'),
};
const SINCE: Array<[number, LocalizedText]> = [[1, L('1 day', '1 Tag')], [7, L('1 week', '1 Woche')], [14, L('2 weeks', '2 Wochen')], [30, L('1 month', '1 Monat')],
  [120, L('4 months', '4 Monate')], [180, L('6 months', '6 Monate')], [365, L('1 year', '1 Jahr')], [730, L('2 years', '2 Jahre')]];
const PROCESSES: Array<[string, LocalizedText]> = [['', L('', '')], ['infarct', L('Infarct', 'Infarkt')], ['haemorrhage', L('Haemorrhage', 'Blutung')], ['compression', L('Compression', 'Kompression')],
  ['section', L('Cut', 'Durchtrennung')], ['degeneration', L('Degeneration (motor neurone disease)', 'Degeneration (Motoneuronerkrankung)')], ['demyelination', L('Demyelination', 'Demyelinisierung')], ['inflammation', L('Inflammation', 'Entzündung')]];
const IDENTIFY_POOL = ['healthy', ...NEURO_PRESETS.map((p) => p.id)];
const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const SIDES: Side[] = ['R', 'L'];

export function mountNeuroStation(host: HTMLElement, o: StationOptions): StationHandle {
  let lang = o.lang;
  const t = (k: string) => tr(T[k], lang);
  let model: PatientModel = structuredClone(o.patient?.model ?? healthyModel());
  let test: NeuroTest = 'drift';
  let side: Side = 'R';
  let eyesClosed = false;
  let stopped = false, raf = 0, t0 = performance.now(), last = -1e9;
  const look = figureLookFor(FREE_CASE.patient, { exposure: [] } as any, 7, {});
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const signLabel = (x: string) => labelOf(KNOWLEDGE, `sign:${x}`, lang);
  const val = (ref: string, ctx: ExamContext = {}) => neuroObserve(model, ref, ctx).value as Record<string, any>;
  let mode: 'explore' | 'identify' = 'explore';
  let predict = false;
  let pending: { id: string; picked: Set<string> } | null = null;
  let feedback: { brought: string[]; took: string[]; picked: string[] } | null = null;
  const id = { pool: [] as string[], n: 0, hidden: 'healthy', named: new Set<string>(), mech: '', checked: false, right: 0, done: 0 };
  const presetLabel = (pid: string) => (pid === 'healthy' ? t('healthyPatient') : tr(NEURO_PRESETS.find((p) => p.id === pid)?.label ?? L(pid, pid), lang));
  const chips = (ids: string[], on: Set<string>, attr: string, disabled = false) => ids.map((x) =>
    `<button type="button" class="chip st-chip" ${attr}="${x}" aria-pressed="${on.has(x)}" ${disabled ? 'disabled' : ''}>${esc(signLabel(x))}</button>`).join('');
  const groupedChips = (on: Set<string>, attr: string, disabled = false) => neuroSignGroups().map((g) =>
    `<div class="st-chip-group"><div class="muted small">${esc(tr(NEURO_TEST_LABEL[g.test], lang))}</div><div class="st-chips">${chips(g.signs, on, attr, disabled)}</div></div>`).join('');

  /** the basis the model gives for this test's observations */
  const basisOf = () => { const b = new Set<string>(); for (const l of NEURO_TEST_BY_ID[test].lines()) { const x = neuroObserve(model, l.ref, l.ctx).basis; if (x) b.add(x); } return [...b]; };
  const motion = (): NeuroMotion | null => neuroMotionFor(test, val, side, eyesClosed);
  /** The side to look at first: the abnormal one. */
  const abnormalSide = (): Side => {
    const bad = (S: Side) => NEURO_TEST_BY_ID[test].lines().some((l) => l.ref.endsWith(`.${S}`) && !neuroObserve(model, l.ref, l.ctx).normal);
    return bad('R') ? 'R' : bad('L') ? 'L' : side;
  };

  const seg = (attr: string, items: Array<[string, string]>, cur: string, label: string) =>
    `<span class="seg" role="radiogroup" aria-label="${esc(label)}">${items.map(([v, lab]) => `<button type="button" role="radio" aria-checked="${v === cur}" ${attr}="${v}">${esc(lab)}</button>`).join('')}</span>`;
  const testControls = () => {
    const d = NEURO_TEST_BY_ID[test];
    const sd = d.sided ? seg('data-side', [['R', t('right')], ['L', t('left')]], side, t('side')) : '';
    const ey = d.eyes ? seg('data-eyes', [['open', t('open')], ['closed', t('closed')]], eyesClosed ? 'closed' : 'open', t('eyes')) : '';
    return sd + ey;
  };

  const head = () => `<div class="st-head">
        <button type="button" class="ghost" data-leave>← ${o.backLabel ? tr(o.backLabel, lang) : t('back')}</button>
        <div class="st-title"><div class="eyebrow">${t('eyebrow')}</div><h1>${esc(tr(NEURO_STATION.title, lang))}</h1><p class="lede">${esc(tr(NEURO_STATION.summary, lang))}</p></div>
        <span class="seg st-mode" role="radiogroup" aria-label="${t('mode')}">${(['explore', 'identify'] as const).map((m) => `<button type="button" role="radio" aria-checked="${mode === m}" data-mode="${m}">${t(m)}</button>`).join('')}</span>
      </div>
      ${mode === 'explore' ? patientBanner(o, lang) : ''}`;
  const testTabs = () => `<div class="st-test-groups">${(Object.keys(NEURO_GROUP_LABEL) as Array<keyof typeof NEURO_GROUP_LABEL>).map((g) => `<div class="st-test-group"><div class="muted small">${esc(tr(NEURO_GROUP_LABEL[g], lang))}</div><div class="st-tests" role="tablist" aria-label="${esc(tr(NEURO_GROUP_LABEL[g], lang))}">${NEURO_TESTS.filter((x) => x.group === g).map((x) => `<button type="button" role="tab" class="tog" aria-selected="${x.id === test}" data-test="${x.id}">${esc(tr(x.label, lang))}</button>`).join('')}</div></div>`).join('')}</div>`;

  const render = () => {
    if (mode === 'identify') { renderIdentify(); return; }
    const cut = new Set(model.lesions.nodes);
    host.innerHTML = `${head()}
      <div class="st-grid">
        <aside class="panel st-settings" aria-labelledby="st-set-h">
          <h2 id="st-set-h">${t('settings')}</h2>
          <p class="layer-note">${t('settingsNote')}</p>
          <label class="st-preset">${t('startFrom')}
            <select data-preset><option value="">${t('choose')}</option>${NEURO_PRESET_GROUPS.map((g) => `<optgroup label="${esc(tr(g.group, lang))}">${g.ids.map((x) => NEURO_PRESETS.find((p) => p.id === x)!).map((p) => `<option value="${p.id}">${esc(tr(p.label, lang))}</option>`).join('')}</optgroup>`).join('')}</select>
          </label>
          <button type="button" class="ghost small" data-healthy>${t('healthy')}</button>
          <label class="st-predict"><input type="checkbox" data-predict ${predict ? 'checked' : ''}><span><b>${t('predict')}</b><br><span class="muted small">${t('predictNote')}</span></span></label>
          <label class="st-var st-check"><input type="checkbox" data-complete ${model.lesions.complete ? 'checked' : ''}><span>${t('complete')}</span></label>
          <p class="muted small">${t('completeNote')}</p>
          <label class="st-preset">${t('since')}
            <select data-days>${SINCE.map(([d, lab]) => `<option value="${d}" ${(model.lesions.days ?? 1) === d ? 'selected' : ''}>${esc(tr(lab, lang))}</option>`).join('')}${SINCE.some(([d]) => d === (model.lesions.days ?? 1)) ? '' : `<option value="${model.lesions.days}" selected>${model.lesions.days} d</option>`}</select>
          </label>
          <p class="muted small">${t('sinceNote')}</p>
          <label class="st-preset">${t('process')}
            <select data-process>${PROCESSES.map(([v, lab]) => `<option value="${v}" ${(Object.values(model.lesions.process ?? {})[0] ?? '') === v ? 'selected' : ''}>${esc(v ? tr(lab, lang) : t('notSaid'))}</option>`).join('')}</select>
          </label>
          <p class="muted small">${t('processNote')}</p>
          ${NEURO_STRUCTURES.map((g) => `<fieldset class="st-lesions"><legend>${esc(tr(g.group, lang))}</legend>${g.nodes.map((n) =>
            `<label class="st-var st-check"><input type="checkbox" data-node="${n.id}" ${cut.has(n.id) ? 'checked' : ''}><span>${esc(tr(n.label, lang))}</span></label>`).join('')}</fieldset>`).join('')}
        </aside>
        <div class="st-main">
          <section class="panel st-signal" aria-labelledby="st-see-h">
            <div class="st-row"><div><h2 id="st-see-h">${t('see')}</h2><div class="muted small">${t('seeNote')}</div></div></div>
            <div data-predict-box></div>
            ${testTabs()}
            <div class="st-listen" data-test-controls>${testControls()}</div>
            <div class="neurohost" data-visual></div>
            <ul class="st-findings plain small" data-findings aria-live="polite"></ul>
            <div class="st-signs" data-signs aria-live="polite"></div>
          </section>
          <section class="panel st-why st-why-wide" aria-labelledby="st-why-h">
            <div class="st-row"><div><h2>${t('mechanism')}</h2></div></div>
            <div data-ladder aria-label="${t('diagram')}"></div>
            <div class="st-text"><h3 id="st-why-h" data-title></h3><div data-body></div></div>
          </section>
        </div>
      </div>`;
    wire();
    refresh();
    renderPredict();
    start();
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
        const pid = pending!.id, picked = [...pending!.picked], before = neuroSignsOf(model).present;
        pending = null;
        applyPreset(pid);
        const after = neuroSignsOf(model).present;
        feedback = { brought: [...after].filter((x) => !before.has(x)), took: [...before].filter((x) => !after.has(x)), picked };
        renderPredict();
      };
    } else if (feedback) {
      const f = feedback, got = new Set(f.brought);
      const right = f.picked.filter((x) => got.has(x)), missed = f.brought.filter((x) => !f.picked.includes(x)), wrong = f.picked.filter((x) => !got.has(x));
      const list = (xs: string[]) => (xs.length ? xs.map((x) => esc(signLabel(x))).join(', ') : t('nothing'));
      box.innerHTML = `<div class="st-predict-a" role="status">
        <p><b>${t('brought')}:</b> ${list(f.brought)}.</p>
        ${!missed.length && !wrong.length ? `<p class="ok">${t('allRight')}</p>` : `${missed.length ? `<p><b>${t('youMissed')}:</b> ${list(missed)}</p>` : ''}${wrong.length ? `<p><b>${t('notCome')}:</b> ${list(wrong)}</p>` : ''}`}
        ${right.length ? `<p class="muted small">✓ ${list(right)}</p>` : ''}</div>`;
    } else box.innerHTML = '';
  };
  const applyPreset = (pid: string) => {
    const p = NEURO_PRESETS.find((x) => x.id === pid)!;
    test = p.look;
    change(applyNeuroPreset(model, pid));
    const sel = host.querySelector<HTMLSelectElement>('[data-preset]');
    if (sel) sel.value = pid;
  };

  /* ---- identify ------------------------------------------------------------------------------------------------------- */
  const nextUnknown = () => {
    if (!id.pool.length) id.pool = [...IDENTIFY_POOL].sort(() => Math.random() - 0.5);
    id.hidden = id.pool.pop()!;
    id.n++; id.named = new Set(); id.mech = ''; id.checked = false;
    test = 'gait'; t0 = performance.now();
    model = applyNeuroPreset(model, id.hidden === 'healthy' ? '' : id.hidden);
  };
  const renderIdentify = () => {
    host.innerHTML = `${head()}
      <div class="st-grid">
        <aside class="panel st-settings" aria-labelledby="st-name-h">
          <h2 id="st-name-h">${t('nameSigns')}</h2>
          <p class="layer-note">${t('nameSignsNote')}</p>
          ${groupedChips(id.named, 'data-name', id.checked)}
          <label class="st-preset">${t('nameMech')}
            <select data-mech ${id.checked ? 'disabled' : ''}><option value="">${t('chooseMech')}</option><option value="healthy" ${id.mech === 'healthy' ? 'selected' : ''}>${t('healthyPatient')}</option>
            ${NEURO_PRESET_GROUPS.map((g) => `<optgroup label="${esc(tr(g.group, lang))}">${g.ids.map((x) => `<option value="${x}" ${id.mech === x ? 'selected' : ''}>${esc(presetLabel(x))}</option>`).join('')}</optgroup>`).join('')}</select>
          </label>
          ${id.checked ? `<button type="button" class="primary" data-next>${t('next')}</button>` : `<button type="button" class="primary" data-check ${id.mech ? '' : 'disabled'}>${t('check')}</button>`}
          ${id.done ? `<p class="muted small">${id.right} / ${id.done} ${t('score')}</p>` : ''}
        </aside>
        <div class="st-main">
          <section class="panel st-signal" aria-labelledby="st-unk-h">
            <div class="st-row"><div><h2 id="st-unk-h">${t('unknown')} ${id.n}</h2><div class="muted small">${t('unknownNote')}</div></div></div>
            ${testTabs()}
            <div class="st-listen" data-test-controls>${testControls()}</div>
            <div class="neurohost" data-visual></div>
            <ul class="st-findings plain small" data-findings aria-live="polite"></ul>
          </section>
          ${id.checked ? resultHtml() : ''}
        </div>
      </div>`;
    wire();
    refresh();
    start();
    host.querySelectorAll<HTMLButtonElement>('[data-name]').forEach((b) => b.onclick = () => {
      const x = b.dataset.name!; id.named.has(x) ? id.named.delete(x) : id.named.add(x);
      b.setAttribute('aria-pressed', String(id.named.has(x)));
    });
    host.querySelector<HTMLSelectElement>('[data-mech]')!.onchange = (e) => { id.mech = (e.target as HTMLSelectElement).value; const c = host.querySelector<HTMLButtonElement>('[data-check]'); if (c) c.disabled = !id.mech; };
    host.querySelector<HTMLButtonElement>('[data-check]')?.addEventListener('click', () => {
      id.checked = true; id.done++;
      const tp = neuroSignsOf(model).present;
      if (id.mech === id.hidden && [...id.named].every((x) => tp.has(x)) && [...tp].every((x) => id.named.has(x))) id.right++;
      renderIdentify();
    });
    host.querySelector<HTMLButtonElement>('[data-next]')?.addEventListener('click', () => { nextUnknown(); renderIdentify(); });
    host.querySelector<HTMLButtonElement>('[data-why]')?.addEventListener('click', () => { mode = 'explore'; render(); });
  };
  const resultHtml = () => {
    const truth = neuroSignsOf(model);
    const hits = [...id.named].filter((x) => truth.present.has(x)), misses = [...truth.present].filter((x) => !id.named.has(x)), over = [...id.named].filter((x) => !truth.present.has(x));
    const col = (title: string, xs: string[], cls: string) => `<div class="st-res ${cls}"><h3>${title}</h3>${xs.length ? `<ul>${xs.map((x) => `<li>${esc(signLabel(x))}</li>`).join('')}</ul>` : `<p class="muted small">—</p>`}</div>`;
    const right = id.mech === id.hidden;
    const where = [...truth.present].map((x) => { const w = truth.where.get(x) ?? []; return `<li><b>${esc(signLabel(x))}</b>: ${esc(w.map((m) => tr(NEURO_TEST_LABEL[m], lang)).join('; ') || tr(NEURO_TEST_LABEL.sensation, lang))}</li>`; }).join('');
    return `<section class="panel st-result" aria-labelledby="st-res-h">
      <h2 id="st-res-h" class="${right ? 'ok' : 'abn'}">${right ? t('mechRight') : t('mechWrong')}: ${esc(presetLabel(id.hidden))}</h2>
      <div class="st-res-grid">${col(t('hits'), hits, 'hit')}${col(t('misses'), misses, 'miss')}${col(t('over'), over, 'over')}</div>
      ${where ? `<div><h3 class="small">${t('foundWhere')}</h3><ul class="small">${where}</ul></div>` : ''}
      <button type="button" class="ghost" data-why>${t('seeWhy')}</button>
    </section>`;
  };

  const css = (n: string) => getComputedStyle(host).getPropertyValue(n).trim() || '#888';
  const findingLines = (): string[] => NEURO_TEST_BY_ID[test].lines().map((l) => {
    const f = neuroObserve(model, l.ref, l.ctx ?? {});
    const prop = l.ref.replace(/\.(L|R)$/, ''), S = /\.(L|R)$/.exec(l.ref)?.[1] as Side | undefined;
    const text = FORMATTERS[CATALOG.properties[prop]?.formatter ?? prop]?.(f.value, l.ctx ?? {}, lang, CATALOG, { property: prop, side: S } as any) ?? JSON.stringify(f.value);
    return `${f.normal ? '' : '<b class="abn" aria-label="abnormal">●</b> '}${l.label ? `<b>${esc(tr(l.label, lang))}</b>: ` : ''}${esc(text)}`;
  });
  const colors = () => ({ fg: css('--fg'), muted: css('--muted'), accent: css('--accent'), abn: css('--abn'), line: css('--line'), surface: css('--surface') });
  const refresh = () => {
    const box = host.querySelector<HTMLElement>('[data-findings]');
    if (!box) return;
    if (mode === 'identify') {
      /* nothing is written for the learner but what the patient says */
      box.innerHTML = '';   /* what the patient says is heard, in the picture */
      renderVisual();
      return;
    }
    box.innerHTML = findingLines().map((x) => `<li>${x}</li>`).join('');
    const r = neuroSignsOf(model);
    host.querySelector<HTMLElement>('[data-signs]')!.innerHTML = `<span class="muted small">${t('signsNow')}:</span> ${r.present.size
      ? [...r.present].map((x) => `<span class="sign" title="${esc(`${t('at')}: ${(r.where.get(x) ?? []).map((m) => tr(NEURO_TEST_LABEL[m], lang)).join('; ')}`)}">${esc(signLabel(x))}${[...(r.sides.get(x) ?? [])].length === 1 ? ` (${t([...r.sides.get(x)!][0] === 'R' ? 'right' : 'left').toLowerCase()})` : ''}</span>`).join('')
      : `<span class="muted small">${t('noSigns')}</span>`}`;
    const ex = explainNeuro(test, val);
    const basis = basisOf();
    host.querySelector<HTMLElement>('[data-title]')!.textContent = tr(ex.title, lang);
    host.querySelector<HTMLElement>('[data-body]')!.innerHTML = ex.body.map((p) => `<p>${esc(tr(p, lang))}</p>`).join('')
      + (basis.length ? `<p class="muted small"><b>${t('basis')}:</b> ${esc(basis.join('; '))}</p>` : '');
    host.querySelector<HTMLElement>('[data-ladder]')!.innerHTML = neuroLadderSvg(test, model.lesions.nodes, lang, colors(), model.lesions.extent ?? {});
    renderVisual();
  };
  const renderVisual = () => {
    current = motion();
    const vis = host.querySelector<HTMLElement>('[data-visual]')!;
    faceView?.stop(); faceView = null; eyeView?.stop(); eyeView = null;
    if (test === 'eyes') {
      /* the eye station's eyes, run through the bedside sequence: room light, dim light, then the gaze to each side and up and down */
      vis.hidden = false; vis.innerHTML = `<div class="st-eyes eyehost neuro-eyes"></div><div class="muted small" data-eye-step></div>`;
      const ev = neuroView(model), stepEl = vis.querySelector<HTMLElement>('[data-eye-step]')!;
      eyeView = new EyeView(vis.querySelector('.st-eyes')!, appearanceOf(ev.c.patient as any, 7));
      const GAZE = ['primary', 'right', 'left', 'up', 'down'] as const;
      const STEP: Record<string, LocalizedText> = { room: L('Room light: lids and pupils', 'Raumlicht: Lider und Pupillen'), dim: L('Dim light: the pupils widen', 'Dämmerlicht: die Pupillen werden weit'), primary: L('Looking ahead', 'Geradeausblick'), right: L('Looking right', 'Blick nach rechts'), left: L('Looking left', 'Blick nach links'), up: L('Looking up', 'Blick nach oben'), down: L('Looking down', 'Blick nach unten') };
      let shown = '';
      const lidCovers = (['L', 'R'] as Side[]).some((S) => (val(`eye.lid.${S}`)?.ptosisMm ?? 0) >= 4);
      const controls = (now: number): SceneControls => {
        const el = reduce ? 1 : ((now - t0) / 1000) % 22, b: SceneControls = { gaze: 'primary', fixation: true, lightOn: 'none', ambient: 'room' };
        const k = el < 4 ? 'room' : el < 8 ? 'dim' : GAZE[Math.min(4, Math.floor((el - 8) / 2.8))];
        if (k !== shown) { shown = k; stepEl.textContent = tr(STEP[k], lang); }
        /* a lid that covers the pupil is held up to watch the eye move, as the examiner does */
        return k === 'room' ? b : k === 'dim' ? { ...b, ambient: 'dim' } : { ...b, gaze: k, liftLids: lidCovers };
      };
      eyeView.show((sc) => sceneFindings(CATALOG, REGISTRY, ev.c, ev.view, sc), controls);
      current = null;
      return;
    }
    if (test === 'speech') {
      vis.hidden = false; vis.innerHTML = '<div class="facehost"></div>';
      faceView = new FaceView(vis.querySelector('.facehost')!, appearanceOf(FREE_CASE.patient as any, 7));
      faceView.talk(speechScript({ ...(val('speech.language') as any), fatigue: (val('speech.fatigue', { repetition: 50 }) as any)?.voice }, lang), lang, reduce, { L: val('face.movement.L') as any, R: val('face.movement.R') as any });
      current = null;
      return;
    }
    if (test === 'cranial') {
      /* the face and the mouth, close up: the same face view the ward uses, moved by the findings */
      vis.hidden = false; vis.innerHTML = '<div class="facehost"></div>';
      faceView = new FaceView(vis.querySelector('.facehost')!, appearanceOf(FREE_CASE.patient as any, 7));
      const fm = (S: Side) => val(`face.movement.${S}`) as any, tg = val('mouth.tongue') as any;
      faceView.show({ L: fm('L'), R: fm('R') }, lang, { jawTo: (val('jaw.opening') as any)?.deviatesTo ?? 'none', uvulaTo: (val('mouth.palate') as any)?.uvulaDeviatesTo ?? 'none', tongueTo: tg?.deviatesTo ?? 'none', tongueWasting: !!tg?.wasting, tongueFasciculation: !!tg?.fasciculation,
        shrug: { R: (val('shoulder.shrug.R') as any)?.power ?? 5, L: (val('shoulder.shrug.L') as any)?.power ?? 5 } });
      current = null;
      return;
    }
    const chart = current ? null : neuroChartFor(test, val, lang, colors());
    vis.innerHTML = current ? `<svg class="neuro-motion" viewBox="${neuroViewBox(current)}" role="img" aria-label="${t('figure')}"></svg>` : chart ?? '';
    vis.hidden = !current && !chart;
  };
  let current: NeuroMotion | null = null;
  let faceView: FaceView | null = null;
  let eyeView: EyeView | null = null;
  const STILL: Partial<Record<NeuroMotion['kind'], number>> = { drift: 12, 'finger-nose': 1.0, 'knee-jerk': 0.75, 'heel-shin': 2, 'rapid-alternating': 0.3, romberg: 10, gait: 0.8, tone: 1.5, 'arm-reflexes': 0.7, 'leg-reflexes': 0.75 };
  const start = () => {
    cancelAnimationFrame(raf);
    const svg = host.querySelector<SVGSVGElement>('svg.neuro-motion');
    if (!svg || !current) return;
    const m = current;
    if (reduce) { svg.innerHTML = neuroFrame(m, look, STILL[m.kind] ?? 1); return; }
    const step = (now: number) => {
      if (stopped || current !== m) return;
      if (now - last >= 33) { last = now; svg.innerHTML = neuroFrame(m, look, (now - t0) / 1000); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  const change = (next: PatientModel) => { model = next; side = abnormalSide(); t0 = performance.now(); render(); };
  const wire = () => {
    host.querySelector<HTMLButtonElement>('[data-leave]')!.onclick = () => { stop(); o.onLeave(); };
    host.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => b.onclick = () => {
      const m = b.dataset.mode as typeof mode;
      if (m === mode) return;
      mode = m; pending = null; feedback = null;
      if (mode === 'identify') { if (!id.n || id.checked) nextUnknown(); }
      else model = applyNeuroPreset(model, id.hidden === 'healthy' ? '' : id.hidden);   // Explore opens on the patient just identified
      render();
    });
    const sel = host.querySelector<HTMLSelectElement>('[data-preset]');
    if (sel) sel.onchange = () => {
      const pid = sel.value;
      if (!pid) return;
      if (predict) { pending = { id: pid, picked: new Set() }; feedback = null; renderPredict(); return; }
      feedback = null;
      applyPreset(pid);
    };
    const pr = host.querySelector<HTMLInputElement>('[data-predict]');
    if (pr) pr.onchange = () => { predict = pr.checked; };
    const hb = host.querySelector<HTMLButtonElement>('[data-healthy]');
    if (hb) hb.onclick = () => { pending = null; feedback = null; change(applyNeuroPreset(model, '')); };
    const ps = host.querySelector<HTMLSelectElement>('[data-process]');
    if (ps) ps.onchange = () => {
      const next = structuredClone(model);
      if (ps.value) next.lesions.process = Object.fromEntries(next.lesions.nodes.map((n) => [n, ps.value as LesionProcess])); else delete next.lesions.process;
      change(next);
    };
    const ds = host.querySelector<HTMLSelectElement>('[data-days]');
    if (ds) ds.onchange = () => { const next = structuredClone(model); next.lesions.days = Number(ds.value); change(next); };
    const cb = host.querySelector<HTMLInputElement>('[data-complete]');
    if (cb) cb.onchange = (e) => { const next = structuredClone(model); next.lesions.complete = (e.target as HTMLInputElement).checked; change(next); };
    host.querySelectorAll<HTMLInputElement>('[data-node]').forEach((el) => el.onchange = () => {
      const next = structuredClone(model), id = el.dataset.node!;
      next.lesions.nodes = el.checked ? [...new Set([...next.lesions.nodes, id])] : next.lesions.nodes.filter((x) => x !== id);
      change(next);
    });
    host.querySelectorAll<HTMLButtonElement>('[data-test]').forEach((b) => b.onclick = () => { test = b.dataset.test as NeuroTest; side = abnormalSide(); t0 = performance.now(); render(); });
    wireTestControls();
  };
  const wireTestControls = () => {
    const box = host.querySelector<HTMLElement>('[data-test-controls]')!;
    const on = (attr: string, f: (v: string) => void) => box.querySelectorAll<HTMLButtonElement>(`[${attr}]`).forEach((b) => b.onclick = () => {
      f(b.getAttribute(attr)!); t0 = performance.now();
      box.innerHTML = testControls(); wireTestControls(); refresh(); start();
    });
    on('data-side', (v) => { side = v as Side; });
    on('data-eyes', (v) => { eyesClosed = v === 'closed'; });
  };

  const stop = () => { stopped = true; cancelAnimationFrame(raf); faceView?.stop(); eyeView?.stop(); };
  side = abnormalSide();
  render();
  return { stop, setLang(l: Lang) { lang = l; render(); } };
}
