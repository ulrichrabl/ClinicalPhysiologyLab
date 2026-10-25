import { figureSvg, POSES, viewAt, type FigureLook } from '../render/patient-figure.ts';
import { fingerNose, kneeJerk, pronatorDrift, type DriftFinding, type FingerNoseFinding, type MotionFrame, type ReflexGrade } from '../render/neuro-motion.ts';

/* ---------------------------------------------------------------------------
   The neurological examination, moving (ADR-017 decision 10): the bedside
   figure doing one test, driven by the examination model's finding. The same
   view serves the ward (`visualFor` in app.ts) and the neurological station.

   Arm 0 is the right, as in `Pose`; a left-sided test is watched from the
   left of the bed, so the arm or leg examined is the near one. What the
   examiner holds is computed seen from the right and mirrored with the
   figure (it mirrors about x = 180).

   With `prefers-reduced-motion` one still of the result is shown.
--------------------------------------------------------------------------- */

export type NeuroMotion =
  | { kind: 'drift'; finding: DriftFinding }
  | { kind: 'finger-nose'; side: 'L' | 'R'; finding: FingerNoseFinding }
  | { kind: 'knee-jerk'; side: 'L' | 'R'; grade: ReflexGrade };

/** The side the test is watched from: the side examined, or for drift the side that drifts (the right if neither or both). */
export const motionSide = (m: NeuroMotion): 'L' | 'R' => (m.kind === 'drift' ? (m.finding.drift[1] && !m.finding.drift[0] ? 'L' : 'R') : m.side);

/** One frame of the test, `t` seconds in, as SVG content for a 360 × 380 view box. */
export function neuroFrame(m: NeuroMotion, look: FigureLook, t: number): string {
  const base = POSES.sitting, side = motionSide(m), i: 0 | 1 = side === 'L' ? 1 : 0;
  const fr: MotionFrame = m.kind === 'drift' ? pronatorDrift(base, look, t, m.finding)
    : m.kind === 'finger-nose' ? fingerNose(base, look, t, m.finding, i)
      : kneeJerk(base, look, t, m.grade, i);
  const props = side === 'L' ? `<g transform="matrix(-1 0 0 1 360 0)">${fr.props}</g>` : fr.props;
  /* the ward's bedside figure is on the same page with gradients of the same names: these get their own */
  return (figureSvg(fr.pose, look, viewAt(side === 'L' ? 180 : 0)) + props).replace(/id="([^"]+)"/g, 'id="nm-$1"').replace(/url\(#([^)]+)\)/g, 'url(#nm-$1)').replace(/href="#([^"]+)"/g, 'href="#nm-$1"');
}

/** The moment that shows the result best, for a still: the drift at its fullest, the finger near the target, the leg at the top of its kick. */
const STILL: Record<NeuroMotion['kind'], number> = { drift: 12, 'finger-nose': 1.0, 'knee-jerk': 0.75 };

export function mountNeuroMotion(host: HTMLElement, opts: { look: FigureLook; motion: NeuroMotion; caption: string; label: string }): () => void {
  host.innerHTML = `<div class="neurohost"><svg class="neuro-motion" viewBox="0 0 360 380" role="img" aria-label="${opts.label.replace(/"/g, '&quot;')}"></svg>`
    + `<div class="trace-label">${opts.caption.replace(/</g, '&lt;')}</div></div>`;
  const svg = host.querySelector('svg')!;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { svg.innerHTML = neuroFrame(opts.motion, opts.look, STILL[opts.motion.kind]); return () => {}; }
  const t0 = performance.now();
  let raf = 0, last = -1e9;
  const step = (now: number) => {
    /* at most 30 frames a second: the figure is redrawn whole */
    if (now - last >= 33) { last = now; svg.innerHTML = neuroFrame(opts.motion, opts.look, (now - t0) / 1000); }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
