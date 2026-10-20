import { tr, type LocalizedText } from '../model/i18n.ts';
import { ScenarioRun, TICK_S } from '../scenario/run.ts';
import type { ScenarioDef } from '../scenario/types.ts';
import { FREE_CASE } from './free-case.ts';
import arrestPractice from '../scenarios/arrest-practice.json';
import type { Lang } from './diagrams.ts';
import type { StationHandle, StationOptions } from './station-ecg.ts';

/* ---------------------------------------------------------------------------
   Practice: a cardiac arrest, with the clock running (ADR-018, a first
   screen after step 2). Draft, for the owner to try.

   A healthy man and a nurse; after a few seconds his heart fibrillates. The
   learner's hands do what hands do: tap to compress (or press the space
   bar), take the bag and squeeze a breath. One pair of hands cannot do both,
   so changing over costs the pause it costs in life. The nurse does what she
   is told: compressions, the bag, two breaths.

   Everything shown is the model's: the monitor draws the circulation's own
   2 ms samples (with an arterial line, for teaching), the numbers come from
   the circulation and the lungs, and the run is a ScenarioRun, so it could
   be replayed from its seed and the learner's inputs. No defibrillator and
   no drugs yet (ADR-018 steps 3 and 4), so the patient cannot be saved here.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });
const T: Record<string, LocalizedText> = {
  eyebrow: L('Practice · draft', 'Übung · Entwurf'), title: L('Cardiac arrest', 'Herz-Kreislauf-Stillstand'),
  lede: L('Your hands on a running patient: compressions and breaths. No defibrillator or drugs yet, so he cannot be saved here; what you can do is keep blood moving to his heart and brain.',
    'Ihre Hände an einem laufenden Patienten: Thoraxkompressionen und Beatmung. Noch kein Defibrillator und keine Medikamente, er kann hier also nicht gerettet werden; Sie können Blut zu Herz und Gehirn bewegen.'),
  back: L('Ward', 'Übersicht'), preparing: L('Preparing the patient…', 'Der Patient wird vorbereitet…'),
  pause: L('Pause', 'Anhalten'), resume: L('Resume', 'Weiter'), restart: L('Start again', 'Neu beginnen'),
  monitor: L('Monitor', 'Monitor'), monitorNote: L('ECG lead II, arterial pressure (an arterial line, for teaching: on the ward you would not have one), the pressure of the compressions in the chest, and airway pressure.',
    'EKG Ableitung II, arterieller Druck (eine arterielle Kanüle, zum Lernen: auf Station hätten Sie keine), der Druck der Kompressionen im Thorax und der Atemwegsdruck.'),
  ecg: L('ECG II', 'EKG II'), art: L('Artery', 'Arterie'), chest: L('Chest', 'Thorax'), paw: L('Airway', 'Atemweg'),
  abp: L('Arterial', 'Arteriell'), cpp: L('Coronary perfusion', 'Koronarer Perfusionsdruck'), etco2: L('End-tidal CO₂', 'Endtidales CO₂'), time: L('Time', 'Zeit'),
  hands: L('Your hands', 'Ihre Hände'),
  startCpr: L('Start compressions', 'Kompressionen beginnen'), stopCpr: L('Stop compressions', 'Kompressionen beenden'),
  push: L('Push', 'Drücken'), pushHint: L('Tap here, or press the space bar, once per compression.', 'Hier tippen oder die Leertaste drücken, einmal pro Kompression.'),
  takeBag: L('Take the bag', 'Beutel nehmen'), dropBag: L('Put the bag down', 'Beutel ablegen'), breath: L('Give a breath', 'Beatmen'),
  rate: L('Rate', 'Frequenz'), count: L('Count', 'Zählung'), handsOff: L('Hands off', 'Pause'), perMin: L('/min', '/min'), s: L('s', 's'),
  target: L('aim: 100–120/min, 30 then 2 breaths, pauses under 10 s', 'Ziel: 100–120/min, 30 dann 2 Beatmungen, Pausen unter 10 s'),
  nurse: L('The nurse', 'Die Pflegekraft'),
  nCpr: L('Take over compressions', 'Kompressionen übernehmen'), nBag: L('Take the bag', 'Beutel nehmen'), nTwo: L('Two breaths', 'Zwei Beatmungen'), nStop: L('Stop what you are doing', 'Aufhören'),
  busy: L('busy', 'beschäftigt'), free: L('free', 'frei'),
  nDoingCpr: L('compressing', 'drückt'), nDoingBag: L('holding the bag', 'hält den Beutel'),
  breathing: L('Breathing', 'Atmung'), bNormal: L('breathing', 'atmet'), bGasping: L('gasping: agonal breaths, not breathing', 'Schnappatmung: agonale Atemzüge, keine Atmung'), bNone: L('not breathing', 'atmet nicht'),
  logGasp: L('gasps', 'schnappt nach Luft'), logApnoea: L('stops breathing', 'hört auf zu atmen'), logBreath: L('gives a breath', 'beatmet'),
  why: L('Why it works', 'Warum es wirkt'),
  trend: L('The last two minutes', 'Die letzten zwei Minuten'),
  whyCpp: L('Between compressions the aorta is still under pressure while the right atrium is not: that difference, the coronary perfusion pressure, is what fills the heart’s own arteries. It builds over several compressions and is gone within seconds of stopping. In people, a return of circulation was seen only when it reached 15 mmHg or more (Paradis 1990).',
    'Zwischen den Kompressionen steht die Aorta noch unter Druck, der rechte Vorhof nicht: dieser Unterschied, der koronare Perfusionsdruck, füllt die Herzkranzgefäße. Er baut sich über mehrere Kompressionen auf und ist Sekunden nach dem Aufhören weg. Bei Menschen kehrte ein Kreislauf nur zurück, wenn er 15 mmHg oder mehr erreichte (Paradis 1990).'),
  whyCo2: L('End-tidal CO₂ follows the flow: the CO₂ in the breath is what the blood brought to the lungs. Without compressions it falls towards zero even while you ventilate; with good compressions it rises again. With no breaths given, nothing comes out to measure.',
    'Das endtidale CO₂ folgt dem Fluss: das CO₂ in der Ausatemluft ist, was das Blut zur Lunge gebracht hat. Ohne Kompressionen fällt es gegen null, auch wenn Sie beatmen; mit guten Kompressionen steigt es wieder. Ohne Beatmung kommt nichts heraus, das man messen könnte.'),
  events: L('What happened', 'Was geschah'),
  you: L('You', 'Sie'), nurseName: L('Nurse', 'Pflegekraft'), patient: L('Patient', 'Patient'),
  blocked: L('Not now', 'Jetzt nicht'),
  reasons_busy: L('your hands are busy', 'Ihre Hände sind beschäftigt'), reasons_absent: L('not here yet', 'noch nicht da'),
  draft: L('Draft for review: the physiology is from ADR-018 steps 1–2 (compressions, breathing in arrest, given breaths); the scene, the wording and the layout are first attempts. The monitor’s labels and the numbers are the model’s own.',
    'Entwurf zur Durchsicht: die Physiologie stammt aus ADR-018, Schritte 1–2 (Kompressionen, Atmung im Stillstand, Beatmung); Szene, Wortlaut und Gestaltung sind erste Versuche. Beschriftungen und Zahlen des Monitors stammen aus dem Modell.'),
};
const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const MMHG = 7.50062;
const WINDOW_S = 6;
const TREND_S = 120;

interface Sample { T: number; ecg: number; Pa: number; Pchest: number }

export function mountArrestPractice(host: HTMLElement, o: StationOptions): StationHandle {
  let lang = o.lang;
  const t = (k: string) => tr(T[k], lang);
  const def = arrestPractice as unknown as ScenarioDef;
  let run: ScenarioRun | null = null;
  let raf = 0, stopped = false, paused = false;
  let wall0 = 0, pausedAt = 0, pausedTotal = 0, pauseWall = 0;
  /* the monitor's samples: the circulation's own (2 ms), read as they are produced */
  let buf: Sample[] = [];
  let paw: Array<{ T: number; v: number }> = [];
  let trend: Array<{ T: number; cpp: number | null; co2: number }> = [];
  let curArr: unknown[] | null = null, curStart = 0, idx = 0;
  /* the learner's compressions, for the feedback */
  let taps: number[] = [];
  let sinceBreaths = 0;
  let seenEvents = 0;
  const log: Array<{ t: number; who: string; text: string; fromEvent?: boolean }> = [];
  let lastBreathing = '';

  const runT = () => (paused ? pausedAt : (performance.now() - wall0 - pausedTotal) / 1000);

  const start = () => {
    host.innerHTML = `${head()}<p class="muted" data-preparing>${t('preparing')}</p>`;
    wire();
    run = null; buf = []; paw = []; trend = []; taps = []; sinceBreaths = 0; seenEvents = 0; log.length = 0; curArr = null; idx = 0; lastBreathing = '';
    setTimeout(() => {
      if (stopped) return;
      /* a fresh seed each time: chance (gasping, the heart's noise) differs from run to run, as in life */
      run = new ScenarioRun(def, { seed: (Date.now() % 1e9) | 0, caseDef: FREE_CASE, settleSeconds: 20 });
      wall0 = performance.now(); pausedTotal = 0; paused = false;
      render();
    }, 30);
  };

  const head = () => `<div class="st-head">
      <button type="button" class="ghost" data-leave>← ${o.backLabel ? tr(o.backLabel, lang) : t('back')}</button>
      <div class="st-title"><div class="eyebrow">${t('eyebrow')}</div><h1>${t('title')}</h1><p class="lede">${t('lede')}</p></div>
      <span class="ar-head-buttons"><button type="button" class="ghost" data-pause>${paused ? t('resume') : t('pause')}</button><button type="button" class="ghost" data-restart>${t('restart')}</button></span>
    </div>`;

  const render = () => {
    host.innerHTML = `${head()}
      <p class="ar-draft muted small" role="note">${t('draft')}</p>
      <div class="ar-grid">
        <section class="panel ar-monitor" aria-labelledby="ar-mon-h">
          <div class="st-row"><div><h2 id="ar-mon-h">${t('monitor')}</h2><div class="muted small">${t('monitorNote')}</div></div></div>
          <canvas class="ar-strip" aria-label="${t('monitorNote')}"></canvas>
          <dl class="ar-nums" data-nums></dl>
          <p class="ar-breathing" data-breathing role="status"></p>
        </section>
        <section class="panel ar-hands" aria-labelledby="ar-hands-h">
          <h2 id="ar-hands-h">${t('hands')}</h2>
          <div class="ar-row"><button type="button" class="primary" data-cpr></button><button type="button" class="ghost" data-bag></button></div>
          <button type="button" class="ar-pad" data-push aria-describedby="ar-push-hint">${t('push')}</button>
          <p id="ar-push-hint" class="muted small">${t('pushHint')}</p>
          <button type="button" class="ghost ar-breath" data-breath>${t('breath')}</button>
          <dl class="ar-feedback" data-feedback></dl>
          <p class="muted small">${t('target')}</p>
          <h3>${t('nurse')} <span class="muted small" data-nurse-state></span></h3>
          <div class="ar-row ar-wrap"><button type="button" class="ghost small" data-n="cpr">${t('nCpr')}</button><button type="button" class="ghost small" data-n="bag">${t('nBag')}</button>
            <button type="button" class="ghost small" data-n="two">${t('nTwo')}</button><button type="button" class="ghost small" data-n="stop">${t('nStop')}</button></div>
          <span class="st-note" role="status" data-note></span>
        </section>
        <section class="panel ar-why" aria-labelledby="ar-why-h">
          <h2 id="ar-why-h">${t('why')}</h2>
          <div class="muted small">${t('trend')}</div>
          <canvas class="ar-trend" aria-label="${t('trend')}"></canvas>
          <p class="ar-legend small"><span class="ar-key cpp"></span>${t('cpp')} (mmHg) <span class="ar-key co2"></span>${t('etco2')} (mmHg) <span class="muted">· 15 mmHg: Paradis</span></p>
          <p>${t('whyCpp')}</p><p>${t('whyCo2')}</p>
        </section>
        <section class="panel ar-log" aria-labelledby="ar-log-h">
          <h2 id="ar-log-h">${t('events')}</h2>
          <ol class="ar-events small" data-events aria-live="polite"></ol>
        </section>
      </div>`;
    wire();
    renderEvents(true);
  };

  /* ---- inputs ---------------------------------------------------------------------------------- */
  const note = (x: string) => { const n = host.querySelector<HTMLElement>('[data-note]'); if (n) n.textContent = x; };
  const held = (slot: string) => run?.held.get(slot);
  const learnerHolds = (slot: string) => held(slot)?.by === 'learner';
  /** An input lands at the run's current tick: bring the run up to now first. */
  const now = () => { if (!run) return 0; run.advanceTo(Math.floor(runT() / TICK_S) * TICK_S); return run.t; };
  const blocked = () => {
    const b = run?.events.filter((e) => e.kind === 'blocked').at(-1) as { reason: string } | undefined;
    note(`${t('blocked')}: ${b ? tr(T[`reasons_${b.reason}`] ?? L(b.reason, b.reason), lang) : ''}`);
  };
  const act = (fn: () => boolean) => { if (!run || paused) return; now(); if (!fn()) blocked(); else note(''); };
  const push = () => {
    if (!run || paused) return;
    now();
    const w = runT();
    const at = Math.max(run.t, Math.min(w, run.t + TICK_S - 0.001));
    if (run.compress(Math.round(at * 1000) / 1000)) { taps.push(w); if (taps.length > 40) taps.shift(); sinceBreaths++; note(''); }
    else blocked();
    const pad = host.querySelector<HTMLElement>('[data-push]');
    if (pad) { pad.classList.remove('hit'); void pad.offsetWidth; pad.classList.add('hit'); }
  };
  const breath = (by: string) => {
    if (!run) return false;
    const ok = run.ventilate(run.t, 1, by);
    if (ok) { sinceBreaths = 0; log.push({ t: run.t, who: who(by), text: t('logBreath') }); }
    return ok;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || !run || !learnerHolds('compressions')) return;
    const target = e.target as HTMLElement | null;
    if (target && /INPUT|TEXTAREA|SELECT/.test(target.tagName)) return;
    e.preventDefault();
    if (!e.repeat) push();
  };
  document.addEventListener('keydown', onKey);

  const wire = () => {
    host.querySelector<HTMLButtonElement>('[data-leave]')!.onclick = () => o.onLeave();
    host.querySelector<HTMLButtonElement>('[data-restart]')!.onclick = () => start();
    host.querySelector<HTMLButtonElement>('[data-pause]')!.onclick = (e) => {
      if (!run) return;
      if (paused) { pausedTotal += performance.now() - pauseWall; paused = false; }
      else { pausedAt = runT(); pauseWall = performance.now(); paused = true; }
      (e.target as HTMLButtonElement).textContent = paused ? t('resume') : t('pause');
    };
    if (!run) return;
    host.querySelector<HTMLButtonElement>('[data-cpr]')!.onclick = () => act(() => (learnerHolds('compressions') ? run!.release('compressions') : run!.intervene('cpr.compressions')));
    host.querySelector<HTMLButtonElement>('[data-bag]')!.onclick = () => act(() => (learnerHolds('ventilation') ? run!.release('ventilation') : run!.intervene('vent.bag')));
    host.querySelector<HTMLButtonElement>('[data-push]')!.addEventListener('pointerdown', (e) => { e.preventDefault(); push(); });
    host.querySelector<HTMLButtonElement>('[data-breath]')!.onclick = () => act(() => breath('learner'));
    host.querySelectorAll<HTMLButtonElement>('[data-n]').forEach((b) => b.onclick = () => {
      const k = b.dataset.n!;
      if (k === 'cpr') act(() => run!.intervene('cpr.compressions', 'nurse'));
      else if (k === 'bag') act(() => run!.intervene('vent.bag', 'nurse'));
      else if (k === 'stop') act(() => { const h = [...run!.held.entries()].find(([, x]) => x.by === 'nurse'); return h ? run!.release(h[0], 'nurse') : true; });
      else act(() => {
        /* two breaths, a second and a half apart */
        if (!breath('nurse')) return false;
        const at = run!.t + 1.5;
        const second = () => { if (!run || stopped) return; if (run.t + 1e-9 < at) { now(); if (run.t + 1e-9 < at) { setTimeout(second, 50); return; } } breath('nurse'); };
        setTimeout(second, 1500);
        return true;
      });
    });
  };

  /* ---- reading the model ------------------------------------------------------------------------ */
  const readSamples = () => {
    if (!run) return;
    const sim = run.live.run.sim as any;
    if (curArr && sim.beat !== curArr) {
      const old = curArr as Array<Record<string, number>>;
      for (; idx < old.length; idx++) { const s = old[idx]; buf.push({ T: (curStart + s.t) / 1000, ecg: s.ecg, Pa: s.Pa, Pchest: s.Pchest ?? 0 }); }
      curArr = null;
    }
    if (!curArr) { curArr = sim.beat; curStart = sim.beatStartT; idx = 0; }
    const arr = curArr as Array<Record<string, number>>;
    for (; idx < arr.length; idx++) { const s = arr[idx]; buf.push({ T: (curStart + s.t) / 1000, ecg: s.ecg, Pa: s.Pa, Pchest: s.Pchest ?? 0 }); }
    const tNow = sim.t as number;
    while (buf.length && buf[0].T < tNow - WINDOW_S - 1) buf.shift();
    const r = run.live.snap.resp;
    paw.push({ T: tNow, v: r.Paw ?? 0 });
    while (paw.length && paw[0].T < tNow - WINDOW_S - 1) paw.shift();
    const m = run.live.snap.metrics;
    if (!trend.length || tNow - trend.at(-1)!.T >= 1) {
      trend.push({ T: tNow, cpp: m?.CPP ?? null, co2: (r.EtCO2 ?? 0) * MMHG });
      while (trend.length && trend[0].T < tNow - TREND_S) trend.shift();
    }
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
  const drawStrip = () => {
    const c = host.querySelector<HTMLCanvasElement>('.ar-strip');
    if (!c || !run) return;
    const h = Math.round(Math.max(240, Math.min(340, c.clientWidth * 0.42)));
    const { g, w } = sizeCanvas(c, h);
    const fg = css('--trace'), muted = css('--muted'), line = css('--grid'), art = '#c0392b', acc = css('--accent');
    g.fillStyle = css('--surface'); g.fillRect(0, 0, w, h);
    const pad = 46, tNow = (run.live.run.sim as any).t as number, from = tNow - WINDOW_S;
    const x = (T: number) => pad + ((T - from) / WINDOW_S) * (w - pad - 8);
    const rows: Array<{ key: string; label: string; top: number; hgt: number; lo: number; hi: number; color: string; get: (s: Sample) => number; unit?: string }> = [
      { key: 'ecg', label: t('ecg'), top: 6, hgt: h * 0.24, lo: -1.2, hi: 1.6, color: fg, get: (s) => s.ecg },
      { key: 'art', label: t('art'), top: h * 0.30, hgt: h * 0.36, lo: 0, hi: Math.max(80, ...buf.map((s) => s.Pa)) + 5, color: art, get: (s) => s.Pa, unit: 'mmHg' },
      { key: 'chest', label: t('chest'), top: h * 0.70, hgt: h * 0.13, lo: 0, hi: 60, color: acc, get: (s) => s.Pchest },
    ];
    g.font = '500 10px "JetBrains Mono", ui-monospace, monospace'; g.textBaseline = 'middle';
    for (const r of rows) {
      g.strokeStyle = line; g.lineWidth = 1; g.beginPath(); g.moveTo(pad, r.top + r.hgt); g.lineTo(w - 8, r.top + r.hgt); g.stroke();
      g.fillStyle = muted; g.fillText(r.label, 4, r.top + r.hgt / 2);
      if (r.unit) { g.fillText(`${Math.round(r.hi)}`, 4, r.top + 6); g.fillText('0', 4, r.top + r.hgt - 4); }
      g.strokeStyle = r.color; g.lineWidth = 1.5; g.lineJoin = 'round'; g.beginPath();
      let first = true;
      for (let i = 0; i < buf.length; i += 2) {
        const s = buf[i]; if (s.T < from) continue;
        const y = r.top + r.hgt - ((r.get(s) - r.lo) / (r.hi - r.lo)) * r.hgt;
        if (first) { g.moveTo(x(s.T), y); first = false; } else g.lineTo(x(s.T), y);
      }
      g.stroke();
    }
    /* airway pressure, from the lungs (0.1 s) */
    const top = h * 0.86, hgt = h * 0.12;
    g.strokeStyle = line; g.beginPath(); g.moveTo(pad, top + hgt); g.lineTo(w - 8, top + hgt); g.stroke();
    g.fillStyle = muted; g.fillText(t('paw'), 4, top + hgt / 2);
    g.strokeStyle = '#3f6fb5'; g.lineWidth = 1.5; g.beginPath();
    paw.filter((p) => p.T >= from).forEach((p, i) => { const y = top + hgt - Math.min(1, p.v / 30) * hgt; i ? g.lineTo(x(p.T), y) : g.moveTo(x(p.T), y); });
    g.stroke();
  };
  const drawTrend = () => {
    const c = host.querySelector<HTMLCanvasElement>('.ar-trend');
    if (!c || !run) return;
    const h = 150;
    const { g, w } = sizeCanvas(c, h);
    g.fillStyle = css('--surface'); g.fillRect(0, 0, w, h);
    const tNow = (run.live.run.sim as any).t as number, from = tNow - TREND_S, pad = 34;
    const x = (T: number) => pad + ((T - from) / TREND_S) * (w - pad - 8);
    const y = (v: number) => h - 14 - (Math.max(0, Math.min(40, v)) / 40) * (h - 24);
    g.font = '500 10px "JetBrains Mono", ui-monospace, monospace'; g.textBaseline = 'middle'; g.fillStyle = css('--muted');
    for (const v of [0, 15, 40]) { g.strokeStyle = css('--grid'); g.lineWidth = 1; g.setLineDash(v === 15 ? [4, 4] : []); g.beginPath(); g.moveTo(pad, y(v)); g.lineTo(w - 8, y(v)); g.stroke(); g.fillText(String(v), 4, y(v)); }
    g.setLineDash([]);
    const series = (get: (p: typeof trend[number]) => number | null, color: string) => {
      g.strokeStyle = color; g.lineWidth = 2; g.beginPath(); let on = false;
      for (const p of trend) { const v = get(p); if (v == null) { on = false; continue; } if (!on) { g.moveTo(x(p.T), y(v)); on = true; } else g.lineTo(x(p.T), y(v)); }
      g.stroke();
    };
    series((p) => p.cpp, '#c0392b');
    series((p) => p.co2, '#3f6fb5');

  };
  const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const renderNumbers = () => {
    if (!run) return;
    const sim = run.live.run.sim as any, m = run.live.snap.metrics ?? {}, r = run.live.snap.resp;
    const recent = buf.filter((s) => s.T > sim.t - 4);
    const sys = recent.length ? Math.max(...recent.map((s) => s.Pa)) : NaN, dia = recent.length ? Math.min(...recent.map((s) => s.Pa)) : NaN;
    const breaths = (r.givenRate ?? 0) > 0 || (r.RR ?? 0) > 0;
    const nums = host.querySelector<HTMLElement>('[data-nums]');
    if (nums) nums.innerHTML = `
      <div><dt>${t('abp')}</dt><dd>${Number.isFinite(sys) ? `${Math.round(sys)}/${Math.round(dia)}` : '—'} <span class="muted small">mmHg</span></dd></div>
      <div><dt>${t('cpp')}</dt><dd>${m.CPP != null ? Math.round(m.CPP) : '—'} <span class="muted small">mmHg</span></dd></div>
      <div><dt>${t('etco2')}</dt><dd>${breaths ? Math.round((r.EtCO2 ?? 0) * MMHG) : '—'} <span class="muted small">mmHg</span></dd></div>
      <div><dt>${t('time')}</dt><dd>${fmtT(run.t)}</dd></div>`;
    const w = runT();
    const last = taps.filter((x) => x > w - 6).slice(-6);
    const rate = last.length >= 3 ? 60 / ((last.at(-1)! - last[0]) / (last.length - 1)) : null;
    const off = learnerHolds('compressions') || held('compressions') ? (taps.length && learnerHolds('compressions') ? w - taps.at(-1)! : 0) : null;
    const fb = host.querySelector<HTMLElement>('[data-feedback]');
    if (fb) fb.innerHTML = `
      <div><dt>${t('rate')}</dt><dd class="${rate != null && (rate < 100 || rate > 120) ? 'abn' : ''}">${rate != null ? Math.round(rate) : '—'} <span class="muted small">${t('perMin')}</span></dd></div>
      <div><dt>${t('count')}</dt><dd class="${sinceBreaths > 30 ? 'abn' : ''}">${sinceBreaths}<span class="muted small">/30</span></dd></div>
      <div><dt>${t('handsOff')}</dt><dd class="${off != null && off > 10 ? 'abn' : ''}">${off != null && off > 1.5 ? off.toFixed(0) : '—'} <span class="muted small">${t('s')}</span></dd></div>`;
    const cpr = host.querySelector<HTMLButtonElement>('[data-cpr]'), bag = host.querySelector<HTMLButtonElement>('[data-bag]');
    if (cpr) cpr.textContent = learnerHolds('compressions') ? t('stopCpr') : t('startCpr');
    if (bag) bag.textContent = learnerHolds('ventilation') ? t('dropBag') : t('takeBag');
    const pad = host.querySelector<HTMLButtonElement>('[data-push]'); if (pad) pad.disabled = !learnerHolds('compressions');
    const br = host.querySelector<HTMLButtonElement>('[data-breath]'); if (br) br.disabled = !learnerHolds('ventilation');
    const ns = host.querySelector<HTMLElement>('[data-nurse-state]');
    if (ns) {
      const h = [...run.held.entries()].find(([, x]) => x.by === 'nurse');
      ns.textContent = h ? t(h[0] === 'compressions' ? 'nDoingCpr' : 'nDoingBag') : run.actors.nurse && run.actors.nurse.busyUntil > run.tick ? t('busy') : t('free');
    }
    /* what the patient's breathing is: the learner should see gasping for what it is */
    const state = r.gasping ? 'gasp' : (r.RR ?? 0) - (r.givenRate ?? 0) > 0.5 ? 'normal' : 'none';
    if (state !== lastBreathing) {
      if (lastBreathing && state === 'gasp') log.push({ t: run.t, who: t('patient'), text: t('logGasp') });
      if (lastBreathing && state === 'none') log.push({ t: run.t, who: t('patient'), text: t('logApnoea') });
      lastBreathing = state;
    }
    const bs = host.querySelector<HTMLElement>('[data-breathing]');
    if (bs) { bs.innerHTML = `<span class="muted">${t('breathing')}:</span> <b class="${state === 'normal' ? '' : 'abn'}">${t(state === 'gasp' ? 'bGasping' : state === 'normal' ? 'bNormal' : 'bNone')}</b>`; }
  };
  const who = (x: string) => (x === 'learner' ? t('you') : x === 'nurse' ? t('nurseName') : x === 'patient' ? t('patient') : x);
  const renderEvents = (all = false) => {
    if (!run) return;
    if (all) { seenEvents = 0; for (let i = log.length - 1; i >= 0; i--) if (log[i].fromEvent) log.splice(i, 1); }
    const ev = run.events;
    for (; seenEvents < ev.length; seenEvents++) {
      const e = ev[seenEvents] as any;
      if (e.kind === 'say') log.push({ t: e.t, who: who(e.who), text: tr(e.text, lang), fromEvent: true });
      else if (e.kind === 'done') log.push({ fromEvent: true, t: e.t, who: who(e.by), text: tr(e.id === 'cpr.compressions' ? L('starts compressions', 'beginnt mit den Kompressionen') : e.id === 'vent.bag' ? L('has the bag on the face', 'hat die Maske aufgesetzt') : L(e.id, e.id), lang) });
      else if (e.kind === 'release') log.push({ fromEvent: true, t: e.t, who: who(e.by), text: tr(e.slot === 'compressions' ? L('stops compressions', 'beendet die Kompressionen') : L('puts the bag down', 'legt den Beutel ab'), lang) });
    }
    const box = host.querySelector<HTMLElement>('[data-events]');
    if (box) box.innerHTML = [...log].sort((a, b) => a.t - b.t).slice(-12).reverse().map((x) => `<li><span class="muted">${fmtT(x.t)}</span> <b>${esc(x.who)}</b>: ${esc(x.text)}</li>`).join('');
  };

  let tick = 0;
  const frame = () => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    if (!run) return;
    if (!paused) { run.advanceTo(Math.floor(runT() / TICK_S) * TICK_S); readSamples(); }
    drawStrip();
    if (tick++ % 6 === 0) { renderNumbers(); renderEvents(); drawTrend(); }
  };

  start();
  raf = requestAnimationFrame(frame);
  return {
    stop: () => { stopped = true; cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); },
    setLang: (l: Lang) => { lang = l; if (run) render(); else start(); },
  };
}
