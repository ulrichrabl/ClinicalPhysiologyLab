import { thoraxSvg, landmarks, frontX, phiOf, type ThoraxLook, thoraxHit, thoraxPartAt, thoraxLimbSites } from '../render/thorax.ts';
import { ELECTRODES, LEAD_NAMES, STANDARD_SITES, leadVectorsOn, standardPlacement, type ElectrodeId, type Placement, type Site } from '../measurements/ecg.ts';
import { mountMonitor, type MonitorSource } from '../render/ecg-monitor.ts';
import { tr } from '../model/i18n.ts';
import type { Lang } from './diagrams.ts';

/* ---------------------------------------------------------------------------
   Recording a 12-lead ECG, focused: the learner puts the ten electrodes on
   the patient. Where they go is where the model records from, so a V1 in
   the second intercostal space, or arm electrodes swapped, give the
   tracing those mistakes give. Drag an electrode onto the body, or tap it
   and then tap the place.

   A live monitor below shows all twelve leads from the running heart
   through the electrodes as they are now: a lead comes on when its
   electrodes are all on, and while an electrode is dragged its leads follow
   it, so the learner sees what a misplaced V1 or swapped arm leads do
   before printing. Printing takes the last ten seconds onto paper.
--------------------------------------------------------------------------- */

const COLOR: Record<ElectrodeId, string> = {
  RA: '#f4f4f4', LA: '#222222', LL: '#d33c32', RL: '#2f9a4a',
  V1: '#d33c32', V2: '#e8c62b', V3: '#2f9a4a', V4: '#2f6fd3', V5: '#ee8a24', V6: '#8b4fc4',
};
const LIMB_AT: Record<string, [number, number]> = { 'right-arm': [-21.6, 20], 'left-arm': [21.6, 20], 'right-leg': [-7, 33.5], 'left-leg': [7, 33.5] };

export interface EcgPlacementOptions {
  look: ThoraxLook;
  lang: Lang;
  placement: Partial<Placement>;
  chestExposed: boolean;
  onExpose: () => void;
  onRecord: (p: Placement) => void;
  /** The running heart, for the live monitor. */
  source?: MonitorSource;
  /** Called whenever electrodes go on or come off: they stay on the patient (the bedside monitor uses them). */
  onChange?: (p: Partial<Placement>) => void;
}

const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Where a site is drawn: on this patient's own arms and legs when the drawing is their body. */
function drawnAt(site: Site, drop?: [number, number], look?: ThoraxLook): [number, number] {
  if ('limb' in site) return drop ?? (look && thoraxLimbSites(look)?.[site.limb]) ?? LIMB_AT[site.limb];
  return [frontX(site.chest.phi), site.chest.y];
}

/** The site at a point on the drawing, or null if it is not on the body. On the patient's own body this follows its
    outline (a wide abdomen is not an arm); the old drawing uses fixed bands. */
function siteAt(x: number, y: number, look?: ThoraxLook): Site | null {
  if (look?.figure) {
    const hit = thoraxPartAt(look, x, y);
    if (!hit) return null;
    if (hit.part === 'arm') return { limb: hit.side === 'R' ? 'right-arm' : 'left-arm' };
    if (hit.part === 'leg') return { limb: hit.side === 'R' ? 'right-leg' : 'left-leg' };
    return { chest: { phi: phiOf(Math.max(-15, Math.min(15, x))), y } };
  }
  if (y > 25.5 && Math.abs(x) < 14) return { limb: x < 0 ? 'right-leg' : 'left-leg' };
  if (Math.abs(x) > 16.3 && y > -14 && y < 26) return { limb: x < 0 ? 'right-arm' : 'left-arm' };
  if (Math.abs(x) <= 15.8 && y >= -13.5 && y <= 17) return { chest: { phi: phiOf(Math.max(-15, Math.min(15, x))), y } };
  return null;
}

export function mountEcgPlacement(host: HTMLElement, o: EcgPlacementOptions): () => void {
  const L = (en: string, de: string) => (o.lang === 'de' ? de : en);
  const placed: Partial<Placement> = structuredClone(o.placement);
  const drops: Partial<Record<ElectrodeId, [number, number]>> = {};
  let selected: ElectrodeId | null = null;
  let showLandmarks = false;
  let drag: { id: ElectrodeId; x: number; y: number; inside: boolean } | null = null;

  if (!o.chestExposed) {
    host.innerHTML = `<div class="locked"><b>${L('The chest is covered', 'Der Thorax ist bedeckt')}</b>${L('Chest electrodes go on skin. Ask, then expose the chest.', 'Brustwandelektroden gehören auf die Haut. Fragen Sie und machen Sie den Thorax frei.')}<div style="margin-top:12px"><button type="button" class="primary" data-expose>${L('Expose the chest', 'Thorax freimachen')}</button></div></div>`;
    host.querySelector<HTMLButtonElement>('[data-expose]')!.onclick = o.onExpose;
    return () => undefined;
  }

  host.innerHTML = `<div class="focus-grid">
    <div><div class="thorax-host"></div>
      <div class="focus-tools"><button type="button" class="tog small" data-lm aria-pressed="false">${L('Landmarks', 'Orientierungslinien')}</button></div>
      <p class="focus-caption" data-cap>${L('Drag each electrode onto the patient, or tap an electrode and then the place.', 'Ziehen Sie jede Elektrode auf den Patienten oder tippen Sie erst die Elektrode, dann die Stelle an.')}</p></div>
    <div><h2>${L('Electrodes', 'Elektroden')}</h2><div class="tray" data-tray></div>
      <p class="focus-caption" data-where></p>
      <div class="focus-tools" style="margin-top:14px">
        <button type="button" class="ghost small" data-standard>${L('Place at standard positions', 'Standardpositionen')}</button>
        <button type="button" class="ghost small" data-clear>${L('Remove all', 'Alle entfernen')}</button>
        <button type="button" class="primary" data-record disabled>${L('Print 12-lead ECG', '12-Kanal-EKG drucken')}</button>
      </div></div></div>
    ${o.source ? `<div class="ecg-live"><div class="trace-head"><span class="trace-label">${L('Live monitor: all twelve leads, through the electrodes as they are now', 'Live-Monitor: alle zwölf Ableitungen, über die Elektroden, wie sie jetzt liegen')}</span></div>
      <canvas class="ecg-monitor"></canvas>
      <p class="focus-caption">${L('Move an electrode and watch its leads change. Monitor filtering steadies the baseline; the printed ECG is the diagnostic record.', 'Verschieben Sie eine Elektrode und beobachten Sie ihre Ableitungen. Der Monitor glättet die Grundlinie; das gedruckte EKG ist der diagnostische Befund.')}</p></div>` : ''}`;
  const svgHost = host.querySelector('.thorax-host') as HTMLElement;
  const tray = host.querySelector('[data-tray]') as HTMLElement;

  const electrodeSvg = (id: ElectrodeId, x: number, y: number, ghost = false) => {
    const dark = id === 'LA';
    return `<g class="electrode" data-e="${id}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)})" ${ghost ? 'opacity="0.7" pointer-events="none"' : ''}>
      <circle r="1.35" fill="${COLOR[id]}" stroke="#333" stroke-width="0.22"/><circle r="0.45" fill="${dark ? '#888' : '#555'}"/>
      <text y="-1.75" font-size="1.25" text-anchor="middle" font-weight="700" fill="#1b1b1b" stroke="#fff" stroke-width="0.3" paint-order="stroke">${id}</text></g>`;
  };
  const render = () => {
    let inner = showLandmarks ? landmarks() : '';
    for (const id of ELECTRODES) {
      const s = placed[id];
      if (!s || drag?.id === id) continue;
      const [x, y] = drawnAt(s, drops[id], o.look);
      inner += electrodeSvg(id, x, y);
    }
    if (drag?.inside) inner += electrodeSvg(drag.id, drag.x, drag.y, true);
    svgHost.innerHTML = thoraxSvg(o.look, 'front', `${thoraxHit(o.look)}${inner}`).replace('<svg ', '<svg class="thorax" ');
    tray.innerHTML = ELECTRODES.map((id) => `<button type="button" class="chip-el ${placed[id] ? 'placed' : ''}" data-chip="${id}" aria-pressed="${selected === id}"><i style="background:${COLOR[id]}"></i>${id}</button>`).join('');
    const all = ELECTRODES.every((id) => placed[id]);
    (host.querySelector('[data-record]') as HTMLButtonElement).disabled = !all;
    const sel = selected ?? drag?.id;
    host.querySelector('[data-where]')!.textContent = sel ? `${sel}: ${tr(STANDARD_SITES[sel].landmark, o.lang)}` : (all ? L('All ten placed.', 'Alle zehn platziert.') : `${ELECTRODES.filter((id) => !placed[id]).length} ${L('still to place', 'noch zu platzieren')}`);
  };
  const toSvg = (cx: number, cy: number) => {
    const svg = svgHost.querySelector('svg') as SVGSVGElement;
    const r = svg.getBoundingClientRect();
    const inside = cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
    const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y, inside };
  };
  const changed = () => o.onChange?.(structuredClone(placed));
  const place = (id: ElectrodeId, x: number, y: number) => {
    const s = siteAt(x, y, o.look);
    if (!s) { host.querySelector('[data-cap]')!.textContent = L('That is not on the patient.', 'Das ist nicht auf dem Patienten.'); return false; }
    placed[id] = s; drops[id] = 'limb' in s ? [x, y] : undefined;
    changed();
    return true;
  };
  /* What the monitor sees: the electrodes that are on, and the one being dragged where it is over the body now. */
  let vecKey = '', vecVal = leadVectorsOn(placed);
  const vectorsNow = () => {
    const eff: Partial<Placement> = { ...placed };
    if (drag) { delete eff[drag.id]; const s = drag.inside ? siteAt(drag.x, drag.y, o.look) : null; if (s) eff[drag.id] = s; }
    const key = JSON.stringify(eff);
    if (key !== vecKey) { vecKey = key; vecVal = leadVectorsOn(eff); }
    return vecVal;
  };
  const narrow = (host.clientWidth || 800) < 560;
  const stopMonitor = o.source ? mountMonitor(host.querySelector('.ecg-monitor') as HTMLCanvasElement, o.source, {
    /* the paper's order across four columns; on a phone, limb leads beside chest leads in two */
    leads: (narrow ? ['I', 'V1', 'II', 'V2', 'III', 'V3', 'aVR', 'V4', 'aVL', 'V5', 'aVF', 'V6'] : ['I', 'aVR', 'V1', 'V4', 'II', 'aVL', 'V2', 'V5', 'III', 'aVF', 'V3', 'V6']) as Array<typeof LEAD_NAMES[number]>,
    columns: narrow ? 2 : 4, seconds: 2.5, vectors: vectorsNow, reference: () => !!(placed.RL && drag?.id !== 'RL'), showRate: true, mvRange: 2.6,
    label: L('ECG · 25 mm/s', 'EKG · 25 mm/s'), offText: L('Lead off', 'Elektrode fehlt'),
  }) : () => undefined;

  const onDown = (ev: PointerEvent) => {
    const t = ev.target as Element;
    const chip = t.closest('[data-chip]') as HTMLElement | null;
    const el = t.closest('[data-e]') as SVGGElement | null;
    const id = (chip?.dataset.chip ?? el?.getAttribute('data-e')) as ElectrodeId | undefined;
    if (!id) return;
    ev.preventDefault();
    const start = { x: ev.clientX, y: ev.clientY };
    let moved = false;
    const move = (e: PointerEvent) => {
      if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) return;
      moved = true;
      const p = toSvg(e.clientX, e.clientY);
      drag = { id, ...p };
      render();
    };
    const up = (e: PointerEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      if (!moved) { selected = selected === id ? null : id; drag = null; render(); return; }
      const p = toSvg(e.clientX, e.clientY);
      drag = null;
      if (p.inside) place(id, p.x, p.y); else { delete placed[id]; changed(); }
      selected = null;
      render();
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  host.addEventListener('pointerdown', onDown);
  svgHost.addEventListener('click', (ev) => {
    if (!selected || (ev.target as Element).closest('[data-e]')) return;
    const p = toSvg((ev as MouseEvent).clientX, (ev as MouseEvent).clientY);
    if (place(selected, p.x, p.y)) selected = null;
    render();
  });
  host.querySelector<HTMLButtonElement>('[data-lm]')!.onclick = (e) => { showLandmarks = !showLandmarks; (e.target as HTMLElement).setAttribute('aria-pressed', String(showLandmarks)); render(); };
  host.querySelector<HTMLButtonElement>('[data-standard]')!.onclick = () => { Object.assign(placed, standardPlacement()); for (const k of ELECTRODES) delete drops[k]; changed(); render(); };
  host.querySelector<HTMLButtonElement>('[data-clear]')!.onclick = () => { for (const k of ELECTRODES) { delete placed[k]; delete drops[k]; } changed(); render(); };
  host.querySelector<HTMLButtonElement>('[data-record]')!.onclick = () => { if (ELECTRODES.every((id) => placed[id])) o.onRecord(structuredClone(placed) as Placement); };
  render();
  return () => { host.removeEventListener('pointerdown', onDown); stopMonitor(); };
}

/** How far a placement is from standard, electrode by electrode, in words. */
export function placementReview(p: Placement, lang: Lang): string[] {
  const out: string[] = [];
  const L = (en: string, de: string) => (lang === 'de' ? de : en);
  const std = standardPlacement();
  for (const id of ELECTRODES) {
    const a = p[id], b = std[id];
    if ('limb' in b) {
      if (!('limb' in a) || a.limb !== b.limb) out.push(`${id}: ${L('on the wrong limb', 'an der falschen Extremität')}${'limb' in a ? ` (${a.limb})` : ''}`);
      continue;
    }
    if ('limb' in a) { out.push(`${id}: ${L('on a limb, not the chest', 'an einer Extremität statt an der Brustwand')}`); continue; }
    const dx = frontX(a.chest.phi) - frontX(b.chest.phi), dy = a.chest.y - b.chest.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
      const vert = Math.abs(dy) >= Math.abs(dx);
      const where = vert ? (dy < 0 ? L('too high', 'zu hoch') : L('too low', 'zu tief')) : (dx < 0 ? L('too far right', 'zu weit rechts') : L('too far left', 'zu weit links'));
      out.push(`${id}: ${where} (${d.toFixed(1).replace('.', lang === 'de' ? ',' : '.')} cm; ${tr(STANDARD_SITES[id].landmark, lang)})`);
    }
  }
  return out;
}
