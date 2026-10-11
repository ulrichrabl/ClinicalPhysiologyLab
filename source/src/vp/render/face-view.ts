import type { Side } from '../model/types.ts';
import { FaceCanvas, neutralFace, type Appearance } from './face-canvas.ts';

/* ---------------------------------------------------------------------------
   Face view: animates the facial-movement examination from face.movement
   findings. The patient is asked in turn to raise the eyebrows, screw the
   eyes shut and show the teeth; each half of the face responds with the
   strength its finding gives (normal, weak, absent).

   An upper motor neuron weakness therefore shows a drooping mouth corner and
   a flattened fold with a forehead that still wrinkles. A facial nerve palsy
   shows a smooth forehead that does not rise, an eye that will not close
   while the globe rolls up beneath the lid (Bell's phenomenon), and a smile
   pulled to the healthy side.
--------------------------------------------------------------------------- */

export interface FaceFinding { forehead: string; eyeClosure: string; mouth: string }

const STRENGTH: Record<string, number> = { normal: 1, weak: 0.4, absent: 0 };
const PHASES = ['rest', 'brows', 'eyes', 'smile'] as const;
const LABEL: Record<string, [string, string]> = {
  rest: ['At rest', 'In Ruhe'], brows: ['“Raise your eyebrows”', '„Stirn runzeln“'],
  eyes: ['“Screw your eyes shut”', '„Augen fest zukneifen“'], smile: ['“Show me your teeth”', '„Zähne zeigen“'],
};
const PHASE_S = 2.6;

export class FaceView {
  private raf = 0;
  private face: FaceCanvas;
  private caption: HTMLElement;
  constructor(host: HTMLElement, ap: Appearance) {
    host.innerHTML = '<div class="facecanvas-host"></div><div class="face-caption"></div>';
    this.face = new FaceCanvas(host.querySelector('.facecanvas-host')!, ap);
    this.caption = host.querySelector('.face-caption')!;
  }

  show(f: Record<Side, FaceFinding>, lang: 'en' | 'de') {
    cancelAnimationFrame(this.raf);
    const t0 = performance.now();
    const frame = (now: number) => {
      const el = Math.max(0, (now - t0) / 1000);
      const phase = PHASES[Math.floor(el / PHASE_S) % PHASES.length];
      const x = (el % PHASE_S) / PHASE_S;
      // effort rises over 0.6 s, is held, and relaxes at the end of the phase
      const effort = Math.min(1, x * PHASE_S / 0.6) * Math.min(1, (1 - x) * PHASE_S / 0.4);
      const ease = 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, effort)));
      this.caption.textContent = LABEL[phase][lang === 'de' ? 1 : 0];

      const st = neutralFace();
      st.camera = 'face';
      const blink = phase === 'eyes' ? 0 : this.face.blink(el);
      let maxMouth = 0;
      for (const S of ['L', 'R'] as Side[]) {
        const fh = STRENGTH[f[S].forehead] ?? 1, ec = STRENGTH[f[S].eyeClosure] ?? 1, mo = STRENGTH[f[S].mouth] ?? 1;
        maxMouth = Math.max(maxMouth, mo);
        st.brows[S] = phase === 'brows' ? 16 * fh * ease : -3 * (1 - fh);
        st.foreheadLines[S] = phase === 'brows' ? fh * ease : 0;
        const closing = phase === 'eyes' ? ease : 0;
        // the globe rolls up on forced closure; it shows only where the lid fails to cover it
        st.eyes[S] = {
          h: 0, v: 26 * closing, torsion: 0, pupilMm: 3.5, ptosisMm: 0,
          closure: Math.max(blink, closing * (ec >= 1 ? 1 : ec > 0 ? 0.55 : 0.12)),
        };
        // a weak orbicularis lets the lower lid sag and the fissure widen at rest
        if (ec < 1 && phase !== 'eyes') st.eyes[S].ptosisMm = -0.6 * (1 - ec);
        const smiling = phase === 'smile' ? ease : 0;
        st.mouth[S] = { lift: mo * smiling, droop: 1 - mo, pull: mo * smiling };
        st.folds[S] = 0.25 + 0.75 * mo + 0.4 * mo * smiling;
      }
      st.mouthOpen = phase === 'smile' ? 0.85 * ease * maxMouth : 0;
      this.face.draw(st);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() { cancelAnimationFrame(this.raf); }
}
