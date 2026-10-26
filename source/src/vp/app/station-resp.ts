import { LivePatient } from '../live/live-patient.ts';
import { healthyModel, type PatientModel } from '../physiology/state.ts';
import { getPath, setPath } from '../physiology/models.ts';
import type { VariableDef } from '../physiology/types.ts';
import { CATALOG } from '../data/catalog.ts';
import { FORMATTERS } from '../text/formatters.ts';
import { tr, type LocalizedText } from '../model/i18n.ts';
import { RESP_STATION, stationSettings } from '../stations/station.ts';
import { RESP_PRESETS, RESP_PRESET_GROUPS, applyRespPreset } from '../stations/resp-presets.ts';
import { respSignsOf, respSignGroups, respObserve } from '../stations/resp-signs.ts';
import { RESP_TESTS, RESP_SITES, RESP_TEST_BY_ID, type RespTestId, type SiteKey } from '../stations/resp-tests.ts';
import { explainResp, type RespContext } from '../stations/resp-texts.ts';
import { lungsSvg, drawBreath, drawVQ, FILL } from '../render/lung-mechanism.ts';
import { tracheaSvg, expansionSvg } from '../render/chest-palpation.ts';
import { AUSCULTATION_SITES, type ThoraxLook } from '../render/thorax.ts';
import { figureLookFor, figureSvg, POSES, VIEW_FRONT, type FigureFindings } from '../render/patient-figure.ts';
import { appearanceOf } from '../render/face-canvas.ts';
import { mountChest, type ChestMode } from './focus-chest.ts';
import { BreathRecorder, tissueVolume, type LobeId, type RespSnapshot } from '../physiology/lung/respiratory.ts';
import { mediastinalShift, SITE_LOBES, FLUID_REACHES, underSite } from '../models/resp-exam.ts';
import { EXAM } from '../evidence/exam.ts';
import { FREE_CASE } from './free-case.ts';
import { KNOWLEDGE, labelOf } from '../knowledge/index.ts';
import { fmtValue } from './math.ts';
import type { Lang } from './diagrams.ts';
import { patientBanner, type StationHandle, type StationOptions } from './station-ecg.ts';
import type { ExamContext } from '../model/types.ts';

/* ---------------------------------------------------------------------------
   The respiratory station: Explore, Predict and Identify.

   A healthy adult's lungs and circulation run here. The signal is the chest
   examination as the ward has it: the patient seen sitting up, the trachea
   under the finger, the hands on the lower ribs, and percussion, breath
   sounds and vocal resonance at ten sites, heard as the encounter makes
   them. The mechanism is what lies beneath: the lobes, the pleura, the
   mediastinum and the airways, with the lobes under the site outlined, and
   the breath on one clock (volume, flow and the pressures, from the model's
   own 20 ms samples). The findings and the signs are the examination
   model's; only the explanations are written.

   Predict asks which signs a starting point will bring and scores the
   answer once the lungs have settled. Identify hides one (or a healthy
   chest): the learner examines as at the bedside, hears and feels without
   the findings written, the mechanism or the settings, and names the signs
   and the chest.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });
const T: Record<string, LocalizedText> = {
  eyebrow: L('Station', 'Station'), back: L('Ward', 'Übersicht'),
  preparing: L('Preparing the lungs…', 'Die Lunge wird vorbereitet…'),
  settings: L('What moves the chest examination', 'Was die Thoraxuntersuchung verändert'),
  settingsNote: L('Only the model settings that change these tests.', 'Nur die Modelleinstellungen, die diese Tests verändern.'),
  startFrom: L('Start from', 'Ausgangspunkt'), choose: L('Choose a chest…', 'Thorax wählen…'), healthy: L('Reset to healthy', 'Auf gesund zurücksetzen'),
  exam: L('Examine', 'Untersuchen'), examNote: L('In the order of the examination. Percussion, breath sounds and vocal resonance: tap a site on the chest, or turn the patient.', 'In der Reihenfolge der Untersuchung. Perkussion, Atemgeräusch und Bronchophonie: eine Stelle am Thorax antippen oder den Patienten drehen.'),
  beneath: L('What lies beneath', 'Was darunter liegt'), beneathNote: L('The model’s lungs under the chest wall: each lobe coloured by what fills it; the lobes under the site outlined.', 'Die Lunge des Modells unter der Brustwand: jeder Lappen gefärbt nach dem, was ihn füllt; die Lappen unter der Stelle umrandet.'),
  breath: L('The breath, on one clock', 'Der Atemzug, auf einer Uhr'), breathNote: L('The model’s own breathing over the last seconds; inspiration shaded. Tap to place the cursor.', 'Die Atmung des Modells über die letzten Sekunden; Inspiration schattiert. Antippen setzt den Cursor.'),
  vq: L('Ventilation and blood flow, lobe by lobe', 'Ventilation und Durchblutung, Lappen für Lappen'),
  air: L('air', 'Luft'), solid: L('exudate', 'Exsudat'), water: L('water', 'Wasser'), airless: L('airless', 'luftleer'),
  fluid: L('fluid {mL} mL', 'Flüssigkeit {mL} ml'), freeAir: L('air', 'Luft'), under: L('Under the site', 'Unter der Stelle'),
  vol: L('Volume', 'Volumen'), flow: L('Flow', 'Fluss'), pres: L('Pressures', 'Drücke'), insp: L('inspiration', 'Inspiration'), ppl: L('pleural', 'pleural'), palv: L('alveolar', 'alveolär'), pmus: L('muscles', 'Muskeln'),
  added: L('added sounds at this site', 'Nebengeräusche an dieser Stelle'), vent: L('ventilation', 'Ventilation'), perf: L('blood flow', 'Durchblutung'), shunt: L('shunt', 'Shunt'),
  oximeter: L('Oximeter', 'Pulsoxymeter'), counted: L('Counted over 30 s', 'Über 30 s gezählt'), says: L('Asked “How is your breathing?”, the patient says', 'Gefragt „Wie geht es mit der Atmung?“, sagt der Patient'),
  see: L('What you see as they breathe', 'Was Sie beim Atmen sehen'), notch: L('suprasternal notch', 'Drosselgrube'), left: L('patient’s left', 'links (Patient)'), right: L('patient’s right', 'rechts (Patient)'),
  handsNote: L('The hands follow the patient’s own breaths, each with the share of the breath its lung takes; magnified, as for a deep breath.', 'Die Hände folgen den Atemzügen des Patienten, jede mit dem Anteil, den ihre Lunge aufnimmt; vergrößert, wie bei tiefer Einatmung.'),
  chart: L('Your chart', 'Ihr Befund'), siteCol: L('Site', 'Stelle'), rCol: L('right', 'rechts'), lCol: L('left', 'links'),
  signsNow: L('Signs now', 'Jetzt vorhandene Zeichen'), noSigns: L('none: a normal chest', 'keine: ein unauffälliger Thorax'), at: L('found with', 'gefunden mit'),
  settling: L('The lungs and the circulation are settling into the new state…', 'Lunge und Kreislauf stellen sich auf den neuen Zustand ein…'),
  explore: L('Explore', 'Erkunden'), identify: L('Identify', 'Erkennen'), mode: L('Mode', 'Modus'),
  predict: L('Predict first', 'Erst vorhersagen'), predictNote: L('Choosing a chest first asks which signs it will bring.', 'Bei der Wahl eines Thorax fragt die Station zuerst, welche Zeichen er bringt.'),
  predictQ: L('Which signs will this bring to the chest examination?', 'Welche Zeichen wird das bei der Thoraxuntersuchung bringen?'),
  showIt: L('Show it', 'Zeigen'), cancel: L('Cancel', 'Abbrechen'),
  brought: L('It brought', 'Es brachte'), took: L('It took away', 'Es nahm weg'), youMissed: L('Not predicted', 'Nicht vorhergesagt'), notCome: L('Predicted, did not come', 'Vorhergesagt, kam nicht'), nothing: L('nothing', 'nichts'),
  allRight: L('Every sign as you predicted.', 'Jedes Zeichen wie vorhergesagt.'), waiting: L('Examining the new patient…', 'Der neue Patient wird untersucht…'),
  unknown: L('Unknown', 'Unbekannt'), unknownNote: L('A healthy adult with a hidden change in the chest, or none. You have what the bedside gives: the patient, the trachea and the expansion under your hands, the percussion note and the sounds through the stethoscope. No findings written for you, no lungs drawn.', 'Ein gesunder Erwachsener mit einer verdeckten Veränderung im Thorax, oder ohne. Sie haben, was das Bett gibt: den Patienten, Trachea und Exkursion unter den Händen, Klopfschall und Geräusche durch das Stethoskop. Keine vorgeschriebenen Befunde, keine gezeichnete Lunge.'),
  preparingUnknown: L('Preparing the patient…', 'Der Patient wird vorbereitet…'),
  nameSigns: L('Name the signs', 'Zeichen benennen'), nameSignsNote: L('Pick every sign you find. Naming one that is not there counts too.', 'Wählen Sie jedes Zeichen, das Sie finden. Ein Zeichen zu nennen, das nicht da ist, zählt auch.'),
  nameMech: L('Name the chest', 'Den Thorax benennen'), healthyPatient: L('A healthy chest', 'Ein gesunder Thorax'), chooseMech: L('Choose…', 'Wählen…'),
  check: L('Check', 'Prüfen'), next: L('Next unknown', 'Nächstes Unbekanntes'), seeWhy: L('See why, in Explore', 'Das Warum ansehen, im Erkunden-Modus'),
  hits: L('Named, and there', 'Benannt und vorhanden'), misses: L('There, not named', 'Vorhanden, nicht benannt'), over: L('Named, not there', 'Benannt, nicht vorhanden'),
  mechRight: L('Right', 'Richtig'), mechWrong: L('It was', 'Es war'), score: L('right this session', 'richtig in dieser Sitzung'), foundWhere: L('Where each is found', 'Wo jedes zu finden ist'),
  sideR: L('right', 'rechts'), sideL: L('left', 'links'),
};
const SAYS: Record<string, LocalizedText> = {
  fine: L('“It’s fine, thank you. No trouble at all.”', '„Gut, danke. Keine Probleme.“'),
  sentences: L('“I’m a bit short of breath, but I can talk to you all right.”', '„Ich bin etwas kurzatmig, aber reden kann ich schon.“'),
  phrases: L('“I can’t… get my breath… since this morning.”', '„Ich krieg… keine Luft… seit heute früh.“'),
  words: L('“Can’t… breathe.”', '„Keine… Luft.“'),
  unable: L('(Cannot answer: nods, every breath an effort.)', '(Kann nicht antworten: nickt, jeder Atemzug eine Anstrengung.)'),
};
const IDENTIFY_POOL = ['healthy', ...RESP_PRESETS.map((p) => p.id)];
const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const SETTLE_S = 45;
const SITE_MODE: Partial<Record<RespTestId, ChestMode>> = { percussion: 'percuss', auscultation: 'listen', resonance: 'voice' };
const MODE_TEST: Record<ChestMode, RespTestId> = { percuss: 'percussion', listen: 'auscultation', voice: 'resonance' };

export function mountRespStation(host: HTMLElement, o: StationOptions): StationHandle {
  let lang = o.lang;
  const t = (k: string) => tr(T[k], lang);
  const healthy = healthyModel();
  const live = new LivePatient(o.patient?.model ?? healthy);
  const rec = new BreathRecorder(20, 0.02);
  live.run.resp.recorder = rec;
  let raf = 0, stopped = false, ready = false, settling = false;
  let test: RespTestId = 'look';
  let site = 'chest.lung-base.R';
  let cursor: number | null = null;
  let textKey = '', chestKey = '';
  let stopChest: (() => void) | null = null;
  const settings = stationSettings(RESP_STATION);
  const open = new Set<string>(['mechanics/airways', 'mechanics/pleura']);
  const overlays = { lobes: false, landmarks: false };
  const signLabel = (x: string) => labelOf(KNOWLEDGE, `sign:${x}`, lang);
  const testLabel = (id: RespTestId) => tr(RESP_TEST_BY_ID[id].label, lang);
  let mode: 'explore' | 'identify' = 'explore';
  let predict = false;
  let pending: { id: string; picked: Set<string> } | null = null;
  let awaiting: { before: Set<string>; picked: string[] } | null = null;
  let feedback: { brought: string[]; took: string[]; picked: string[] } | null = null;
  let signs: ReturnType<typeof respSignsOf> | null = null;
  const id: { pool: string[]; n: number; hidden: string; truth: ReturnType<typeof respSignsOf> | null; named: Set<string>; mech: string; checked: boolean; right: number; done: number } =
    { pool: [], n: 0, hidden: 'healthy', truth: null, named: new Set(), mech: '', checked: false, right: 0, done: 0 };
  const presetLabel = (pid: string) => (pid === 'healthy' ? t('healthyPatient') : tr(RESP_PRESETS.find((p) => p.id === pid)?.label ?? L(pid, pid), lang));
  const resp = (): RespSnapshot => live.snap.resp as RespSnapshot;

  /* ---- what the examination finds ------------------------------------------------------------------ */
  const finding = (ref: string, ctx: ExamContext = {}) => {
    const f = respObserve(live.model, live.snap, ref, ctx, live.chemistry);
    const prop = ref.replace(/\.(L|R)$/, ''), side = /\.(L|R)$/.exec(ref)?.[1];
    const text = FORMATTERS[CATALOG.properties[prop]?.formatter ?? prop]?.(f.value, ctx, lang, CATALOG, { property: prop, side } as any) ?? JSON.stringify(f.value);
    return { value: f.value as any, text, normal: f.normal, basis: f.basis };
  };
  const siteParts = (s: string) => { const m = /^chest\.(.+)\.(L|R)$/.exec(s)!; return { key: m[1] as SiteKey, side: m[2] as 'L' | 'R' }; };
  const siteRef = (tid: RespTestId) => (tid === 'percussion' ? 'chest.percussion' : tid === 'resonance' ? 'chest.resonance' : 'lung.sounds');
  const thoraxLook = (): ThoraxLook => {
    const ap = appearanceOf(FREE_CASE.patient as Parameters<typeof appearanceOf>[0], 7);
    return { skin: ap.skin, shade: ap.skinShade, sex: FREE_CASE.patient.sex, figure: figureLookFor(FREE_CASE.patient, { exposure: ['chest'] } as any, 7, figureFindings()) };
  };
  const figureFindings = (): FigureFindings => {
    const g = finding('general.appearance').value ?? {}, b = finding('breathing.pattern').value ?? {};
    return { colour: g.colour, sweating: g.sweating, distress: g.distress, breathing: { hyperinflated: !!b.hyperinflated, accessory: !!b.accessory, pursedLips: !!b.pursedLips } };
  };

  /* ---- layout ----------------------------------------------------------------------------------------- */
  const head = () => `<div class="st-head">
        <button type="button" class="ghost" data-leave>← ${o.backLabel ? tr(o.backLabel, lang) : t('back')}</button>
        <div class="st-title"><div class="eyebrow">${t('eyebrow')}</div><h1>${esc(tr(RESP_STATION.title, lang))}</h1><p class="lede">${esc(tr(RESP_STATION.summary, lang))}</p></div>
        <span class="seg st-mode" role="radiogroup" aria-label="${t('mode')}">${(['explore', 'identify'] as const).map((m) => `<button type="button" role="radio" aria-checked="${mode === m}" data-mode="${m}">${t(m)}</button>`).join('')}</span>
      </div>
      ${mode === 'explore' ? patientBanner(o, lang) : ''}
      ${ready ? '' : `<p class="muted" data-preparing>${t('preparing')}</p>`}`;
  const chips = (ids: string[], on: Set<string>, attr: string, disabled = false) => ids.map((x) =>
    `<button type="button" class="chip st-chip" ${attr}="${x}" aria-pressed="${on.has(x)}" ${disabled ? 'disabled' : ''}>${esc(signLabel(x))}</button>`).join('');
  const groupedChips = (on: Set<string>, attr: string, disabled = false) => respSignGroups().map((g) =>
    `<div class="st-chip-group"><div class="muted small">${esc(testLabel(g.test))}</div><div class="st-chips">${chips(g.signs, on, attr, disabled)}</div></div>`).join('');
  const testTabs = () => `<div class="seg st-tests" role="tablist" aria-label="${t('exam')}">${RESP_TESTS.map((x) => `<button type="button" role="tab" aria-selected="${test === x.id}" data-test="${x.id}">${esc(tr(x.label, lang))}</button>`).join('')}</div>
    <p class="muted small" data-how>${esc(tr(RESP_TEST_BY_ID[test].how, lang))}</p>`;

  const signalHtml = () => `<section class="panel st-signal" aria-labelledby="st-ex-h">
      <div class="st-row"><div><h2 id="st-ex-h">${mode === 'identify' ? `${t('unknown')} ${id.n}` : t('exam')}</h2><div class="muted small">${mode === 'identify' ? t('unknownNote') : t('examNote')}</div></div></div>
      ${mode === 'identify' && !id.truth ? `<p class="muted" data-recording role="status">${t('preparingUnknown')}</p>` : ''}
      ${testTabs()}
      <div class="st-resp-signal" data-signal></div>
      ${mode === 'explore' ? `<ul class="st-findings plain small" data-findings aria-live="polite"></ul><div data-chart></div><div class="st-signs" data-signs aria-live="polite"></div><span class="st-note" role="status" data-note></span><div data-predict-box></div>` : ''}
    </section>`;

  const render = () => {
    stopChest?.(); stopChest = null; chestKey = '';
    if (mode === 'identify') { renderIdentify(); return; }
    host.innerHTML = `${head()}
      <div class="st-grid">
        <aside class="panel st-settings" aria-labelledby="st-set-h">
          <h2 id="st-set-h">${t('settings')}</h2>
          <p class="layer-note">${t('settingsNote')}</p>
          <label class="st-preset">${t('startFrom')}
            <select data-preset><option value="">${t('choose')}</option>${RESP_PRESET_GROUPS.map((g) => `<optgroup label="${esc(tr(g.group, lang))}">${g.ids.map((x) => RESP_PRESETS.find((p) => p.id === x)!).map((p) => `<option value="${p.id}">${esc(tr(p.label, lang))}</option>`).join('')}</optgroup>`).join('')}</select>
          </label>
          <button type="button" class="ghost small" data-healthy>${t('healthy')}</button>
          <label class="st-predict"><input type="checkbox" data-predict ${predict ? 'checked' : ''}><span><b>${t('predict')}</b><br><span class="muted small">${t('predictNote')}</span></span></label>
          <div data-controls></div>
        </aside>
        <div class="st-main">
          ${signalHtml()}
          <section class="panel st-why st-why-wide" aria-labelledby="st-under-h">
            <div class="st-row"><div><h2 id="st-under-h">${t('beneath')}</h2><div class="muted small">${t('beneathNote')}</div></div></div>
            <div class="st-resp-mech"><figure class="st-lungs" data-lungs></figure>
              <div><div class="st-legend small" data-legend></div><div class="small" data-under></div></div></div>
            <h3 class="small">${t('breath')}</h3><div class="muted small">${t('breathNote')}</div>
            <canvas class="st-breath" aria-label="${t('breath')}"></canvas>
            <div data-vq-box ${test === 'look' ? '' : 'hidden'}><h3 class="small">${t('vq')}</h3><canvas class="st-vq" aria-label="${t('vq')}"></canvas></div>
            <div class="st-text" data-text></div>
          </section>
        </div>
      </div>`;
    renderControls();
    wire();
    renderPredict();
    textKey = '';
    renderSignal();
  };

  /* ---- the signal: one test ------------------------------------------------------------------------- */
  const renderSignal = () => {
    const box = host.querySelector<HTMLElement>('[data-signal]');
    if (!box || !ready || settling) return;
    const mode2 = SITE_MODE[test];
    if (mode2) {
      const value = finding(siteRef(test), { site }).value;
      const key = JSON.stringify([test, site, value, lang, mode]);
      if (key === chestKey) return;
      stopChest?.();
      chestKey = key;
      const r = resp();
      stopChest = mountChest(box, {
        look: thoraxLook(), site, mode: mode2, value,
        breathing: { rr: r.RR, ti: r.Ti, tauE: r.tauE },
        lang, caption: mode === 'identify' ? tr(L('Tap a site to examine there.', 'Eine Stelle antippen, um dort zu untersuchen.'), lang) : finding(siteRef(test), { site }).text,
        overlays,
        onExamAt: (s2, m) => { site = s2; test = MODE_TEST[m]; syncTabs(); textKey = ''; renderSignal(); renderFindings(); },
      });
      return;
    }
    stopChest?.(); stopChest = null;
    const key = JSON.stringify([test, lang, mode, live.model.respiratory]);
    if (key === chestKey) return;
    chestKey = key;
    if (test === 'look') {
      const g = finding('general.appearance').value ?? {}, b = finding('breathing.pattern'), ox = finding('vitals.spo2').value ?? {}, rr = finding('vitals.rr').value;
      const says = b.value?.speech === 'sentences' ? (g.distress && g.distress !== 'none' ? SAYS.sentences : SAYS.fine) : SAYS[b.value?.speech ?? 'sentences'];
      const lk = figureLookFor(FREE_CASE.patient, { exposure: ['chest'] } as any, 7, figureFindings());
      box.innerHTML = `<div class="st-look"><figure class="st-look-fig"><svg class="st-look-svg" viewBox="0 0 360 380" xmlns="http://www.w3.org/2000/svg" role="img"><g data-fig>${figureSvg(POSES.sitting, lk, VIEW_FRONT, { scene: false })}</g></svg></figure>
        <div><div class="st-ox"><div class="muted small">${t('oximeter')}</div><div class="st-ox-n">${Math.round(ox.spo2 ?? 0)} %</div><div class="muted small">FiO₂ ${Math.round((ox.fio2 ?? 0.21) * 100)} %</div></div>
        <p><b>${t('counted')}:</b> ${Math.round(Number(rr ?? 0))}/min</p>
        <p><b>${t('says')}:</b> ${esc(tr(says, lang))}</p>
        <p><b>${t('see')}:</b> ${esc(b.text)}</p></div></div>`;
      /* framed on what the look reads: the head, the neck and the chest (the upper half of the figure as drawn) */
      const figG = box.querySelector<SVGGElement>('[data-fig]'), svg = box.querySelector<SVGSVGElement>('.st-look-svg');
      try { const bb = figG!.getBBox(); if (bb.width > 0) svg!.setAttribute('viewBox', `${bb.x - bb.width * 0.25} ${bb.y - 4} ${bb.width * 1.5} ${bb.height * 0.5}`); } catch { /* not laid out */ }
    } else if (test === 'trachea') {
      const lk = thoraxLook();
      box.innerHTML = `<figure class="st-trachea">${tracheaSvg(mediastinalShift(resp(), resp().params as any), lk, { notch: t('notch'), left: t('left'), right: t('right') })}</figure>`;
    } else if (test === 'expansion') {
      box.innerHTML = `<figure class="st-expansion" data-hands></figure><p class="muted small">${t('handsNote')}</p>`;
    }
  };
  const syncTabs = () => host.querySelectorAll<HTMLButtonElement>('[data-test]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.test === test)));

  /* ---- findings (Explore) ------------------------------------------------------------------------------ */
  const renderFindings = () => {
    const box = host.querySelector<HTMLElement>('[data-findings]'), chart = host.querySelector<HTMLElement>('[data-chart]');
    if (!box || !ready || settling) return;
    const rows: Array<ReturnType<typeof finding>> = test === 'look' ? [finding('general.appearance'), finding('breathing.pattern'), finding('vitals.rr'), finding('vitals.spo2')]
      : test === 'trachea' ? [finding('trachea.position')]
        : test === 'expansion' ? [finding('chest.expansion.R'), finding('chest.expansion.L')]
          : [finding(siteRef(test), { site })];
    box.innerHTML = rows.map((r) => `<li>${r.normal ? '' : '<b class="abn" aria-label="abnormal">●</b> '}${esc(r.text)}</li>`).join('');
    if (!chart) return;
    if (!SITE_MODE[test]) { chart.innerHTML = ''; return; }
    /* the learner's chart: this test at every site, both sides, the site being examined marked */
    const vsName = test === 'percussion' ? 'percussion' : test === 'resonance' ? 'vocal-resonance' : 'breath-sounds';
    const cell = (key: SiteKey, side: 'L' | 'R') => {
      const s2 = `chest.${key}.${side}`, f = finding(siteRef(test), { site: s2 });
      const code = test === 'percussion' ? f.value.note : test === 'resonance' ? f.value.resonance : f.value.breath;
      const lab = tr(CATALOG.valueSets[vsName]?.values.find((v) => v.code === code)?.label ?? L(code, code), lang);
      const added = test === 'auscultation' && f.value.added?.length ? ` + ${f.value.added.map((a: string) => tr(CATALOG.valueSets['added-lung']?.values.find((v) => v.code === a)?.label ?? L(a, a), lang)).join(', ')}` : '';
      return `<td class="${f.normal ? '' : 'abn'}${s2 === site ? ' st-here' : ''}"><button type="button" class="linkish" data-site="${s2}">${esc(lab + added)}</button></td>`;
    };
    chart.innerHTML = `<table class="st-chart small"><caption class="muted">${t('chart')}: ${esc(testLabel(test))}</caption>
      <thead><tr><th>${t('siteCol')}</th><th>${t('rCol')}</th><th>${t('lCol')}</th></tr></thead>
      <tbody>${RESP_SITES.map((s) => `<tr><th>${esc(tr(s.label, lang))}</th>${cell(s.key, 'R')}${cell(s.key, 'L')}</tr>`).join('')}</tbody></table>`;
    chart.querySelectorAll<HTMLButtonElement>('[data-site]').forEach((b) => b.onclick = () => { site = b.dataset.site!; textKey = ''; renderSignal(); renderFindings(); });
  };
  const renderSigns = () => {
    const box = host.querySelector<HTMLElement>('[data-signs]');
    if (!box || !signs) return;
    const sides = (x: string) => { const s = [...(signs!.sides.get(x) ?? [])]; return s.length === 1 ? ` (${t(s[0] === 'L' ? 'sideL' : 'sideR')})` : ''; };
    box.innerHTML = `<span class="muted small">${t('signsNow')}:</span> ${signs.present.size
      ? [...signs.present].map((x) => `<span class="sign" title="${esc(`${t('at')}: ${(signs!.where.get(x) ?? []).map(testLabel).join('; ')}`)}">${esc(signLabel(x) + sides(x))}</span>`).join('')
      : `<span class="muted small">${t('noSigns')}</span>`}`;
  };

  /* ---- the mechanism (Explore) --------------------------------------------------------------------------- */
  const LOBE: Record<LobeId, LocalizedText> = { RUL: L('RUL', 'OL r'), RML: L('RML', 'ML'), RLL: L('RLL', 'UL r'), LUL: L('LUL', 'OL l'), LLL: L('LLL', 'UL l') };
  const lobeLabels = () => Object.fromEntries(Object.entries(LOBE).map(([k, v]) => [k, tr(v, lang)])) as Record<LobeId, string>;
  const css = (n: string) => getComputedStyle(host).getPropertyValue(n).trim() || '#888';
  const colors = () => ({ fg: css('--fg'), muted: css('--muted'), accent: css('--accent'), line: css('--line'), surface: css('--surface') });
  const chestView = (): 'front' | 'back' => (SITE_MODE[test] && AUSCULTATION_SITES[site]?.view === 'back' ? 'back' : 'front');
  const renderLungs = () => {
    const fig = host.querySelector<HTMLElement>('[data-lungs]');
    if (!fig) return;
    const r = resp(), p = r.params, view = chestView();
    let st;
    if (SITE_MODE[test]) {
      const { key, side } = siteParts(site), a = AUSCULTATION_SITES[site];
      st = { x: view === 'back' ? -a.x : a.x, y: a.y, side, lobes: SITE_LOBES[key][side] };
    }
    fig.innerHTML = lungsSvg({ view, lobes: r.lobes, effusion: { L: p.effusionL, R: p.effusionR }, ptx: { L: p.ptxL, R: p.ptxR }, tension: { L: p.tensionL, R: p.tensionR },
      shift: mediastinalShift(r, p as any), bronchoconstriction: p.bronchoconstriction, emphysema: p.emphysema, fibrosis: p.fibrosis, interstitial: r.interstitial,
      tlcRatio: tissueVolume(p, r.interstitial), volume: r.V, site: st, fluidReaches: FLUID_REACHES, beat: 0 }, colors(),
      { fluid: t('fluid'), air: t('freeAir'), lobe: lobeLabels() });
  };
  const renderLegend = () => {
    const lg = host.querySelector<HTMLElement>('[data-legend]'), un = host.querySelector<HTMLElement>('[data-under]');
    if (lg) lg.innerHTML = (['air', 'solid', 'water', 'airless'] as const).map((k) => `<span class="st-key"><i style="background:rgb(${FILL[k].join(',')})"></i>${t(k)}</span>`).join(' ');
    if (!un) return;
    if (!SITE_MODE[test]) { un.innerHTML = ''; return; }
    const { key, side } = siteParts(site), u = underSite(resp(), key, side);
    un.innerHTML = `<b>${t('under')}</b>: ${SITE_LOBES[key][side].map(([l, w]) => `${tr(LOBE[l], lang)} ${Math.round(w * 100)} %`).join(' · ')}<br>
      ${t('air')} ${Math.round(u.aerated * 100)} % · ${t('solid')} ${Math.round(u.solid * 100)} % · ${t('water')} ${Math.round(u.flooded * 100)} % · ${t('airless')} ${Math.round((u.obstructed + u.compressed) * 100)} %`;
  };
  const sizeCanvas = (c: HTMLCanvasElement, h: number) => {
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth;
    if (c.style.height !== `${h}px`) c.style.height = `${h}px`;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    return { g, w };
  };
  const breathWindow = () => { const s = rec.samples, to = s.at(-1)?.t ?? 0; const rr = Math.max(6, resp().RR || 12); return { from: to - Math.min(18, Math.max(8, 3 * 60 / rr)), to }; };
  const drawMechanism = () => {
    const bc = host.querySelector<HTMLCanvasElement>('.st-breath');
    if (bc) {
      const { from, to } = breathWindow();
      const bw = bc.clientWidth, bh = Math.max(220, Math.min(300, bw * 0.38));
      const added = SITE_MODE[test] === 'listen' ? finding('lung.sounds', { site }).value?.added ?? [] : [];
      drawBreath(sizeCanvas(bc, bh).g, bw, bh, rec.samples, from, to, { ...colors(), flow: '#2f6f9f', vol: '#1f6f66', ppl: '#8a4b2f', palv: '#7a3fa0', pmus: '#b07d1a' },
        { vol: t('vol'), flow: t('flow'), pres: t('pres'), insp: t('insp'), ppl: t('ppl'), palv: t('palv'), pmus: t('pmus'), added: t('added') },
        { added: { fine: added.includes('fine-crackles'), coarse: added.includes('coarse-crackles'), wheeze: added.includes('wheeze') }, cursor });
    }
    const vq = host.querySelector<HTMLCanvasElement>('.st-vq');
    if (vq && test === 'look') { const w = vq.clientWidth, h = 170; drawVQ(sizeCanvas(vq, h).g, w, h, resp().lobes, colors(), { vent: t('vent'), perf: t('perf'), shunt: t('shunt'), lobe: lobeLabels() }); }
  };
  const drawHands = () => {
    const fig = host.querySelector<HTMLElement>('[data-hands]');
    if (!fig) return;
    const r = resp(), s = rec.samples;
    const lo = s.length ? Math.min(...s.map((x) => x.V)) : 0;
    const share = (side: 'L' | 'R') => r.lobes.filter((l) => l.side === side).reduce((a, l) => a + l.ventShare, 0);
    /* a deep breath moves each hand about 2.5 cm in health (half the normal 5 cm between the thumbs): the tidal breath scaled to it */
    const k = 2.5 / Math.max(0.2, 0.5 * r.VT);
    const now = Math.max(0, r.V - lo);
    fig.innerHTML = expansionSvg(thoraxLook(), k * now * share('L'), k * now * share('R'), { left: t('left'), right: t('right') });
  };
  const ctxNow = (): RespContext => {
    const r = resp(), p = r.params;
    let s: RespContext['site'];
    if (SITE_MODE[test]) {
      const { key, side } = siteParts(site), u = underSite(r, key, side);
      const snd = finding('lung.sounds', { site }).value, per = finding('chest.percussion', { site }).value, res = finding('chest.resonance', { site }).value;
      const E = side === 'L' ? p.effusionL : p.effusionR;
      s = { key, side, label: RESP_SITES.find((x) => x.key === key)!.label, note: per.note, breath: snd.breath, added: snd.added, resonance: res.resonance,
        under: { aerated: u.aerated, solid: u.solid, flooded: u.flooded, obstructed: u.obstructed, compressed: u.compressed, ptx: u.ptx }, fluid: E, fluidHere: E >= FLUID_REACHES[key] };
    }
    const share = (side: 'L' | 'R') => r.lobes.filter((l) => l.side === side).reduce((a, l) => a + l.ventShare, 0);
    const tr2 = finding('trachea.position').value ?? {};
    return {
      test, site: s,
      r: { RR: r.RR, VT: r.VT, VE: r.VE, SaO2: r.SaO2, PaO2: r.PaO2, PaCO2: r.PaCO2, AaGradient: r.AaGradient, shunt: r.shunt, VDVT: r.VDVT, iPEEP: r.iPEEP, tauE: r.tauE, Te: r.Te, Ti: r.Ti,
        effort: r.effort, demand: r.demand, capacity: r.capacity, deoxyHb: r.deoxyHb, interstitial: r.interstitial, FiO2: p.FiO2, FEV1pct: (r.FEV1 / r.pred.FEV1) * 100, PEFpct: (r.PEF / r.pred.PEF) * 100 },
      p: { bronchoconstriction: p.bronchoconstriction, emphysema: p.emphysema, fibrosis: p.fibrosis, muscleStrength: p.muscleStrength, effusionL: p.effusionL, effusionR: p.effusionR, ptxL: p.ptxL, ptxR: p.ptxR,
        tensionL: p.tensionL, tensionR: p.tensionR, capillaryLeak: p.capillaryLeak, emb: p.embRUL + p.embRML + p.embRLL + p.embLUL + p.embLLL },
      trachea: { position: tr2.position ?? 'central', shift: mediastinalShift(r, p as any) },
      expansion: { L: { share: share('L'), finding: finding('chest.expansion.L').value?.expansion ?? 'normal' }, R: { share: share('R'), finding: finding('chest.expansion.R').value?.expansion ?? 'normal' } },
      pattern: finding('breathing.pattern').value ?? {}, cyanosisAt: EXAM.cyanosis,
    };
  };
  const renderText = () => {
    const box = host.querySelector<HTMLElement>('[data-text]');
    if (!box) return;
    const key = JSON.stringify([lang, test, site, live.model.respiratory, live.model.circulation.Emax, Math.round(resp().RR), Math.round(resp().SaO2 * 100)]);
    if (key === textKey) return;
    textKey = key;
    box.innerHTML = explainResp(ctxNow()).map((x) => `<h3>${esc(tr(x.title, lang))}</h3>${x.body.map((b) => `<p>${esc(tr(b, lang))}</p>`).join('')}`).join('');
    renderLungs(); renderLegend();
    const vqb = host.querySelector<HTMLElement>('[data-vq-box]'); if (vqb) vqb.hidden = test !== 'look';
  };

  /* ---- predict -------------------------------------------------------------------------------------------- */
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
        awaiting = { before: signs?.present ?? new Set(), picked: [...pending!.picked] };
        const pid = pending!.id;
        pending = null; feedback = null;
        void change(applyRespPreset(live.model, healthy.circulation, pid), true);
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

  /* ---- identify ------------------------------------------------------------------------------------------- */
  const nextUnknown = () => {
    if (!id.pool.length) id.pool = [...IDENTIFY_POOL].sort(() => Math.random() - 0.5);
    id.hidden = id.pool.pop()!;
    id.n++; id.truth = null; id.named = new Set(); id.mech = ''; id.checked = false;
    test = 'look'; site = 'chest.lung-base.R';
    void change(id.hidden === 'healthy' ? healthyModel() : applyRespPreset(healthyModel(), healthy.circulation, id.hidden), false);
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
            ${RESP_PRESET_GROUPS.map((g) => `<optgroup label="${esc(tr(g.group, lang))}">${g.ids.map((x) => `<option value="${x}" ${id.mech === x ? 'selected' : ''}>${esc(presetLabel(x))}</option>`).join('')}</optgroup>`).join('')}</select>
          </label>
          ${id.checked ? `<button type="button" class="primary" data-next>${t('next')}</button>` : `<button type="button" class="primary" data-check ${id.truth && id.mech ? '' : 'disabled'}>${t('check')}</button>`}
          ${id.done ? `<p class="muted small">${id.right} / ${id.done} ${t('score')}</p>` : ''}
        </aside>
        <div class="st-main">${signalHtml()}${id.checked ? resultHtml() : ''}</div>
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
      render();
    });
    host.querySelector<HTMLButtonElement>('[data-next]')?.addEventListener('click', () => { nextUnknown(); render(); });
    host.querySelector<HTMLButtonElement>('[data-why]')?.addEventListener('click', () => { mode = 'explore'; render(); });
    renderSignal();
  };
  const resultHtml = () => {
    const truth = id.truth!;
    const hits = [...id.named].filter((x) => truth.present.has(x)), misses = [...truth.present].filter((x) => !id.named.has(x)), over = [...id.named].filter((x) => !truth.present.has(x));
    const col = (title: string, xs: string[], cls: string) => `<div class="st-res ${cls}"><h3>${title}</h3>${xs.length ? `<ul>${xs.map((x) => `<li>${esc(signLabel(x))}</li>`).join('')}</ul>` : `<p class="muted small">—</p>`}</div>`;
    const right = id.mech === id.hidden;
    const where = [...truth.present].map((x) => `<li><b>${esc(signLabel(x))}</b>: ${esc((truth.where.get(x) ?? []).map(testLabel).join('; '))}${(truth.sides.get(x)?.size ?? 0) === 1 ? ` (${t([...truth.sides.get(x)!][0] === 'L' ? 'sideL' : 'sideR')})` : ''}</li>`).join('');
    return `<section class="panel st-result" aria-labelledby="st-res-h">
      <h2 id="st-res-h" class="${right ? 'ok' : 'abn'}">${right ? t('mechRight') : t('mechWrong')}: ${esc(presetLabel(id.hidden))}</h2>
      <div class="st-res-grid">${col(t('hits'), hits, 'hit')}${col(t('misses'), misses, 'miss')}${col(t('over'), over, 'over')}</div>
      ${where ? `<div><h3 class="small">${t('foundWhere')}</h3><ul class="small">${where}</ul></div>` : ''}
      <button type="button" class="ghost" data-why>${t('seeWhy')}</button>
    </section>`;
  };

  /* ---- settings ------------------------------------------------------------------------------------------- */
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
      const def = settings.flatMap((g) => g.vars).find((x) => x.key === key);
      el.addEventListener('input', () => { const out = box.querySelector<HTMLOutputElement>(`[data-out="${CSS.escape(key)}"]`); if (out && def && el instanceof HTMLInputElement && el.type === 'range') out.textContent = `${fmtValue(def, Number(el.value), lang)} ${def.unit}`; });
      el.addEventListener('change', () => {
        let v: unknown;
        if (el instanceof HTMLInputElement && el.type === 'checkbox') { const cur = getPath(live.model, key); v = typeof cur === 'boolean' ? el.checked : el.checked ? 1 : 0; }
        else if (el instanceof HTMLInputElement) v = Number(el.value);
        else v = el.value;
        const next = structuredClone(live.model);
        setPath(next, key, v);
        void change(next, false);
      });
    });
  };
  /* After a change the lungs and the circulation are run through their settling (gases, lung water, the drive, the
     heart), so what is found is the new steady state. */
  const change = async (next: PatientModel, rerenderControls: boolean) => {
    live.setModel(next);
    settling = true; signs = null; chestKey = ''; textKey = ''; note(t('settling'));
    if (rerenderControls) renderControls();
    await live.settle(SETTLE_S);
    if (stopped) return;
    /* settling restarts the breath from the relaxed lung (equilibrate): the record starts after it */
    rec.clear();
    settling = false; note('');
    signs = respSignsOf(live.model, live.snap, live.chemistry);
    if (awaiting) {
      const after = signs.present, a = awaiting;
      feedback = { brought: [...after].filter((x) => !a.before.has(x)), took: [...a.before].filter((x) => !after.has(x)), picked: a.picked };
      awaiting = null; renderPredict();
    }
    if (mode === 'identify' && !id.truth) {
      id.truth = signs;
      host.querySelector('[data-recording]')?.remove();
      const c = host.querySelector<HTMLButtonElement>('[data-check]'); if (c) c.disabled = !id.mech;
    }
    renderSignal(); renderFindings(); renderSigns(); textKey = '';
  };
  const note = (x: string) => { const n = host.querySelector<HTMLElement>('[data-note]'); if (n) n.textContent = x; };

  const wireCommon = () => {
    host.querySelector<HTMLButtonElement>('[data-leave]')!.onclick = () => o.onLeave();
    host.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => b.onclick = () => {
      const m = b.dataset.mode as typeof mode;
      if (m === mode) return;
      mode = m; pending = null; awaiting = null; feedback = null;
      if (mode === 'identify') { if (!id.n || id.checked) nextUnknown(); }
      render();
    });
    host.querySelectorAll<HTMLButtonElement>('[data-test]').forEach((b) => b.onclick = () => {
      test = b.dataset.test as RespTestId; syncTabs(); textKey = ''; chestKey = '';
      const how = host.querySelector<HTMLElement>('[data-how]'); if (how) how.textContent = tr(RESP_TEST_BY_ID[test].how, lang);
      renderSignal(); renderFindings();
    });
    const bc = host.querySelector<HTMLCanvasElement>('.st-breath');
    bc?.addEventListener('pointerdown', (ev) => {
      const r = bc.getBoundingClientRect(), { from, to } = breathWindow();
      cursor = from + ((ev.clientX - r.left - 46) / (r.width - 54)) * (to - from);
    });
  };
  const wire = () => {
    wireCommon();
    host.querySelector<HTMLSelectElement>('[data-preset]')!.onchange = (e) => {
      const pid = (e.target as HTMLSelectElement).value;
      if (!pid) return;
      if (predict) { pending = { id: pid, picked: new Set() }; feedback = null; renderPredict(); return; }
      feedback = null;
      void change(applyRespPreset(live.model, healthy.circulation, pid), true);
    };
    host.querySelector<HTMLInputElement>('[data-predict]')!.onchange = (e) => { predict = (e.target as HTMLInputElement).checked; pending = null; renderPredict(); };
    host.querySelector<HTMLButtonElement>('[data-healthy]')!.onclick = () => { pending = null; feedback = null; void change(healthyModel(), true); host.querySelector<HTMLSelectElement>('[data-preset]')!.value = ''; };
  };

  /* ---- the clock ------------------------------------------------------------------------------------------- */
  let tick = 0;
  const frame = () => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    if (!ready || settling) return;
    if (test === 'expansion') drawHands();
    if (mode === 'explore') {
      drawMechanism();
      if (tick++ % 20 === 0) { renderText(); renderLungs(); }
    }
  };

  render();
  raf = requestAnimationFrame(frame);
  void live.settle(SETTLE_S).then(() => {
    if (stopped) return;
    ready = true;
    rec.clear();
    host.querySelector('[data-preparing]')?.remove();
    signs = respSignsOf(live.model, live.snap, live.chemistry);
    live.start();
    renderSignal(); renderFindings(); renderSigns();
  });

  return {
    stop: () => { stopped = true; cancelAnimationFrame(raf); live.stop(); stopChest?.(); live.run.resp.recorder = null; },
    setLang: (l: Lang) => { lang = l; render(); },
  };
}
