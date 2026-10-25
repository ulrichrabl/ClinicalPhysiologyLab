import { figureJoints, figureSvg, POSES, viewAt, type FigureLook } from '../render/patient-figure.ts';
import { pullTest, type PullFinding, armReflexes, fingerNose, gait, heelShin, kneeJerk, legReflexes, toneTest, type ArmReflexFinding, type LegReflexFinding, type ToneFinding, pronatorDrift, rapidAlternating, romberg, type DriftFinding, type FingerNoseFinding, type GaitFinding, type HeelShinFinding, type MotionFrame, type RapidAlternatingFinding, type ReflexGrade, type RombergFinding } from '../render/neuro-motion.ts';

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
  | { kind: 'finger-nose'; side: 'L' | 'R'; finding: FingerNoseFinding; eyesClosed?: boolean }
  | { kind: 'knee-jerk'; side: 'L' | 'R'; grade: ReflexGrade }
  | { kind: 'heel-shin'; side: 'L' | 'R'; finding: HeelShinFinding; eyesClosed?: boolean }
  | { kind: 'rapid-alternating'; side: 'L' | 'R'; finding: RapidAlternatingFinding }
  | { kind: 'romberg'; open: RombergFinding; closed: RombergFinding }
  | { kind: 'gait'; finding: GaitFinding }
  | { kind: 'tone'; side: 'L' | 'R'; finding: ToneFinding }
  | { kind: 'arm-reflexes'; side: 'L' | 'R'; finding: ArmReflexFinding }
  | { kind: 'leg-reflexes'; side: 'L' | 'R'; finding: LegReflexFinding }
  | { kind: 'pull'; finding: PullFinding };

/** The drawing's view box: walking is drawn twice, from the side and from the front. */
export const neuroViewBox = (m: NeuroMotion) => (m.kind === 'gait' && m.finding.pattern !== 'unable' ? '0 0 720 380' : '0 0 360 380');

/** The side the test is watched from: the side examined, or for drift the side that drifts (the right if neither or both). */
export const motionSide = (m: NeuroMotion): 'L' | 'R' => (m.kind === 'drift' ? (m.finding.drift[1] && !m.finding.drift[0] ? 'L' : 'R') : m.kind === 'romberg' || m.kind === 'gait' || m.kind === 'pull' ? 'R' : m.side);

/** One frame of the test, `t` seconds in, as SVG content for a 360 × 380 view box. */
export function neuroFrame(m: NeuroMotion, look: FigureLook, t: number): string {
  const side = motionSide(m), i: 0 | 1 = side === 'L' ? 1 : 0;
  const base = m.kind === 'heel-shin' ? POSES.supine : m.kind === 'romberg' || m.kind === 'gait' || m.kind === 'pull' ? POSES.standing : POSES.sitting;
  const fr: MotionFrame = m.kind === 'drift' ? pronatorDrift(base, look, t, m.finding)
    : m.kind === 'finger-nose' ? fingerNose(base, look, t, m.finding, i)
      : m.kind === 'heel-shin' ? heelShin(base, look, t, m.finding, i)
        : m.kind === 'rapid-alternating' ? rapidAlternating(base, look, t, m.finding, i)
          : m.kind === 'romberg' ? romberg(base, look, t, m.open, m.closed)
            : m.kind === 'gait' ? gait(base, look, t, m.finding)
              : m.kind === 'tone' ? toneTest(base, look, t, m.finding, i)
                : m.kind === 'arm-reflexes' ? armReflexes(base, look, t, m.finding, i)
                  : m.kind === 'leg-reflexes' ? legReflexes(base, look, t, m.finding, i)
                    : m.kind === 'pull' ? pullTest(base, look, t, m.finding)
            : kneeJerk(base, look, t, m.grade, i);
  if ((m.kind === 'finger-nose' || m.kind === 'heel-shin') && m.eyesClosed) fr.pose.eyes = 1;
  const angle = fr.view ?? (side === 'L' ? 180 : 0);
  let svg: string;
  if (fr.walk) {
    /* from the side, walking across and round again; from the front, toward the examiner, in place */
    const w = fr.walk, span = 250, x0 = 70;
    const hipX = x0 + (((w.ahead % span) + span) % span);
    const side = figureSvg({ ...fr.pose, hipX }, look, viewAt(0), { scene: false });
    const feet: { x: number; y: number }[] = [];
    const front = figureSvg({ ...fr.pose, legOut: fr.pose.legOut }, look, viewAt(90), { scene: false, collect: (k, _sd, pts) => { if (k === 'legs') feet.push(...pts); } });
    const footY = Math.max(...feet.map((q) => q.y)), footX = feet.reduce((a, q) => a + q.x, 0) / Math.max(1, feet.length);
    const floor = (x1: number, x2: number) => `<line x1="${x1}" y1="${(footY + 1).toFixed(1)}" x2="${x2}" y2="${(footY + 1).toFixed(1)}" stroke="#c4cdca" stroke-width="2" stroke-linecap="round"/>`;
    /* in the front view the patient's right is on the viewer's left */
    const dx = -w.drift, deg = -w.lurch;
    svg = `<svg x="0" y="0" width="360" height="380" viewBox="0 0 360 380" overflow="hidden">${floor(10, 350)}${side}</svg>`
      + `<line x1="360" y1="20" x2="360" y2="360" stroke="#d3dad8" stroke-width="1"/>`
      + `<g transform="translate(360 0)">${floor(20, 340)}<g transform="translate(${dx.toFixed(1)} 0) rotate(${deg.toFixed(2)} ${footX.toFixed(1)} ${footY.toFixed(1)})">${front}</g></g>`;
  } else if (fr.pull) {
    /* the pull test from the side: the body leans back about its feet; the examiner stands behind */
    const feet: { x: number; y: number }[] = [];
    const body = figureSvg(fr.pose, look, viewAt(0), { scene: false, collect: (k, _sd, pts) => { if (k === 'legs') feet.push(...pts); } });
    const footY = Math.max(...feet.map((q) => q.y)), back = fr.pull.s > 0 ? Math.min(...feet.map((q) => q.x)) : Math.max(...feet.map((q) => q.x));
    const deg = -fr.pull.s * fr.pull.tilt, r = (deg * Math.PI) / 180;
    const sh = figureJoints(fr.pose, look).k.shoulder, dx = sh.x - back, dy = sh.y - footY;
    const q = { x: back + dx * Math.cos(r) - dy * Math.sin(r), y: footY + dx * Math.sin(r) + dy * Math.cos(r) };
    /* the hands on the shoulders, or a hand's breadth behind them, ready */
    const at = fr.pull.hold ? q : { x: q.x - fr.pull.s * 14, y: q.y + 4 };
    const sleeve = { x: at.x - fr.pull.s * 46, y: at.y + 26 };
    const hands = `<g class="examiner" pointer-events="none"><path d="M${sleeve.x.toFixed(1)} ${sleeve.y.toFixed(1)} L${(at.x - fr.pull.s * 7).toFixed(1)} ${(at.y + 3).toFixed(1)}" stroke="#4f7f86" stroke-width="8" stroke-linecap="round"/>`
      + `<ellipse cx="${(at.x - fr.pull.s * 3).toFixed(1)}" cy="${(at.y + 1).toFixed(1)}" rx="6" ry="4" fill="#e2b89a" stroke="#b98d70" stroke-width=".5"/></g>`;
    /* where the feet stood before the pull: a strip of tape on the floor */
    const tape = `<rect x="${(fr.pull.start - 14).toFixed(1)}" y="${(footY + 0.5).toFixed(1)}" width="28" height="3" rx="1" fill="#d9a441" opacity=".85"/>`;
    const floor = `<line x1="10" y1="${(footY + 1).toFixed(1)}" x2="350" y2="${(footY + 1).toFixed(1)}" stroke="#c4cdca" stroke-width="2" stroke-linecap="round"/>${tape}`;
    svg = `${floor}<g transform="rotate(${deg.toFixed(2)} ${back.toFixed(1)} ${footY.toFixed(1)})">${body}</g>${hands}`;
  } else if (fr.sway !== undefined) {
    /* stance, from the front: the body turns about the feet; the catching hand is the examiner's, outside the turn */
    const arms: Record<string, { x: number; y: number }[]> = { R: [], L: [] }, feet: { x: number; y: number }[] = [];
    const body = figureSvg(fr.pose, look, viewAt(angle), { scene: false, collect: (k, sd, pts) => { if (k === 'arm' && (sd === 'R' || sd === 'L')) arms[sd].push(...pts); if (k === 'legs') feet.push(...pts); } });
    const mean = (ps: { x: number }[]) => ps.reduce((a, q) => a + q.x, 0) / Math.max(1, ps.length);
    const rightOnLeft = mean(arms.R) < mean(arms.L);
    const footY = Math.max(...feet.map((q) => q.y)), footX = mean(feet);
    const deg = (rightOnLeft ? -1 : 1) * fr.sway;
    let catchHand = '';
    if (fr.props === 'catch') {
      const sd = (fr.sway > 0) === true ? 'R' : 'L', top = arms[sd].reduce((a, q) => (q.y < a.y ? q : a), { x: 0, y: 1e9 });
      const r = (deg * Math.PI) / 180, dx = top.x - footX, dy = top.y - footY;
      const q = { x: footX + dx * Math.cos(r) - dy * Math.sin(r), y: footY + dx * Math.sin(r) + dy * Math.cos(r) };
      const out = q.x < footX ? -1 : 1;
      catchHand = `<g class="examiner" pointer-events="none"><path d="M${(q.x + out * 40).toFixed(1)} ${(q.y + 14).toFixed(1)} L${(q.x + out * 9).toFixed(1)} ${(q.y + 4).toFixed(1)}" stroke="#4f7f86" stroke-width="7" stroke-linecap="round"/>`
        + `<ellipse cx="${(q.x + out * 5).toFixed(1)}" cy="${(q.y + 3).toFixed(1)}" rx="5" ry="3.6" fill="#e2b89a" stroke="#b98d70" stroke-width=".5"/></g>`;
    }
    const floor = `<line x1="20" y1="${(footY + 1).toFixed(1)}" x2="340" y2="${(footY + 1).toFixed(1)}" stroke="#c4cdca" stroke-width="2" stroke-linecap="round"/>`;
    svg = `${floor}<g transform="rotate(${deg.toFixed(2)} ${footX.toFixed(1)} ${footY.toFixed(1)})">${body}</g>${catchHand}`;
  } else {
    const props = side === 'L' ? `<g transform="matrix(-1 0 0 1 360 0)">${fr.props}</g>` : fr.props;
    svg = figureSvg(fr.pose, look, viewAt(angle)) + props;
  }
  /* the ward's bedside figure is on the same page with gradients of the same names: these get their own */
  return svg.replace(/id="([^"]+)"/g, 'id="nm-$1"').replace(/url\(#([^)]+)\)/g, 'url(#nm-$1)').replace(/href="#([^"]+)"/g, 'href="#nm-$1"');
}

/** The moment that shows the result best, for a still: the drift at its fullest, the finger near the target, the leg at the top of its kick. */
const STILL: Record<NeuroMotion['kind'], number> = { drift: 12, 'finger-nose': 1.0, 'knee-jerk': 0.75, 'heel-shin': 2.0, 'rapid-alternating': 0.3, romberg: 10, gait: 0.8, tone: 1.5, 'arm-reflexes': 0.7, 'leg-reflexes': 0.75, pull: 2.6 };

export function mountNeuroMotion(host: HTMLElement, opts: { look: FigureLook; motion: NeuroMotion; caption: string; label: string }): () => void {
  host.innerHTML = `<div class="neurohost"><svg class="neuro-motion" viewBox="${neuroViewBox(opts.motion)}" role="img" aria-label="${opts.label.replace(/"/g, '&quot;')}"></svg>`
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
