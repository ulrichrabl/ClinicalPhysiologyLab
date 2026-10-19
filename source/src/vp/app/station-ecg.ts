import { LivePatient } from '../live/live-patient.ts';
import { healthyModel, applyPreset, type PatientModel } from '../physiology/state.ts';
import { getPath, setPath } from '../physiology/models.ts';
import type { VariableDef } from '../physiology/types.ts';
import { LEAD_NAMES, leadVectors, standardPlacement, recordLeads, type LeadName } from '../measurements/ecg.ts';
import { drawEcgPaper, PAPER_MM } from '../render/ecg-paper.ts';
import { ecgSigns, ecgSignsOf } from '../stations/ecg-signs.ts';
import { KNOWLEDGE, labelOf } from '../knowledge/index.ts';
import { ELECTRICAL_PRESETS } from '../physiology/heart/electrical.ts';
import { CATALOG } from '../data/catalog.ts';
import { tr, type LocalizedText } from '../model/i18n.ts';
import { ECG_STATION, stationSettings, stationPresets } from '../stations/station.ts';
import { momentAt, segments, findPhase, PHASES, type EcgPhase, type Moment } from '../stations/ecg-timeline.ts';
import { explain, PHASE_LABEL } from '../stations/ecg-texts.ts';
import { drawStrip, stripHeight, type StripGeometry } from '../render/station-strip.ts';
import { drawConductionHeart, heartPaneHeight } from '../render/conduction-heart.ts';
import { fmtValue } from './math.ts';
import type { Lang } from './diagrams.ts';

/* ---------------------------------------------------------------------------
   The ECG station (ADR-017): Explore (step 1), Predict and Identify (step 2).

   A healthy adult's heart runs here on its own. The strip is its dipole
   recorded through standard electrodes; the ladder, the heart and the
   arrows are read from the electrical model at the cursor. Playing, the
   cursor is "now" and the paper runs; paused, the last seconds are held
   and the learner moves the cursor through them. The settings are the
   ones the ECG measures (stations/station.ts).

   Predict: with it on, choosing a pattern first asks which signs it will
   bring; the answer is scored against the signs the knowledge tables find
   before and after. Identify: a hidden pattern is set on a healthy heart;
   the learner reads its 12-lead, names the signs and the mechanism, and is
   scored as the observe-only debrief scores (named and there, there and
   not named, named and not there). The signs are always the tables'.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });
const T: Record<string, LocalizedText> = {
  eyebrow: L('Station', 'Station'), back: L('Ward', 'Übersicht'),
  preparing: L('Preparing the heart…', 'Das Herz wird vorbereitet…'),
  settings: L('What moves this signal', 'Was dieses Signal verändert'),
  settingsNote: L('Only the model settings that change this test.', 'Nur die Modelleinstellungen, die diesen Test verändern.'),
  startFrom: L('Start from', 'Ausgangspunkt'), choose: L('Choose a pattern…', 'Muster wählen…'), healthy: L('Reset to healthy', 'Auf gesund zurücksetzen'),
  see: L('What you see', 'Was Sie sehen'), seeNote: L('25 mm/s · 10 mm/mV, the conduction ladder beneath', '25 mm/s · 10 mm/mV, darunter das Leitungsdiagramm'),
  lead1: L('Upper lead', 'Obere Ableitung'), lead2: L('Lower lead', 'Untere Ableitung'),
  ladder: L('Ladder rows: A atria, AV node and His bundle, V ventricles. The steeper the line, the slower the conduction; dashed means reached late, through muscle; a short bar is an impulse that stops.',
    'Zeilen: A Vorhöfe, AV-Knoten und His-Bündel, V Kammern. Je steiler die Linie, desto langsamer die Leitung; gestrichelt heißt spät erreicht, über die Muskulatur; ein kurzer Querstrich ist ein Impuls, der stehen bleibt.'),
  play: L('Play', 'Abspielen'), pause: L('Pause', 'Anhalten'), slow: L('Slow motion', 'Zeitlupe'),
  hint: L('or tap or drag on the strip; ← → move the cursor', 'oder auf den Streifen tippen oder ziehen; ← → bewegen den Cursor'),
  none: L('Not in this stretch of the strip.', 'Nicht in diesem Abschnitt des Streifens.'),
  why: L('What makes it', 'Was es erzeugt'),
  frontal: L('Frontal plane', 'Frontalebene'), horizontal: L('Horizontal plane', 'Horizontalebene'),
  front: L('front', 'vorn'), backSide: L('back', 'hinten'),
  ra: L('RA', 'RA'), la: L('LA', 'LA'), rv: L('RV', 'RV'), lv: L('LV', 'LV'), sa: L('SA', 'Sinus'), av: L('AV', 'AV'), focus: L('focus', 'Fokus'), ap: L('AP', 'AP'),
  dep: L('depolarising', 'depolarisiert gerade'), done: L('depolarised, plateau', 'depolarisiert, Plateau'), rep: L('repolarising', 'repolarisiert'), late: L('reached late or abnormal path', 'spät oder auf abnormem Weg erreicht'),
  machine: L('The model’s intervals', 'Die Intervalle des Modells'),
  rate: L('Rate', 'Frequenz'), axis: L('Axis', 'Achse'),
  strip: L('ECG strip with conduction ladder. Arrow keys move the cursor, space plays or pauses.', 'EKG-Streifen mit Leitungsdiagramm. Pfeiltasten bewegen den Cursor, Leertaste spielt oder hält an.'),
  heart: L('The heart and the cardiac vector at the cursor', 'Das Herz und der Herzvektor am Cursor'),
  explore: L('Explore', 'Erkunden'), identify: L('Identify', 'Erkennen'), mode: L('Mode', 'Modus'),
  predict: L('Predict first', 'Erst vorhersagen'), predictNote: L('Choosing a pattern first asks which signs it will bring.', 'Bei der Wahl eines Musters fragt die Station zuerst, welche Zeichen es bringt.'),
  predictQ: L('Which signs will this bring to the ECG?', 'Welche Zeichen wird das im EKG bringen?'), predictNone: L('none of these', 'keines davon'),
  playIt: L('Play it', 'Abspielen'), cancel: L('Cancel', 'Abbrechen'),
  brought: L('It brought', 'Es brachte'), took: L('It took away', 'Es nahm weg'), youMissed: L('Not predicted', 'Nicht vorhergesagt'), notCome: L('Predicted, did not come', 'Vorhergesagt, kam nicht'), nothing: L('nothing', 'nichts'),
  allRight: L('Every sign as you predicted.', 'Jedes Zeichen wie vorhergesagt.'),
  signsNow: L('Signs on this ECG now', 'Zeichen in diesem EKG jetzt'), noSigns: L('none: a normal ECG', 'keine: ein normales EKG'),
  unknown: L('Unknown', 'Unbekannt'), paperNote: L('12-lead ECG, 25 mm/s, 10 mm/mV. Scroll sideways on a small screen.', '12-Kanal-EKG, 25 mm/s, 10 mm/mV. Auf kleinen Bildschirmen seitlich scrollen.'),
  recording: L('Recording…', 'Wird aufgezeichnet…'),
  nameSigns: L('Name the signs', 'Zeichen benennen'), nameSignsNote: L('Pick every sign this ECG shows. Naming one that is not there counts too.', 'Wählen Sie jedes Zeichen, das dieses EKG zeigt. Ein Zeichen zu nennen, das nicht da ist, zählt auch.'),
  nameMech: L('Name the mechanism', 'Mechanismus benennen'), healthyHeart: L('A healthy heart', 'Ein gesundes Herz'), chooseMech: L('Choose…', 'Wählen…'),
  check: L('Check', 'Prüfen'), next: L('Next unknown', 'Nächstes Unbekanntes'), seeWhy: L('See why, in Explore', 'Das Warum ansehen, im Erkunden-Modus'),
  hits: L('Named, and there', 'Benannt und vorhanden'), misses: L('There, not named', 'Vorhanden, nicht benannt'), over: L('Named, not there', 'Benannt, nicht vorhanden'),
  mechRight: L('Right', 'Richtig'), mechWrong: L('It was', 'Es war'),
  syndromes: L('Together they make', 'Zusammen ergeben sie'), score: L('right this session', 'richtig in dieser Sitzung'),
};
/* The patterns Identify hides: the station's presets, with a healthy heart among them. Ventricular fibrillation is left
   out: it is recognised, not read. */
const IDENTIFY_POOL = ['normal', 'af', 'flutter', 'avb1', 'wenckebach', 'mobitz2', 'chb', 'vt', 'rbbb', 'lbbb', 'wpw', 'lvh', 'rvh', 'p-mitrale', 'p-pulmonale',
  'stemi-anterior', 'stemi-inferior', 'stemi-lateral', 'nstemi', 'wellens', 'pericarditis', 'brugada', 'early-repol', 'long-qt', 'digoxin', 'hyperkalaemia', 'hypokalaemia'];
/** Seconds of strip: four on a wide screen, fewer on a phone so the paper stays readable. */
const secondsFor = (w: number) => (w < 600 ? 2.5 : 4);


const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export interface StationHandle { stop(): void; setLang(l: Lang): void }
/** How a station is opened: on a healthy heart (from the Ward), or on a patient the learner has examined (from a debrief, a
    result, or the free lab), with where "back" returns to. */
export interface StationOptions { lang: Lang; onLeave: () => void; patient?: { model: PatientModel; name: LocalizedText }; backLabel?: LocalizedText }
export const patientBanner = (o: StationOptions, lang: Lang) => o.patient
  ? `<p class="st-patient" role="note"><b>${tr(o.patient.name, lang).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))}</b>: ${tr({ en: 'the patient you examined, as the model runs them. Reset to healthy to compare.', de: 'die Patientin oder der Patient, die Sie untersucht haben, wie das Modell sie laufen lässt. Auf gesund zurücksetzen zum Vergleich.' }, lang)}</p>` : '';

export function mountEcgStation(host: HTMLElement, o: StationOptions): StationHandle {
  let lang = o.lang;
  const t = (k: string) => tr(T[k], lang);
  const live = new LivePatient(o.patient?.model ?? healthyModel());
  let raf = 0, stopped = false, ready = false;
  let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let slow = false;
  let show: [LeadName, LeadName] = ['II', 'V1'];
  let frozen: ReturnType<LivePatient['recording']> | null = null;
  let cursor = 0;
  let geom: StripGeometry | null = null;
  let textKey = '';
  let mode: 'explore' | 'identify' = 'explore';
  let predict = false;
  let pending: { id: string; picked: Set<string> } | null = null;
  let feedback: { brought: string[]; took: string[]; picked: string[] } | null = null;
  let signsTick = 0;
  const id: { pool: string[]; n: number; hidden: string; t0: number; leads: Record<LeadName, Float32Array> | null; truth: { present: Set<string>; syndromes: string[] } | null;
    named: Set<string>; mech: string; checked: boolean; right: number; done: number } = { pool: [], n: 0, hidden: 'normal', t0: 0, leads: null, truth: null, named: new Set(), mech: '', checked: false, right: 0, done: 0 };
  const signLabel = (s: string) => labelOf(KNOWLEDGE, `sign:${s}`, lang);
  const synLabel = (s: string) => labelOf(KNOWLEDGE, `syndrome:${s}`, lang);
  const presetLabel = (pid: string) => (pid === 'normal' ? t('healthyHeart') : tr(ELECTRICAL_PRESETS.find((x) => x.id === pid)?.label ?? L(pid, pid), lang));
  let note = '';
  const vectors = leadVectors(standardPlacement());
  const seconds = () => secondsFor(host.querySelector<HTMLElement>('.st-strip')?.clientWidth ?? 800);
  const settings = stationSettings(ECG_STATION);
  const presets = stationPresets(ECG_STATION);
  const open = new Set<string>(['electrical/rhythm', 'electrical/conduction', 'driver/fluids.clamp-potassium']);

  const head = () => `<div class="st-head">
        <button type="button" class="ghost" data-leave>← ${o.backLabel ? tr(o.backLabel, lang) : t('back')}</button>
        <div class="st-title"><div class="eyebrow">${t('eyebrow')}</div><h1>${esc(tr(ECG_STATION.title, lang))}</h1><p class="lede">${esc(tr(ECG_STATION.summary, lang))}</p></div>
        <span class="seg st-mode" role="radiogroup" aria-label="${t('mode')}">${(['explore', 'identify'] as const).map((m) => `<button type="button" role="radio" aria-checked="${mode === m}" data-mode="${m}">${t(m)}</button>`).join('')}</span>
      </div>
      ${patientBanner(o, lang)}
      ${ready ? '' : `<p class="muted" data-preparing>${t('preparing')}</p>`}`;
  const render = () => {
    if (mode === 'identify') { renderIdentify(); return; }
    host.innerHTML = `${head()}
      <div class="st-grid">
        <aside class="panel st-settings" aria-labelledby="st-set-h">
          <h2 id="st-set-h">${t('settings')}</h2>
          <p class="layer-note">${t('settingsNote')}</p>
          <label class="st-preset">${t('startFrom')}
            <select data-preset><option value="">${t('choose')}</option>${presets.map((g) => `<optgroup label="${esc(tr(g.group, lang))}">${g.presets.map((p) => `<option value="${p.id}">${esc(tr(p.label, lang))}</option>`).join('')}</optgroup>`).join('')}</select>
          </label>
          <button type="button" class="ghost small" data-healthy>${t('healthy')}</button>
          <label class="st-predict"><input type="checkbox" data-predict ${predict ? 'checked' : ''}><span><b>${t('predict')}</b><br><span class="muted small">${t('predictNote')}</span></span></label>
          <div data-controls></div>
        </aside>
        <div class="st-main">
          <section class="panel st-signal" aria-labelledby="st-see-h">
            <div class="st-row">
              <div><h2 id="st-see-h">${t('see')}</h2><div class="muted small">${t('seeNote')}</div></div>
              <div class="st-leads">
                <label>${t('lead1')} <select data-lead="0">${LEAD_NAMES.map((n) => `<option ${n === show[0] ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
                <label>${t('lead2')} <select data-lead="1">${LEAD_NAMES.map((n) => `<option ${n === show[1] ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
              </div>
            </div>
            <div class="st-measures" data-measures aria-label="${t('machine')}"></div>
            <div class="st-signs" data-signs aria-live="polite"></div>
            <div data-predict-box></div>
            <canvas class="st-strip" tabindex="0" aria-label="${t('strip')}"></canvas>
            <p class="muted small st-legend">${t('ladder')}</p>
          </section>
          <div class="st-bar" role="group">
            <button type="button" class="primary" data-play></button>
            <button type="button" class="ghost" data-slow aria-pressed="${slow}">${t('slow')}</button>
            <span class="st-phases">${PHASES.map((p) => `<button type="button" class="tog" data-phase="${p}">${esc(tr(PHASE_LABEL[p], lang))}</button>`).join('')}</span>
            <span class="muted small">${t('hint')}</span>
            <span class="st-note" role="status" data-note></span>
          </div>
          <section class="panel st-why" aria-labelledby="st-why-h">
            <canvas class="st-heart" aria-label="${t('heart')}"></canvas>
            <div class="st-text">
              <div class="eyebrow" data-phase-name></div>
              <h3 id="st-why-h" data-title></h3>
              <div data-body></div>
              <p class="st-proj" data-proj></p>
              <div class="st-key">
                <span><i style="background:color-mix(in srgb, var(--accent) 60%, transparent)"></i>${t('dep')}</span>
                <span><i style="background:color-mix(in srgb, var(--accent) 22%, transparent)"></i>${t('done')}</span>
                <span><i style="background:color-mix(in srgb, #4f6fb3 45%, transparent)"></i>${t('rep')}</span>
                <span><i style="background:color-mix(in srgb, var(--abn) 42%, transparent)"></i>${t('late')}</span>
              </div>
            </div>
          </section>
        </div>
      </div>`;
    renderControls();
    wire();
    renderPredict();
    textKey = '';
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
      const handler = () => {
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
      };
      el.addEventListener(el instanceof HTMLInputElement && el.type === 'range' ? 'input' : 'change', handler);
    });
  };
  const change = (next: ReturnType<typeof healthyModel>, rerenderControls: boolean) => {
    live.setModel(next);
    playing = true; frozen = null; note = '';
    if (rerenderControls) renderControls();
    syncButtons();
  };

  /* ---- wiring ---------------------------------------------------------------------------------- */
  const syncButtons = () => {
    const play = host.querySelector<HTMLButtonElement>('[data-play]');
    if (play) play.textContent = playing ? t('pause') : t('play');
    host.querySelector('[data-slow]')?.setAttribute('aria-pressed', String(slow));
    const n = host.querySelector<HTMLElement>('[data-note]'); if (n) n.textContent = note;
  };
  const pause = () => { if (playing) { frozen = live.recording(seconds()); cursor = frozen.t0 + (frozen.vcg.X.length - 1) * frozen.dt; } playing = false; syncButtons(); };
  const wireHead = () => {
    host.querySelector<HTMLButtonElement>('[data-leave]')!.onclick = () => o.onLeave();
    host.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => b.onclick = () => {
      const m = b.dataset.mode as typeof mode;
      if (m === mode) return;
      mode = m; pending = null; feedback = null;
      if (mode === 'identify') nextUnknown(); else { live.speed = slow ? 0.25 : 1; playing = true; frozen = null; }
      render();
    });
  };
  const wire = () => {
    wireHead();
    host.querySelector<HTMLSelectElement>('[data-preset]')!.onchange = (e) => {
      const pid = (e.target as HTMLSelectElement).value;
      if (!pid) return;
      if (predict) { pending = { id: pid, picked: new Set() }; feedback = null; renderPredict(); }
      else change(applyPreset(live.model, pid), true);
    };
    host.querySelector<HTMLInputElement>('[data-predict]')!.onchange = (e) => { predict = (e.target as HTMLInputElement).checked; pending = null; renderPredict(); };
    host.querySelector<HTMLButtonElement>('[data-healthy]')!.onclick = () => { const h = healthyModel(); change(h, true); host.querySelector<HTMLSelectElement>('[data-preset]')!.value = ''; };
    host.querySelectorAll<HTMLSelectElement>('[data-lead]').forEach((s) => s.onchange = () => { show[Number(s.dataset.lead)] = s.value as LeadName; });
    host.querySelector<HTMLButtonElement>('[data-play]')!.onclick = () => { if (playing) pause(); else { playing = true; frozen = null; note = ''; syncButtons(); } };
    host.querySelector<HTMLButtonElement>('[data-slow]')!.onclick = () => { slow = !slow; live.speed = slow ? 0.25 : 1; syncButtons(); };
    host.querySelectorAll<HTMLButtonElement>('[data-phase]').forEach((b) => b.onclick = () => {
      pause();
      const rec = frozen!;
      const t1 = rec.t0 + (rec.vcg.X.length - 1) * rec.dt;
      const at = findPhase(rec.activations, rec.t0, t1, b.dataset.phase as EcgPhase, live.model.electrical.atrial);
      if (at == null) note = t('none'); else { cursor = at; note = ''; }
      syncButtons();
    });
    const canvas = host.querySelector<HTMLCanvasElement>('.st-strip')!;
    let dragging = false;
    const seek = (ev: PointerEvent) => {
      if (!geom) return;
      if (playing) pause();
      const r = canvas.getBoundingClientRect();
      const rec = frozen!;
      const t1 = rec.t0 + (rec.vcg.X.length - 1) * rec.dt;
      cursor = Math.max(rec.t0, Math.min(t1, geom.tAt(ev.clientX - r.left)));
      note = ''; syncButtons();
    };
    canvas.addEventListener('pointerdown', (ev) => { dragging = true; canvas.setPointerCapture(ev.pointerId); seek(ev); });
    canvas.addEventListener('pointermove', (ev) => { if (dragging) seek(ev); });
    canvas.addEventListener('pointerup', () => { dragging = false; });
    canvas.addEventListener('keydown', (ev) => {
      if (ev.key === ' ') { ev.preventDefault(); host.querySelector<HTMLButtonElement>('[data-play]')!.click(); return; }
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      ev.preventDefault();
      if (playing) pause();
      const rec = frozen!;
      const t1 = rec.t0 + (rec.vcg.X.length - 1) * rec.dt;
      cursor = Math.max(rec.t0, Math.min(t1, cursor + (ev.key === 'ArrowLeft' ? -1 : 1) * (ev.shiftKey ? 40 : 4)));
    });
    syncButtons();
  };

  /* ---- predict ----------------------------------------------------------------------------------- */
  const chips = (ids: string[], on: Set<string>, attr: string, disabled = false) => ids.map((s) =>
    `<button type="button" class="chip st-chip" ${attr}="${s}" aria-pressed="${on.has(s)}" ${disabled ? 'disabled' : ''}>${esc(signLabel(s))}</button>`).join('');
  const renderPredict = () => {
    const box = host.querySelector<HTMLElement>('[data-predict-box]');
    if (!box) return;
    if (pending) {
      box.innerHTML = `<div class="st-predict-q" role="group" aria-label="${t('predictQ')}">
        <div class="eyebrow">${t('predict')} · ${esc(presetLabel(pending.id))}</div>
        <p><b>${t('predictQ')}</b></p>
        <div class="st-chips">${chips(ecgSigns(), pending.picked, 'data-pick')}</div>
        <div class="st-row-buttons"><button type="button" class="primary" data-go>${t('playIt')}</button><button type="button" class="ghost" data-cancel>${t('cancel')}</button></div></div>`;
      box.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => b.onclick = () => {
        const s = b.dataset.pick!; pending!.picked.has(s) ? pending!.picked.delete(s) : pending!.picked.add(s);
        b.setAttribute('aria-pressed', String(pending!.picked.has(s)));
      });
      box.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick = () => { pending = null; host.querySelector<HTMLSelectElement>('[data-preset]')!.value = ''; renderPredict(); };
      box.querySelector<HTMLButtonElement>('[data-go]')!.onclick = () => {
        const before = ecgSignsOf(live.model, live.snap, live.chemistry).present;
        const picked = [...pending!.picked];
        change(applyPreset(live.model, pending!.id), true);
        pending = null;
        /* The heart changes at once; its reading is taken once the new rhythm has run for a moment. */
        window.setTimeout(() => {
          if (stopped) return;
          const after = ecgSignsOf(live.model, live.snap, live.chemistry).present;
          feedback = { brought: [...after].filter((s) => !before.has(s)), took: [...before].filter((s) => !after.has(s)), picked };
          renderPredict();
        }, 1500);
        renderPredict();
      };
    } else if (feedback) {
      const f = feedback, got = new Set(f.brought);
      const right = f.picked.filter((s) => got.has(s)), missed = f.brought.filter((s) => !f.picked.includes(s)), wrong = f.picked.filter((s) => !got.has(s));
      const list = (xs: string[]) => (xs.length ? xs.map((s) => esc(signLabel(s))).join(', ') : t('nothing'));
      box.innerHTML = `<div class="st-predict-a" role="status">
        <p><b>${t('brought')}:</b> ${list(f.brought)}${f.took.length ? `. <b>${t('took')}:</b> ${list(f.took)}` : ''}.</p>
        ${!missed.length && !wrong.length ? `<p class="ok">${t('allRight')}</p>` : `${missed.length ? `<p><b>${t('youMissed')}:</b> ${list(missed)}</p>` : ''}${wrong.length ? `<p><b>${t('notCome')}:</b> ${list(wrong)}</p>` : ''}`}
        ${right.length ? `<p class="muted small">✓ ${list(right)}</p>` : ''}</div>`;
    } else box.innerHTML = '';
  };
  const renderSignsNow = () => {
    const box = host.querySelector<HTMLElement>('[data-signs]');
    if (!box || !live.snap.electrical) return;
    const r = ecgSignsOf(live.model, live.snap, live.chemistry);
    const html = `<span class="muted small">${t('signsNow')}:</span> ${r.present.size ? [...r.present].map((s) => `<span class="sign">${esc(signLabel(s))}</span>`).join('') : `<span class="muted small">${t('noSigns')}</span>`}${r.syndromes.length ? ` <span class="muted small">→</span> ${r.syndromes.map((y) => `<b class="syn">${esc(synLabel(y))}</b>`).join(' ')}` : ''}`;
    if (box.innerHTML !== html) box.innerHTML = html;
  };

  /* ---- identify ---------------------------------------------------------------------------------- */
  const nextUnknown = () => {
    if (!id.pool.length) id.pool = [...IDENTIFY_POOL].sort(() => Math.random() - 0.5);
    id.hidden = id.pool.pop()!;
    id.n++; id.leads = null; id.truth = null; id.named = new Set(); id.mech = ''; id.checked = false;
    const m = applyPreset(healthyModel(), id.hidden);
    live.setModel(m);
    live.speed = 6;               // run ahead to fill the paper quickly
    id.t0 = live.t;
    playing = true; frozen = null;
  };
  const renderIdentify = () => {
    const groups = stationPresets(ECG_STATION);
    host.innerHTML = `${head()}
      <div class="st-grid">
        <aside class="panel st-settings" aria-labelledby="st-name-h">
          <h2 id="st-name-h">${t('nameSigns')}</h2>
          <p class="layer-note">${t('nameSignsNote')}</p>
          <div class="st-chips">${chips(ecgSigns(), id.named, 'data-name', id.checked)}</div>
          <label class="st-preset">${t('nameMech')}
            <select data-mech ${id.checked ? 'disabled' : ''}><option value="">${t('chooseMech')}</option><option value="normal" ${id.mech === 'normal' ? 'selected' : ''}>${t('healthyHeart')}</option>
            ${groups.map((g) => `<optgroup label="${esc(tr(g.group, lang))}">${g.presets.filter((p) => IDENTIFY_POOL.includes(p.id) && p.id !== 'normal').map((p) => `<option value="${p.id}" ${id.mech === p.id ? 'selected' : ''}>${esc(tr(p.label, lang))}</option>`).join('')}</optgroup>`).join('')}</select>
          </label>
          ${id.checked ? `<button type="button" class="primary" data-next>${t('next')}</button>` : `<button type="button" class="primary" data-check ${id.leads && id.mech ? '' : 'disabled'}>${t('check')}</button>`}
          ${id.done ? `<p class="muted small">${id.right} / ${id.done} ${t('score')}</p>` : ''}
        </aside>
        <div class="st-main">
          <section class="panel st-signal" aria-labelledby="st-unk-h">
            <div class="st-row"><div><h2 id="st-unk-h">${t('unknown')} ${id.n}</h2><div class="muted small">${t('paperNote')}</div></div></div>
            <div class="st-paper-wrap">${id.leads ? '' : `<p class="muted" data-recording>${t('recording')}</p>`}<canvas class="st-paper" aria-label="${t('unknown')} ${id.n}"></canvas></div>
          </section>
          ${id.checked ? resultHtml() : ''}
        </div>
      </div>`;
    wireHead();
    host.querySelectorAll<HTMLButtonElement>('[data-name]').forEach((b) => b.onclick = () => {
      const s = b.dataset.name!; id.named.has(s) ? id.named.delete(s) : id.named.add(s);
      b.setAttribute('aria-pressed', String(id.named.has(s)));
    });
    host.querySelector<HTMLSelectElement>('[data-mech]')!.onchange = (e) => { id.mech = (e.target as HTMLSelectElement).value; const c = host.querySelector<HTMLButtonElement>('[data-check]'); if (c) c.disabled = !(id.leads && id.mech); };
    host.querySelector<HTMLButtonElement>('[data-check]')?.addEventListener('click', () => {
      id.checked = true; id.done++;
      const tr2 = id.truth!.present;
      if (id.mech === id.hidden && [...id.named].every((s) => tr2.has(s)) && [...tr2].every((s) => id.named.has(s))) id.right++;
      renderIdentify();
    });
    host.querySelector<HTMLButtonElement>('[data-next]')?.addEventListener('click', () => { nextUnknown(); renderIdentify(); });
    host.querySelector<HTMLButtonElement>('[data-why]')?.addEventListener('click', () => { mode = 'explore'; live.speed = 1; playing = true; frozen = null; render(); });
    drawPaper();
  };
  const resultHtml = () => {
    const truth = id.truth!;
    const hits = [...id.named].filter((s) => truth.present.has(s)), misses = [...truth.present].filter((s) => !id.named.has(s)), over = [...id.named].filter((s) => !truth.present.has(s));
    const col = (title: string, xs: string[], cls: string) => `<div class="st-res ${cls}"><h3>${title}</h3>${xs.length ? `<ul>${xs.map((s) => `<li>${esc(signLabel(s))}</li>`).join('')}</ul>` : `<p class="muted small">—</p>`}</div>`;
    const right = id.mech === id.hidden;
    return `<section class="panel st-result" aria-labelledby="st-res-h">
      <h2 id="st-res-h" class="${right ? 'ok' : 'abn'}">${right ? t('mechRight') : t('mechWrong')}: ${esc(presetLabel(id.hidden))}</h2>
      ${truth.syndromes.length ? `<p>${t('syndromes')}: ${truth.syndromes.map((y) => `<b>${esc(synLabel(y))}</b>`).join(', ')}</p>` : ''}
      <div class="st-res-grid">${col(t('hits'), hits, 'hit')}${col(t('misses'), misses, 'miss')}${col(t('over'), over, 'over')}</div>
      <button type="button" class="ghost" data-why>${t('seeWhy')}</button>
    </section>`;
  };
  const drawPaper = () => {
    const c = host.querySelector<HTMLCanvasElement>('.st-paper');
    if (!c || !id.leads) return;
    const wrap = c.parentElement!;
    drawEcgPaper(c, id.leads, 500, { pxPerMm: Math.max(3, Math.min(5, (wrap.clientWidth - 2) / PAPER_MM.width)), header: `${t('unknown')} ${id.n}` });
  };
  const identifyFrame = () => {
    if (id.leads || live.t - id.t0 < 11) return;
    id.leads = recordLeads(live.vcg(10));
    id.truth = ecgSignsOf(live.model, live.snap, live.chemistry);
    live.speed = 1;
    host.querySelector('[data-recording]')?.remove();
    const c = host.querySelector<HTMLButtonElement>('[data-check]'); if (c) c.disabled = !id.mech;
    drawPaper();
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
  const project = (rec: ReturnType<LivePatient['recording']>, lead: LeadName) => {
    const v = vectors[lead], n = rec.vcg.X.length, a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = v[0] * rec.vcg.X[i] + v[1] * rec.vcg.Y[i] + v[2] * rec.vcg.Z[i];
    return a;
  };
  const median = (a: Float32Array) => { const s = Array.from(a).sort((p, q) => p - q); return s[Math.floor(s.length / 2)] ?? 0; };
  const fmt = (x: number, d = 2) => { const s = (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d); return lang === 'de' ? s.replace('.', ',') : s; };

  let measureTick = 0;
  const frame = () => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    if (!ready) return;
    if (mode === 'identify') { identifyFrame(); return; }
    if (++signsTick % 60 === 1) renderSignsNow();
    const strip = host.querySelector<HTMLCanvasElement>('.st-strip'), heartC = host.querySelector<HTMLCanvasElement>('.st-heart');
    if (!strip || !heartC) return;
    const rec = playing ? live.recording(seconds()) : frozen ?? live.recording(seconds());
    const n = rec.vcg.X.length;
    if (n < 10) return;
    const tEnd = rec.t0 + (n - 1) * rec.dt;
    if (playing) cursor = tEnd;
    const e = live.model.electrical;
    const m = momentAt(rec.activations, cursor, e.atrial);
    const seg = m.phase === 'rest' ? null : segments(rec.activations, rec.t0, tEnd).find((s) => s.phase === m.phase && s.from <= cursor && cursor < s.to) ?? null;
    const leads = { [show[0]]: project(rec, show[0]), [show[1]]: project(rec, show[1]) } as Record<LeadName, Float32Array>;
    const colors = { fg: css('--fg'), muted: css('--muted'), accent: css('--accent'), abn: css('--abn'), line: css('--line'), surface: css('--surface'), sunk: css('--sunk'), repol: '#4f6fb3' };

    const sw = strip.clientWidth;
    const { g } = sizeCanvas(strip, stripHeight(sw, seconds()));
    geom = drawStrip(g, sw, stripHeight(sw, seconds()), {
      leads, show, t0: rec.t0, dt: rec.dt, activations: rec.activations, cursor, band: seg, colors,
      labels: { atria: 'A', av: 'AV', ventricles: 'V' },
    }, seconds());

    const i = Math.max(0, Math.min(n - 1, Math.round((cursor - rec.t0) / rec.dt)));
    const d: [number, number, number] = [rec.vcg.X[i], rec.vcg.Y[i], rec.vcg.Z[i]];
    let scale = 0.3; for (let j = 0; j < n; j++) scale = Math.max(scale, Math.hypot(rec.vcg.X[j], rec.vcg.Y[j], rec.vcg.Z[j]));
    const trail: Array<[number, number, number]> = [];
    for (let j = Math.max(0, i - 60); j <= i; j += 2) trail.push([rec.vcg.X[j], rec.vcg.Y[j], rec.vcg.Z[j]]);
    const hw = heartC.clientWidth;
    const hg = sizeCanvas(heartC, heartPaneHeight(hw)).g;
    const limb: LeadName[] = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF'], chest: LeadName[] = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
    drawConductionHeart(hg, hw, heartPaneHeight(hw), {
      moment: m, e, dipole: d, trail, scale,
      frontal: limb.map((l) => ({ name: l, a: vectors[l][0], b: vectors[l][1], on: show.includes(l) })),
      horizontal: chest.map((l) => ({ name: l, a: vectors[l][0], b: vectors[l][2], on: show.includes(l) })),
      colors,
      labels: { frontal: t('frontal'), horizontal: t('horizontal'), front: t('front'), back: t('backSide'), ra: t('ra'), la: t('la'), rv: t('rv'), lv: t('lv'), sa: t('sa'), av: t('av'), focus: t('focus'), ap: t('ap') },
    });

    // the words: rewritten only when what they describe changes
    const K = live.model.chemistry.potassium ?? live.model.circulation.K ?? 4;
    const key = JSON.stringify([lang, m.phase, m.v?.t, m.a?.t, m.late?.reached, m.dropped, m.atria, Math.round(K * 10), e]);
    if (key !== textKey) {
      textKey = key;
      const met = live.snap.ecgMetrics ?? {};
      const x = explain({ moment: m, e, K, metrics: { HR: met.HR, PR: met.PR, QRS: met.QRS, QT: met.QT, QTc: met.QTc } });
      host.querySelector('[data-phase-name]')!.textContent = `${t('why')} · ${tr(PHASE_LABEL[m.phase], lang)}`;
      host.querySelector('[data-title]')!.textContent = tr(x.title, lang);
      host.querySelector('[data-body]')!.innerHTML = x.body.map((b) => `<p>${esc(tr(b, lang))}</p>`).join('');
      host.querySelectorAll<HTMLButtonElement>('[data-phase]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.phase === m.phase)));
    }
    const a = leads[show[0]], b = leads[show[1]];
    const va = a[i] - median(a), vb = b[i] - median(b);
    const mag = Math.hypot(d[0], d[1], d[2]);
    host.querySelector('[data-proj]')!.textContent = mag < 0.04
      ? tr(L('No arrow: there is no net dipole now, so every lead reads the baseline.', 'Kein Pfeil: Jetzt gibt es keinen Netto-Dipol, deshalb zeigt jede Ableitung die Grundlinie.'), lang)
      : tr(L(`Each lead sees the arrow’s share along its own axis: ${show[0]} ${fmt(va)} mV, ${show[1]} ${fmt(vb)} mV.`,
        `Jede Ableitung sieht den Anteil des Pfeils entlang ihrer eigenen Achse: ${show[0]} ${fmt(va)} mV, ${show[1]} ${fmt(vb)} mV.`), lang);

    if (++measureTick % 15 === 1) {
      const met = live.snap.ecgMetrics ?? {};
      const range = (CATALOG.investigations['ecg-12'].normal as any)?.range ?? {};
      const chip = (label: string, v: number | null | undefined, unit: string, r?: [number, number]) =>
        `<span class="${v != null && r && (v < r[0] || v > r[1]) ? 'abn' : ''}">${label} <b>${v == null || !Number.isFinite(v) ? '—' : Math.round(v)}</b> ${unit}</span>`;
      host.querySelector('[data-measures]')!.innerHTML = chip(t('rate'), met.HR, '/min', range.rate) + chip('PR', met.PR, 'ms', range.pr) + chip('QRS', met.QRS, 'ms', range.qrs)
        + chip('QTc', met.QTc, 'ms', range.qtc) + chip(t('axis'), met.qrsAxis, '°', range.axis);
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
