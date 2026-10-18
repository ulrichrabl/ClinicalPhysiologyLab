import { LivePatient } from '../live/live-patient.ts';
import { healthyModel, applyPreset } from '../physiology/state.ts';
import { getPath, setPath } from '../physiology/models.ts';
import type { VariableDef } from '../physiology/types.ts';
import { LEAD_NAMES, leadVectors, standardPlacement, type LeadName } from '../measurements/ecg.ts';
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
   The ECG station (ADR-017, step 1: Explore).

   A healthy adult's heart runs here on its own. The strip is its dipole
   recorded through standard electrodes; the ladder, the heart and the
   arrows are read from the electrical model at the cursor. Playing, the
   cursor is "now" and the paper runs; paused, the last seconds are held
   and the learner moves the cursor through them. The settings are the
   ones the ECG measures (stations/station.ts).
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
};
/** Seconds of strip: four on a wide screen, fewer on a phone so the paper stays readable. */
const secondsFor = (w: number) => (w < 600 ? 2.5 : 4);


const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export interface StationHandle { stop(): void; setLang(l: Lang): void }

export function mountEcgStation(host: HTMLElement, o: { lang: Lang; onLeave: () => void }): StationHandle {
  let lang = o.lang;
  const t = (k: string) => tr(T[k], lang);
  const live = new LivePatient(healthyModel());
  let raf = 0, stopped = false, ready = false;
  let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let slow = false;
  let show: [LeadName, LeadName] = ['II', 'V1'];
  let frozen: ReturnType<LivePatient['recording']> | null = null;
  let cursor = 0;
  let geom: StripGeometry | null = null;
  let textKey = '';
  let note = '';
  const vectors = leadVectors(standardPlacement());
  const seconds = () => secondsFor(host.querySelector<HTMLElement>('.st-strip')?.clientWidth ?? 800);
  const settings = stationSettings(ECG_STATION);
  const presets = stationPresets(ECG_STATION);
  const open = new Set<string>(['electrical/rhythm', 'electrical/conduction', 'driver/fluids.clamp-potassium']);

  const render = () => {
    host.innerHTML = `<div class="st-head">
        <button type="button" class="ghost" data-leave>← ${t('back')}</button>
        <div><div class="eyebrow">${t('eyebrow')}</div><h1>${esc(tr(ECG_STATION.title, lang))}</h1><p class="lede">${esc(tr(ECG_STATION.summary, lang))}</p></div>
      </div>
      ${ready ? '' : `<p class="muted" data-preparing>${t('preparing')}</p>`}
      <div class="st-grid">
        <aside class="panel st-settings" aria-labelledby="st-set-h">
          <h2 id="st-set-h">${t('settings')}</h2>
          <p class="layer-note">${t('settingsNote')}</p>
          <label class="st-preset">${t('startFrom')}
            <select data-preset><option value="">${t('choose')}</option>${presets.map((g) => `<optgroup label="${esc(tr(g.group, lang))}">${g.presets.map((p) => `<option value="${p.id}">${esc(tr(p.label, lang))}</option>`).join('')}</optgroup>`).join('')}</select>
          </label>
          <button type="button" class="ghost small" data-healthy>${t('healthy')}</button>
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
  const wire = () => {
    host.querySelector<HTMLButtonElement>('[data-leave]')!.onclick = () => o.onLeave();
    host.querySelector<HTMLSelectElement>('[data-preset]')!.onchange = (e) => { const id = (e.target as HTMLSelectElement).value; if (id) change(applyPreset(live.model, id), true); };
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
