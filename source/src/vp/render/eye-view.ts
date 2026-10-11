import type { Side } from '../model/types.ts';
import { scene, type Scene, type SceneControls, type SceneFindings } from './eye-scene.ts';
import { FaceCanvas, neutralFace, type Appearance, type FaceState } from './face-canvas.ts';

/* ---------------------------------------------------------------------------
   Eye view: the eye examination drawn on the face canvas. Each frame takes
   the eye scene (angles, pupils, lids, head, cover) computed from the
   model's findings and paints it; pupils follow their target size with the
   iris muscle's time constant rather than jumping.
--------------------------------------------------------------------------- */

export class EyeView {
  private face: FaceCanvas;
  private findings: SceneFindings | null = null;
  private pupil: Record<Side, number> = { L: 4, R: 4 };
  private raf = 0;
  /** The last scene drawn, for traces and tests. */
  last: Scene | null = null;

  constructor(host: HTMLElement, ap: Appearance) {
    this.face = new FaceCanvas(host, ap);
  }

  show(findingsFor: (k: SceneControls) => SceneFindings, controls: (now: number) => SceneControls, onFrame?: (sc: Scene, k: SceneControls, now: number) => void) {
    cancelAnimationFrame(this.raf);
    let lastKey = '';
    let prev = performance.now();
    const frame = (now: number) => {
      const k = controls(now);
      const key = `${k.gaze}|${k.fixation}|${k.lightOn}|${k.ambient}`;
      if (key !== lastKey || !this.findings) { this.findings = findingsFor(k); lastKey = key; }
      const sc = scene(this.findings, k, now / 1000);
      this.last = sc;
      const dt = Math.min(0.1, Math.max(0, (now - prev) / 1000)); prev = now;
      const st: FaceState = neutralFace();
      st.camera = 'eyes';
      st.yaw = sc.head;
      const blink = k.impulse || sc.covered ? 0 : this.face.blink(now / 1000);
      for (const S of ['L', 'R'] as Side[]) {
        const e = sc[S];
        // pupils constrict in ~0.3 s and dilate more slowly
        const tau = e.pupilMm < this.pupil[S] ? 0.25 : 0.8;
        this.pupil[S] += (e.pupilMm - this.pupil[S]) * (1 - Math.exp(-dt / tau));
        const hippus = Math.sin(now / 1000 * 2.1 + (S === 'L' ? 0 : 1.3)) * 0.06;
        st.eyes[S] = { h: e.h - sc.head, v: e.v, torsion: e.torsion, pupilMm: this.pupil[S] + hippus, ptosisMm: e.ptosisMm, closure: blink };
      }
      st.light = k.lightOn;
      st.dim = k.ambient === 'dim';
      st.frenzel = !k.fixation;
      st.cover = sc.covered;
      this.face.draw(st);
      onFrame?.(sc, k, now);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  /** Forget cached findings (the patient changed). */
  invalidate() { this.findings = null; }

  stop() { cancelAnimationFrame(this.raf); }
}
