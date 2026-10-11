import type { NystagmusValue } from '../models/neuro-exam.ts';

/* ---------------------------------------------------------------------------
   Eye kinematics for renderers.

   Turns a nystagmus finding into eye position over time, so an SVG eye beats
   with the slow-phase velocity, amplitude and frequency the model computed.
   A jerk nystagmus is a slow drift away from the target followed by a fast
   corrective jump back (~30 ms). A constant-velocity slow phase is a linear
   ramp (peripheral); a decreasing-velocity slow phase is an exponential
   decay toward the centre (a leaky gaze-holding integrator).

   The function is pure: (finding, gaze, time) -> angles. Renderers sample
   it every frame; tests sample it to check the physics.
--------------------------------------------------------------------------- */

export interface EyeAngles { h: number; v: number; torsion: number }

const UNIT: Record<string, [number, number]> = { right: [1, 0], left: [-1, 0], up: [0, 1], down: [0, -1] };
const FAST_PHASE_S = 0.03;

/**
 * Eye angles in degrees at time t (seconds) while holding `gaze`.
 * Positive h = to the patient's right, positive v = up, positive torsion =
 * upper pole toward the patient's right ear.
 */
export function eyeAngles(n: NystagmusValue, gaze: { h: number; v: number }, t: number): EyeAngles {
  if (!n.present || !n.fastPhase || !n.frequencyHz || !n.amplitudeDeg) return { h: gaze.h, v: gaze.v, torsion: 0 };
  const T = 1 / n.frequencyHz;
  const p = ((t % T) + T) % T;
  const A = n.amplitudeDeg;
  const slowDur = T - FAST_PHASE_S;
  let offset: number;   // displacement along the fast-phase direction, +A/2 at the start of a slow phase
  if (p < slowDur) {
    const x = p / slowDur;
    offset = n.slowPhase === 'decreasing'
      ? A / 2 - A * (1 - Math.exp(-3 * x)) / (1 - Math.exp(-3))
      : A / 2 - A * x;
  } else {
    offset = -A / 2 + A * ((p - slowDur) / FAST_PHASE_S);
  }
  const [ux, uy] = UNIT[n.fastPhase];
  const tSign = n.torsion === 'toward-right-ear' ? 1 : n.torsion === 'toward-left-ear' ? -1 : 0;
  return { h: gaze.h + ux * offset, v: gaze.v + uy * offset, torsion: tSign * offset * 0.6 };
}

/** Mean slow-phase velocity measured from the trajectory, for checking renderers against the model. */
export function measuredSlowPhaseVelocity(n: NystagmusValue, gaze: { h: number; v: number }, samples = 2000): number {
  if (!n.present || !n.frequencyHz) return 0;
  const T = 1 / n.frequencyHz;
  const dt = (T - FAST_PHASE_S) / samples;
  const a = eyeAngles(n, gaze, 0), b = eyeAngles(n, gaze, (samples - 1) * dt);
  return Math.hypot(b.h - a.h, b.v - a.v) / ((samples - 1) * dt);
}
