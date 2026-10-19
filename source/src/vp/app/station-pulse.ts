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
import { pulseSignsOf } from '../stations/pulse-signs.ts';
import { explainPulse } from '../stations/pulse-texts.ts';
import { drawPulseStrip, pulseStripHeight, drawBeat, beatHeight, drawNeck, neckHeight, type PulseColors } from '../render/pulse-strip.ts';
import { arterialWave, type WaveSample } from '../../domains/cardio/sim/waves.ts';
import { KNOWLEDGE, labelOf } from '../knowledge/index.ts';
import { fmtValue } from './math.ts';
import type { Lang } from './diagrams.ts';
import { patientBanner, type StationHandle, type StationOptions } from './station-ecg.ts';
import type { ExamContext } from '../model/types.ts';

/* ---------------------------------------------------------------------------
   The pulse and neck-vein station: Explore.

   A healthy adult's circulation runs here. The signal is what the finger
   feels at the wrist and the carotid and what the eye sees in the neck:
   the last seconds of arterial and right atrial pressure, beat by beat,
   each beat's venous waves named where the model made them, and the
   jugular column at 45° rising and falling with the atrium now. The
   mechanism is one beat in detail. The findings are the examination
   model's, read from these same beats.
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
};
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

  const render = () => {
    host.innerHTML = `<div class="st-head">
        <button type="button" class="ghost" data-leave>← ${o.backLabel ? tr(o.backLabel, lang) : t('back')}</button>
        <div class="st-title"><div class="eyebrow">${t('eyebrow')}</div><h1>${esc(tr(PULSE_STATION.title, lang))}</h1><p class="lede">${esc(tr(PULSE_STATION.summary, lang))}</p></div>
      </div>
      ${patientBanner(o, lang)}
      ${ready ? '' : `<p class="muted" data-preparing>${t('preparing')}</p>`}
      <div class="st-grid">
        <aside class="panel st-settings" aria-labelledby="st-set-h">
          <h2 id="st-set-h">${t('settings')}</h2>
          <p class="layer-note">${t('settingsNote')}</p>
          <label class="st-preset">${t('startFrom')}
            <select data-preset><option value="">${t('choose')}</option>${PULSE_PRESET_GROUPS.map((g) => `<optgroup label="${esc(tr(g.group, lang))}">${g.ids.map((id) => PULSE_PRESETS.find((p) => p.id === id)!).map((p) => `<option value="${p.id}">${esc(tr(p.label, lang))}</option>`).join('')}</optgroup>`).join('')}</select>
          </label>
          <button type="button" class="ghost small" data-healthy>${t('healthy')}</button>
          <div data-controls></div>
        </aside>
        <div class="st-main">
          <section class="panel st-signal" aria-labelledby="st-feel-h">
            <div class="st-row"><div><h2 id="st-feel-h">${t('feel')}</h2><div class="muted small">${t('feelNote')}</div></div>
              <button type="button" class="ghost" data-play>${t('pause')}</button></div>
            <ul class="st-findings plain small" data-findings aria-live="polite"></ul>
            <div class="st-signs" data-signs aria-live="polite"></div>
            <span class="st-note" role="status" data-note></span>
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
    textKey = ''; signsTick = 0; findTick = 0;
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
  const wire = () => {
    host.querySelector<HTMLButtonElement>('[data-leave]')!.onclick = () => o.onLeave();
    host.querySelector<HTMLSelectElement>('[data-preset]')!.onchange = (e) => {
      const pid = (e.target as HTMLSelectElement).value;
      if (pid) change(applyPulsePreset(live.model, healthy.circulation, pid), true);
    };
    host.querySelector<HTMLButtonElement>('[data-healthy]')!.onclick = () => { change(healthyModel(), true); host.querySelector<HTMLSelectElement>('[data-preset]')!.value = ''; };
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
    if (settleUntil && live.t >= settleUntil) { settleUntil = 0; live.speed = 1; note(''); signsTick = 0; findTick = 0; textKey = ''; }
    if (!settleUntil && findTick-- <= 0) { renderFindings(); findTick = 45; }
    if (!settleUntil && signsTick-- <= 0) { renderSigns(); signsTick = 120; }
    const bs = beats();
    if (bs.length < 2) return;
    const colors: PulseColors = { fg: css('--fg'), muted: css('--muted'), accent: css('--accent'), abn: css('--abn'), line: css('--line'), surface: css('--surface'), ven: '#3f6fb5', art: '#c0392b' };
    const strip = host.querySelector<HTMLCanvasElement>('.st-strip'), neck = host.querySelector<HTMLCanvasElement>('.st-neck-c'), bc = host.querySelector<HTMLCanvasElement>('.st-beat');
    if (!strip || !neck || !bc) return;
    const { from, to } = span();
    const sw = strip.clientWidth, sh = pulseStripHeight(sw);
    drawPulseStrip(sizeCanvas(strip, sh).g, sw, sh, bs.filter((b) => b.t0 + b.dur > from), from, to, colors, { ecg: t('ecg'), art: t('art'), ven: t('ven'), mmHg: t('mmHg') });
    const nw = neck.clientWidth, nh = neckHeight(nw);
    /* the neck follows the right atrium now; paused, it shows the mean of the beat in detail */
    const beat = (picked != null ? bs.find((b) => b.t0 === picked) : null) ?? bs.at(-1)!;
    const beatMean = beat.samples.reduce((a, s) => a + s.Pra, 0) / beat.samples.length;
    const praMean = !playing || jvpCm == null ? beatMean : (jvpCm + 5) / 1.36;
    const pra = playing ? (live.snap.Pra as number) : beatMean;
    drawNeck(sizeCanvas(neck, nh).g, nw, nh, pra, praMean, colors, { angle: t('angle'), above: t('above'), notSeen: t('notSeen'), ear: t('ear'), cm: t('cm'), ra: t('raShort') });
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
