import type { CaseDef, ExamContext, Gaze, Side } from '../model/types.ts';
import type { Catalog } from '../data/catalog.ts';
import type { Registry } from '../registry.ts';
import { observe, type RuntimeView } from '../engine/observe.ts';
import { verticalRange, type NystagmusValue } from '../models/neuro-exam.ts';
import { eyeAngles } from './eye-motion.ts';

/* ---------------------------------------------------------------------------
   Eye scene: everything an eye renderer needs at one instant, computed from
   findings (never from the lesion directly). A renderer that draws this
   scene shows exactly what the model says the examiner would see:

   - each eye's horizontal, vertical and torsional angle, combining the gaze
     target, duction limits, resting deviation, skew, which eye is fixing,
     the nystagmus waveform and the head-impulse response;
   - pupil diameter and lid position, which change with the light.

   Angles in degrees. Positive h = toward the patient's right, positive
   v = up, positive torsion = upper pole toward the patient's right ear.
--------------------------------------------------------------------------- */

export const GAZE_TARGET: Record<string, { h: number; v: number }> = {
  primary: { h: 0, v: 0 }, left: { h: -30, v: 0 }, right: { h: 30, v: 0 }, up: { h: 0, v: 25 }, down: { h: 0, v: -25 },
};

export interface EyeState { h: number; v: number; torsion: number; pupilMm: number; ptosisMm: number }
export interface Scene { head: number; L: EyeState; R: EyeState; fixing: Side; covered: Side | null }

export interface SceneControls {
  gaze: Gaze;
  fixation: boolean;               // false behind Frenzel lenses
  lightOn: Side | 'none';
  ambient: 'room' | 'dim';
  /** Seconds since a head impulse began, and its direction. */
  impulse?: { to: Side; t: number };
  /** Alternate cover: which eye is covered now. */
  cover?: Side | null;
  /** Seconds since a slow pursuit target began moving side to side (overrides gaze). */
  pursuit?: number;
  /** The examiner holds the upper lids up (to see an eye behind a complete ptosis). */
  liftLids?: boolean;
}

/** Static findings for a context, observed once and reused every frame. */
export interface SceneFindings {
  nystagmus: NystagmusValue;
  pupil: Record<Side, { sizeMm: number }>;
  lid: Record<Side, { ptosisMm: number }>;
  motility: Record<Side, { abduction: number; adduction: number; elevation: number; depression: number; restingDeg: { horizontal: number; vertical: number } }>;
  alignment: { verticalPD: number; higherEye?: Side };
  hit: Record<Side, { gain: number; saccade: string }>;
  pursuit: { quality: string };
}

export function sceneFindings(cat: Catalog, reg: Registry, c: CaseDef, view: RuntimeView, k: SceneControls): SceneFindings {
  const o = (ref: string, ctx: ExamContext = {}) => observe(cat, reg.resolvers, c, view, ref, ctx).value as any;
  const light: ExamContext = { lightOn: k.lightOn, ambient: k.ambient };
  return {
    nystagmus: o('eyes.nystagmus', { gaze: k.gaze, fixation: k.fixation }),
    pupil: { L: o('eye.pupil.L', light), R: o('eye.pupil.R', light) },
    lid: { L: o('eye.lid.L'), R: o('eye.lid.R') },
    motility: { L: o('eye.motility.L'), R: o('eye.motility.R') },
    alignment: o('eyes.alignment'),
    hit: { L: o('eye.head-impulse.L'), R: o('eye.head-impulse.R') },
    pursuit: o('eyes.pursuit') ?? { quality: 'smooth' },
  };
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x, 0, 1));

/** Resting deviation of one eye in world coordinates (abducted = away from the nose). */
function deviation(f: SceneFindings, S: Side): { h: number; v: number } {
  const r = f.motility[S].restingDeg;
  let v = r.vertical;
  if (f.alignment.higherEye && f.alignment.verticalPD > 0 && r.vertical === 0 && f.motility.L.restingDeg.vertical === f.motility.R.restingDeg.vertical) {
    const d = f.alignment.verticalPD / 1.75 / 2;   // skew: split between the eyes
    v += f.alignment.higherEye === S ? d : -d;
  }
  return { h: S === 'L' ? -r.horizontal : r.horizontal, v };
}

function limits(f: SceneFindings, S: Side) {
  const m = f.motility[S];
  const abd = 30 * m.abduction / 100, add = 30 * m.adduction / 100;
  /* a paretic eye can rest beyond what its muscles reach on command (down and out in a third nerve palsy) */
  const v = verticalRange({ elevation: m.elevation, depression: m.depression, restV: m.restingDeg.vertical });
  return {
    hMin: S === 'L' ? -abd : -add, hMax: S === 'L' ? add : abd,
    vMin: v.min, vMax: v.max,
  };
}

/**
 * Head angle and eye-in-world angle during a head impulse (seconds since
 * onset). The head turns 15° in 150 ms. With VOR gain g the eyes are carried
 * off target by 15·(1−g); a catch-up saccade (~40 ms) brings them back,
 * after the head stops when overt, during the movement when covert.
 */
function impulse(gain: number, saccade: string, t: number): { head: number; eyeWorld: number } {
  const amp = 15;
  const head = t < 0.15 ? amp * ease(t / 0.15) : t < 0.45 ? amp : t < 0.95 ? amp * (1 - ease((t - 0.45) / 0.5)) : 0;
  const built = amp * (1 - gain) * ease(Math.min(t, 0.15) / 0.15);
  const latency = saccade === 'overt' ? 0.22 : saccade === 'covert' ? 0.09 : Infinity;
  const eyeWorld = t < latency ? built : built * Math.max(0, 1 - (t - latency) / 0.04);
  return { head, eyeWorld };
}

/**
 * Where the eyes look during slow pursuit of a target swinging 25° to each side at 0.2 Hz (s since it began). Smooth
 * pursuit keeps them on it. Saccadic pursuit follows with too low a gain, so the eyes fall behind and a catch-up saccade
 * brings them back every few hundred ms: a staircase.
 */
export function pursuitTarget(quality: string, t: number): number {
  const T = (x: number) => 25 * Math.sin(2 * Math.PI * 0.2 * x);
  if (quality !== 'saccadic') return T(t);
  const step = 0.3, ts = Math.floor(t / step) * step;
  return T(ts) + 0.5 * (T(t) - T(ts));
}

export function scene(f: SceneFindings, k: SceneControls, t: number): Scene {
  const target = k.pursuit != null ? { h: pursuitTarget(f.pursuit.quality, k.pursuit), v: 0 } : GAZE_TARGET[k.gaze] ?? GAZE_TARGET.primary;
  const covered = k.cover ?? null;
  const fixing: Side = covered === 'R' ? 'L' : 'R';
  const devF = deviation(f, fixing);
  let head = 0, hitOffset = 0;
  if (k.impulse && k.impulse.t < 1) {
    const sign = k.impulse.to === 'R' ? 1 : -1;
    const r = impulse(f.hit[k.impulse.to].gain, f.hit[k.impulse.to].saccade, k.impulse.t);
    head = sign * r.head;
    hitOffset = sign * r.eyeWorld;
  }
  const beat = eyeAngles(f.nystagmus, { h: 0, v: 0 }, t);
  const eye = (S: Side): EyeState => {
    const d = deviation(f, S), lim = limits(f, S);
    const h = clamp(target.h + d.h - devF.h, lim.hMin, lim.hMax) + beat.h + hitOffset;
    const v = clamp(target.v + d.v - devF.v, lim.vMin, lim.vMax) + beat.v;
    return { h, v, torsion: beat.torsion, pupilMm: f.pupil[S].sizeMm, ptosisMm: k.liftLids ? 0 : f.lid[S].ptosisMm };
  };
  return { head, L: eye('L'), R: eye('R'), fixing, covered };
}
