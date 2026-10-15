import { thoraxSvg, heartUnderChest, landmarks, stethoscope, AUSCULTATION_SITES, type ThoraxLook, thoraxHit } from '../render/thorax.ts';
import { cycle, phonoSample } from '../render/phono.ts';
import { traceLoop, playCycle } from './sound.ts';
import type { Lang } from './diagrams.ts';

/* ---------------------------------------------------------------------------
   Auscultation, focused: the chest with the stethoscope where the examiner
   put it, and what it picks up there as a phonocardiogram and as sound.
   Tap elsewhere on the chest (or the neck, or the back) to listen there.
   Optional overlays: the landmarks one counts by, and the heart beneath
   the chest wall beating with the cycle that is heard. No site is marked:
   knowing where to listen is part of the examination.
--------------------------------------------------------------------------- */

export interface AuscultationOptions {
  look: ThoraxLook;
  site: string;                 // 'chest.aortic-area', 'neck.carotid.R', 'chest.lung-base.L'
  bell: boolean;
  value: any;                   // the heart.sounds (or lung.sounds) finding value
  kind: 'heart' | 'lung';
  hr: number;
  lang: Lang;
  caption: string;
  onListenAt: (site: string) => void;
  overlays: { anatomy: boolean; landmarks: boolean };
}

const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function mountAuscultation(host: HTMLElement, o: AuscultationOptions): () => void {
  const site = AUSCULTATION_SITES[o.site] ?? AUSCULTATION_SITES['chest.aortic-area'];
  const view = site.view === 'back' ? 'back' : 'front';
  const dx = (x: number) => (view === 'back' ? -x : x);     // from behind, the patient's left is on our left
  const cyc = o.kind === 'heart' ? cycle(o.value, o.hr) : null;
  const L = (en: string, de: string) => (o.lang === 'de' ? de : en);
  host.innerHTML = `<div class="focus-grid">
    <div><div class="thorax-host"></div>
      <div class="focus-tools">
        <button type="button" class="tog small" data-ov="landmarks" aria-pressed="${o.overlays.landmarks}">${L('Landmarks', 'Orientierungslinien')}</button>
        ${view === 'front' ? `<button type="button" class="tog small" data-ov="anatomy" aria-pressed="${o.overlays.anatomy}">${L('Heart beneath', 'Herz darunter')}</button>` : ''}
        <button type="button" class="tog small" data-flip>${view === 'front' ? L('Turn: back', 'Rücken') : L('Turn: front', 'Vorderseite')}</button>
      </div>
      <p class="focus-caption" data-cap>${esc(o.caption)}</p></div>
    <div><div class="trace-head"><span class="trace-label">${o.kind === 'heart' ? L('Phonocardiogram at this site', 'Phonokardiogramm an dieser Stelle') : L('Breath sounds', 'Atemgeräusch')}</span>
      ${cyc ? `<button type="button" class="ghost small" data-listen>${L('Listen', 'Anhören')}</button>` : ''}</div>
      <canvas class="phono"></canvas>
      <p class="focus-caption">${L('Shaded: systole. The trace and the sound are generated from the finding the model produced here.', 'Schattiert: Systole. Kurve und Ton entstehen aus dem Befund, den das Modell hier erzeugt hat.')}</p></div></div>`;
  const svgHost = host.querySelector('.thorax-host') as HTMLElement;
  let beatRaf = 0;
  const t0 = performance.now();
  const draw = (beat: number) => {
    const sx = dx(site.x), sy = site.y;
    const inner = (view === 'front' && o.overlays.anatomy ? heartUnderChest(beat) : '') + (view === 'front' && o.overlays.landmarks ? landmarks() : '')
      + thoraxHit(o.look) + stethoscope(sx, sy, o.bell);
    svgHost.innerHTML = thoraxSvg(o.look, view, inner).replace('<svg ', '<svg class="thorax" ');
  };
  const animate = (now: number) => {
    let beat = 0;
    if (cyc) { const t = ((now - t0) / 1000) % cyc.periodS; beat = t < cyc.systoleS ? Math.sin((Math.PI * t) / cyc.systoleS) : 0; }
    draw(beat);
    if (o.overlays.anatomy && view === 'front') beatRaf = requestAnimationFrame(animate);
  };
  animate(performance.now());
  // tap to move the stethoscope
  svgHost.addEventListener('click', (ev) => {
    const svg = svgHost.querySelector('svg') as SVGSVGElement;
    const pt = svg.createSVGPoint(); pt.x = (ev as MouseEvent).clientX; pt.y = (ev as MouseEvent).clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const x = dx(p.x), y = p.y;
    let best = '', bd = 1e9;
    for (const [id, s] of Object.entries(AUSCULTATION_SITES)) {
      if ((s.view === 'back') !== (view === 'back')) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) { bd = d; best = id; }
    }
    if (best && bd < 4.5) o.onListenAt(best);
    else host.querySelector('[data-cap]')!.textContent = L('Over bone and away from the heart there is little to hear. Try the precordium, the neck or the lung bases.', 'Über Knochen und fern vom Herzen ist wenig zu hören. Versuchen Sie das Präkordium, den Hals oder die Lungenbasen.');
  });
  host.querySelectorAll<HTMLButtonElement>('[data-ov]').forEach((b) => b.onclick = () => {
    const k = b.dataset.ov as 'anatomy' | 'landmarks';
    o.overlays[k] = !o.overlays[k];
    b.setAttribute('aria-pressed', String(o.overlays[k]));
    cancelAnimationFrame(beatRaf); animate(performance.now());
  });
  host.querySelector<HTMLButtonElement>('[data-flip]')!.onclick = () => o.onListenAt(view === 'front' ? 'chest.lung-base.R' : 'chest.aortic-area');
  // trace and sound
  const canvas = host.querySelector('canvas') as HTMLCanvasElement;
  const stopTrace = cyc ? traceLoop(canvas, (x) => phonoSample(cyc, x), cyc.periodS * 2.2, 1.6, cyc)
    : traceLoop(canvas, (x) => { const ph = (x % 4) / 4; const env = ph < 0.4 ? Math.sin(Math.PI * ph / 0.4) : ph < 0.75 ? 0.35 * Math.sin(Math.PI * (ph - 0.4) / 0.35) : 0; const crackle = o.value?.added?.length ? (Math.sin(x * 977) > 0.995 ? 1.5 : 0) : 0; return env * Math.sin(x * 1311.7) * Math.sin(x * 517.3) * 0.8 + crackle * (ph < 0.4 ? 1 : 0); }, 8, 1);
  let stopSound: (() => void) | null = null;
  const lb = host.querySelector<HTMLButtonElement>('[data-listen]');
  if (lb && cyc) lb.onclick = () => {
    if (stopSound) { stopSound(); stopSound = null; lb.textContent = L('Listen', 'Anhören'); }
    else { stopSound = playCycle(cyc); lb.textContent = L('Stop', 'Stopp'); }
  };
  return () => { cancelAnimationFrame(beatRaf); stopTrace(); stopSound?.(); };
}
