import type { Side } from '../model/types.ts';

/* ---------------------------------------------------------------------------
   Face view: animates the facial-movement examination from face.movement
   findings. The patient is asked in turn to raise the eyebrows, screw the
   eyes shut and show the teeth; each half of the face responds with the
   strength its finding gives (normal, weak, absent). An upper motor neuron
   weakness therefore shows a drooping mouth with a wrinkling forehead, a
   facial nerve palsy a smooth forehead, an eye that will not close (the
   globe rolls up: Bell's phenomenon) and a mouth pulled to the other side.
--------------------------------------------------------------------------- */

export interface FaceFinding { forehead: string; eyeClosure: string; mouth: string }

const STRENGTH: Record<string, number> = { normal: 1, weak: 0.4, absent: 0 };
const PHASES = ['rest', 'brows', 'eyes', 'smile'] as const;
const LABEL: Record<string, [string, string]> = {
  rest: ['At rest', 'In Ruhe'], brows: ['“Raise your eyebrows”', '„Stirn runzeln“'], eyes: ['“Screw your eyes shut”', '„Augen fest zukneifen“'], smile: ['“Show me your teeth”', '„Zähne zeigen“'],
};

export function faceSvg(skin: string, shade: string): string {
  const side = (S: Side) => {
    const cx = S === 'R' ? 108 : 192, dir = S === 'R' ? -1 : 1;
    return `
      <g data-side="${S}">
        <g data-lines style="opacity:0">${[0, 1, 2].map((i) => `<path d="M${cx - 26} ${62 + i * 7} q26 -5 52 0" fill="none" stroke="${shade}" stroke-width="1.6"/>`).join('')}</g>
        <path data-brow d="M${cx - 30} 92 Q${cx} 80 ${cx + 30} 92" fill="none" stroke="#5b4636" stroke-width="5" stroke-linecap="round"/>
        <ellipse cx="${cx}" cy="118" rx="24" ry="11" fill="#fbf8f2"/>
        <circle data-iris cx="${cx}" cy="118" r="8.5" fill="#5a7d6e"/><circle data-pupil cx="${cx}" cy="118" r="3.4" fill="#111"/>
        <path data-lid d="M${cx - 26} 104 H${cx + 26} V118 Q${cx} 106 ${cx - 26} 118 Z" fill="${skin}"/>
        <path data-lowlid d="M${cx - 26} 132 H${cx + 26} V118 Q${cx} 130 ${cx - 26} 118 Z" fill="${skin}"/>
        <path d="M${cx - 25} 118 Q${cx} 104 ${cx + 25} 118 Q${cx} 130 ${cx - 25} 118 Z" fill="none" stroke="${shade}" stroke-width="1.4"/>
        <path data-fold d="M${150 + dir * 22} 168 Q${150 + dir * 36} 190 ${150 + dir * 34} 208" fill="none" stroke="${shade}" stroke-width="1.6"/>
      </g>`;
  };
  return `<svg class="faceview" viewBox="0 0 300 300" role="img" aria-label="Face">
    <rect x="0" y="0" width="300" height="300" fill="${skin}"/>
    <ellipse cx="150" cy="160" rx="118" ry="150" fill="${skin}" stroke="${shade}" stroke-width="2"/>
    <path d="M150 128 Q144 170 140 182 Q150 190 160 182" fill="none" stroke="${shade}" stroke-width="2"/>
    ${side('R')}${side('L')}
    <path data-mouth d="" fill="#7a3b33" stroke="#5e2a24" stroke-width="2"/>
    <path data-teeth d="" fill="#fbf8f2" opacity="0"/>
    <text data-label x="150" y="292" text-anchor="middle" font-size="13" fill="#3b2a20" opacity="0.75"></text>
  </svg>`;
}

export class FaceView {
  private raf = 0;
  private svg: SVGSVGElement;
  constructor(host: HTMLElement, skin: string, shade: string) {
    host.innerHTML = faceSvg(skin, shade);
    this.svg = host.querySelector('svg')!;
  }
  show(f: Record<Side, FaceFinding>, lang: 'en' | 'de') {
    cancelAnimationFrame(this.raf);
    const q = <T extends Element>(sel: string, root: Element = this.svg) => root.querySelector(sel) as T;
    const t0 = performance.now();
    const frame = (now: number) => {
      const el = Math.max(0, (now - t0) / 1000);   // a frame can be stamped slightly before t0
      const phase = PHASES[Math.floor(el / 2.2) % PHASES.length];
      const k = Math.min(1, ((el % 2.2) / 0.5));   // effort builds over half a second
      const ease = 0.5 - 0.5 * Math.cos(Math.PI * k);
      q<SVGTextElement>('[data-label]').textContent = LABEL[phase][lang === 'de' ? 1 : 0];
      const corner: Record<Side, { x: number; y: number }> = { L: { x: 0, y: 0 }, R: { x: 0, y: 0 } };
      for (const S of ['L', 'R'] as Side[]) {
        const g = q<SVGGElement>(`[data-side="${S}"]`);
        const fh = STRENGTH[f[S].forehead] ?? 1, ec = STRENGTH[f[S].eyeClosure] ?? 1, mo = STRENGTH[f[S].mouth] ?? 1;
        const brow = (phase === 'brows' ? -12 * fh * ease : 0) + 3 * (1 - fh);
        q<SVGPathElement>('[data-brow]', g).setAttribute('transform', `translate(0 ${brow.toFixed(2)})`);
        (q<SVGGElement>('[data-lines]', g) as unknown as SVGElement).style.opacity = phase === 'brows' ? String(0.8 * fh * ease) : '0';
        // upper lid: at rest a weak orbicularis leaves a wider fissure; on effort it closes as far as the muscle allows
        const close = phase === 'eyes' ? ec * ease : 0;
        const lidDrop = 14 * close - 2 * (1 - ec);
        q<SVGPathElement>('[data-lid]', g).setAttribute('transform', `translate(0 ${lidDrop.toFixed(2)})`);
        q<SVGPathElement>('[data-lowlid]', g).setAttribute('transform', `translate(0 ${(-12 * close).toFixed(2)})`);
        const bell = phase === 'eyes' && ec < 1 ? -7 * (1 - ec) * ease : 0;   // Bell's phenomenon
        q<SVGCircleElement>('[data-iris]', g).setAttribute('transform', `translate(0 ${bell.toFixed(2)})`);
        q<SVGCircleElement>('[data-pupil]', g).setAttribute('transform', `translate(0 ${bell.toFixed(2)})`);
        const dir = S === 'R' ? -1 : 1;
        const pull = phase === 'smile' ? mo * ease : 0;
        corner[S] = { x: dir * (30 + 12 * pull), y: 222 - 10 * pull + 5 * (1 - mo) };
        q<SVGPathElement>('[data-fold]', g).style.opacity = String(0.35 + 0.65 * mo);
      }
      const R = corner.R, L = corner.L;
      const smile = phase === 'smile' ? ease : 0;
      const top = 216 - 2 * smile, bottom = 224 + 10 * smile;
      q<SVGPathElement>('[data-mouth]').setAttribute('d',
        `M${150 + R.x} ${R.y} Q150 ${top} ${150 + L.x} ${L.y} Q150 ${bottom} ${150 + R.x} ${R.y} Z`);
      q<SVGPathElement>('[data-teeth]').setAttribute('d', `M${150 + R.x + 6} ${R.y} Q150 ${top + 1} ${150 + L.x - 6} ${L.y} Q150 ${top + 8} ${150 + R.x + 6} ${R.y} Z`);
      q<SVGPathElement>('[data-teeth]').setAttribute('opacity', String(smile * 0.95));
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }
  stop() { cancelAnimationFrame(this.raf); }
}
