import { LivePatient, type BeatRecord } from '../live/live-patient.ts';
import { healthyModel, caseWithModel } from '../physiology/state.ts';
import { getPath, setPath } from '../physiology/models.ts';
import type { VariableDef } from '../physiology/types.ts';
import { CATALOG } from '../data/catalog.ts';
import { REGISTRY } from '../registry.ts';
import { observe } from '../engine/observe.ts';
import { buildView } from '../engine/view.ts';
import { FREE_CASE } from './free-case.ts';
import { FORMATTERS } from '../text/formatters.ts';
import { tr, type LocalizedText } from '../model/i18n.ts';
import { AUSCULTATION_STATION, stationSettings } from '../stations/station.ts';
import { AUSC_PRESETS, AUSC_PRESET_GROUPS, applyAuscPreset } from '../stations/auscultation-presets.ts';
import { cycleAt, cycleSegments, valveEvents, meanMitralGradient, CYCLE_PHASES, type CyclePhase } from '../stations/cardiac-cycle.ts';
import { explainCycle, CYCLE_LABEL } from '../stations/auscultation-texts.ts';
import { cycle as phonoCycle } from '../render/phono.ts';
import { drawPhonoStrip, phonoStripHeight, type StripBeat, type PhonoGeometry } from '../render/phono-strip.ts';
import { drawWiggers, wiggersHeight, type WiggersGeometry } from '../render/wiggers.ts';
import { playCycle } from './sound.ts';
import { fmtValue } from './math.ts';
import type { Lang } from './diagrams.ts';
import type { StationHandle } from './station-ecg.ts';
import type { ExamContext } from '../model/types.ts';

/* ---------------------------------------------------------------------------
   The auscultation station (ADR-017 step 4): Explore.

   A healthy adult's circulation runs here on its own. The signal is the
   phonocardiogram the examination model gives at the chosen site, timed
   beat by beat from the circulation's valve events, under the ECG the same
   beats produced and over the breath they fell in. The mechanism is the
   beat at the cursor as a Wiggers diagram: pressures, volume, valve events
   and phases, all the model's own. Playing, the cursor sweeps the most
   recent beat; paused, the learner moves it through the last beats, and can
   listen to the beat under it on its own.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });
const T: Record<string, LocalizedText> = {
  eyebrow: L('Station', 'Station'), back: L('Ward', 'Übersicht'),
  preparing: L('Preparing the heart…', 'Das Herz wird vorbereitet…'),
  settings: L('What moves these sounds', 'Was diese Töne verändert'),
  settingsNote: L('Only the model settings that change this test.', 'Nur die Modelleinstellungen, die diesen Test verändern.'),
  startFrom: L('Start from', 'Ausgangspunkt'), choose: L('Choose a heart…', 'Herz wählen…'), healthy: L('Reset to healthy', 'Auf gesund zurücksetzen'),
  listen: L('Where and how you listen', 'Wo und wie Sie hören'), site: L('Site', 'Ort'), position: L('Position', 'Lage'), breathing: L('Breathing', 'Atmung'),
  diaphragm: L('Diaphragm', 'Membran'), bell: L('Bell', 'Glocke'),
  supine: L('Lying', 'Liegend'), leftLat: L('Left side', 'Linksseitenlage'), forward: L('Sitting forward', 'Vorgebeugt sitzend'),
  quiet: L('Quiet breathing', 'Ruhige Atmung'), held: L('Breath held out', 'In Exspiration angehalten'),
  hear: L('What you hear', 'Was Sie hören'), hearNote: L('The phonocardiogram of the last beats, each timed from its own valves, under the ECG they made', 'Das Phonokardiogramm der letzten Schläge, jeder nach seinen eigenen Klappen getimt, unter dem EKG, das sie erzeugt haben'),
  play: L('Play', 'Abspielen'), pause: L('Pause', 'Anhalten'), slow: L('Slow motion', 'Zeitlupe'),
  sound: L('Listen to this beat', 'Diesen Schlag anhören'), stopSound: L('Stop the sound', 'Ton beenden'),
  hint: L('or tap or drag on the sounds or the diagram; ← → move the cursor', 'oder auf die Töne oder das Diagramm tippen oder ziehen; ← → bewegen den Cursor'),
  why: L('What makes it', 'Was es erzeugt'), mechanism: L('The beat under the cursor', 'Der Schlag unter dem Cursor'),
  left: L('Left heart', 'Linkes Herz'), right: L('Right heart', 'Rechtes Herz'),
  aorta: L('Aorta', 'Aorta'), pa: L('Pulmonary artery', 'Pulmonalarterie'), lv: L('Left ventricle', 'Linker Ventrikel'), rv: L('Right ventricle', 'Rechter Ventrikel'),
  la: L('Left atrium', 'Linker Vorhof'), ra: L('Right atrium', 'Rechter Vorhof'),
  pressure: L('mmHg', 'mmHg'), volume: L('Volume, mL', 'Volumen, mL'), phono: L('PCG', 'PKG'), ecg: L('ECG', 'EKG'),
  insp: L('inspiration', 'Einatmung'), exp: L('expiration', 'Ausatmung'),
  valves: L('The valves now', 'Die Klappen jetzt'), open: L('open', 'offen'), closed: L('closed', 'geschlossen'), leaking: L('leaking', 'undicht'),
  mitral: L('Mitral', 'Mitral'), aortic: L('Aortic', 'Aorten'), tricuspid: L('Tricuspid', 'Trikuspidal'), pulmonic: L('Pulmonary', 'Pulmonal'),
  rate: L('Rate', 'Frequenz'), bp: L('BP', 'RR'), grad: L('Aortic gradient', 'Aortengradient'), msgrad: L('Mitral gradient', 'Mitralgradient'), rf: L('Regurgitant fraction', 'Regurgitationsfraktion'), ef: L('EF', 'EF'), split: L('A2–P2', 'A2–P2'),
  strip: L('Phonocardiogram with ECG and breathing. Arrow keys move the cursor, space plays or pauses.', 'Phonokardiogramm mit EKG und Atmung. Pfeiltasten bewegen den Cursor, Leertaste spielt oder hält an.'),
  diagram: L('Wiggers diagram of the beat at the cursor', 'Wiggers-Diagramm des Schlags am Cursor'),
  noAudio: L('This browser cannot play sound.', 'Dieser Browser kann keinen Ton abspielen.'),
  settling: L('The circulation is settling into its new state…', 'Der Kreislauf stellt sich auf den neuen Zustand ein…'),
};
const SITES = ['chest.aortic-area', 'chest.pulmonary-area', 'chest.erb', 'chest.tricuspid-area', 'chest.mitral-area'];
const PHASE_SHORT: Record<CyclePhase, LocalizedText> = {
  'iso-contraction': L('IVCT', 'Anspannung'), ejection: L('ejection', 'Austreibung'), 'iso-relaxation': L('IVRT', 'Entspannung'),
  'rapid-filling': L('rapid filling', 'rasche Füllung'), diastasis: L('diastasis', 'Diastase'), 'atrial-systole': L('atrial', 'Vorhof'),
};
/** Seconds of phonocardiogram: five on a wide screen, three on a phone. */
const secondsFor = (w: number) => (w < 600 ? 3 : 5);

const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function mountAuscultationStation(host: HTMLElement, o: { lang: Lang; onLeave: () => void }): StationHandle {
  let lang = o.lang;
  const t = (k: string) => tr(T[k], lang);
  const healthy = healthyModel();
  const live = new LivePatient(healthy);
  let raf = 0, stopped = false, ready = false;
  let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let slow = false;
  let frozen: BeatRecord[] | null = null;
  let cursor = 0;
  let stripGeom: PhonoGeometry | null = null, wigGeom: WiggersGeometry | null = null, wigBeat: BeatRecord | null = null;
  let side: 'left' | 'right' = 'left';
  const ctx: ExamContext = { site: 'chest.aortic-area', instrument: 'stethoscope-diaphragm', position: 'supine', respiration: 'quiet' };
  let finding: any = null, findingTick = 0;
  let stopSound: (() => void) | null = null;
  let textKey = '';
  const settings = stationSettings(AUSCULTATION_STATION);
  const open = new Set<string>(['haemodynamics/valves', 'haemodynamics/lv']);
  const seconds = () => secondsFor(host.querySelector<HTMLElement>('.st-strip')?.clientWidth ?? 800);
  const beats = () => frozen ?? live.beats;

  const render = () => {
    host.innerHTML = `<div class="st-head">
        <button type="button" class="ghost" data-leave>← ${t('back')}</button>
        <div class="st-title"><div class="eyebrow">${t('eyebrow')}</div><h1>${esc(tr(AUSCULTATION_STATION.title, lang))}</h1><p class="lede">${esc(tr(AUSCULTATION_STATION.summary, lang))}</p></div>
      </div>
      ${ready ? '' : `<p class="muted" data-preparing>${t('preparing')}</p>`}
      <div class="st-grid">
        <aside class="panel st-settings" aria-labelledby="st-set-h">
          <h2 id="st-set-h">${t('settings')}</h2>
          <p class="layer-note">${t('settingsNote')}</p>
          <label class="st-preset">${t('startFrom')}
            <select data-preset><option value="">${t('choose')}</option>${AUSC_PRESET_GROUPS.map((g) => `<optgroup label="${esc(tr(g.group, lang))}">${g.ids.map((id) => AUSC_PRESETS.find((p) => p.id === id)!).map((p) => `<option value="${p.id}">${esc(tr(p.label, lang))}</option>`).join('')}</optgroup>`).join('')}</select>
          </label>
          <button type="button" class="ghost small" data-healthy>${t('healthy')}</button>
          <div data-controls></div>
        </aside>
        <div class="st-main">
          <section class="panel st-signal" aria-labelledby="st-hear-h">
            <div class="st-row">
              <div><h2 id="st-hear-h">${t('hear')}</h2><div class="muted small">${t('hearNote')}</div></div>
            </div>
            <div class="st-listen" role="group" aria-label="${t('listen')}">
              <label>${t('site')} <select data-site>${SITES.map((s) => `<option value="${s}" ${s === ctx.site ? 'selected' : ''}>${esc(tr(CATALOG.structures[s]?.label ?? L(s, s), lang))}</option>`).join('')}</select></label>
              <span class="seg" role="radiogroup" aria-label="${t('listen')}">${(['stethoscope-diaphragm', 'stethoscope-bell'] as const).map((i) => `<button type="button" role="radio" aria-checked="${ctx.instrument === i}" data-inst="${i}">${t(i === 'stethoscope-bell' ? 'bell' : 'diaphragm')}</button>`).join('')}</span>
              <label>${t('position')} <select data-pos>${([['supine', 'supine'], ['left-lateral', 'leftLat'], ['sitting-forward', 'forward']] as const).map(([v, k]) => `<option value="${v}" ${ctx.position === v ? 'selected' : ''}>${t(k)}</option>`).join('')}</select></label>
              <label>${t('breathing')} <select data-resp>${([['quiet', 'quiet'], ['held-expiration', 'held']] as const).map(([v, k]) => `<option value="${v}" ${ctx.respiration === v ? 'selected' : ''}>${t(k)}</option>`).join('')}</select></label>
            </div>
            <p class="st-heard" data-heard aria-live="polite"></p>
            <div class="st-measures" data-measures></div>
            <canvas class="st-strip" tabindex="0" aria-label="${t('strip')}"></canvas>
          </section>
          <div class="st-bar" role="group">
            <button type="button" class="primary" data-play></button>
            <button type="button" class="ghost" data-slow aria-pressed="${slow}">${t('slow')}</button>
            <button type="button" class="ghost" data-sound aria-pressed="false">${t('sound')}</button>
            <span class="st-phases">${CYCLE_PHASES.map((p) => `<button type="button" class="tog" data-phase="${p}">${esc(tr(CYCLE_LABEL[p], lang))}</button>`).join('')}</span>
            <span class="muted small">${t('hint')}</span>
            <span class="st-note" role="status" data-note></span>
          </div>
          <section class="panel st-why st-why-wide" aria-labelledby="st-why-h">
            <div class="st-row">
              <div><h2>${t('mechanism')}</h2></div>
              <span class="seg" role="radiogroup" aria-label="${t('mechanism')}">${(['left', 'right'] as const).map((x) => `<button type="button" role="radio" aria-checked="${side === x}" data-side="${x}">${t(x)}</button>`).join('')}</span>
            </div>
            <canvas class="st-wiggers" tabindex="0" aria-label="${t('diagram')}"></canvas>
            <div class="st-valves" data-valves aria-label="${t('valves')}"></div>
            <div class="st-text">
              <div class="eyebrow" data-phase-name></div>
              <h3 id="st-why-h" data-title></h3>
              <div data-body></div>
            </div>
          </section>
        </div>
      </div>`;
    renderControls();
    wire();
    textKey = '';
    findingTick = 0;
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
  /* After a change the circulation takes some seconds to settle (blood moves between vessels and heart, the reflexes act):
     the station runs it ahead quickly through that, so what is heard is the new steady state. */
  let settleUntil = 0;
  const SETTLE_S = 20, SETTLE_SPEED = 8;
  const change = (next: ReturnType<typeof healthyModel>, rerenderControls: boolean) => {
    live.setModel(next);
    settleUntil = live.t + SETTLE_S; live.speed = SETTLE_SPEED; note(t('settling'));
    playing = true; frozen = null; findingTick = 0; endSound();
    if (rerenderControls) renderControls();
    syncButtons();
  };

  /* ---- sound --------------------------------------------------------------------------------- */
  const endSound = () => { stopSound?.(); stopSound = null; host.querySelector('[data-sound]')?.setAttribute('aria-pressed', 'false'); const b = host.querySelector<HTMLButtonElement>('[data-sound]'); if (b) b.textContent = t('sound'); };
  const startSound = () => {
    const b = stripBeat(wigBeat ?? beats().at(-1)!);
    if (!b) return;
    stopSound = playCycle(b.cycle);
    const btn = host.querySelector<HTMLButtonElement>('[data-sound]')!;
    if (!stopSound) { note(t('noAudio')); return; }
    btn.setAttribute('aria-pressed', 'true'); btn.textContent = t('stopSound');
  };

  /* ---- wiring -------------------------------------------------------------------------------- */
  const note = (x: string) => { const n = host.querySelector<HTMLElement>('[data-note]'); if (n) n.textContent = x; };
  const syncButtons = () => {
    const play = host.querySelector<HTMLButtonElement>('[data-play]');
    if (play) play.textContent = playing ? t('pause') : t('play');
    host.querySelector('[data-slow]')?.setAttribute('aria-pressed', String(slow));
  };
  const span = () => { const bs = beats(); const last = bs.at(-1); const to = last ? last.t0 + last.dur : 0; return { from: to - seconds() * 1000, to }; };
  const pause = () => { if (playing) { frozen = live.beats.map((b) => b); } playing = false; syncButtons(); };
  const clampCursor = (x: number) => { const s = span(); const first = beats().find((b) => b.t0 + b.dur > s.from); return Math.max(first ? Math.max(s.from, first.t0) : s.from, Math.min(s.to - 1, x)); };
  const wire = () => {
    host.querySelector<HTMLButtonElement>('[data-leave]')!.onclick = () => o.onLeave();
    host.querySelector<HTMLSelectElement>('[data-preset]')!.onchange = (e) => {
      const pid = (e.target as HTMLSelectElement).value;
      if (pid) change(applyAuscPreset(live.model, healthy.circulation, pid), true);
    };
    host.querySelector<HTMLButtonElement>('[data-healthy]')!.onclick = () => { change(healthyModel(), true); host.querySelector<HTMLSelectElement>('[data-preset]')!.value = ''; };
    host.querySelector<HTMLSelectElement>('[data-site]')!.onchange = (e) => { ctx.site = (e.target as HTMLSelectElement).value; findingTick = 0; endSound(); };
    host.querySelector<HTMLSelectElement>('[data-pos]')!.onchange = (e) => { ctx.position = (e.target as HTMLSelectElement).value as ExamContext['position']; findingTick = 0; endSound(); };
    host.querySelector<HTMLSelectElement>('[data-resp]')!.onchange = (e) => { ctx.respiration = (e.target as HTMLSelectElement).value as ExamContext['respiration']; findingTick = 0; endSound(); };
    host.querySelectorAll<HTMLButtonElement>('[data-inst]').forEach((b) => b.onclick = () => {
      ctx.instrument = b.dataset.inst!; findingTick = 0; endSound();
      host.querySelectorAll('[data-inst]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    });
    host.querySelectorAll<HTMLButtonElement>('[data-side]').forEach((b) => b.onclick = () => {
      side = b.dataset.side as typeof side;
      host.querySelectorAll('[data-side]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    });
    host.querySelector<HTMLButtonElement>('[data-play]')!.onclick = () => { if (playing) pause(); else { playing = true; frozen = null; note(''); syncButtons(); } };
    host.querySelector<HTMLButtonElement>('[data-slow]')!.onclick = () => { slow = !slow; if (!settleUntil) live.speed = slow ? 0.25 : 1; syncButtons(); };
    host.querySelector<HTMLButtonElement>('[data-sound]')!.onclick = () => { if (stopSound) endSound(); else startSound(); };
    host.querySelectorAll<HTMLButtonElement>('[data-phase]').forEach((b) => b.onclick = () => {
      pause();
      const beat = wigBeat ?? beats().at(-1);
      if (!beat) return;
      const seg = cycleSegments(beat, side).find((x) => x.phase === b.dataset.phase);
      if (!seg) { note(tr(L('Not in this beat.', 'Nicht in diesem Schlag.'), lang)); return; }
      cursor = beat.t0 + (seg.from + seg.to) / 2; note('');
    });
    const seekOn = (canvas: HTMLCanvasElement, toTime: (x: number) => number | null) => {
      let dragging = false;
      const seek = (ev: PointerEvent) => {
        if (playing) pause();
        const r = canvas.getBoundingClientRect();
        const tt = toTime(ev.clientX - r.left);
        if (tt != null) { cursor = clampCursor(tt); note(''); }
      };
      canvas.addEventListener('pointerdown', (ev) => { dragging = true; canvas.setPointerCapture(ev.pointerId); seek(ev); });
      canvas.addEventListener('pointermove', (ev) => { if (dragging) seek(ev); });
      canvas.addEventListener('pointerup', () => { dragging = false; });
      canvas.addEventListener('keydown', (ev) => {
        if (ev.key === ' ') { ev.preventDefault(); host.querySelector<HTMLButtonElement>('[data-play]')!.click(); return; }
        if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
        ev.preventDefault();
        if (playing) pause();
        cursor = clampCursor(cursor + (ev.key === 'ArrowLeft' ? -1 : 1) * (ev.shiftKey ? 40 : 4));
      });
    };
    seekOn(host.querySelector<HTMLCanvasElement>('.st-strip')!, (x) => stripGeom?.tAt(x) ?? null);
    seekOn(host.querySelector<HTMLCanvasElement>('.st-wiggers')!, (x) => (wigGeom && wigBeat ? wigBeat.t0 + wigGeom.tAt(x) : null));
    syncButtons();
  };

  /* ---- the finding and each beat's sounds ------------------------------------------------------ */
  const readFinding = () => {
    const c = caseWithModel(FREE_CASE, live.model);
    const view = buildView(c, { circulation: live.snap, chemistry: live.chemistry });
    finding = observe(CATALOG, REGISTRY.resolvers, c, view, 'heart.sounds', ctx).value;
  };
  const hr = () => (live.snap.metricsBreath?.HRbeat ?? live.snap.metrics?.HRbeat ?? 72) as number;
  const cache = new WeakMap<BeatRecord, { key: string; sb: StripBeat }>();
  let findingKey = '';
  const stripBeat = (b: BeatRecord): StripBeat => {
    const hit = cache.get(b);
    if (hit && hit.key === findingKey) return hit.sb;
    const m1 = b.times.m1 ?? 0, s1At = m1 > b.dur / 2 ? m1 - b.dur : m1;
    const sb = { beat: b, cycle: phonoCycle(finding ?? {}, 60000 / b.dur, b.times as any), s1At };
    cache.set(b, { key: findingKey, sb });
    return sb;
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
  const num = (x: number, d = 0) => (lang === 'de' ? x.toFixed(d).replace('.', ',') : x.toFixed(d));

  const frame = () => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    if (!ready) return;
    if (settleUntil && live.t >= settleUntil) { settleUntil = 0; live.speed = slow ? 0.25 : 1; note(''); }
    if (findingTick-- <= 0) {
      readFinding(); findingTick = 30;
      const key = JSON.stringify([finding, ctx]);
      if (key !== findingKey) {
        findingKey = key;
        const heard = host.querySelector<HTMLElement>('[data-heard]');
        if (heard) heard.textContent = FORMATTERS['heart.sounds']?.(finding, ctx, lang, CATALOG, { property: 'heart.sounds' } as any) ?? '';
        if (stopSound) { endSound(); startSound(); }
      }
    }
    const bs = beats();
    const strip = host.querySelector<HTMLCanvasElement>('.st-strip'), wig = host.querySelector<HTMLCanvasElement>('.st-wiggers');
    if (!strip || !wig || bs.length < 2) return;
    const { from, to } = span();
    const last = bs.at(-1)!;
    if (playing) {
      const into = live.run.sim.t * 1000 - (last.t0 + last.dur);
      cursor = last.t0 + Math.max(0, Math.min(last.dur - 1, into));
    }
    const beat = bs.find((b) => cursor >= b.t0 && cursor < b.t0 + b.dur) ?? last;
    wigBeat = beat;
    const sb = stripBeat(beat);
    const tIn = cursor - beat.t0;
    const mo = cycleAt(beat, tIn, side);
    const segs = cycleSegments(beat, side);
    const seg = segs.find((x) => tIn >= x.from && tIn < x.to) ?? null;
    const colors = { fg: css('--fg'), muted: css('--muted'), accent: css('--accent'), abn: css('--abn'), line: css('--line'), surface: css('--surface') };

    const sw = strip.clientWidth, sh = phonoStripHeight(sw);
    stripGeom = drawPhonoStrip(sizeCanvas(strip, sh).g, sw, sh, {
      beats: bs.filter((b) => b.t0 + b.dur > from).map(stripBeat), from, to, cursor,
      band: seg ? { from: beat.t0 + seg.from, to: beat.t0 + seg.to } : null,
      colors: { ...colors, insp: '#4f8fb3' },
      labels: { ecg: t('ecg'), phono: t('phono'), insp: t('insp'), exp: t('exp'), sounds: { s1: 'S1', a2: 'A2', p2: 'P2', s3: 'S3', s4: 'S4', 'opening-snap': 'OS', 'ejection-click': 'EC' } },
    });
    const ww = wig.clientWidth, wh = wiggersHeight(ww);
    wigGeom = drawWiggers(sizeCanvas(wig, wh).g, ww, wh, {
      b: sb, side, segments: segs, events: valveEvents(beat), cursor: tIn,
      colors: { ...colors, atrium: '#4f6fb3', volume: '#8a6d1f' },
      labels: {
        pressure: t('pressure'), volume: t('volume'), ecg: t('ecg'), phono: t('phono'),
        artery: t(side === 'left' ? 'aorta' : 'pa'), ventricle: t(side === 'left' ? 'lv' : 'rv'), atrium: t(side === 'left' ? 'la' : 'ra'),
        phase: Object.fromEntries(CYCLE_PHASES.map((p) => [p, tr(PHASE_SHORT[p], lang)])),
      },
    });

    // the valves now
    const vb = host.querySelector<HTMLElement>('[data-valves]')!;
    const vhtml = `<span class="muted small">${t('valves')}:</span> ${(['mitral', 'aortic', 'tricuspid', 'pulmonic'] as const).map((k) => `<span class="st-valve ${mo.valves[k]}">${t(k)} <b>${t(mo.valves[k])}</b></span>`).join('')}`;
    if (vb.innerHTML !== vhtml) vb.innerHTML = vhtml;

    // the words: rewritten only when what they describe changes
    const mt = live.snap.metricsBreath ?? live.snap.metrics ?? {};
    const leaks = (k: 'mitral' | 'aortic') => beat.samples.some((s) => cycleAt(beat, s.t).valves[k] === 'leaking');
    const split = beat.times.a2 != null && beat.times.p2 != null ? beat.times.p2 - beat.times.a2 : null;
    const ms = meanMitralGradient(beat);
    const m = {
      hr: hr(), gradient: mt.aorticGradient ?? 0, msGradient: ms, regurgFraction: mt.regurgFraction ?? 0, ef: mt.EF ?? 60, edv: mt.EDV ?? 120, la: mt.PlaMean ?? 8,
      split, phaseMs: seg ? seg.to - seg.from : 0, mitralLeaks: leaks('mitral'), aorticLeaks: leaks('aortic'),
      prematureMitralClosure: (beat.times.m1 ?? 0) > beat.dur / 2 && beat.dur - (beat.times.m1 ?? 0) > 120,
      af: live.model.electrical.atrial === 'af', breath: (beat.log.breath?.phase ?? null) as 'insp' | 'exp' | null,
    };
    const key = JSON.stringify([lang, side, mo.phase, mo.valves, findingKey, beat.t0, Math.round(m.gradient), Math.round(ms), m.af]);
    if (key !== textKey) {
      textKey = key;
      const x = explainCycle({ phase: mo.phase, valves: mo.valves, finding: finding ?? {}, m, site: ctx.site!, bell: ctx.instrument === 'stethoscope-bell' });
      host.querySelector('[data-phase-name]')!.textContent = `${t('why')} · ${tr(CYCLE_LABEL[mo.phase], lang)}`;
      host.querySelector('[data-title]')!.textContent = tr(x.title, lang);
      const rightNote = side === 'right' ? [L('The diagram shows the right heart, whose phases are its own: its pressures are a fifth of the left’s, its valves open and close a few ms apart from the left ones, and P2 follows A2. The text follows the left heart.',
        'Das Diagramm zeigt das rechte Herz mit seinen eigenen Phasen: Seine Drücke sind ein Fünftel der linken, seine Klappen öffnen und schließen einige ms neben den linken, und P2 folgt A2. Der Text folgt dem linken Herzen.')] : [];
      host.querySelector('[data-body]')!.innerHTML = [...rightNote, ...x.body].map((b) => `<p>${esc(tr(b, lang))}</p>`).join('');
      host.querySelectorAll<HTMLButtonElement>('[data-phase]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.phase === mo.phase)));
      const chip = (label: string, v: string, abn = false) => `<span class="${abn ? 'abn' : ''}">${label} <b>${v}</b></span>`;
      host.querySelector('[data-measures]')!.innerHTML = chip(t('rate'), `${Math.round(m.hr)}/min`)
        + chip(t('bp'), `${Math.round(mt.Psys ?? 0)}/${Math.round(mt.Pdia ?? 0)}`)
        + chip(t('grad'), `${Math.round(m.gradient)} mmHg`, m.gradient >= 36)
        + chip(t('msgrad'), `${num(ms, 1)} mmHg`, ms >= 5)
        + chip(t('rf'), `${Math.round(m.regurgFraction * 100)} %`, m.regurgFraction >= 0.3)
        + chip(t('ef'), `${Math.round(m.ef)} %`, m.ef < 50)
        + chip(t('split'), split == null ? '—' : `${Math.round(split)} ms`, split != null && (split < 0 || split > 60));
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
    stop: () => { stopped = true; cancelAnimationFrame(raf); live.stop(); endSound(); },
    setLang: (l: Lang) => { lang = l; findingKey = ''; render(); },
  };
}
