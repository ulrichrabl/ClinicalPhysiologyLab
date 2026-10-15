import { thoraxSvg, landmarks, stethoscope, percussionHand, lobesUnderChest, AUSCULTATION_SITES, LUNG_SITE_IDS, type ThoraxLook, thoraxHit } from '../render/thorax.ts';
import { traceLoop, synthBreath, synthPercussion, playLoop, breathFlow, type BreathSpec } from './sound.ts';
import type { Lang } from './diagrams.ts';

/* ---------------------------------------------------------------------------
   The lungs, focused: the chest from the front or the back, and the
   examiner's hands or stethoscope where they were put. Three ways to
   examine any of the ten sites: listen, percuss, ask for vocal resonance.
   Tap another place to examine there in the same way. What is heard is
   synthesised from the finding the model produced at that site and from
   the patient's own breathing (rate, inspiratory time, how fast the lung
   empties), so obstruction sounds long in expiration because it is.
   No site is marked: where to examine is part of the examination. An
   optional overlay shows the lobes and fissures under the chest wall.
--------------------------------------------------------------------------- */

export type ChestMode = 'listen' | 'percuss' | 'voice';

export interface ChestOptions {
  look: ThoraxLook;
  site: string;                  // 'chest.lung-base.R'
  mode: ChestMode;
  value: any;                    // the finding: lung.sounds, chest.percussion or chest.resonance
  breathing: Omit<BreathSpec, 'breath' | 'added'>;
  lang: Lang;
  caption: string;
  onExamAt: (site: string, mode: ChestMode) => void;
  overlays: { lobes: boolean; landmarks: boolean };
}

const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function mountChest(host: HTMLElement, o: ChestOptions): () => void {
  const L = (en: string, de: string) => (o.lang === 'de' ? de : en);
  const site = AUSCULTATION_SITES[o.site] ?? AUSCULTATION_SITES['chest.lung-base.R'];
  const view = site.view === 'back' ? 'back' : 'front';
  const dx = (x: number) => (view === 'back' ? -x : x);
  const modes: Array<[ChestMode, string]> = [['listen', L('Listen', 'Abhören')], ['percuss', L('Percuss', 'Perkutieren')], ['voice', L('Vocal resonance', 'Bronchophonie')]];
  host.innerHTML = `<div class="focus-grid">
    <div><div class="thorax-host"></div>
      <div class="focus-tools">
        <span class="seg" role="group">${modes.map(([m, l]) => `<button type="button" class="tog small" data-mode="${m}" aria-pressed="${m === o.mode}">${l}</button>`).join('')}</span>
        <button type="button" class="tog small" data-ov="lobes" aria-pressed="${o.overlays.lobes}">${L('Lobes beneath', 'Lappen darunter')}</button>
        <button type="button" class="tog small" data-flip>${view === 'front' ? L('Turn: back', 'Rücken') : L('Turn: front', 'Vorderseite')}</button>
      </div>
      <p class="focus-caption" data-cap>${esc(o.caption)}</p></div>
    <div><div class="trace-head"><span class="trace-label">${o.mode === 'percuss' ? L('Percussion note', 'Klopfschall') : o.mode === 'voice' ? L('Voice through the chest wall', 'Stimme durch die Thoraxwand') : L('Breath sounds at this site, with the airflow', 'Atemgeräusch an dieser Stelle, mit dem Atemstrom')}</span>
      <button type="button" class="ghost small" data-play>${o.mode === 'percuss' ? L('Tap again', 'Nochmals klopfen') : L('Listen', 'Anhören')}</button></div>
      <canvas class="phono"></canvas>
      <p class="focus-caption">${o.mode === 'listen' ? L('Synthesised from this patient’s breathing (rate, inspiratory time, how fast the lung empties) as heard through the lung beneath this site.', 'Synthetisiert aus der Atmung dieses Patienten (Frequenz, Inspirationszeit, wie schnell sich die Lunge entleert), so wie sie durch die Lunge unter dieser Stelle klingt.')
        : o.mode === 'percuss' ? L('How long the chest wall rings depends on what lies beneath: air rings, solid lung damps, fluid stops it.', 'Wie lange die Thoraxwand nachklingt, hängt davon ab, was darunter liegt: Luft klingt, solide Lunge dämpft, Flüssigkeit stoppt.')
        : L('The patient says “ninety-nine”. Consolidation carries the voice; fluid and air keep it away.', 'Der Patient sagt „sechsundsechzig“. Konsolidierung leitet die Stimme; Flüssigkeit und Luft halten sie fern.')}</p></div></div>`;
  const svgHost = host.querySelector('.thorax-host') as HTMLElement;
  let raf = 0, tapT = -1e9;
  const t0 = performance.now();
  const draw = (now: number) => {
    const sx = dx(site.x), sy = site.y;
    const tap = o.mode === 'percuss' ? Math.max(0, 1 - Math.abs((now - tapT) / 120 - 1)) : 0;
    const inst = o.mode === 'percuss' ? percussionHand(sx, sy, tap, o.look.skin, o.look.shade) : stethoscope(sx, sy, false);
    // the chest rises with the patient's own breathing
    const f = breathFlow({ ...o.breathing, breath: 'vesicular', added: [] }, (now - t0) / 1000);
    const scale = 1 + 0.006 * Math.max(-0.2, f);
    const inner = (o.overlays.lobes ? lobesUnderChest(view) : '') + (view === 'front' && o.overlays.landmarks ? landmarks() : '')
      + thoraxHit(o.look) + inst;
    svgHost.innerHTML = thoraxSvg(o.look, view, `<g transform="scale(${scale.toFixed(4)} 1)">${inner}</g>`).replace('<svg ', '<svg class="thorax" ');
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  svgHost.addEventListener('click', (ev) => {
    const svg = svgHost.querySelector('svg') as SVGSVGElement;
    const pt = svg.createSVGPoint(); pt.x = (ev as MouseEvent).clientX; pt.y = (ev as MouseEvent).clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const x = dx(p.x), y = p.y;
    let best = '', bd = 1e9;
    for (const id of LUNG_SITE_IDS) {
      const s = AUSCULTATION_SITES[id]; if (!s || (s.view === 'back') !== (view === 'back')) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) { bd = d; best = id; }
    }
    if (best && bd < 6) o.onExamAt(best, o.mode);
    else host.querySelector('[data-cap]')!.textContent = L('Over the sternum, spine or scapula there is little lung to examine. Try a zone between them.', 'Über Sternum, Wirbelsäule oder Schulterblatt ist wenig Lunge zu untersuchen. Versuchen Sie ein Feld dazwischen.');
  });
  host.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => b.onclick = () => o.onExamAt(o.site, b.dataset.mode as ChestMode));
  host.querySelector<HTMLButtonElement>('[data-ov]')!.onclick = (e) => { o.overlays.lobes = !o.overlays.lobes; (e.currentTarget as HTMLElement).setAttribute('aria-pressed', String(o.overlays.lobes)); };
  host.querySelector<HTMLButtonElement>('[data-flip]')!.onclick = () => o.onExamAt(view === 'front' ? o.site.replace(/upper-zone|mid-zone|axilla/, (m) => (m === 'upper-zone' ? 'upper-back' : 'lung-base')) : o.site.replace(/upper-back|lung-base/, (m) => (m === 'upper-back' ? 'upper-zone' : 'mid-zone')), o.mode);

  // what is heard
  const canvas = host.querySelector('canvas') as HTMLCanvasElement;
  const spec: BreathSpec = o.mode === 'listen'
    ? { ...o.breathing, breath: o.value?.breath ?? 'vesicular', added: o.value?.added ?? [] }
    : { ...o.breathing, breath: o.value?.resonance === 'increased' ? 'bronchial' : o.value?.resonance === 'absent' ? 'absent' : o.value?.resonance === 'reduced' ? 'reduced' : 'vesicular', added: [] };
  const SR = 4000;
  let stopTrace: () => void;
  if (o.mode === 'percuss') {
    const wave = synthPercussion(SR, o.value?.note ?? 'resonant');
    stopTrace = traceLoop(canvas, (t) => wave[Math.round((((t % 1.2) + 1.2) % 1.2) * SR)] ?? 0, 1.2, 1.4);
    host.querySelector<HTMLButtonElement>('[data-play]')!.onclick = () => { tapT = performance.now(); const stop = playLoop((sr) => synthPercussion(sr, o.value?.note ?? 'resonant'), 0.9); setTimeout(() => stop?.(), 1150); };
    tapT = performance.now();
  } else {
    const wave = synthBreath(SR, spec);
    const T = 60 / Math.max(4, spec.rr);
    stopTrace = traceLoop(canvas, (t) => { const tt = ((t % T) + T) % T; return (wave[Math.round(tt * SR)] ?? 0) * 2.2; }, Math.min(12, T * 2.2), 1.3);
    let stopSound: (() => void) | null = null;
    const lb = host.querySelector<HTMLButtonElement>('[data-play]')!;
    lb.onclick = () => {
      if (stopSound) { stopSound(); stopSound = null; lb.textContent = L('Listen', 'Anhören'); }
      else { stopSound = playLoop((sr) => synthBreath(sr, spec), 0.9); lb.textContent = L('Stop', 'Stopp'); }
    };
    return () => { cancelAnimationFrame(raf); stopTrace(); stopSound?.(); };
  }
  return () => { cancelAnimationFrame(raf); stopTrace(); };
}
