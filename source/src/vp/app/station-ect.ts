import { tr, type LocalizedText } from '../model/i18n.ts';
import type { Lang } from './diagrams.ts';
import { type StationHandle, type StationOptions } from './station-ecg.ts';
import { ECT_STATION } from '../stations/station.ts';
import { ECT } from '../evidence/ect.ts';
import { EctSession, FS, type EctPatient, type PaperEntry } from '../stations/ect-session.ts';
import { PROGRAM_NAMES, PROGRAM_REPORT, DEFAULT_SETTINGS, stimulusFor, type ProgramChoice } from '../stations/ect-device.ts';
import { CHARGE_MC, PERCENT_STEPS } from '../stations/ect-programs.ts';
import { nextStep, explainStimulus, ECT_BACKGROUND, reportLines } from '../stations/ect-texts.ts';
import { PHASE_LABEL, PHASE_TEXT } from '../stations/eeg-seizure-texts.ts';
import { phaseOf } from '../stations/eeg-seizure.ts';
import { PLACEMENTS, thresholdField, fieldSection, energy, type PlacementId, type FieldSection, type RegionDose } from '../physiology/brain/ect-stimulus.ts';
import { fieldFor, dosesFor } from '../physiology/brain/ect-trial.ts';
import { layoutStrip, drawStrip, type PaperItem } from '../render/ect-strip.ts';
import { drawFieldSection, drawRegionMap } from '../render/ect-head.ts';

/* ---------------------------------------------------------------------------
   The ECT station, part 1: the device, the stimulus and the seizure it starts.

   Treatment: a front panel laid out as the real device's (the owner's
   photograph and the manual): the impedance display with its test button,
   the stimulus and monitoring sockets, the FlexDial with its light, the
   percent energy display and dial with the PRESET and USER SET lights, the
   guarded treatment button, start/stop with the safety-monitor light, the
   power switch, and the strip printer. It behaves as the manual describes
   (stations/ect-device.ts); the patient behind it is part 1's head and
   part 2a's brain (stations/ect-session.ts).

   The stimulus: where the current goes for each placement, the field in a
   section through the pads, how much of each region one pulse excites, and
   the arithmetic of charge and energy.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });
const T: Record<string, LocalizedText> = {
  eyebrow: L('Station', 'Station'), back: L('Ward', 'Übersicht'),
  view: L('View', 'Ansicht'), viewTreat: L('The treatment', 'Die Behandlung'), viewStim: L('The stimulus', 'Der Reiz'),
  patient: L('The patient', 'Der Patient'),
  patientNote: L('A reference adult of 59 years (the mean age at which the threshold was measured with this device), anaesthetised and relaxed, the right foot cuffed. Age, sex, the anaesthetic and the heart come in the next parts.', 'Ein Referenzerwachsener von 59 Jahren (das mittlere Alter, bei dem die Schwelle mit diesem Gerät gemessen wurde), in Narkose und relaxiert, der rechte Fuß gestaut. Alter, Geschlecht, Narkose und Herz folgen in den nächsten Teilen.'),
  placement: L('Electrode placement', 'Elektrodenposition'),
  prepared: L('Skin cleaned and pads pressed on', 'Haut gereinigt und Elektroden angedrückt'),
  skin: L('Skin impedance', 'Hautimpedanz'), skinLow: L('low', 'niedrig'), skinTypical: L('typical', 'typisch'), skinHigh: L('high', 'hoch'),
  another: L('Another run (new noise)', 'Neuer Durchlauf (anderes Rauschen)'),
  restart: L('Start again', 'Neu beginnen'),
  speed: L('Speed after the stimulus', 'Tempo nach dem Reiz'),
  demo: L('Show the steps', 'Schritte zeigen'), demoStop: L('Stop showing', 'Vorführung beenden'),
  device: L('The device', 'Das Gerät'),
  deviceNote: L('Laid out as the real front panel. Hold the buttons (impedance test, treat) as you would at the device; turn a dial with its arrows, the mouse wheel or by dragging, press it by tapping its middle.', 'Angeordnet wie die echte Frontplatte. Halten Sie die Tasten (Impedanztest, Behandlung) wie am Gerät; drehen Sie einen Knopf mit seinen Pfeilen, dem Mausrad oder durch Ziehen, drücken Sie ihn durch Tippen in die Mitte.'),
  impedance: L('IMPEDANCE TEST', 'IMPEDANCE TEST'), ectJack: L('ECT', 'ECT'), monJack: L('EEG/ECG/EMG', 'EEG/ECG/EMG'),
  flex: L('FLEXDIAL', 'FLEXDIAL'), percent: L('PERCENT ENERGY', 'PERCENT ENERGY'), preset: L('PRESET', 'PRESET'), userSet: L('USER SET', 'USER SET'),
  treat: L('TREAT', 'TREAT'), cover: L('Lift the cover', 'Kappe heben'), coverDown: L('Close the cover', 'Kappe schließen'),
  startStop: L('START/STOP', 'START/STOP'), safety: L('SAFETY MONITOR ACTIVATED', 'SAFETY MONITOR ACTIVATED'), power: L('POWER', 'POWER'),
  plug: L('plugged in', 'eingesteckt'), unplug: L('not plugged in', 'nicht eingesteckt'),
  turnDown: L('turn left', 'nach links drehen'), turnUp: L('turn right', 'nach rechts drehen'), pressDial: L('press', 'drücken'),
  strip: L('The strip', 'Der Streifen'),
  stripNote: L('EEG 1 and 2 (above each eyebrow to the mastoid) at the set gain, the EMG of the cuffed foot and the ECG at 1000 µV/cm; a mark every second, a block every 6 s, the heart rate every 3 s, the ictal line along the top. Drag or use the slider to read back.', 'EEG 1 und 2 (über jeder Augenbraue zum Mastoid) mit der eingestellten Verstärkung, das EMG des gestauten Fußes und das EKG mit 1000 µV/cm; jede Sekunde eine Marke, alle 6 s ein Block, alle 3 s die Herzfrequenz, oben die Iktallinie. Ziehen oder den Regler benutzen, um zurückzulesen.'),
  follow: L('Follow the printer', 'Dem Drucker folgen'),
  report: L('The report', 'Der Bericht'), noReport: L('Printed when START/STOP is pressed after a treatment.', 'Gedruckt, wenn nach einer Behandlung START/STOP gedrückt wird.'),
  now: L('What happens now', 'Was jetzt geschieht'), next: L('Next', 'Als Nächstes'),
  more: L('Background', 'Hintergrund'),
  draft: L('Explanations are drafts until a clinician has read them.', 'Die Erklärungen sind Entwürfe, bis ein Kliniker sie gelesen hat.'),
  stimTitle: L('Where the current goes', 'Wohin der Strom fließt'),
  stimNote: L('By reciprocity through the EEG station’s four-shell head: the field from the pads is the EEG’s lead field times the current.', 'Über die Reziprozität durch den Vierschalenkopf der EEG-Station: Das Feld der Elektroden ist das Ableitfeld des EEG mal dem Strom.'),
  pulseWidth: L('Pulse width', 'Pulsbreite'), dose: L('Dose on the dial', 'Dosis am Drehknopf'), program: L('Program', 'Programm'),
  section: L('The field in the plane of the pads', 'Das Feld in der Ebene der Elektroden'),
  sectionNote: L('Field strength in the brain (V/cm, logarithmic): blue below what excites cortical axons with this pulse width, yellow to red above it; the mark on the scale is that threshold. Seen from the side the plane faces; the rings are brain, fluid, skull and scalp.', 'Feldstärke im Gehirn (V/cm, logarithmisch): blau unter dem, was kortikale Axone bei dieser Pulsbreite erregt, gelb bis rot darüber; die Marke auf der Skala ist diese Schwelle. Von der Seite gesehen, der die Ebene zugewandt ist; die Ringe sind Gehirn, Liquor, Schädel und Kopfhaut.'),
  regions: L('One pulse in each region', 'Ein Puls in jeder Region'),
  regionsNote: L('The head from above, nose up, the pads as squares: the share of each region’s cortex one pulse excites.', 'Der Kopf von oben, Nase oben, die Elektroden als Quadrate: der Anteil der Rinde jeder Region, den ein Puls erregt.'),
  computing: L('Computing the field…', 'Das Feld wird berechnet…'),
  nose: L('nose', 'Nase'), left: L('left', 'links'), right: L('right', 'rechts'), up: L('vertex', 'Scheitel'),
  regionCol: L('Region', 'Region'), fieldCol: L('Field (median)', 'Feld (Median)'), excitedCol: L('Excited', 'Erregt'),
  regionName: L('frontal,central,temporal,parietal,occipital', 'frontal,zentral,temporal,parietal,okzipital'),
  sd: L('Strength and duration', 'Stärke und Dauer'),
  sdNote: L('The field that excites an axon falls as the pulse lengthens, toward a floor: past about 0.3 ms a longer pulse spends charge without exciting much more.', 'Das Feld, das ein Axon erregt, sinkt mit länger werdendem Puls auf einen Boden zu: Über etwa 0,3 ms hinaus verbraucht ein längerer Puls Ladung, ohne viel mehr zu erregen.'),
  seizingNow: L('The model: seizing', 'Das Modell: Anfall'),
};
const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const SKINS = [{ k: 'skinLow', z: -1.2 }, { k: 'skinTypical', z: 0 }, { k: 'skinHigh', z: 1.5 }];
const PROGRAM_ORDER: ProgramChoice[] = ['DGX', 'LOWEST', 'LOW_UB', 'LOW_05', 'INTERMIT', 'USER'];

export function mountEctStation(host: HTMLElement, o: StationOptions): StationHandle {
  let lang: Lang = o.lang;
  const t = (k: string) => tr(T[k], lang);
  const num = (x: number, d = 0) => { const s = x.toFixed(d); return lang === 'de' ? s.replace('.', ',') : s; };
  let view: 'treat' | 'stim' = 'treat';
  let patient: EctPatient = { placement: 'BT', prepared: true, skin: 0, seed: 7 };
  let session = new EctSession(patient, DEFAULT_SETTINGS);
  let speed = 4, stopped = false, raf = 0, last = 0, coverUp = false;
  let follow = true, scrollX = 0, drag: { x: number; s: number } | null = null;
  let demo: Generator<number, void, unknown> | null = null as Generator<number, void, unknown> | null, demoWait = 0;
  let seized = false;
  /* the stimulus view */
  let stimPlacement: PlacementId = 'BT', stimWidth = 0.5;
  let section: FieldSection | null = null, sectionKey = '', sectionJob = 0;
  let audio: { ctx: AudioContext; osc: OscillatorNode; gain: GainNode } | null = null;

  const css = (n: string) => getComputedStyle(host).getPropertyValue(n).trim() || '#888';
  const sizeCanvas = (c: HTMLCanvasElement, h: number) => {
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth;
    if (c.style.height !== `${h}px`) c.style.height = `${h}px`;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    return { g, w };
  };

  const newSession = (keepSeed = true) => {
    if (!keepSeed) patient.seed = (patient.seed * 7 + 3) % 997;
    const settings = structuredClone(session.device.settings);
    session = new EctSession(patient, settings);
    seized = false; coverUp = false; follow = true; scrollX = 0;
    render();
  };

  /* ---- sound: the device's tones (a continuous warning, an intermittent buzz while the current flows) ---------------- */
  const tone = (kind: 'none' | 'warning' | 'delivering') => {
    try {
      if (kind === 'none') { if (audio) audio.gain.gain.value = 0; return; }
      if (!audio) {
        const ctx = new AudioContext(), osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'square'; osc.connect(gain); gain.connect(ctx.destination); gain.gain.value = 0; osc.start();
        audio = { ctx, osc, gain };
      }
      audio.osc.frequency.value = kind === 'warning' ? 880 : 440;
      audio.gain.gain.value = kind === 'warning' ? 0.04 : (Math.floor(performance.now() / 120) % 2 ? 0.04 : 0);
    } catch { /* no audio: the lights say the same */ }
  };

  /* ---- the panel ---------------------------------------------------------------------------------------------- */
  const knob = (id: 'percent' | 'flex', label: string) => `
    <div class="ect-knob" data-knob="${id}">
      <button type="button" class="ect-turn" data-turn="${id}" data-dir="-1" aria-label="${esc(label)}: ${t('turnDown')}">◀</button>
      <button type="button" class="ect-face" data-face="${id}" aria-label="${esc(label)}: ${t('pressDial')}"><span></span></button>
      <button type="button" class="ect-turn" data-turn="${id}" data-dir="1" aria-label="${esc(label)}: ${t('turnUp')}">▶</button>
    </div>`;
  const panelHtml = () => `
    <div class="ect-panel" data-panel>
      <div class="ect-col">
        <div class="ect-led ect-led8" data-led-left aria-live="polite"></div>
        <button type="button" class="ect-btn ect-yellow" data-imp>${t('impedance')}</button>
        <div class="ect-jacks">
          <button type="button" class="ect-jack" data-jack="stim" aria-pressed="${session.stimulusCable}"><span class="ect-plug"></span>${t('ectJack')}</button>
          <span class="ect-dot" data-led-mon title="ECG"></span>
          <button type="button" class="ect-jack" data-jack="mon" aria-pressed="${session.monitoringCable}"><span class="ect-plug"></span>${t('monJack')}</button>
        </div>
      </div>
      <div class="ect-col ect-center">
        <div class="ect-lab"><span class="ect-dot" data-led-flex></span>${t('flex')}</div>
        ${knob('flex', t('flex'))}
      </div>
      <div class="ect-col ect-center">
        <div class="ect-led ect-led4" data-led-right></div>
        <div class="ect-lab">${t('percent')}</div>
        ${knob('percent', t('percent'))}
        <div class="ect-lights"><span><span class="ect-dot" data-led-preset></span>${t('preset')}</span><span><span class="ect-dot" data-led-user></span>${t('userSet')}</span></div>
      </div>
      <div class="ect-col ect-center">
        <div class="ect-treat ${coverUp ? 'open' : ''}" data-treat-wrap>
          <button type="button" class="ect-btn ect-yellow ect-big" data-treat ${coverUp ? '' : 'disabled'}>${t('treat')}</button>
          <button type="button" class="ect-cover" data-cover>${coverUp ? t('coverDown') : t('cover')}</button>
        </div>
      </div>
      <div class="ect-col ect-center">
        <div class="ect-lab"><span class="ect-dot ect-red" data-led-safety></span>${t('safety')}</div>
        <button type="button" class="ect-btn" data-startstop>${t('startStop')}</button>
        <button type="button" class="ect-rocker" data-power aria-pressed="${session.device.on}"><span>I</span><span>0</span></button>
        <div class="ect-lab">${t('power')}</div>
      </div>
      <div class="ect-printer" aria-hidden="true"><div class="ect-slot"></div></div>
    </div>`;

  const updatePanel = () => {
    const d = session.device, p = host.querySelector<HTMLElement>('[data-panel]');
    if (!p) return;
    const flash = Math.floor(performance.now() / 350) % 2 === 0;
    const left = p.querySelector<HTMLElement>('[data-led-left]')!;
    left.textContent = d.leftFlashes && !flash ? '' : d.left;
    p.querySelector<HTMLElement>('[data-led-right]')!.textContent = d.right;
    const lights = d.lights;
    p.querySelector('[data-led-flex]')!.classList.toggle('on', lights.flexDial && flash);
    p.querySelector('[data-led-preset]')!.classList.toggle('on', lights.preset);
    p.querySelector('[data-led-user]')!.classList.toggle('on', lights.userSet);
    p.querySelector('[data-led-safety]')!.classList.toggle('on', lights.safety);
    /* the light above the monitoring jack stays lit unless channel 4 has the ECG connected */
    p.querySelector('[data-led-mon]')!.classList.toggle('on', d.on && !session.monitoringCable);
    p.querySelector('[data-treat]')!.classList.toggle('lit', d.treat === 'delivering');
    p.querySelector('[data-power]')!.setAttribute('aria-pressed', String(d.on));
    tone(d.tone);
  };

  /* ---- the strip and the report -------------------------------------------------------------------------------- */
  const paperItems = (): PaperItem[] => session.paper.map((e: PaperEntry): PaperItem => {
    if (e.kind === 'trace') return { kind: 'trace', from: e.from, to: e.to ?? session.t, afterStimulus: e.afterStimulus };
    if (e.kind === 'selftest') return { kind: 'text', at: e.at, lines: [lang === 'de' ? 'EKT-System IV  Selbsttest bestanden' : 'ECT System IV  self test passed', `${lang === 'de' ? 'Netzfrequenz' : 'Mains'} 50 Hz`] };
    if (e.kind === 'settings') { const s = session.device.settings; return { kind: 'text', at: e.at, lines: [`${t('program')}: ${PROGRAM_NAMES[s.program]}`, `FREQUENC ${s.user.frequency} HZ  P-WIDTH ${s.user.pulseWidth} MS`, `CHANN. 1 ${s.gain[0]}  CHANN. 2 ${s.gain[1]}  PRINT ${s.paper}`, `INDEXES ${s.indexes ? 'ON' : 'OFF'}`] }; }
    return { kind: 'text', at: e.at, lines: reportFor(e.stimulus) };
  });
  const reportFor = (k: number): string[] => {
    const st = session.stimuli[k];
    if (!st) return [];
    const r = session.lastReport()!;
    return reportLines({ percent: st.percent, charge: st.given.charge, current: ECT.current, duration: st.given.duration, frequency: st.given.frequency, pulseWidth: st.given.pulseWidth,
      staticOhm: st.staticOhm, dynamicOhm: st.dynamicOhm, early: st.early, baselineAvailable: r.baselineAvailable, eegEndpoint: r.eegEndpoint, emgEndpoint: r.emgEndpoint,
      baseHr: ECT.restingHeartRate, peakHr: ECT.restingHeartRate, asei: r.asei, psi: r.psi, msp: r.msp, ttp: r.timeToPeakPower, coh: r.coherence, ttc: r.timeToPeakCoherence,
      program: PROGRAM_REPORT[st.program], indexes: session.device.settings.indexes }, lang, num);
  };
  /* the report's text is fixed when it is printed */
  const printedReports = new Map<number, string[]>();

  const drawStripNow = () => {
    const c = host.querySelector<HTMLCanvasElement>('[data-strip]');
    if (!c) return;
    const { g, w } = sizeCanvas(c, 300);
    g.font = '11px ui-monospace, Menlo, Consolas, monospace';
    const items = paperItems().map((it, i) => {
      const e = session.paper[i];
      if (e.kind === 'report') { if (!printedReports.has(i)) printedReports.set(i, it.kind === 'text' ? it.lines : []); return { ...it, lines: printedReports.get(i)! } as PaperItem; }
      return it;
    });
    const lay = layoutStrip(items, session.device.settings.paper, g);
    const maxScroll = Math.max(0, lay.width - w);
    if (follow) scrollX = maxScroll;
    scrollX = Math.max(0, Math.min(maxScroll, scrollX));
    const base = session.baselineFrom != null && session.readyAt != null ? baselineRate() : null;
    drawStrip(g, w, 300, session, lay, scrollX, { gains: session.device.settings.gain, emgGain: 1000, ecgGain: 1000, baselineRate: base }, { paper: css('--surface'), ink: css('--fg'), faint: css('--muted') }, () => ECT.restingHeartRate);
    const sl = host.querySelector<HTMLInputElement>('[data-scroll]');
    if (sl) { sl.max = String(Math.round(maxScroll)); sl.value = String(Math.round(scrollX)); }
  };
  let baseCache: { key: string; v: number } | null = null;
  const baselineRate = () => {
    const key = `${session.baselineFrom}:${session.readyAt}`;
    if (baseCache?.key === key) return baseCache.v;
    const a = Math.round(session.baselineFrom! * FS), b = Math.round(session.readyAt! * FS);
    /* the device's filter, on the baseline stretch */
    const x = session.rec.eeg1.subarray(0, b);
    let s = 0; const f = bandpassLocal(x);
    for (let i = a; i < b; i++) s += Math.abs(f[i]);
    baseCache = { key, v: s / Math.max(1, b - a) };
    return baseCache.v;
  };
  const bandpassLocal = (x: Float32Array) => { const out = new Float32Array(x.length); const aa = Math.exp((-2 * Math.PI * 2) / FS), bb = 1 - Math.exp((-2 * Math.PI * 25) / FS); let h1 = 0, h2 = 0, p1 = 0, p2 = 0, l1 = 0, l2 = 0; for (let i = 0; i < x.length; i++) { const v = x[i]; h1 = aa * (h1 + v - p1); p1 = v; h2 = aa * (h2 + h1 - p2); p2 = h1; l1 += bb * (h2 - l1); l2 += bb * (l1 - l2); out[i] = l2; } return out; };

  const drawReport = () => {
    const el = host.querySelector<HTMLElement>('[data-report]');
    if (!el) return;
    const k = [...session.paper.keys()].reverse().find((i) => session.paper[i].kind === 'report');
    const lines = k != null ? printedReports.get(k) : null;
    el.innerHTML = lines ? `<pre class="ect-report">${lines.map(esc).join('\n')}</pre>` : `<p class="muted small">${t('noReport')}</p>`;
  };

  /* ---- what happens now -------------------------------------------------------------------------------------- */
  const drawNow = () => {
    const el = host.querySelector<HTMLElement>('[data-now]');
    if (!el) return;
    const d = session.device, st = session.stimuli[session.stimuli.length - 1];
    if (session.seizing) seized = true;
    const reported = !!st && session.paper.some((e) => e.kind === 'report' && e.stimulus === session.stimuli.length - 1);
    const step = nextStep({ on: d.on, booting: d.booting, baseline: d.baseline, testedOhm: d.testing && d.t > 0 ? (d.left.match(/^\d+$/) ? Number(d.left) : null) : d.lastStatic, staticHigh: ECT.staticHigh, staticLow: ECT.staticLow,
      treat: d.treat, early: !!st?.early, printing: d.printing, stimulusEnd: d.stimulusEnd, reported, seconds: d.stimulusEnd != null ? d.t - d.stimulusEnd : 0 }, num);
    const ph = st ? phaseOf(session.brain, seized) : 'rest';
    const html = `<div class="st-text"><h3>${t('next')}</h3><p>${esc(tr(step, lang))}</p></div>` +
      (st && ph !== 'rest' ? `<div class="st-text"><h3>${esc(tr(PHASE_LABEL[ph], lang))}</h3><p>${esc(tr(PHASE_TEXT[ph], lang))}</p></div>` : '');
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
  };

  /* ---- the loop ---------------------------------------------------------------------------------------------- */
  const frame = (now: number) => {
    if (stopped) return;
    const dt = Math.min(0.1, last ? (now - last) / 1000 : 0);
    last = now;
    if (view === 'treat') {
      const d = session.device;
      /* real time while the learner works the device; faster after a stimulus, while only the seizure is to be seen */
      const fast = d.stimulusEnd != null && d.treat === 'done';
      session.advance(dt * (fast ? speed : 1));
      if (demo) { demoWait -= dt * (fast ? speed : 1); while (demo && demoWait <= 0) { const r = demo.next(); if (r.done) { demo = null; renderDemoButton(); } else demoWait = r.value as number; } }
      updatePanel(); drawStripNow(); drawReport(); drawNow();
    }
    raf = requestAnimationFrame(frame);
  };

  /* the manual's sequence, step by step, for "show the steps" */
  function* demoSteps(): Generator<number, void, unknown> {
    const d = session.device;
    if (!d.on) { d.power(true); yield 6; }
    d.impedanceButton(true); yield 1.6; d.impedanceButton(false); yield 0.5;
    while (d.baseline !== 'ready') yield 0.5;
    yield 1;
    d.turnPercent(0); yield 1.2;
    coverUp = true; render(); yield 0.8;
    d.treatButton(true);
    while (d.treat !== 'done') yield 0.1;
    d.treatButton(false); coverUp = false; render();
    yield 5;
    while (session.seizing || session.device.t - (session.device.stimulusEnd ?? 0) < 20) yield 1;
    yield 8;
    d.startStop();
  }
  const renderDemoButton = () => { const b = host.querySelector<HTMLButtonElement>('[data-demo]'); if (b) b.textContent = demo ? t('demoStop') : t('demo'); };

  /* ---- render ------------------------------------------------------------------------------------------------ */
  const headHtml = () => `<div class="st-head">
      <button type="button" class="ghost" data-leave>← ${o.backLabel ? tr(o.backLabel, lang) : t('back')}</button>
      <div class="st-title"><div class="eyebrow">${t('eyebrow')}</div><h1>${esc(tr(ECT_STATION.title, lang))}</h1><p class="lede">${esc(tr(ECT_STATION.summary, lang))}</p></div>
      <span class="seg st-mode" role="radiogroup" aria-label="${t('view')}">${(['treat', 'stim'] as const).map((v) => `<button type="button" role="radio" aria-checked="${view === v}" data-view="${v}">${t(v === 'treat' ? 'viewTreat' : 'viewStim')}</button>`).join('')}</span>
    </div>`;

  const render = () => {
    if (view === 'stim') { renderStim(); return; }
    host.innerHTML = `${headHtml()}
      <div class="st-grid">
        <aside class="panel st-settings" aria-labelledby="ect-pt-h">
          <h2 id="ect-pt-h">${t('patient')}</h2>
          <p class="layer-note">${t('patientNote')}</p>
          <label class="st-preset">${t('placement')}
            <select data-placement>${(Object.keys(PLACEMENTS) as PlacementId[]).map((k) => `<option value="${k}" ${k === patient.placement ? 'selected' : ''}>${esc(tr(PLACEMENTS[k].name, lang))}</option>`).join('')}</select></label>
          <p class="muted small">${esc(tr(PLACEMENTS[patient.placement].where, lang))}</p>
          <label class="st-var st-check"><input type="checkbox" data-prepared ${patient.prepared ? 'checked' : ''}><span>${t('prepared')}</span></label>
          <div class="st-var"><span>${t('skin')}</span><span class="seg" role="radiogroup" aria-label="${t('skin')}">${SKINS.map((x) => `<button type="button" role="radio" aria-checked="${patient.skin === x.z}" data-skin="${x.z}">${t(x.k)}</button>`).join('')}</span></div>
          <label class="st-leads">${t('speed')} <select data-speed>${[1, 4, 16].map((s) => `<option value="${s}" ${s === speed ? 'selected' : ''}>${s}×</option>`).join('')}</select></label>
          <button type="button" class="primary" data-demo>${demo ? t('demoStop') : t('demo')}</button>
          <button type="button" class="ghost" data-restart>${t('restart')}</button>
          <button type="button" class="ghost" data-another>${t('another')}</button>
        </aside>
        <div class="st-main">
          <section class="panel st-signal" aria-labelledby="ect-dev-h">
            <div class="st-row"><div><h2 id="ect-dev-h">${t('device')}</h2><div class="muted small">${t('deviceNote')}</div></div></div>
            ${panelHtml()}
          </section>
          <section class="panel st-signal" aria-labelledby="ect-strip-h">
            <div class="st-row"><div><h2 id="ect-strip-h">${t('strip')}</h2><div class="muted small">${t('stripNote')}</div></div>
              <label class="st-check"><input type="checkbox" data-follow ${follow ? 'checked' : ''}> ${t('follow')}</label></div>
            <canvas class="st-strip ect-strip" data-strip role="img" aria-label="${t('strip')}"></canvas>
            <input type="range" class="ect-scroll" data-scroll min="0" max="0" value="0" aria-label="${t('strip')}">
            <h3>${t('report')}</h3><div data-report></div>
          </section>
          <section class="panel st-why" aria-labelledby="ect-now-h">
            <h2 id="ect-now-h">${t('now')}</h2>
            <div data-now></div>
            <details><summary>${t('more')}</summary>${ECT_BACKGROUND.map((x) => `<div class="st-text"><h3>${esc(tr(x.title, lang))}</h3><p>${esc(tr(x.body, lang))}</p></div>`).join('')}</details>
            <p class="muted small">${t('draft')}</p>
          </section>
        </div>
      </div>`;
    wireCommon(); wireTreat();
  };

  const wireCommon = () => {
    host.querySelector('[data-leave]')!.addEventListener('click', () => { stop(); o.onLeave(); });
    host.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => b.addEventListener('click', () => { view = b.dataset.view as typeof view; tone('none'); render(); }));
  };

  const wireTreat = () => {
    const d = () => session.device;
    host.querySelector<HTMLSelectElement>('[data-placement]')!.onchange = (e) => { patient.placement = (e.target as HTMLSelectElement).value as PlacementId; newSession(); };
    host.querySelector<HTMLInputElement>('[data-prepared]')!.onchange = (e) => { patient.prepared = (e.target as HTMLInputElement).checked; session.setPrepared(patient.prepared); };
    host.querySelectorAll<HTMLButtonElement>('[data-skin]').forEach((b) => b.addEventListener('click', () => { patient.skin = Number(b.dataset.skin); newSession(); }));
    host.querySelector<HTMLSelectElement>('[data-speed]')!.onchange = (e) => { speed = Number((e.target as HTMLSelectElement).value); };
    host.querySelector('[data-restart]')!.addEventListener('click', () => { demo = null; newSession(); });
    host.querySelector('[data-another]')!.addEventListener('click', () => { demo = null; newSession(false); });
    host.querySelector('[data-demo]')!.addEventListener('click', () => { if (demo) { demo = null; d().treatButton(false); d().impedanceButton(false); } else { demo = demoSteps(); demoWait = 0; } renderDemoButton(); });
    host.querySelector<HTMLInputElement>('[data-follow]')!.onchange = (e) => { follow = (e.target as HTMLInputElement).checked; };
    const sl = host.querySelector<HTMLInputElement>('[data-scroll]')!;
    sl.oninput = () => { follow = false; scrollX = Number(sl.value); (host.querySelector('[data-follow]') as HTMLInputElement).checked = false; };
    const strip = host.querySelector<HTMLCanvasElement>('[data-strip]')!;
    strip.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, s: scrollX }; strip.setPointerCapture(e.pointerId); });
    strip.addEventListener('pointermove', (e) => { if (!drag) return; follow = false; scrollX = drag.s - (e.clientX - drag.x); (host.querySelector('[data-follow]') as HTMLInputElement).checked = false; });
    strip.addEventListener('pointerup', () => { drag = null; });
    /* holding buttons */
    const hold = (sel: string, f: (down: boolean) => void) => {
      const b = host.querySelector<HTMLButtonElement>(sel)!;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); f(true); });
      b.addEventListener('pointerup', () => f(false));
      b.addEventListener('pointercancel', () => f(false));
      b.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); f(true); } });
      b.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); f(false); } });
    };
    hold('[data-imp]', (down) => d().impedanceButton(down));
    hold('[data-treat]', (down) => { if (coverUp) d().treatButton(down); });
    host.querySelector('[data-cover]')!.addEventListener('click', () => { coverUp = !coverUp; if (!coverUp) d().treatButton(false); render(); });
    host.querySelector('[data-startstop]')!.addEventListener('click', () => d().startStop());
    host.querySelector('[data-power]')!.addEventListener('click', () => d().power(!d().on));
    host.querySelectorAll<HTMLButtonElement>('[data-jack]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.jack === 'stim') session.setStimulusCable(!session.stimulusCable); else session.monitoringCable = !session.monitoringCable;
      b.setAttribute('aria-pressed', String(b.dataset.jack === 'stim' ? session.stimulusCable : session.monitoringCable));
    }));
    /* the dials */
    const turn = (id: string, n: number) => { if (id === 'percent') d().turnPercent(n); else d().turnFlex(n); };
    host.querySelectorAll<HTMLButtonElement>('[data-turn]').forEach((b) => b.addEventListener('click', () => turn(b.dataset.turn!, Number(b.dataset.dir))));
    host.querySelectorAll<HTMLButtonElement>('[data-face]').forEach((b) => {
      const id = b.dataset.face!;
      let start: { a: number; moved: number; acc: number } | null = null;
      const angle = (e: PointerEvent) => { const r = b.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
      b.addEventListener('wheel', (e) => { e.preventDefault(); turn(id, e.deltaY > 0 ? 1 : -1); }, { passive: false });
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); start = { a: angle(e), moved: 0, acc: 0 }; if (id === 'percent') d().pressPercent(true); });
      b.addEventListener('pointermove', (e) => {
        if (!start) return;
        let da = angle(e) - start.a; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
        start.a = angle(e); start.acc += da; start.moved += Math.abs(da);
        const steps = Math.trunc(start.acc / (Math.PI / 8));
        if (steps) { start.acc -= steps * (Math.PI / 8); turn(id, steps); b.querySelector('span')!.style.transform = `rotate(${(start.moved * 180) / Math.PI}deg)`; }
      });
      const up = () => {
        if (!start) return;
        const click = start.moved < 0.15; start = null;
        if (id === 'percent') d().pressPercent(false);
        else if (click) d().pressFlex();
      };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
      b.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); turn(id, 1); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); turn(id, -1); }
        else if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); if (id === 'percent') d().pressPercent(true); else d().pressFlex(); }
      });
      b.addEventListener('keyup', (e) => { if ((e.key === ' ' || e.key === 'Enter') && id === 'percent') d().pressPercent(false); });
    });
  };

  /* ---- the stimulus view --------------------------------------------------------------------------------------- */
  const renderStim = () => {
    const s = session.device.settings;
    const stim = stimulusFor(s.program, session.device.percent, s.user);
    const doses: RegionDose[] = dosesFor(stimPlacement, stimWidth);
    const f = fieldFor(stimPlacement), th = thresholdField(stimWidth);
    const regionNames = tr(T.regionName, lang).split(',');
    const rname = (id: string) => { const [h, r] = id.split('-'); const k = ['frontal', 'central', 'temporal', 'parietal', 'occipital'].indexOf(r); return `${h === 'L' ? t('left') : t('right')} ${regionNames[k]}`; };
    const median = (() => { const fs = doses.map((x) => x.field).sort((a, b) => a - b); return fs[fs.length >> 1]; })();
    const facts = stim ? explainStimulus({ percent: session.device.percent, charge: stim.charge, current: ECT.current, pulseWidth: stimWidth, frequency: stim.frequency, pulses: Math.round(stim.charge / (ECT.current * stimWidth)),
      duration: Math.round(stim.charge / (ECT.current * stimWidth)) / (2 * stim.frequency), dynamicOhm: session.dynamicOhm, energy: energy({ frequency: stim.frequency, pulseWidth: stimWidth, pulses: Math.round(stim.charge / (ECT.current * stimWidth)) }, session.dynamicOhm),
      brainShare: brainShareOf(stimPlacement), medianField: median, threshold: th, excitedRegions: doses.filter((x) => x.excited > 0.9).length,
      placementName: PLACEMENTS[stimPlacement].name, placementWhere: PLACEMENTS[stimPlacement].where }, num) : [];
    host.innerHTML = `${headHtml()}
      <div class="st-grid">
        <aside class="panel st-settings" aria-labelledby="ect-st-h">
          <h2 id="ect-st-h">${t('stimTitle')}</h2>
          <p class="layer-note">${t('stimNote')}</p>
          <label class="st-preset">${t('placement')}
            <select data-splace>${(Object.keys(PLACEMENTS) as PlacementId[]).map((k) => `<option value="${k}" ${k === stimPlacement ? 'selected' : ''}>${esc(tr(PLACEMENTS[k].name, lang))}</option>`).join('')}</select></label>
          <label class="st-preset">${t('pulseWidth')}
            <select data-swidth>${[0.25, 0.3, 0.5, 1.0, 1.5].map((w) => `<option value="${w}" ${w === stimWidth ? 'selected' : ''}>${num(w, 2)} ms</option>`).join('')}</select></label>
          <label class="st-preset">${t('program')}
            <select data-sprog>${PROGRAM_ORDER.filter((p) => p !== 'INTERMIT').map((p) => `<option value="${p}" ${p === s.program ? 'selected' : ''}>${PROGRAM_NAMES[p]}</option>`).join('')}</select></label>
          <label class="st-var"><span>${t('dose')} <output>${num(session.device.percent)} % · ${num(CHARGE_MC[s.percentIndex], 1)} mC</output></span>
            <input type="range" data-spct min="0" max="${PERCENT_STEPS.indexOf(s.maxPercent)}" step="1" value="${s.percentIndex}"></label>
        </aside>
        <div class="st-main">
          <section class="panel st-signal">
            <div class="eeg-mech">
              <figure><figcaption class="muted small">${t('section')}</figcaption><canvas class="st-heart" data-sec role="img" aria-label="${t('section')}"></canvas><span class="muted small">${t('sectionNote')}</span></figure>
              <figure><figcaption class="muted small">${t('regions')}</figcaption><canvas class="st-heart" data-rmap role="img" aria-label="${t('regions')}"></canvas><span class="muted small">${t('regionsNote')}</span></figure>
            </div>
            <table class="lab ect-regions"><thead><tr><th>${t('regionCol')}</th><th>${t('fieldCol')}</th><th>${t('excitedCol')}</th></tr></thead>
              <tbody>${doses.map((x) => `<tr><td>${esc(rname(x.def.id))}</td><td>${num(x.field, 2)} V/cm</td><td>${num(100 * x.excited)} %</td></tr>`).join('')}</tbody></table>
            <figure><figcaption class="muted small">${t('sd')}</figcaption><canvas class="st-heart" data-sd role="img" aria-label="${t('sd')}"></canvas><span class="muted small">${t('sdNote')}</span></figure>
          </section>
          <section class="panel st-why">
            ${facts.map((x) => `<div class="st-text"><h3>${esc(tr(x.title, lang))}</h3><p>${esc(tr(x.body, lang))}</p></div>`).join('')}
            <details><summary>${t('more')}</summary>${ECT_BACKGROUND.map((x) => `<div class="st-text"><h3>${esc(tr(x.title, lang))}</h3><p>${esc(tr(x.body, lang))}</p></div>`).join('')}</details>
            <p class="muted small">${t('draft')}</p>
          </section>
        </div>
      </div>`;
    wireCommon();
    host.querySelector<HTMLSelectElement>('[data-splace]')!.onchange = (e) => { stimPlacement = (e.target as HTMLSelectElement).value as PlacementId; renderStim(); };
    host.querySelector<HTMLSelectElement>('[data-swidth]')!.onchange = (e) => { stimWidth = Number((e.target as HTMLSelectElement).value); renderStim(); };
    host.querySelector<HTMLSelectElement>('[data-sprog]')!.onchange = (e) => { session.device.settings.program = (e.target as HTMLSelectElement).value as ProgramChoice; if (stimulusFor(session.device.settings.program, session.device.percent, s.user)) stimWidth = stimulusFor(session.device.settings.program, session.device.percent, s.user)!.pulseWidth; renderStim(); };
    host.querySelector<HTMLInputElement>('[data-spct]')!.oninput = (e) => { session.device.settings.percentIndex = Number((e.target as HTMLInputElement).value); const x = stimulusFor(session.device.settings.program, session.device.percent, s.user); if (x) stimWidth = x.pulseWidth; renderStim(); };
    drawStimFigures(doses, th);
    const key = `${stimPlacement}`;
    if (sectionKey !== key) {
      section = null; sectionKey = key;
      const job = ++sectionJob;
      setTimeout(() => { if (job !== sectionJob || stopped) return; section = fieldSection(f, 72); if (view === 'stim') drawStimFigures(dosesFor(stimPlacement, stimWidth), thresholdField(stimWidth)); }, 30);
    }
  };
  const shares = new Map<PlacementId, number>();
  const brainShareOf = (p: PlacementId) => { if (!shares.has(p)) shares.set(p, fieldFor(p).brainShare(300)); return shares.get(p)!; };

  const drawStimFigures = (doses: RegionDose[], th: number) => {
    const col = { fg: css('--fg'), muted: css('--muted'), line: css('--line'), surface: css('--surface'), accent: css('--accent') };
    const sc = host.querySelector<HTMLCanvasElement>('[data-sec]');
    if (sc) {
      const { g, w } = sizeCanvas(sc, 300);
      if (section) drawFieldSection(g, w, 300, section, fieldFor(stimPlacement).model.head.radii, th, col, { a: 'A', b: 'B', left: t('left'), right: t('right'), up: t('up'), dec: lang === 'de' ? ',' : '.' });
      else { g.fillStyle = col.muted; g.font = '13px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(t('computing'), w / 2, 150); }
    }
    const rc = host.querySelector<HTMLCanvasElement>('[data-rmap]');
    if (rc) { const { g, w } = sizeCanvas(rc, 300); const p = PLACEMENTS[stimPlacement]; drawRegionMap(g, w, 300, doses, [p.a, p.b], col, { nose: t('nose') }); }
    const sd = host.querySelector<HTMLCanvasElement>('[data-sd]');
    if (sd) {
      const { g, w } = sizeCanvas(sd, 170), h = 170, x0 = 46, y0 = h - 26, x1 = w - 12, y1 = 10;
      const X = (ms: number) => x0 + ((ms - 0.1) / 1.4) * (x1 - x0), maxE = thresholdField(0.1) * 1.05, Y = (e: number) => y0 - (e / maxE) * (y0 - y1);
      g.strokeStyle = col.line; g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, y0); g.lineTo(x1, y0); g.stroke();
      g.strokeStyle = col.accent; g.lineWidth = 2; g.beginPath();
      for (let k = 0; k <= 140; k++) { const ms = 0.1 + k * 0.01; const y = Y(thresholdField(ms)); if (k === 0) g.moveTo(X(ms), y); else g.lineTo(X(ms), y); }
      g.stroke(); g.lineWidth = 1;
      g.fillStyle = col.fg; g.beginPath(); g.arc(X(stimWidth), Y(thresholdField(stimWidth)), 4, 0, 2 * Math.PI); g.fill();
      g.fillStyle = col.muted; g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
      for (const ms of [0.25, 0.5, 1.0, 1.5]) g.fillText(`${num(ms, 2)} ms`, X(ms), y0 + 14);
      g.textAlign = 'right'; for (const e of [0.4, 0.6, 0.8]) if (e < maxE) g.fillText(`${num(e, 1)}`, x0 - 4, Y(e) + 4);
      g.textAlign = 'left'; g.fillText('V/cm', 4, y1 + 4);
    }
  };

  const stop = () => { stopped = true; cancelAnimationFrame(raf); tone('none'); try { audio?.ctx.close(); } catch { /* */ } };
  render();
  raf = requestAnimationFrame(frame);
  return { stop, setLang(l: Lang) { lang = l; printedReports.clear(); render(); } };
}
