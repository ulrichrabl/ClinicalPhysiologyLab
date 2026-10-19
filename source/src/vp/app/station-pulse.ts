import { LivePatient, type BeatRecord } from '../live/live-patient.ts';
import { healthyModel } from '../physiology/state.ts';
import { getPath, setPath } from '../physiology/models.ts';
import type { VariableDef } from '../physiology/types.ts';
import { CATALOG } from '../data/catalog.ts';
import { REGISTRY } from '../registry.ts';
import { observe } from '../engine/observe.ts';
import { buildView } from '../engine/view.ts';
import { FREE_CASE } from './free-case.ts';
import { caseWithModel } from '../physiology/state.ts';
import { FORMATTERS } from '../text/formatters.ts';
import { tr, type LocalizedText } from '../model/i18n.ts';
import { PULSE_STATION, stationSettings } from '../stations/station.ts';
import { PULSE_PRESETS, PULSE_PRESET_GROUPS, applyPulsePreset } from '../stations/pulse-presets.ts';
import { pulseSignsOf, pulseSignGroups } from '../stations/pulse-signs.ts';
import { explainPulse } from '../stations/pulse-texts.ts';
import { drawPulseStrip, pulseStripHeight, drawBeat, beatHeight, drawNeck, neckHeight, type PulseColors } from '../render/pulse-strip.ts';
import { arterialWave, type WaveSample } from '../../domains/cardio/sim/waves.ts';
import { KNOWLEDGE, labelOf } from '../knowledge/index.ts';
import { fmtValue } from './math.ts';
import type { Lang } from './diagrams.ts';
import { patientBanner, type StationHandle, type StationOptions } from './station-ecg.ts';
import type { ExamContext } from '../model/types.ts';

/* ---------------------------------------------------------------------------
   The pulse and neck-vein station: Explore, Predict and Identify.

   A healthy adult's circulation runs here. The signal is what the finger
   feels at the wrist and the carotid and what the eye sees in the neck:
   the last seconds of arterial and right atrial pressure, beat by beat,
   each beat's venous waves named where the model made them, and the
   jugular column at 45° rising and falling with the atrium now. The
   mechanism is one beat in detail. The findings are the examination
   model's, read from these same beats.

   Predict asks which signs a starting point will bring and scores the
   answer once the circulation has settled. Identify hides one (or a
   healthy patient): the learner has the pulse and the neck as at the
   bedside, without the ECG, the named waves, the findings or the beat in
   detail, and names the signs and the patient.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });
const T: Record<string, LocalizedText> = {
  eyebrow: L('Station', 'Station'), back: L('Ward', 'Übersicht'),
  preparing: L('Preparing the circulation…', 'Der Kreislauf wird vorbereitet…'),
  settings: L('What moves the pulse and the neck veins', 'Was Puls und Halsvenen verändert'),
  settingsNote: L('Only the model settings that change these tests.', 'Nur die Modelleinstellungen, die diese Tests verändern.'),
  startFrom: L('Start from', 'Ausgangspunkt'), choose: L('Choose a patient…', 'Patienten wählen…'), healthy: L('Reset to healthy', 'Auf gesund zurücksetzen'),
  feel: L('What you feel and see', 'Was Sie fühlen und sehen'),
  feelNote: L('The last seconds of the circulation’s own beats: arterial pressure (the pulse under the finger) and right atrial pressure (the column in the neck), with the ECG.', 'Die letzten Sekunden der eigenen Schläge des Kreislaufs: arterieller Druck (der Puls unter dem Finger) und rechter Vorhofdruck (die Säule am Hals), mit dem EKG.'),
  neck: L('The neck at 45°', 'Der Hals in 45°'),
  beat: L('One beat in detail', 'Ein Schlag im Detail'), beatNote: L('Tap a beat in the strip to see it here.', 'Tippen Sie auf einen Schlag im Streifen, um ihn hier zu sehen.'),
  ecg: L('ECG', 'EKG'), art: L('Artery', 'Arterie'), ven: L('Right atrium', 'Rechter Vorhof'), mmHg: L('mmHg', 'mmHg'),
  aorta: L('Aorta', 'Aorta'), lv: L('Left ventricle', 'Linker Ventrikel'), ra: L('Right atrium', 'Rechter Vorhof'), rv: L('Right ventricle', 'Rechter Ventrikel'),
  atria: L('atria contracting', 'Vorhöfe kontrahieren'), raShort: L('right atrium', 'rechter Vorhof'),
  angle: L('sternal angle', 'Angulus sterni'), above: L('above the sternal angle', 'über dem Angulus sterni'), notSeen: L('Column below the sternal angle: not seen at 45°', 'Säule unter dem Angulus sterni: in 45° nicht zu sehen'), ear: L('ear', 'Ohr'), cm: L('cm', 'cm'),
  play: L('Play', 'Abspielen'), pause: L('Pause', 'Anhalten'),
  signsNow: L('Signs now', 'Jetzt vorhandene Zeichen'), noSigns: L('none: a normal pulse and neck veins', 'keine: normaler Puls und normale Halsvenen'), at: L('found with', 'gefunden mit'),
  settling: L('The circulation is settling into its new state…', 'Der Kreislauf stellt sich auf den neuen Zustand ein…'),
  strip: L('Arterial and right atrial pressure over the last seconds, with the ECG. Tap a beat to see it in detail.', 'Arterieller und rechter Vorhofdruck der letzten Sekunden, mit EKG. Einen Schlag antippen, um ihn im Detail zu sehen.'),
  neckDiagram: L('The patient at 45°, from the side: the jugular column rising and falling with the right atrium', 'Der Patient in 45°, von der Seite: die Jugularsäule hebt und senkt sich mit dem rechten Vorhof'),
  beatDiagram: L('One beat: aorta and left ventricle above, right atrium below, with the valve events and the venous waves', 'Ein Schlag: Aorta und linker Ventrikel oben, rechter Vorhof unten, mit Klappenereignissen und Venenwellen'),
  explore: L('Explore', 'Erkunden'), identify: L('Identify', 'Erkennen'), mode: L('Mode', 'Modus'),
  predict: L('Predict first', 'Erst vorhersagen'), predictNote: L('Choosing a patient first asks which signs it will bring.', 'Bei der Wahl eines Patienten fragt die Station zuerst, welche Zeichen er bringt.'),
  predictQ: L('Which signs will this bring to the pulse and the neck?', 'Welche Zeichen wird das an Puls und Hals bringen?'),
  showIt: L('Show it', 'Zeigen'), cancel: L('Cancel', 'Abbrechen'),
  brought: L('It brought', 'Es brachte'), took: L('It took away', 'Es nahm weg'), youMissed: L('Not predicted', 'Nicht vorhergesagt'), notCome: L('Predicted, did not come', 'Vorhergesagt, kam nicht'), nothing: L('nothing', 'nichts'),
  allRight: L('Every sign as you predicted.', 'Jedes Zeichen wie vorhergesagt.'), waiting: L('Examining the new patient…', 'Der neue Patient wird untersucht…'),
  unknown: L('Unknown', 'Unbekannt'), unknownNote: L('A healthy adult with a hidden change, or none. You have what the bedside gives: the pulse under your finger and the neck at 45°. No ECG, no named waves, no findings written for you.', 'Ein gesunder Erwachsener mit einer verdeckten Veränderung, oder ohne. Sie haben, was das Bett gibt: den Puls unter dem Finger und den Hals in 45°. Kein EKG, keine benannten Wellen, keine vorgeschriebenen Befunde.'),
  preparingUnknown: L('Preparing the patient…', 'Der Patient wird vorbereitet…'),
  nameSigns: L('Name the signs', 'Zeichen benennen'), nameSignsNote: L('Pick every sign you find. Naming one that is not there counts too.', 'Wählen Sie jedes Zeichen, das Sie finden. Ein Zeichen zu nennen, das nicht da ist, zählt auch.'),
  nameMech: L('Name the patient', 'Den Patienten benennen'), healthyPatient: L('A healthy patient', 'Ein gesunder Patient'), chooseMech: L('Choose…', 'Wählen…'),
  check: L('Check', 'Prüfen'), next: L('Next unknown', 'Nächstes Unbekanntes'), seeWhy: L('See why, in Explore', 'Das Warum ansehen, im Erkunden-Modus'),
  hits: L('Named, and there', 'Benannt und vorhanden'), misses: L('There, not named', 'Vorhanden, nicht benannt'), over: L('Named, not there', 'Benannt, nicht vorhanden'),
  mechRight: L('Right', 'Richtig'), mechWrong: L('It was', 'Es war'), score: L('right this session', 'richtig in dieser Sitzung'), foundWhere: L('Where each is found', 'Wo jedes zu finden ist'),
};
/* Identify hides every starting point and a healthy patient. */
const IDENTIFY_POOL = ['healthy', ...PULSE_PRESETS.map((p) => p.id)];
const EV: Record<string, LocalizedText> = { AO: L('AO', 'AÖ'), AC: L('AC', 'AS'), TC: L('TC', 'TS'), TO: L('TO', 'TÖ') };
const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const SECONDS = (w: number) => (w < 600 ? 4 : 6);

export function mountPulseStation(host: HTMLElement, o: StationOptions): StationHandle {
  let lang = o.lang;
  const t = (k: string) => tr(T[k], lang);
  const healthy = healthyModel();
  const live = new LivePatient(o.patient?.model ?? healthy);
  let raf = 0, stopped = false, ready = false, playing = true;
  let frozen: BeatRecord[] | null = null;
  let picked: number | null = null;   // t0 of the beat shown in detail
  let textKey = '', signsTick = 0, findTick = 0;
  let settleUntil = 0;
  /** the JVP as the examination reads it (the label on the neck uses the same number as the finding) */
  let jvpCm: number | null = null;
  const SETTLE_S = 20, SETTLE_SPEED = 8;
  const settings = stationSettings(PULSE_STATION);
  const open = new Set<string>(['haemodynamics/valves']);
  const beats = () => frozen ?? live.beats;
  const signLabel = (x: string) => labelOf(KNOWLEDGE, `sign:${x}`, lang);
  const manoeuvreLabel = (m: string) => tr(CATALOG.manoeuvres[m]?.label ?? L(m, m), lang);
  let mode: 'explore' | 'identify' = 'explore';
  let predict = false;
  let pending: { id: string; picked: Set<string> } | null = null;
  let awaiting: { before: Set<string>; picked: string[] } | null = null;
  let feedback: { brought: string[]; took: string[]; picked: string[] } | null = null;
  const id: { pool: string[]; n: number; hidden: string; truth: ReturnType<typeof pulseSignsOf> | null; named: Set<string>; mech: string; checked: boolean; right: number; done: number } =
    { pool: [], n: 0, hidden: 'healthy', truth: null, named: new Set(), mech: '', checked: false, right: 0, done: 0 };
  const presetLabel = (pid: string) => (pid === 'healthy' ? t('healthyPatient') : tr(PULSE_PRESETS.find((p) => p.id === pid)?.label ?? L(pid, pid), lang));
  const signsNow = () => pulseSignsOf(live.model, live.snap as any, live.chemistry);
  const head = () => `<div class="st-head">
        <button type="button" class="ghost" data-leave>← ${o.backLabel ? tr(o.backLabel, lang) : t('back')}</button>
        <div class="st-title"><div class="eyebrow">${t('eyebrow')}</div><h1>${esc(tr(PULSE_STATION.title, lang))}</h1><p class="lede">${esc(tr(PULSE_STATION.summary, lang))}</p></div>
        <span class="seg st-mode" role="radiogroup" aria-label="${t('mode')}">${(['explore', 'identify'] as const).map((m) => `<button type="button" role="radio" aria-checked="${mode === m}" data-mode="${m}">${t(m)}</button>`).join('')}</span>
      </div>
      ${mode === 'explore' ? patientBanner(o, lang) : ''}
      ${ready ? '' : `<p class="muted" data-preparing>${t('preparing')}</p>`}`;
  const chips = (ids: string[], on: Set<string>, attr: string, disabled = false) => ids.map((x) =>
    `<button type="button" class="chip st-chip" ${attr}="${x}" aria-pressed="${on.has(x)}" ${disabled ? 'disabled' : ''}>${esc(signLabel(x))}</button>`).join('');
  const groupedChips = (on: Set<string>, attr: string, disabled = false) => pulseSignGroups().map((g) =>
    `<div class="st-chip-group"><div class="muted small">${esc(manoeuvreLabel(g.test))}</div><div class="st-chips">${chips(g.signs, on, attr, disabled)}</div></div>`).join('');

  const render = () => {
    if (mode === 'identify') { renderIdentify(); return; }
    host.innerHTML = `${head()}
      <div class="st-grid">
        <aside class="panel st-settings" aria-labelledby="st-set-h">
          <h2 id="st-set-h">${t('settings')}</h2>
          <p class="layer-note">${t('settingsNote')}</p>
          <label class="st-preset">${t('startFrom')}
            <select data-preset><option value="">${t('choose')}</option>${PULSE_PRESET_GROUPS.map((g) => `<optgroup label="${esc(tr(g.group, lang))}">${g.ids.map((id) => PULSE_PRESETS.find((p) => p.id === id)!).map((p) => `<option value="${p.id}">${esc(tr(p.label, lang))}</option>`).join('')}</optgroup>`).join('')}</select>
          </label>
          <button type="button" class="ghost small" data-healthy>${t('healthy')}</button>
          <label class="st-predict"><input type="checkbox" data-predict ${predict ? 'checked' : ''}><span><b>${t('predict')}</b><br><span class="muted small">${t('predictNote')}</span></span></label>
          <div data-controls></div>
        </aside>
        <div class="st-main">
          <section class="panel st-signal" aria-labelledby="st-feel-h">
            <div class="st-row"><div><h2 id="st-feel-h">${t('feel')}</h2><div class="muted small">${t('feelNote')}</div></div>
              <button type="button" class="ghost" data-play>${t('pause')}</button></div>
            <ul class="st-findings plain small" data-findings aria-live="polite"></ul>
            <div class="st-signs" data-signs aria-live="polite"></div>
            <span class="st-note" role="status" data-note></span>
            <div data-predict-box></div>
            <div class="st-pulse-row">
              <canvas class="st-strip" tabindex="0" aria-label="${t('strip')}"></canvas>
              <figure class="st-neck"><canvas class="st-neck-c" aria-label="${t('neckDiagram')}"></canvas><figcaption class="muted small">${t('neck')}</figcaption></figure>
            </div>
          </section>
          <section class="panel st-why st-why-wide" aria-labelledby="st-beat-h">
            <div class="st-row"><div><h2 id="st-beat-h">${t('beat')}</h2><div class="muted small">${t('beatNote')}</div></div></div>
            <canvas class="st-beat" aria-label="${t('beatDiagram')}"></canvas>
            <div class="st-text" data-text></div>
          </section>
        </div>
      </div>`;
    renderControls();
    wire();
    renderPredict();
    textKey = ''; signsTick = 0; findTick = 0;
  };

  /* ---- predict -------------------------------------------------------------------------------- */
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
        awaiting = { before: signsNow().present, picked: [...pending!.picked] };
        const pid = pending!.id;
        pending = null; feedback = null;
        change(applyPulsePreset(live.model, healthy.circulation, pid), true);
        renderPredict();
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

  /* ---- identify ------------------------------------------------------------------------------- */
  const nextUnknown = () => {
    if (!id.pool.length) id.pool = [...IDENTIFY_POOL].sort(() => Math.random() - 0.5);
    id.hidden = id.pool.pop()!;
    id.n++; id.truth = null; id.named = new Set(); id.mech = ''; id.checked = false;
    change(id.hidden === 'healthy' ? healthyModel() : applyPulsePreset(healthyModel(), healthy.circulation, id.hidden), false);
  };
  const renderIdentify = () => {
    const ready2 = !!id.truth;
    host.innerHTML = `${head()}
      <div class="st-grid">
        <aside class="panel st-settings" aria-labelledby="st-name-h">
          <h2 id="st-name-h">${t('nameSigns')}</h2>
          <p class="layer-note">${t('nameSignsNote')}</p>
          ${groupedChips(id.named, 'data-name', id.checked)}
          <label class="st-preset">${t('nameMech')}
            <select data-mech ${id.checked ? 'disabled' : ''}><option value="">${t('chooseMech')}</option><option value="healthy" ${id.mech === 'healthy' ? 'selected' : ''}>${t('healthyPatient')}</option>
            ${PULSE_PRESET_GROUPS.map((g) => `<optgroup label="${esc(tr(g.group, lang))}">${g.ids.map((x) => `<option value="${x}" ${id.mech === x ? 'selected' : ''}>${esc(presetLabel(x))}</option>`).join('')}</optgroup>`).join('')}</select>
          </label>
          ${id.checked ? `<button type="button" class="primary" data-next>${t('next')}</button>` : `<button type="button" class="primary" data-check ${ready2 && id.mech ? '' : 'disabled'}>${t('check')}</button>`}
          ${id.done ? `<p class="muted small">${id.right} / ${id.done} ${t('score')}</p>` : ''}
        </aside>
        <div class="st-main">
          <section class="panel st-signal" aria-labelledby="st-unk-h">
            <div class="st-row"><div><h2 id="st-unk-h">${t('unknown')} ${id.n}</h2><div class="muted small">${t('unknownNote')}</div></div>
              <button type="button" class="ghost" data-play>${playing ? t('pause') : t('play')}</button></div>
            ${ready2 ? '' : `<p class="muted" data-recording role="status">${t('preparingUnknown')}</p>`}
            <div class="st-pulse-row">
              <canvas class="st-strip" tabindex="0" aria-label="${t('strip')}"></canvas>
              <figure class="st-neck"><canvas class="st-neck-c" aria-label="${t('neckDiagram')}"></canvas><figcaption class="muted small">${t('neck')}</figcaption></figure>
            </div>
          </section>
          ${id.checked ? resultHtml() : ''}
        </div>
      </div>`;
    wireCommon();
    host.querySelectorAll<HTMLButtonElement>('[data-name]').forEach((b) => b.onclick = () => {
      const x = b.dataset.name!; id.named.has(x) ? id.named.delete(x) : id.named.add(x);
      b.setAttribute('aria-pressed', String(id.named.has(x)));
    });
    host.querySelector<HTMLSelectElement>('[data-mech]')!.onchange = (e) => { id.mech = (e.target as HTMLSelectElement).value; const c = host.querySelector<HTMLButtonElement>('[data-check]'); if (c) c.disabled = !(id.truth && id.mech); };
    host.querySelector<HTMLButtonElement>('[data-check]')?.addEventListener('click', () => {
      id.checked = true; id.done++;
      const tp = id.truth!.present;
      if (id.mech === id.hidden && [...id.named].every((x) => tp.has(x)) && [...tp].every((x) => id.named.has(x))) id.right++;
      renderIdentify();
    });
    host.querySelector<HTMLButtonElement>('[data-next]')?.addEventListener('click', () => { nextUnknown(); renderIdentify(); });
    host.querySelector<HTMLButtonElement>('[data-why]')?.addEventListener('click', () => { mode = 'explore'; playing = true; frozen = null; render(); });
  };
  const resultHtml = () => {
    const truth = id.truth!;
    const hits = [...id.named].filter((x) => truth.present.has(x)), misses = [...truth.present].filter((x) => !id.named.has(x)), over = [...id.named].filter((x) => !truth.present.has(x));
    const col = (title: string, xs: string[], cls: string) => `<div class="st-res ${cls}"><h3>${title}</h3>${xs.length ? `<ul>${xs.map((x) => `<li>${esc(signLabel(x))}</li>`).join('')}</ul>` : `<p class="muted small">—</p>`}</div>`;
    const right = id.mech === id.hidden;
    const where = [...truth.present].map((x) => `<li><b>${esc(signLabel(x))}</b>: ${esc((truth.where.get(x) ?? []).map(manoeuvreLabel).join('; '))}</li>`).join('');
    return `<section class="panel st-result" aria-labelledby="st-res-h">
      <h2 id="st-res-h" class="${right ? 'ok' : 'abn'}">${right ? t('mechRight') : t('mechWrong')}: ${esc(presetLabel(id.hidden))}</h2>
      <div class="st-res-grid">${col(t('hits'), hits, 'hit')}${col(t('misses'), misses, 'miss')}${col(t('over'), over, 'over')}</div>
      ${where ? `<div><h3 class="small">${t('foundWhere')}</h3><ul class="small">${where}</ul></div>` : ''}
      <button type="button" class="ghost" data-why>${t('seeWhy')}</button>
    </section>`;
  };

  /* ---- settings ------------------------------------------------------------------------------ */
  const renderControls = () => {
    const box = host.querySelector<HTMLElement>('[data-controls]')!;
    const m = live.model;
    const control = (v: VariableDef) => {
      const val = getPath(m, v.key);
      const label = esc(tr(v.label, lang));
      if (v.control === 'enum') return `<label class="st-var"><span>${label}</span><select data-k="${v.key}">${(v.options ?? []).map((op) => `<option value="${esc(op.value)}" ${op.value === val ? 'selected' : ''}>${esc(tr(op.label, lang))}</option>`).join('')}</select></label>`;
      if (v.control === 'toggle') return `<label class="st-var st-check"><input type="checkbox" data-k="${v.key}" ${val ? 'checked' : ''}><span>${label}</span></label>`;
      return `<label class="st-var"><span>${label} <output data-out="${v.key}">${esc(fmtValue(v, val, lang))} ${esc(v.unit)}</output></span>
        <input type="range" data-k="${v.key}" min="${v.min}" max="${v.max}" step="${v.step}" value="${Number(val)}"></label>`;
    };
    box.innerHTML = settings.map((g) => `<details class="grp" data-sec="${g.id}" ${open.has(g.id) ? 'open' : ''}><summary>${esc(tr(g.label, lang))}</summary>
      ${g.why ? `<p class="muted small">${esc(tr(g.why, lang))}</p>` : ''}${g.vars.map(control).join('')}</details>`).join('');
    box.querySelectorAll<HTMLDetailsElement>('details[data-sec]').forEach((d) => d.addEventListener('toggle', () => { d.open ? open.add(d.dataset.sec!) : open.delete(d.dataset.sec!); }));
    box.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-k]').forEach((el) => {
      const key = el.dataset.k!;
      el.addEventListener(el instanceof HTMLInputElement && el.type === 'range' ? 'input' : 'change', () => {
        let v: unknown;
        if (el instanceof HTMLInputElement && el.type === 'checkbox') { const cur = getPath(live.model, key); v = typeof cur === 'boolean' ? el.checked : el.checked ? 1 : 0; }
        else if (el instanceof HTMLInputElement) v = Number(el.value);
        else v = el.value;
        const next = structuredClone(live.model);
        setPath(next, key, v);
        change(next, false);
        const out = box.querySelector<HTMLOutputElement>(`[data-out="${CSS.escape(key)}"]`);
        const def = settings.flatMap((g) => g.vars).find((x) => x.key === key);
        if (out && def) out.textContent = `${fmtValue(def, v as number, lang)} ${def.unit}`;
      });
    });
  };
  /* After a change the circulation is run ahead quickly through its settling, so what is felt is the new steady state. */
  const change = (next: ReturnType<typeof healthyModel>, rerenderControls: boolean) => {
    live.setModel(next);
    settleUntil = live.t + SETTLE_S; live.speed = SETTLE_SPEED; note(t('settling'));
    playing = true; frozen = null; picked = null; textKey = ''; signsTick = 0; findTick = 0; jvpCm = null;
    if (rerenderControls) renderControls();
    syncPlay();
  };

  const note = (x: string) => { const n = host.querySelector<HTMLElement>('[data-note]'); if (n) n.textContent = x; };
  const syncPlay = () => { const b = host.querySelector<HTMLButtonElement>('[data-play]'); if (b) b.textContent = playing ? t('pause') : t('play'); };
  const span = () => { const bs = beats(); const last = bs.at(-1); const to = last ? last.t0 + last.dur : 0; const w = host.querySelector<HTMLElement>('.st-strip')?.clientWidth ?? 800; return { from: to - SECONDS(w) * 1000, to }; };
  const wireCommon = () => {
    host.querySelector<HTMLButtonElement>('[data-leave]')!.onclick = () => o.onLeave();
    host.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => b.onclick = () => {
      const m = b.dataset.mode as typeof mode;
      if (m === mode) return;
      mode = m; pending = null; awaiting = null; feedback = null;
      if (mode === 'identify') { if (!id.n || id.checked) nextUnknown(); } else { playing = true; frozen = null; }
      render();
    });
    host.querySelector<HTMLButtonElement>('[data-play]')!.onclick = () => {
      if (playing) { frozen = live.beats.map((b) => b); playing = false; } else { playing = true; frozen = null; picked = null; }
      syncPlay();
    };
    const strip = host.querySelector<HTMLCanvasElement>('.st-strip')!;
    strip.addEventListener('pointerdown', (ev) => {
      const r = strip.getBoundingClientRect(), { from, to } = span();
      const tt = from + ((ev.clientX - r.left - 40) / (r.width - 48)) * (to - from);
      const b = beats().find((x) => tt >= x.t0 && tt < x.t0 + x.dur);
      if (!b) return;
      if (playing) { frozen = live.beats.map((x) => x); playing = false; syncPlay(); }
      picked = b.t0; textKey = '';
    });
  };
  const wire = () => {
    wireCommon();
    host.querySelector<HTMLSelectElement>('[data-preset]')!.onchange = (e) => {
      const pid = (e.target as HTMLSelectElement).value;
      if (!pid) return;
      if (predict) { pending = { id: pid, picked: new Set() }; feedback = null; renderPredict(); return; }
      feedback = null;
      change(applyPulsePreset(live.model, healthy.circulation, pid), true);
    };
    host.querySelector<HTMLInputElement>('[data-predict]')!.onchange = (e) => { predict = (e.target as HTMLInputElement).checked; pending = null; renderPredict(); };
    host.querySelector<HTMLButtonElement>('[data-healthy]')!.onclick = () => { pending = null; feedback = null; change(healthyModel(), true); host.querySelector<HTMLSelectElement>('[data-preset]')!.value = ''; };
  };

  /* ---- what the examination finds, from the same beats ---------------------------------------- */
  const view = () => { const c = caseWithModel(FREE_CASE, live.model); return { c, v: buildView(c, { circulation: live.snap, chemistry: live.chemistry }) }; };
  const finding = (ref: string, ctx: ExamContext = {}) => {
    const { c, v } = view();
    const f = observe(CATALOG, REGISTRY.resolvers, c, v, ref, ctx);
    const prop = ref.replace(/\.(L|R)$/, ''), side = /\.(L|R)$/.exec(ref)?.[1];
    const text = FORMATTERS[CATALOG.properties[prop]?.formatter ?? prop]?.(f.value, ctx, lang, CATALOG, { property: prop, side } as any) ?? JSON.stringify(f.value);
    return { value: f.value as any, text, normal: f.normal };
  };
  const renderFindings = () => {
    const box = host.querySelector<HTMLElement>('[data-findings]');
    if (!box) return;
    const rows: Array<[string, ReturnType<typeof finding>]> = [
      [tr(CATALOG.manoeuvres['palpate.pulse.radial'].label, lang), finding('pulse.radial.R')],
      [tr(CATALOG.manoeuvres['palpate.pulse.carotid'].label, lang), finding('pulse.carotid.R')],
      [tr(CATALOG.manoeuvres['inspect.jvp'].label, lang), finding('jvp', { position: 'reclined-45' })],
    ];
    jvpCm = typeof rows[2][1].value?.heightCm === 'number' ? rows[2][1].value.heightCm : null;
    box.innerHTML = rows.map(([lab, r]) => `<li>${r.normal ? '' : '<b class="abn" aria-label="abnormal">●</b> '}<b>${esc(lab)}</b>: ${esc(r.text)}</li>`).join('');
  };
  const renderSigns = () => {
    const box = host.querySelector<HTMLElement>('[data-signs]');
    if (!box) return;
    const r = pulseSignsOf(live.model, live.snap as any, live.chemistry);
    box.innerHTML = `<span class="muted small">${t('signsNow')}:</span> ${r.present.size
      ? [...r.present].map((x) => `<span class="sign" title="${esc(`${t('at')}: ${(r.where.get(x) ?? []).map(manoeuvreLabel).join('; ')}`)}">${esc(signLabel(x))}</span>`).join('')
      : `<span class="muted small">${t('noSigns')}</span>`}`;
  };

  /* ---- drawing --------------------------------------------------------------------------------- */
  const css = (n: string) => getComputedStyle(host).getPropertyValue(n).trim() || '#888';
  const sizeCanvas = (c: HTMLCanvasElement, h: number) => {
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth;
    if (c.style.height !== `${h}px`) c.style.height = `${h}px`;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    return { g, w };
  };
  const frame = () => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    if (!ready) return;
    if (settleUntil && live.t >= settleUntil) {
      settleUntil = 0; live.speed = 1; note(''); signsTick = 0; findTick = 0; textKey = '';
      if (awaiting) {
        const after = signsNow().present, a = awaiting;
        feedback = { brought: [...after].filter((x) => !a.before.has(x)), took: [...a.before].filter((x) => !after.has(x)), picked: a.picked };
        awaiting = null; renderPredict();
      }
      if (mode === 'identify' && !id.truth) {
        id.truth = signsNow();
        host.querySelector('[data-recording]')?.remove();
        const c = host.querySelector<HTMLButtonElement>('[data-check]'); if (c) c.disabled = !id.mech;
      }
    }
    if (mode === 'explore' && !settleUntil && findTick-- <= 0) { renderFindings(); findTick = 45; }
    if (mode === 'explore' && !settleUntil && signsTick-- <= 0) { renderSigns(); signsTick = 120; }
    if (mode === 'identify' && !id.truth) return;
    const bs = beats();
    if (bs.length < 2) return;
    const colors: PulseColors = { fg: css('--fg'), muted: css('--muted'), accent: css('--accent'), abn: css('--abn'), line: css('--line'), surface: css('--surface'), ven: '#3f6fb5', art: '#c0392b' };
    const strip = host.querySelector<HTMLCanvasElement>('.st-strip'), neck = host.querySelector<HTMLCanvasElement>('.st-neck-c'), bc = host.querySelector<HTMLCanvasElement>('.st-beat');
    if (!strip || !neck) return;
    const { from, to } = span();
    const sw = strip.clientWidth, sh = pulseStripHeight(sw);
    drawPulseStrip(sizeCanvas(strip, sh).g, sw, sh, bs.filter((b) => b.t0 + b.dur > from), from, to, colors, { ecg: t('ecg'), art: t('art'), ven: t('ven'), mmHg: t('mmHg') }, { blind: mode === 'identify' });
    const nw = neck.clientWidth, nh = neckHeight(nw);
    /* the neck follows the right atrium now; paused, it shows the mean of the beat in detail */
    const beat = (picked != null ? bs.find((b) => b.t0 === picked) : null) ?? bs.at(-1)!;
    const beatMean = beat.samples.reduce((a, s) => a + s.Pra, 0) / beat.samples.length;
    const praMean = !playing || jvpCm == null ? beatMean : (jvpCm + 5) / 1.36;
    const pra = playing ? (live.snap.Pra as number) : beatMean;
    drawNeck(sizeCanvas(neck, nh).g, nw, nh, pra, praMean, colors, { angle: t('angle'), above: t('above'), notSeen: t('notSeen'), ear: t('ear'), cm: t('cm'), ra: t('raShort') });
    if (!bc) return;
    if (mode === 'identify') jvpCm = null;
    const bw = bc.clientWidth, bh = beatHeight(bw);
    drawBeat(sizeCanvas(bc, bh).g, bw, bh, beat, colors, { aorta: t('aorta'), lv: t('lv'), ra: t('ra'), rv: t('rv'), atria: t('atria'), ms: t('mmHg'), ev: Object.fromEntries(Object.entries(EV).map(([k, v]) => [k, tr(v, lang)])) });
    // the words: rewritten only when what they describe changes
    const key = JSON.stringify([lang, settleUntil > 0, Math.round((live.snap.metricsBreath?.Psys ?? 0) / 3), live.model.electrical, live.model.circulation]);
    if (key !== textKey && !settleUntil) {
      textKey = key;
      const mt = live.snap.metricsBreath ?? live.snap.metrics ?? {};
      const pulse = finding('pulse.radial.R').value ?? {}, carotid = finding('pulse.carotid.R').value ?? {}, jvp = finding('jvp', { position: 'reclined-45' }).value ?? {};
      const aw = arterialWave(beat.samples as unknown as WaveSample[]);
      const texts = explainPulse({
        pulse: { rate: pulse.rate ?? 72, rhythm: pulse.rhythm ?? 'regular', volume: pulse.volume ?? 'normal', character: carotid.character !== 'normal' ? carotid.character : pulse.character ?? 'normal' },
        jvp: { heightCm: jvp.heightCm ?? 0, waveform: jvp.waveform ?? 'normal' },
        m: { sys: mt.Psys ?? 120, dia: mt.Pdia ?? 75, sv: mt.SV ?? 70, gradient: mt.aorticGradient ?? 0, regurgFraction: mt.regurgFraction ?? 0, upstrokeMs: aw.upstrokeMs, cvp: mt.CVPmean ?? 4 },
        rhythm: { atrial: live.model.electrical.atrial, avBlock: (live.model.electrical as any).avBlock ?? 'none', ventricular: (live.model.electrical as any).ventricular ?? 'none' },
      });
      host.querySelector<HTMLElement>('[data-text]')!.innerHTML = texts.map((x) => `<h3>${esc(tr(x.title, lang))}</h3>${x.body.map((b) => `<p>${esc(tr(b, lang))}</p>`).join('')}`).join('');
    }
  };

  render();
  raf = requestAnimationFrame(frame);
  void live.settle(20).then(() => {
    if (stopped) return;
    ready = true;
    host.querySelector('[data-preparing]')?.remove();
    live.start();
  });

  return {
    stop: () => { stopped = true; cancelAnimationFrame(raf); live.stop(); },
    setLang: (l: Lang) => { lang = l; render(); },
  };
}
