import { tr, type LocalizedText } from '../model/i18n.ts';
import type { Lang } from './diagrams.ts';
import { Brain, REGIONS } from '../physiology/brain/corticothalamic.ts';
import { crossingsHz } from '../physiology/brain/trial.ts';
import { CT } from '../evidence/seizure.ts';
import { regionFields, REGION_AREA, phaseOf } from '../stations/eeg-seizure.ts';
import { PHASE_LABEL, PHASE_TEXT, SEIZURE_BACKGROUND, type SeizurePhase } from '../stations/eeg-seizure-texts.ts';
import { MONTAGES, MONTAGE_BY_ID, channelLabel } from '../measurements/eeg-montage.ts';
import { filter } from '../measurements/eeg-record.ts';
import { ALL_ELECTRODES, E1020, ForwardModel, standardHead, patchPoints, fieldAt, fromMap, toMap, sphericalDir } from '../measurements/eeg-forward.ts';
import { EEG } from '../evidence/eeg.ts';
import { drawPage, pageHeight, drawHeadMap, type Colors } from '../render/eeg-view.ts';
import { drawLoop, drawTrend } from '../render/eeg-seizure-view.ts';

/* ---------------------------------------------------------------------------
   The EEG station, part 2a: a generalised seizure, live.

   Ten corticothalamic regions (five per hemisphere) run on one clock with
   seeded noise (physiology/brain/corticothalamic.ts). The learner gives a
   stimulus, to every region or to one, and watches the EEG it writes through
   part 1's head, the loop of one region with its drive, inhibition and the
   relay's brake, the trend of the whole run (amplitude, dominant frequency,
   the seizure's progression and brake) and the scalp field. After the seizure,
   the loop's gains are shown beside Stuiver 2026's postictal values.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });
const T: Record<string, LocalizedText> = {
  intro: L('Ten regions of cortex, each with its thalamic loop, at rest. Give a stimulus and watch a generalised seizure start, slow, end and leave the EEG suppressed. The model and its evidence are under “Background”.', 'Zehn Regionen der Rinde, jede mit ihrer thalamischen Schleife, in Ruhe. Geben Sie einen Reiz und sehen Sie einen generalisierten Anfall beginnen, sich verlangsamen, enden und das EEG supprimiert zurücklassen. Modell und Belege stehen unter „Hintergrund“.'),
  stimAll: L('Stimulate both hemispheres', 'Beide Hemisphären reizen'), stimRight: L('Stimulate the right frontal region only', 'Nur die rechte Frontalregion reizen'),
  weak: L('Weak stimulus (below threshold)', 'Schwacher Reiz (unter der Schwelle)'),
  reset: L('Reset', 'Zurücksetzen'), pause: L('Pause', 'Anhalten'), play: L('Run', 'Weiter'), speed: L('Speed', 'Tempo'),
  recording: L('The EEG', 'Das EEG'), recordingNote: L('The last ten seconds (four on a phone), 30 mm/s, negative up.', 'Die letzten zehn Sekunden (auf dem Telefon vier), 30 mm/s, negativ oben.'),
  montage: L('Montage', 'Montage'), sens: L('Sensitivity', 'Empfindlichkeit'), lff: L('Low-frequency filter', 'Tiefpassgrenze (LFF)'), hff: L('High-frequency filter', 'Hochfrequenzfilter (HFF)'), off: L('off', 'aus'), second: L('s', 's'),
  trend: L('The whole run', 'Der ganze Verlauf'), trendNote: L('Amplitude at Fz against the linked ears (log scale), the dominant frequency while seizing, the seizure’s progression along its path (0–1) and the relay’s brake (0–8 mV).', 'Amplitude an Fz gegen die verbundenen Ohren (logarithmisch), die dominante Frequenz während des Anfalls, das Fortschreiten des Anfalls entlang seines Pfades (0–1) und die Bremse des Relaiskerns (0–8 mV).'),
  amp: L('µV (Fz–ears)', 'µV (Fz–Ohren)'), hz: L('Hz', 'Hz'), progress: L('progression', 'Fortschreiten'), brake: L('relay brake', 'Relaisbremse'), stim: L('stimulus', 'Reiz'), onset: L('onset', 'Beginn'), end: L('end', 'Ende'),
  loop: L('One region’s loop', 'Die Schleife einer Region'), region: L('Region', 'Region'),
  cortex: L('cortex', 'Rinde'), relay: L('relay nucleus', 'Relaiskern'), reticular: L('reticular nucleus', 'N. reticularis'), drive: L('cortex → thalamus', 'Rinde → Thalamus'), brakeShort: L('brake', 'Bremse'), inhibition: L('cortical inhibition', 'kortikale Hemmung'),
  gains: L('Gains', 'Verstärkungen'), stuiver: L('Stuiver 2026, right after ECT seizures', 'Stuiver 2026, direkt nach EKT-Anfällen'), undefined: L('not defined during a seizure', 'während eines Anfalls nicht definiert'),
  map: L('The scalp now', 'Die Kopfhaut jetzt'), computing: L('Computing the regions’ fields…', 'Die Felder der Regionen werden berechnet…'),
  nose: L('nose', 'Nase'), left: L('left', 'links'), right: L('right', 'rechts'),
  now: L('Now', 'Jetzt'), since: L('since the stimulus', 'seit dem Reiz'), seizureFor: L('seizure', 'Anfall'), lasted: L('lasted', 'dauerte'), domHz: L('dominant', 'dominant'), ampNow: L('amplitude', 'Amplitude'),
  why: L('What is happening', 'Was geschieht'), more: L('Background', 'Hintergrund'),
  draft: L('Explanations are drafts until a clinician has read them.', 'Die Erklärungen sind Entwürfe, bis ein Kliniker sie gelesen hat.'),
};
const REGION_LABEL: Record<string, LocalizedText> = {
  frontal: L('frontal', 'frontal'), central: L('central', 'zentral'), temporal: L('temporal', 'temporal'), parietal: L('parietal', 'parietal'), occipital: L('occipital', 'okzipital'),
};
const regionName = (id: string, lang: Lang) => { const [h, r] = id.split('-'); return `${tr(REGION_LABEL[r], lang)} ${h === 'L' ? (lang === 'de' ? 'links' : 'left') : (lang === 'de' ? 'rechts' : 'right')}`; };
const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const SENS = [7, 10, 15, 20, 30, 50, 100];
const LFFS = [0, 0.3, 0.5, 1, 1.6];
const HFFS = [15, 35, 70, 0];
const FS = 200;

export interface SeizureView { stop(): void; setLang(l: Lang): void }

export function mountSeizureView(host: HTMLElement, opts: { lang: Lang; colors: () => Colors; sizeCanvas: (c: HTMLCanvasElement, h: number) => { g: CanvasRenderingContext2D; w: number } }): SeizureView {
  let lang = opts.lang;
  const t = (k: string) => tr(T[k], lang);
  let seed = 1;
  let brain!: Brain;
  /* the record: each region's activity at 200 Hz, in growing chunks */
  let rec: number[][] = [];
  let perSecond: Array<{ t: number; amp: number; hz: number | null; progress: number; brake: number }> = [];
  let stimulusAt: number | null = null, onsetAt: number | null = null, endAt: number | null = null;
  let running = true, speed = 1, stopped = false, raf = 0, lastFrame = 0, lastMap = 0, lastDraw = 0;
  let montageId = 'LB-18.1', sens = 30, lff = 0.5, hff = 70, regionIdx = 0;
  let mapGrids: Float32Array[] | null = null; const MAP_N = 40;
  const fields = regionFields();
  const restQ = { e: 0, s: 0, r: 0 };

  const reset = () => {
    brain = new Brain({ seed: seed++ });
    brain.settle(6);
    const r0 = brain.regions[0];
    restQ.e = r0.S(r0.x[2]); restQ.s = r0.S(r0.x[4]); restQ.r = r0.S(r0.x[6]);
    rec = REGIONS.map(() => []); perSecond = [];
    stimulusAt = onsetAt = endAt = null;
  };

  /* the electrodes' potentials for a stretch of the record */
  const scalpAt = (i: number) => {
    const v: Record<string, number> = {};
    for (const e of ALL_ELECTRODES) { let s = 0; fields.perRegion.forEach((f, r) => { s += f[e] * (rec[r][i] ?? 0); }); v[e] = s; }
    return v;
  };
  const nowSec = () => (rec[0].length / FS);
  const seizing = () => brain.regions.some((r) => r.excess > CT.seizingThreshold);

  const simulate = (seconds: number) => {
    const n = Math.round(seconds * FS);
    for (let k = 0; k < n; k++) {
      brain.advance(1 / FS);
      const a = brain.activity();
      for (let r = 0; r < a.length; r++) rec[r].push(a[r]);
      const tt = nowSec();
      if (seizing()) { if (onsetAt == null && stimulusAt != null) onsetAt = tt; endAt = null; }
      else if (onsetAt != null && endAt == null) endAt = tt;
      if (rec[0].length % FS === 0) {
        const i1 = rec[0].length, i0 = i1 - FS;
        let lo = Infinity, hi = -Infinity;
        for (let i = i0; i < i1; i++) { const v = scalpAt(i); const x = v.Fz - (v.A1 + v.A2) / 2; lo = Math.min(lo, x); hi = Math.max(hi, x); }
        const hz = seizing() && i1 >= 2 * FS ? crossingsHz(rec[0], i1 - 2 * FS, i1, FS) : null;
        perSecond.push({ t: tt, amp: hi - lo, hz, progress: brain.regions[0].progress, brake: brain.regions[0].relayInhibition });
      }
    }
  };

  const phase = (): SeizurePhase => phaseOf(brain, onsetAt != null);

  const render = () => {
    host.innerHTML = `<p class="muted">${t('intro')}</p>
      <div class="st-bar eeg-sz-bar">
        <button type="button" class="primary" data-stim="all">${t('stimAll')}</button>
        <button type="button" class="ghost" data-stim="right">${t('stimRight')}</button>
        <button type="button" class="ghost" data-stim="weak">${t('weak')}</button>
        <button type="button" class="ghost" data-run>${running ? t('pause') : t('play')}</button>
        <label class="st-leads">${t('speed')} <select data-speed>${[1, 4, 16].map((s) => `<option value="${s}" ${s === speed ? 'selected' : ''}>${s}×</option>`).join('')}</select></label>
        <button type="button" class="ghost" data-reset>${t('reset')}</button>
      </div>
      <p class="st-measures" data-now></p>
      <section class="panel st-signal" aria-labelledby="sz-eeg-h">
        <div class="st-row"><div><h2 id="sz-eeg-h">${t('recording')}</h2><div class="muted small">${t('recordingNote')}</div></div></div>
        <div class="st-leads">
          <label>${t('montage')} <select data-montage>${MONTAGES.map((x) => `<option value="${x.id}" ${x.id === montageId ? 'selected' : ''}>${esc(tr(x.label, lang))}</option>`).join('')}</select></label>
          <label>${t('sens')} <select data-sens>${SENS.map((s) => `<option value="${s}" ${s === sens ? 'selected' : ''}>${s} µV/mm</option>`).join('')}</select></label>
          <label>${t('lff')} <select data-lff>${LFFS.map((s) => `<option value="${s}" ${s === lff ? 'selected' : ''}>${s ? `${s} Hz` : t('off')}</option>`).join('')}</select></label>
          <label>${t('hff')} <select data-hff>${HFFS.map((s) => `<option value="${s}" ${s === hff ? 'selected' : ''}>${s ? `${s} Hz` : t('off')}</option>`).join('')}</select></label>
        </div>
        <canvas class="st-strip" data-page role="img" aria-label="${t('recording')}"></canvas>
      </section>
      <section class="panel st-signal" aria-labelledby="sz-trend-h">
        <h2 id="sz-trend-h">${t('trend')}</h2><div class="muted small">${t('trendNote')}</div>
        <canvas class="st-heart" data-trend role="img" aria-label="${t('trend')}"></canvas>
      </section>
      <section class="panel st-signal">
        <div class="eeg-mech">
          <figure><figcaption class="muted small">${t('loop')}: <select data-region>${REGIONS.map((r, i) => `<option value="${i}" ${i === regionIdx ? 'selected' : ''}>${esc(regionName(r.id, lang))}</option>`).join('')}</select></figcaption>
            <canvas class="st-heart" data-loop role="img" aria-label="${t('loop')}"></canvas></figure>
          <figure><figcaption class="muted small">${t('map')}</figcaption><canvas class="st-heart" data-map role="img" aria-label="${t('map')}"></canvas></figure>
        </div>
      </section>
      <section class="panel st-why"><h2>${t('why')}</h2><div data-why></div>
        <details><summary>${t('more')}</summary>${SEIZURE_BACKGROUND.map((x) => `<div class="st-text"><h3>${esc(tr(x.title, lang))}</h3><p>${esc(tr(x.body, lang))}</p></div>`).join('')}</details>
        <p class="muted small">${t('draft')}</p></section>`;
    host.querySelectorAll<HTMLButtonElement>('[data-stim]').forEach((b) => b.onclick = () => {
      const which = b.dataset.stim;
      if (which === 'weak') brain.stimulate(3, 0.05);
      else brain.stimulate(20, 0.05, which === 'right' ? [REGIONS.findIndex((r) => r.id === 'R-frontal')] : undefined);
      stimulusAt = nowSec(); onsetAt = null; endAt = null;
      if (!running) { running = true; host.querySelector('[data-run]')!.textContent = t('pause'); }
    });
    host.querySelector<HTMLButtonElement>('[data-run]')!.onclick = (e) => { running = !running; (e.target as HTMLElement).textContent = running ? t('pause') : t('play'); };
    host.querySelector<HTMLSelectElement>('[data-speed]')!.onchange = (e) => { speed = Number((e.target as HTMLSelectElement).value); };
    host.querySelector<HTMLButtonElement>('[data-reset]')!.onclick = () => { reset(); draw(true); };
    host.querySelector<HTMLSelectElement>('[data-montage]')!.onchange = (e) => { montageId = (e.target as HTMLSelectElement).value; draw(true); };
    host.querySelector<HTMLSelectElement>('[data-sens]')!.onchange = (e) => { sens = Number((e.target as HTMLSelectElement).value); draw(true); };
    host.querySelector<HTMLSelectElement>('[data-lff]')!.onchange = (e) => { lff = Number((e.target as HTMLSelectElement).value); draw(true); };
    host.querySelector<HTMLSelectElement>('[data-hff]')!.onchange = (e) => { hff = Number((e.target as HTMLSelectElement).value); draw(true); };
    host.querySelector<HTMLSelectElement>('[data-region]')!.onchange = (e) => { regionIdx = Number((e.target as HTMLSelectElement).value); draw(true); };
    draw(true);
  };

  /* ---- drawing ------------------------------------------------------------------------------------- */
  let lastPhase: SeizurePhase | null = null;
  const draw = (full = false) => {
    const col = opts.colors();
    const pc = host.querySelector<HTMLCanvasElement>('[data-page]');
    if (pc) {
      const m = MONTAGE_BY_ID[montageId];
      const w0 = pc.clientWidth, view = w0 < 600 ? 4 : 10, pad = 3;
      const N = rec[0].length, i1 = N, i0 = Math.max(0, i1 - (view + pad) * FS);
      const seg: Record<string, Float32Array> = {};
      for (const e of ALL_ELECTRODES) seg[e] = new Float32Array(i1 - i0);
      for (let i = i0; i < i1; i++) { const v = scalpAt(i); for (const e of ALL_ELECTRODES) seg[e][i - i0] = v[e]; }
      const view0 = Math.max(0, (i1 / FS - view)) * 1000;
      let avg: Float32Array | null = null;
      const input = (e: string) => {
        if (e !== 'AVG') return seg[e];
        if (!avg) { avg = new Float32Array(i1 - i0); for (const x of E1020) { const a = seg[x]; for (let i = 0; i < avg.length; i++) avg[i] += a[i] / E1020.length; } }
        return avg;
      };
      const channels = m.groups.flatMap((grp, gi) => grp.map((ch, k) => {
        const a = input(ch.a), b = input(ch.b), x = new Float32Array(i1 - i0);
        for (let i = 0; i < x.length; i++) x[i] = a[i] - b[i];
        const y = filter(x, FS, { lff, hff });
        /* place the filtered stretch on the record's time axis */
        const full = new Float32Array(i1); full.set(y, i0);
        return { label: channelLabel(ch), data: full, groupStart: gi > 0 && k === 0 };
      }));
      const h = pageHeight(channels.length, m.groups.length - 1);
      const { g, w } = opts.sizeCanvas(pc, h);
      drawPage(g, w, h, { channels, fs: FS, seconds: view, fromMs: view0, sens, cursorMs: null, colors: col, labels: { second: t('second') } });
    }
    const tc = host.querySelector<HTMLCanvasElement>('[data-trend]');
    if (tc) {
      const h = 220, { g, w } = opts.sizeCanvas(tc, h);
      drawTrend(g, w, h, { t: perSecond.map((x) => x.t), amp: perSecond.map((x) => x.amp), hz: perSecond.map((x) => x.hz), progress: perSecond.map((x) => x.progress), brake: perSecond.map((x) => x.brake),
        now: nowSec(), stimulus: stimulusAt, onset: onsetAt, end: endAt, window: Math.max(60, Math.ceil((nowSec() + 10) / 30) * 30), colors: col,
        labels: { amp: t('amp'), hz: t('hz'), progress: t('progress'), brake: t('brake'), stim: t('stim'), onset: t('onset'), end: t('end'), s: t('second') } });
    }
    const lc = host.querySelector<HTMLCanvasElement>('[data-loop]');
    if (lc) {
      const r = brain.regions[regionIdx], h = 260, { g, w } = opts.sizeCanvas(lc, h);
      const sz = seizing();
      drawLoop(g, w, h, {
        qe: r.S(r.x[2]), qs: r.S(r.x[4]), qr: r.S(r.x[6]), qeRest: restQ.e, qsRest: restQ.s, qrRest: restQ.r,
        drive: r.drive, inhibition: r.inhibition, inhibitionRest: CT.nuEI, brake: r.relayInhibition,
        gains: sz ? null : r.gains(), stuiver: phase() === 'postictal' ? { X: '≈ 1', Y: '< 0', Z: '≈ 0' } : null, colors: col,
        labels: { cortex: t('cortex'), relay: t('relay'), reticular: t('reticular'), drive: t('drive'), brake: t('brakeShort'), inhibition: t('inhibition'), gains: t('gains'), stuiver: t('stuiver'), undefined: t('undefined') },
      });
    }
    const mc = host.querySelector<HTMLCanvasElement>('[data-map]');
    if (mc && (full || performance.now() - lastMap > 200)) {
      lastMap = performance.now();
      const w0 = mc.clientWidth, h0 = Math.min(300, w0), { g, w } = opts.sizeCanvas(mc, h0);
      if (mapGrids) {
        const i = rec[0].length - 1, grid = new Float32Array(MAP_N * MAP_N);
        mapGrids.forEach((gr, r) => { const a = rec[r][i] ?? 0; for (let k = 0; k < grid.length; k++) grid[k] += gr[k] * a; });
        const v = scalpAt(Math.max(0, i));
        const max = 300;
        drawHeadMap(g, w, h0, { grid, n: MAP_N, k: 1, max, electrodes: [...E1020, 'A1', 'A2'].map((e) => ({ name: e, v: v[e] })), patchOutline: [], patchCentre: [0, 0], arrow: null, facing: null, colors: col, labels: { nose: t('nose'), left: t('left'), right: t('right') } });
      } else { g.fillStyle = col.muted; g.font = '500 13px system-ui'; g.fillText(t('computing'), 12, 24); }
    }
    const nowEl = host.querySelector('[data-now]');
    if (nowEl) {
      const last = perSecond[perSecond.length - 1];
      const since = stimulusAt != null ? nowSec() - stimulusAt : null;
      const dur = onsetAt != null ? (endAt ?? nowSec()) - onsetAt : null;
      nowEl.innerHTML = [
        `<span>${esc(tr(PHASE_LABEL[phase()], lang))}</span>`,
        since != null ? `<span>${since.toFixed(0)} s ${t('since')}</span>` : '',
        dur != null ? `<span>${t(endAt != null ? 'lasted' : 'seizureFor')} ${dur.toFixed(0)} s</span>` : '',
        last?.hz != null ? `<span>${t('domHz')} ${last.hz.toFixed(1)} Hz</span>` : '',
        last ? `<span>${t('ampNow')} ${last.amp.toFixed(0)} µV</span>` : '',
      ].join('');
    }
    const p = phase();
    if (p !== lastPhase || full) {
      lastPhase = p;
      const why = host.querySelector('[data-why]');
      if (why) why.innerHTML = `<div class="st-text"><h3>${esc(tr(PHASE_LABEL[p], lang))}</h3><p>${esc(tr(PHASE_TEXT[p], lang))}</p></div>`;
    }
  };

  /* the regions' scalp maps, built a region at a time so the page answers at once */
  const buildMaps = () => {
    const model = new ForwardModel(standardHead()), out: Float32Array[] = [];
    let r = 0;
    const next = () => {
      if (stopped) return;
      const d = REGIONS[r];
      const pts = patchPoints({ at: toMap(sphericalDir(d.theta, d.phi)), depth: EEG.crownDepth, area: REGION_AREA, tilt: 0, toward: 0, density: CT.firingToMoment }, model.head);
      const grid = new Float32Array(MAP_N * MAP_N);
      for (let j = 0; j < MAP_N; j++) for (let i = 0; i < MAP_N; i++) {
        const x = ((i + 0.5) / MAP_N) * 2 - 1, y = ((j + 0.5) / MAP_N) * 2 - 1;
        grid[j * MAP_N + i] = Math.hypot(x, y) > 1 ? NaN : fieldAt(model, pts, CT.firingToMoment, fromMap(x, y));
      }
      out.push(grid); r++;
      if (r < REGIONS.length) setTimeout(next, 0); else mapGrids = out;
    };
    setTimeout(next, 50);
  };

  const frame = (now: number) => {
    if (stopped) return;
    const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0;
    lastFrame = now;
    if (running && dt > 0) simulate(Math.min(1.5, dt * speed));
    /* drawing every frame is not needed: about 20 times a second */
    if (now - lastDraw > 50) { lastDraw = now; draw(); }
    raf = requestAnimationFrame(frame);
  };

  reset();
  render();
  buildMaps();
  raf = requestAnimationFrame(frame);
  return {
    stop() { stopped = true; cancelAnimationFrame(raf); },
    setLang(l: Lang) { lang = l; render(); },
  };
}
