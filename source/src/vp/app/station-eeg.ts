import { tr, type LocalizedText } from '../model/i18n.ts';
import type { Lang } from './diagrams.ts';
import { type StationHandle, type StationOptions } from './station-ecg.ts';
import { EEG_STATION } from '../stations/station.ts';
import { EEG } from '../evidence/eeg.ts';
import { EEG_PRESETS, EEG_PRESET_GROUPS, presetById, SPIKE, type EegScene } from '../stations/eeg-presets.ts';
import { compute, pageOf, peaksOn, mapGrid, sectionOf, type Computed, type Section } from '../stations/eeg-scene.ts';
import { explainEeg, EEG_BACKGROUND } from '../stations/eeg-texts.ts';
import { MONTAGES, MONTAGE_BY_ID, channelLabel, potentialOf, type Montage } from '../measurements/eeg-montage.ts';
import { channelTrace, dischargeAt, type Page } from '../measurements/eeg-record.ts';
import { SKULL_RATIOS, E1020, electrodeDir, electrodeLabel, toMap, vec, type Vec3 } from '../measurements/eeg-forward.ts';
import { mountSeizureView, type SeizureView } from './station-eeg-seizure.ts';
import { drawPage, pageHeight, drawHeadMap, mapTransform, drawSection, drawChain, inPlane, type Colors, type PageGeometry } from '../render/eeg-view.ts';

/* ---------------------------------------------------------------------------
   The EEG station, part 1: how the scalp sees a source.

   A patch of cortex discharges; the forward model (measurements/eeg-
   forward.ts) carries its field through brain, CSF, skull and scalp to the
   electrodes; the montage turns the potentials into channels and the
   machine draws them. Nothing on the page is drawn from a rule: phase
   reversals, end-of-chain maxima, two poles of a tangential source and a
   reference that is not quiet all come from the physics.

   Signal: the page in the chosen montage, with the filters and sensitivity
   a reader sets. Mechanism: the head from above with the scalp field at the
   cursor, a section through the head in the plane of the source, and one
   chain of electrodes with the potential along it and each channel's
   deflection. Settings: the source (where, how big, how deep, which way it
   faces), the discharge, and the head's physics.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });
const T: Record<string, LocalizedText> = {
  eyebrow: L('Station', 'Station'), back: L('Ward', 'Übersicht'),
  view: L('View', 'Ansicht'), viewSource: L('A source', 'Eine Quelle'), viewSeizure: L('A seizure', 'Ein Anfall'),
  source: L('The source', 'Die Quelle'), sourceNote: L('A patch of cortex discharging. Tap the head map to move it.', 'Ein Areal der Rinde, das sich entlädt. Tippen Sie auf die Kopfkarte, um es zu verschieben.'),
  startFrom: L('Start from', 'Ausgangspunkt'), choose: L('Choose a source…', 'Quelle wählen…'),
  area: L('Area', 'Fläche'), depth: L('Depth below the brain’s surface', 'Tiefe unter der Hirnoberfläche'),
  crown: L('gyral crown', 'Gyruskuppe'), wall: L('sulcal wall', 'Sulcuswand'), deep: L('deep', 'tief'),
  tilt: L('Tilt from radial', 'Neigung gegen die Radiale'), toward: L('Negative end leans toward', 'Negatives Ende neigt sich nach'),
  tiltNote: L('0° faces the skull (a gyral crown); 90° lies along it (a sulcal wall).', '0° zeigt zum Schädel (Gyruskuppe); 90° liegt entlang (Sulcuswand).'),
  polarity: L('Polarity at the surface', 'Polarität an der Oberfläche'), negative: L('negative', 'negativ'), positive: L('positive', 'positiv'),
  discharge: L('The discharge', 'Die Entladung'), duration: L('Duration of the main component', 'Dauer der Hauptkomponente'),
  slow: L('Slow wave after it', 'Langsame Welle danach'),
  physics: L('The head’s physics', 'Die Physik des Kopfes'),
  skull: L('Brain-to-skull conductivity ratio', 'Leitfähigkeitsverhältnis Gehirn zu Schädel'),
  csf: L('Cerebrospinal fluid layer', 'Liquorschicht'), density: L('Dipole moment density', 'Dipolmomentdichte'),
  densityNote: L('Human neocortex: 0.16–0.77 nAm/mm² (Murakami & Okada 2015).', 'Menschlicher Neokortex: 0,16–0,77 nAm/mm² (Murakami & Okada 2015).'),
  recording: L('The recording', 'Die Ableitung'),
  recordingNote: L('At 30 mm/s (ten seconds; four on a phone). Negative is up: a channel deflects upward when input 1 is negative relative to input 2. Tap the page to move the cursor.', 'Bei 30 mm/s (zehn Sekunden; auf dem Telefon vier). Negativ ist oben: Ein Kanal schlägt nach oben aus, wenn Eingang 1 gegenüber Eingang 2 negativ ist. Tippen Sie auf die Seite, um den Cursor zu setzen.'),
  montage: L('Montage', 'Montage'), sens: L('Sensitivity', 'Empfindlichkeit'), lff: L('Low-frequency filter', 'Tiefpassgrenze (LFF)'), hff: L('High-frequency filter', 'Hochfrequenzfilter (HFF)'),
  off: L('off', 'aus'), second: L('s', 's'),
  how: L('How the scalp sees it', 'Wie die Kopfhaut es sieht'),
  howNote: L('At the cursor. Blue is negative, red positive, against a point far away. The colours keep the scale of the discharge’s peak.', 'Am Cursor. Blau ist negativ, rot positiv, gegen einen fernen Punkt. Die Farben behalten die Skala des Entladungsgipfels.'),
  map: L('The scalp from above', 'Die Kopfhaut von oben'),
  mapKey: L('Dashed: the patch. ⊙ its negative end faces out of the head here, ⊗ into it; an arrow: the way it leans. Electrodes beyond the head’s ring lie below its equator.', 'Gestrichelt: das Areal. ⊙ sein negatives Ende zeigt hier aus dem Kopf, ⊗ hinein; ein Pfeil: wohin es sich neigt. Elektroden außerhalb des Kopfrings liegen unter seinem Äquator.'), section: L('A section through the source', 'Ein Schnitt durch die Quelle'),
  sectionNote: L('In the plane of the patch and the way it leans, seen from behind (the patient’s left on the left), with the head’s vertex up. The field in every shell, on a compressed scale: inside the brain near the source it is far stronger than on the scalp.', 'In der Ebene des Areals und seiner Neigung, von hinten gesehen (die linke Seite des Patienten links), der Scheitel oben. Das Feld in jeder Schicht, auf gestauchter Skala: Im Gehirn nahe der Quelle ist es weit stärker als auf der Kopfhaut.'),
  chain: L('One chain', 'Eine Kette'), chainNote: L('Above: the potential at each electrode. Below: each channel’s deflection, up when input 1 is the more negative.', 'Oben: das Potential an jeder Elektrode. Unten: der Ausschlag jedes Kanals, nach oben, wenn Eingang 1 der negativere ist.'),
  potential: L('potential', 'Potential'), channels: L('channels', 'Kanäle'), reversal: L('reversal', 'Umkehr'), up: L('up', 'oben'),
  slowMo: L('Play the discharge slowly', 'Entladung langsam abspielen'), stop: L('Stop', 'Anhalten'), toPeak: L('To the peak', 'Zum Gipfel'),
  computing: L('Computing the field…', 'Das Feld wird berechnet…'),
  why: L('What the field says', 'Was das Feld sagt'), more: L('Background', 'Hintergrund'),
  reading: L('Reading', 'Befund'), negMax: L('negative maximum', 'negatives Maximum'), posMax: L('positive maximum', 'positives Maximum'),
  revAt: L('phase reversal', 'Phasenumkehr'), none: L('none', 'keine'), endChain: L('end of chain', 'Kettenende'), peak: L('largest channel', 'größter Kanal'),
  nose: L('nose', 'Nase'), left: L('left', 'links'), right: L('right', 'rechts'),
  brain: L('brain', 'Gehirn'), csfShell: L('CSF', 'Liquor'), skullShell: L('skull', 'Schädel'), scalpShell: L('scalp', 'Kopfhaut'),
  dirs: L('nose,right ear,back,left ear', 'Nase,rechtes Ohr,hinten,linkes Ohr'),
  draft: L('Explanations are drafts until a clinician has read them.', 'Die Erklärungen sind Entwürfe, bis ein Kliniker sie gelesen hat.'),
};
const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const SENS = [3, 5, 7, 10, 15, 20, 30, 50, 100];
const LFFS = [0, 0.1, 0.3, 0.5, 1, 1.6];
const HFFS = [15, 35, 70, 0];
const SECONDS = 10;

export function mountEegStation(host: HTMLElement, o: StationOptions): StationHandle {
  let lang: Lang = o.lang;
  const t = (k: string) => tr(T[k], lang);
  let presetId = 'temporal-left';
  let scene: EegScene = structuredClone(presetById(presetId)!.scene);
  let montageId = 'LB-18.1', sens = 7, lff = 1, hff = 70;
  let comp: Computed = compute(scene);
  let page: Page = pageOf(scene, comp, SECONDS);
  let grid: Float32Array | null = null, section: Section | null = null, fieldJob = 0;
  let cursor = peaksOn(scene, SECONDS)[0] ?? 1000;
  let chainIdx = 0;
  let geom: PageGeometry | null = null;
  let raf = 0, playing = false, stopped = false, playFrom = 0;
  let view: 'source' | 'seizure' = 'source';
  let seizureView: SeizureView | null = null;
  const MAP_N = 60, SECTION_N = 64;

  const css = (n: string) => getComputedStyle(host).getPropertyValue(n).trim() || '#888';
  const colors = (): Colors => ({ fg: css('--fg'), muted: css('--muted'), accent: css('--accent'), line: css('--line'), surface: css('--surface'), sunk: css('--sunk'), abn: css('--abn') });
  const sizeCanvas = (c: HTMLCanvasElement, h: number) => {
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth;
    if (c.style.height !== `${h}px`) c.style.height = `${h}px`;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    return { g, w };
  };
  const num = (x: number, d = 0) => { const s = x.toFixed(d); return lang === 'de' ? s.replace('.', ',') : s; };
  const montage = (): Montage => MONTAGE_BY_ID[montageId];
  const peak = () => { const ps = peaksOn(scene, SECONDS); return ps.reduce((b, p) => (Math.abs(p - cursor) < Math.abs(b - cursor) ? p : b), ps[0] ?? 1000); };
  /** the discharge's own waveform at the cursor (1 at its peak) */
  const kAt = (ms: number) => peaksOn(scene, SECONDS).reduce((s, p) => s + dischargeAt(scene.discharge, ms - p), 0);
  const maxField = () => Math.max(...E1020.map((e) => Math.abs(comp.field[e])), 1e-6);

  /* ---- recompute ------------------------------------------------------------------------------------ */
  const recompute = (keepCursor = true) => {
    comp = compute(scene);
    page = pageOf(scene, comp, SECONDS);
    if (!keepCursor) cursor = peaksOn(scene, SECONDS)[0] ?? 1000;
    grid = null; section = null;
    const job = ++fieldJob;
    /* the map and the section take a few hundred ms: after this frame, so the page answers at once */
    setTimeout(() => { if (job !== fieldJob || stopped) return; grid = mapGrid(comp, MAP_N); drawMechanism(); setTimeout(() => { if (job !== fieldJob || stopped) return; section = sectionOf(scene, comp, SECTION_N); drawMechanism(); }, 0); }, 30);
    chainIdx = defaultChain();
  };
  const chainsOf = (m: Montage): string[][] => m.chains ?? (MONTAGE_BY_ID['LB-18.1'].chains as string[][]);
  const defaultChain = () => {
    const cs = chainsOf(montage()), neg = comp.reading.negMax;
    const i = cs.findIndex((c) => c.includes(neg));
    return i >= 0 ? i : 0;
  };

  /* ---- markup --------------------------------------------------------------------------------------- */
  const slider = (key: string, label: string, min: number, max: number, step: number, value: number, unit: string, note = '') =>
    `<label class="st-var"><span>${esc(label)} <output data-out="${key}">${num(value, step < 1 ? 2 : 0)} ${unit}</output></span>
      <input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${value}">${note ? `<span class="muted small">${esc(note)}</span>` : ''}</label>`;
  const dirName = (deg: number) => { const names = t('dirs').split(','); return names[Math.round((((deg % 360) + 360) % 360) / 90) % 4]; };

  const headHtml = () => `<div class="st-head">
        <button type="button" class="ghost" data-leave>← ${o.backLabel ? tr(o.backLabel, lang) : t('back')}</button>
        <div class="st-title"><div class="eyebrow">${t('eyebrow')}</div><h1>${esc(tr(EEG_STATION.title, lang))}</h1><p class="lede">${esc(tr(EEG_STATION.summary, lang))}</p></div>
        <span class="seg st-mode" role="radiogroup" aria-label="${t('view')}">${(['source', 'seizure'] as const).map((v) => `<button type="button" role="radio" aria-checked="${view === v}" data-view="${v}">${t(v === 'source' ? 'viewSource' : 'viewSeizure')}</button>`).join('')}</span>
      </div>`;
  const wireHead = () => {
    host.querySelector<HTMLButtonElement>('[data-leave]')!.onclick = () => { stop(); o.onLeave(); };
    host.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => b.onclick = () => {
      const v = b.dataset.view as typeof view; if (v === view) return;
      view = v; seizureView?.stop(); seizureView = null; setPlaying(false); render();
    });
  };
  const render = () => {
    if (view === 'seizure') {
      host.innerHTML = `${headHtml()}<div data-seizure></div>`;
      wireHead();
      seizureView = mountSeizureView(host.querySelector<HTMLElement>('[data-seizure]')!, { lang, colors, sizeCanvas });
      return;
    }
    const m = montage();
    host.innerHTML = `${headHtml()}
      <div class="st-grid">
        <aside class="panel st-settings" aria-labelledby="eeg-src-h">
          <h2 id="eeg-src-h">${t('source')}</h2>
          <p class="layer-note">${t('sourceNote')}</p>
          <label class="st-preset">${t('startFrom')}
            <select data-preset><option value="">${t('choose')}</option>${EEG_PRESET_GROUPS.map((g) => `<optgroup label="${esc(tr(g.group, lang))}">${g.ids.map((id) => EEG_PRESETS.find((p) => p.id === id)!).map((p) => `<option value="${p.id}" ${p.id === presetId ? 'selected' : ''}>${esc(tr(p.label, lang))}</option>`).join('')}</optgroup>`).join('')}</select>
          </label>
          ${slider('area', t('area'), 1, 40, 1, scene.patch.area, 'cm²')}
          <label class="st-var"><span>${t('depth')} <output data-out="depth">${num(scene.patch.depth, 1)} mm</output></span>
            <input type="range" data-k="depth" min="1" max="40" step="0.25" value="${scene.patch.depth}">
            <span class="st-bar">${[['crown', EEG.crownDepth], ['wall', EEG.sulcusDepth], ['deep', 30]].map(([k, d]) => `<button type="button" class="chip st-chip" data-depth="${d}" aria-pressed="${Math.abs(scene.patch.depth - (d as number)) < 0.01}">${t(k as string)}</button>`).join('')}</span></label>
          ${slider('tilt', t('tilt'), 0, 90, 5, scene.patch.tilt, '°', t('tiltNote'))}
          <label class="st-var" ${scene.patch.tilt < 1 ? 'hidden' : ''} data-toward-row><span>${t('toward')} <output data-out="toward">${dirName(scene.patch.toward)} (${num(scene.patch.toward)}°)</output></span>
            <input type="range" data-k="toward" min="0" max="355" step="5" value="${scene.patch.toward}"></label>
          <div class="st-var"><span>${t('polarity')}</span><span class="seg" role="radiogroup" aria-label="${t('polarity')}">${(['negative', 'positive'] as const).map((p) => `<button type="button" role="radio" aria-checked="${scene.polarity === p}" data-polarity="${p}">${t(p)}</button>`).join('')}</span></div>
          <h3>${t('discharge')}</h3>
          ${slider('duration', t('duration'), 20, 200, 5, scene.discharge.duration, 'ms')}
          <label class="st-var st-check"><input type="checkbox" data-slow ${scene.discharge.slowWave > 0 ? 'checked' : ''}><span>${t('slow')}</span></label>
          <details class="grp"><summary>${t('physics')}</summary>
            <label class="st-preset">${t('skull')}
              <select data-skull>${SKULL_RATIOS.map((r, i) => `<option value="${i}" ${(scene.skullRatio == null ? i === 0 : Math.abs(scene.skullRatio - r.ratio) < 0.01) ? 'selected' : ''}>1 : ${num(r.ratio, r.ratio % 1 ? 1 : 0)}, ${esc(tr(r.label, lang))}</option>`).join('')}</select></label>
            <label class="st-var st-check"><input type="checkbox" data-csf ${scene.csf ? 'checked' : ''}><span>${t('csf')}</span></label>
            ${slider('density', t('density'), 0.1, 1, 0.01, scene.patch.density, 'nAm/mm²', t('densityNote'))}
          </details>
        </aside>
        <div class="st-main">
          <section class="panel st-signal" aria-labelledby="eeg-rec-h">
            <div class="st-row"><div><h2 id="eeg-rec-h">${t('recording')}</h2><div class="muted small">${t('recordingNote')}</div></div></div>
            <div class="st-leads">
              <label>${t('montage')} <select data-montage>${MONTAGES.map((x) => `<option value="${x.id}" ${x.id === montageId ? 'selected' : ''}>${esc(tr(x.label, lang))}</option>`).join('')}</select></label>
              <label>${t('sens')} <select data-sens>${SENS.map((s) => `<option value="${s}" ${s === sens ? 'selected' : ''}>${s} µV/mm</option>`).join('')}</select></label>
              <label>${t('lff')} <select data-lff>${LFFS.map((s) => `<option value="${s}" ${s === lff ? 'selected' : ''}>${s ? `${num(s, s < 1 ? 1 : 0)} Hz` : t('off')}</option>`).join('')}</select></label>
              <label>${t('hff')} <select data-hff>${HFFS.map((s) => `<option value="${s}" ${s === hff ? 'selected' : ''}>${s ? `${s} Hz` : t('off')}</option>`).join('')}</select></label>
            </div>
            <canvas class="st-strip" data-page tabindex="0" role="img" aria-label="${esc(tr(m.label, lang))}"></canvas>
            <p class="st-measures" data-reading></p>
          </section>
          <section class="panel st-signal" aria-labelledby="eeg-how-h">
            <div class="st-row"><div><h2 id="eeg-how-h">${t('how')}</h2><div class="muted small">${t('howNote')}</div></div>
              <span class="st-bar"><button type="button" class="ghost" data-peak>${t('toPeak')}</button><button type="button" class="ghost" data-play>${t('slowMo')}</button></span></div>
            <div class="eeg-mech">
              <figure><figcaption class="muted small">${t('map')}</figcaption><canvas class="st-heart" data-map role="img" aria-label="${t('map')}"></canvas><span class="muted small">${t('mapKey')}</span></figure>
              <figure><figcaption class="muted small">${t('section')}</figcaption><canvas class="st-heart" data-section role="img" aria-label="${t('section')}"></canvas><span class="muted small">${t('sectionNote')}</span></figure>
            </div>
            <figure class="eeg-chain"><figcaption class="muted small">${t('chain')}: <span class="st-chips" data-chains></span></figcaption>
              <canvas class="st-heart" data-chain role="img" aria-label="${t('chain')}"></canvas><span class="muted small">${t('chainNote')}</span></figure>
          </section>
          <section class="panel st-why" aria-labelledby="eeg-why-h">
            <h2 id="eeg-why-h">${t('why')}</h2>
            <div data-why></div>
            <details><summary>${t('more')}</summary>${EEG_BACKGROUND.map((x) => `<div class="st-text"><h3>${esc(tr(x.title, lang))}</h3><p>${esc(tr(x.body, lang))}</p></div>`).join('')}</details>
            <p class="muted small">${t('draft')}</p>
          </section>
        </div>
      </div>`;
    wire();
    drawAll();
  };

  /* ---- wiring --------------------------------------------------------------------------------------- */
  const wire = () => {
    wireHead();
    host.querySelector<HTMLSelectElement>('[data-preset]')!.onchange = (e) => {
      const id = (e.target as HTMLSelectElement).value; const p = presetById(id); if (!p) return;
      presetId = id; scene = structuredClone(p.scene); recompute(false); render();
    };
    host.querySelectorAll<HTMLInputElement>('input[type=range][data-k]').forEach((inp) => {
      const k = inp.dataset.k!;
      const set = () => {
        const v = Number(inp.value);
        if (k === 'duration') scene.discharge.duration = v; else (scene.patch as any)[k] = v;
        const out = host.querySelector(`[data-out="${k}"]`);
        if (out) out.textContent = k === 'toward' ? `${dirName(v)} (${num(v)}°)` : `${num(v, k === 'density' ? 2 : k === 'depth' ? 1 : 0)} ${k === 'area' ? 'cm²' : k === 'tilt' ? '°' : k === 'duration' ? 'ms' : k === 'density' ? 'nAm/mm²' : 'mm'}`;
        if (k === 'tilt') host.querySelector<HTMLElement>('[data-toward-row]')!.hidden = v < 1;
      };
      inp.oninput = () => { set(); presetId = ''; };
      inp.onchange = () => { set(); recompute(); drawAll(); };
    });
    host.querySelectorAll<HTMLButtonElement>('[data-depth]').forEach((b) => b.onclick = () => { scene.patch.depth = Number(b.dataset.depth); presetId = ''; recompute(); render(); });
    host.querySelectorAll<HTMLButtonElement>('[data-polarity]').forEach((b) => b.onclick = () => { scene.polarity = b.dataset.polarity as EegScene['polarity']; recompute(); render(); });
    host.querySelector<HTMLInputElement>('[data-slow]')!.onchange = (e) => { scene.discharge.slowWave = (e.target as HTMLInputElement).checked ? SPIKE.slowWave : 0; recompute(); drawAll(); };
    host.querySelector<HTMLSelectElement>('[data-skull]')!.onchange = (e) => { const i = Number((e.target as HTMLSelectElement).value); scene.skullRatio = i === 0 ? null : SKULL_RATIOS[i].ratio; recompute(); drawAll(); };
    host.querySelector<HTMLInputElement>('[data-csf]')!.onchange = (e) => { scene.csf = (e.target as HTMLInputElement).checked; recompute(); drawAll(); };
    host.querySelector<HTMLSelectElement>('[data-montage]')!.onchange = (e) => { montageId = (e.target as HTMLSelectElement).value; chainIdx = defaultChain(); drawAll(); };
    host.querySelector<HTMLSelectElement>('[data-sens]')!.onchange = (e) => { sens = Number((e.target as HTMLSelectElement).value); drawPageNow(); };
    host.querySelector<HTMLSelectElement>('[data-lff]')!.onchange = (e) => { lff = Number((e.target as HTMLSelectElement).value); drawPageNow(); };
    host.querySelector<HTMLSelectElement>('[data-hff]')!.onchange = (e) => { hff = Number((e.target as HTMLSelectElement).value); drawPageNow(); };
    host.querySelector<HTMLButtonElement>('[data-peak]')!.onclick = () => { setPlaying(false); cursor = peak(); drawPageNow(); drawMechanism(); };
    host.querySelector<HTMLButtonElement>('[data-play]')!.onclick = () => setPlaying(!playing);
    const pc = host.querySelector<HTMLCanvasElement>('[data-page]')!;
    const toCursor = (ev: PointerEvent) => { if (!geom) return; const r = pc.getBoundingClientRect(); cursor = Math.max(0, Math.min(SECONDS * 1000, geom.tAt(ev.clientX - r.left))); setPlaying(false); drawPageNow(); drawMechanism(); };
    pc.onpointerdown = (ev) => { pc.setPointerCapture(ev.pointerId); toCursor(ev); };
    pc.onpointermove = (ev) => { if (ev.buttons) toCursor(ev); };
    pc.onkeydown = (ev) => {
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      ev.preventDefault(); cursor += (ev.key === 'ArrowRight' ? 1 : -1) * (ev.shiftKey ? 100 : 4); cursor = Math.max(0, Math.min(SECONDS * 1000, cursor)); drawPageNow(); drawMechanism();
    };
    const mc = host.querySelector<HTMLCanvasElement>('[data-map]')!;
    mc.onpointerdown = (ev) => {
      const r = mc.getBoundingClientRect(), T = mapTransform(mc.clientWidth, mc.clientHeight);
      let [x, y] = T.from(ev.clientX - r.left, ev.clientY - r.top);
      const rho = Math.hypot(x, y); if (rho > 0.96) { x *= 0.96 / rho; y *= 0.96 / rho; }
      scene.patch.at = [x, y]; presetId = '';
      const sel = host.querySelector<HTMLSelectElement>('[data-preset]'); if (sel) sel.value = '';
      recompute(); drawAll();
    };
  };

  const setPlaying = (on: boolean) => {
    playing = on;
    const b = host.querySelector<HTMLButtonElement>('[data-play]'); if (b) b.textContent = on ? t('stop') : t('slowMo');
    cancelAnimationFrame(raf);
    if (on) { playFrom = performance.now(); const p0 = peak(); const span = [p0 - 120, p0 + 520];
      const step = (now: number) => {
        if (!playing || stopped) return;
        const f = ((now - playFrom) / 6400) % 1;   // a tenth of real time
        cursor = span[0] + f * (span[1] - span[0]);
        drawPageNow(); drawMechanism();
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
  };

  /* ---- drawing -------------------------------------------------------------------------------------- */
  const drawAll = () => { drawPageNow(); drawMechanism(); drawWhy(); };

  const drawPageNow = () => {
    const c = host.querySelector<HTMLCanvasElement>('[data-page]'); if (!c) return;
    const m = montage();
    const channels = m.groups.flatMap((grp, gi) => grp.map((ch, i) => ({ label: channelLabel(ch), data: channelTrace(page, ch, { lff, hff }), groupStart: gi > 0 && i === 0, strong: ch.a === comp.reading.negMax || ch.b === comp.reading.negMax })));
    const h = pageHeight(channels.length, m.groups.length - 1);
    const { g, w } = sizeCanvas(c, h);
    /* a phone shows four seconds around the cursor: ten would leave a spike a tick */
    const view = w < 600 ? 4 : SECONDS;
    const fromMs = view >= SECONDS ? 0 : Math.max(0, Math.min(SECONDS * 1000 - view * 1000, Math.floor((cursor - 500) / 1000) * 1000));
    geom = drawPage(g, w, h, { channels, fs: page.fs, seconds: view, fromMs, sens, cursorMs: cursor, colors: colors(), labels: { second: t('second') } });
    const r = comp.reading, rev = r.reversals.find((x) => x.kind === (scene.polarity === 'negative' ? 'negative' : 'positive'));
    const rd = host.querySelector('[data-reading]');
    if (rd) rd.innerHTML = [
      `<span>${t('negMax')}: ${esc(electrodeLabel(r.negMax))}</span>`,
      `<span>${t('posMax')}: ${esc(electrodeLabel(r.posMax))}</span>`,
      `<span>${t('revAt')} (LB): ${rev ? esc(rev.at.split('=').map(electrodeLabel).join(' = ')) : r.endOfChain ? t('endChain') : t('none')}</span>`,
      `<span${r.bipolarPeak < 20 ? ' class="abn"' : ''}>${t('peak')} (LB): ${num(r.bipolarPeak)} µV</span>`,
    ].join('');
  };

  const drawMechanism = () => {
    const col = colors(), k = kAt(cursor), max = maxField();
    const mc = host.querySelector<HTMLCanvasElement>('[data-map]');
    if (mc) {
      const w0 = mc.clientWidth, h0 = Math.min(360, w0);
      const { g, w } = sizeCanvas(mc, h0);
      if (grid) {
        const ring = comp.pts.slice(-18).map((p) => toMap(p.r));
        const c3 = vec.unit(comp.pts[0].r);
        const q: Vec3 = scene.polarity === 'negative' ? comp.pts[0].q : vec.scale(comp.pts[0].q, -1);
        const tip = toMap(vec.unit(vec.add(c3, vec.scale(q, 0.22)))), base = toMap(c3);
        const arrowV: [number, number] = [tip[0] - base[0], tip[1] - base[1]];
        const flat = Math.hypot(...arrowV) < 0.04;
        drawHeadMap(g, w, h0, {
          grid, n: MAP_N, k, max, electrodes: [...E1020, 'A1', 'A2'].map((e) => ({ name: e, v: comp.field[e] })),
          patchOutline: ring, patchCentre: base, arrow: flat ? null : arrowV, facing: flat ? (vec.dot(q, c3) > 0 ? 'out' : 'in') : null,
          colors: col, labels: { nose: t('nose'), left: t('left'), right: t('right') },
        });
      } else { g.fillStyle = col.muted; g.font = '500 13px system-ui'; g.fillText(t('computing'), 12, 24); }
    }
    const sc = host.querySelector<HTMLCanvasElement>('[data-section]');
    if (sc) {
      const w0 = sc.clientWidth, h0 = Math.min(360, w0);
      const { g, w } = sizeCanvas(sc, h0);
      if (section) {
        const s = section, nrm = vec.cross(s.u, s.v);
        const q: Vec3 = scene.polarity === 'negative' ? comp.pts[0].q : vec.scale(comp.pts[0].q, -1);
        const qa = inPlane(q, s.u, s.v);
        const electrodes = [...E1020, 'A1', 'A2'].map((e) => ({ e, d: electrodeDir(e) })).filter((x) => Math.abs(vec.dot(x.d, nrm)) < Math.sin((14 * Math.PI) / 180))
          .map((x) => { const [a, b] = inPlane(x.d, s.u, s.v); const n = Math.hypot(a, b) || 1; return { name: x.e, a: a / n, b: b / n }; });
        drawSection(g, w, h0, {
          values: s.values, n: s.n, R: s.R, k, max, radii: comp.model.head.radii, names: comp.model.head.names,
          patch: comp.pts.map((p) => inPlane(p.r, s.u, s.v)).filter((_, i) => i < 1 || Math.abs(vec.dot(comp.pts[i].r, nrm)) < 4), q: qa, electrodes, colors: col,
          shellLabels: { brain: t('brain'), csf: t('csfShell'), skull: t('skullShell'), scalp: t('scalpShell') },
        });
      } else { g.fillStyle = col.muted; g.font = '500 13px system-ui'; g.fillText(t('computing'), 12, 24); }
    }
    drawChainNow(k, max, col);
  };

  const drawChainNow = (k: number, max: number, col: Colors) => {
    const cc = host.querySelector<HTMLCanvasElement>('[data-chain]'); if (!cc) return;
    const m = montage(), chains = chainsOf(m);
    const chips = host.querySelector('[data-chains]');
    if (chips) {
      chips.innerHTML = chains.map((c, i) => `<button type="button" class="chip st-chip" data-chain-i="${i}" aria-pressed="${i === chainIdx}">${esc(c.length > 4 ? `${c[0]}–${c[1]}…${c[c.length - 1]}` : c.join('–'))}</button>`).join('');
      chips.querySelectorAll<HTMLButtonElement>('[data-chain-i]').forEach((b) => b.onclick = () => { chainIdx = Number(b.dataset.chainI); drawMechanism(); });
    }
    const chain = chains[chainIdx] ?? chains[0];
    const v = chain.map((e) => comp.field[e] * k);
    const val = (e: string) => (e === 'AVG' ? potentialOf(comp.field, 'AVG') : comp.field[e]) * k;
    let channels: Array<{ a: string; b: string; value: number }>, ref: { name: string; v: number } | null = null;
    if (m.kind === 'bipolar') channels = chain.slice(1).map((b, i) => ({ a: chain[i], b, value: val(chain[i]) - val(b) }));
    else {
      const all = m.groups.flat();
      channels = chain.map((e) => all.find((c) => c.a === e)).filter((c): c is NonNullable<typeof c> => !!c).map((c) => ({ a: c.a, b: c.b, value: val(c.a) - val(c.b) }));
      const refName = channels[0]?.b ?? 'Cz';
      ref = { name: refName, v: val(refName) };
    }
    const revs = comp.reading.reversals.filter((r) => r.chain.join() === chain.join()).flatMap((r) => r.at.split('='));
    const h = 190;
    const { g, w } = sizeCanvas(cc, h);
    drawChain(g, w, h, { electrodes: chain, v, channels, ref, max, colors: col, reversalAt: m.kind === 'bipolar' ? revs : [], labels: { potential: t('potential'), channels: t('channels'), reversal: t('reversal'), up: t('up') } });
  };

  const drawWhy = () => {
    const el = host.querySelector('[data-why]'); if (!el) return;
    const m = montage();
    let refShare: number | null = null, refName: string | null = null;
    if (m.kind === 'referential') {
      const left = ['Fp1', 'F7', 'F3', 'T7', 'C3', 'P7', 'P3', 'O1'].includes(comp.reading.negMax);
      refName = m.id === 'R-18.1' ? (left || comp.reading.negMax.endsWith('z') ? 'A1' : 'A2') : m.id === 'Cz' ? 'Cz' : 'AVG';
      refShare = Math.abs(potentialOf(comp.field, refName)) / maxField();
    }
    el.innerHTML = explainEeg({ scene, reading: comp.reading, montage: m, refShare, refName })
      .map((x) => `<div class="st-text"><h3>${esc(tr(x.title, lang))}</h3><p>${esc(x.body(lang))}</p></div>`).join('');
  };

  const onResize = () => { if (!stopped && view === 'source') { drawPageNow(); drawMechanism(); } };
  window.addEventListener('resize', onResize);
  const stop = () => { stopped = true; cancelAnimationFrame(raf); seizureView?.stop(); window.removeEventListener('resize', onResize); };

  recompute(false);
  render();
  return { stop, setLang(l: Lang) { lang = l; render(); } };
}
