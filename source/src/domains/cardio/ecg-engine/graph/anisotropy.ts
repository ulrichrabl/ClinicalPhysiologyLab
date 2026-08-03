/* Anisotropic activation travel times on the dense mesh.
   Fiber (fast) > sheet > transmural (slow). Endocardium also gets a Purkinje boost. */

import type { CardiacRegion } from '../types/index.ts';

/** ms per unit length — lower is faster. Tuned so QRS stays ~80–100 ms in NSR. */
const COST_FIBER = 5.4;
const COST_SHEET = 11;
const COST_RADIAL = 26;
const PURKINJE_ENDO = 0.62;
const PURKINJE_MID = 0.88;

function dot(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Travel time from a breakthrough origin to a patch under local anisotropy.
 * Uses the patch fiberDir (or falls back to circumferential) and wall normal.
 */
export function anisotropicTravelMs(
  origin: [number, number, number],
  region: CardiacRegion,
  velScale = 1,
): number {
  const dx = region.center[0] - origin[0];
  const dy = region.center[1] - origin[1];
  const dz = region.center[2] - origin[2];
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-6) return 0;

  const radial = region.orientation;
  let fiber = region.fiberDir;
  if (!fiber) {
    /* Circumferential fallback: radial × long-axis (or × X if nearly parallel). */
    const long: [number, number, number] = [0, 1, 0];
    let fx = radial[1] * long[2] - radial[2] * long[1];
    let fy = radial[2] * long[0] - radial[0] * long[2];
    let fz = radial[0] * long[1] - radial[1] * long[0];
    let fn = Math.hypot(fx, fy, fz);
    if (fn < 0.15) {
      fx = 0; fy = radial[2]; fz = -radial[1];
      fn = Math.hypot(fx, fy, fz) || 1;
    }
    fiber = [fx / fn, fy / fn, fz / fn];
  }

  const ux = dx / dist, uy = dy / dist, uz = dz / dist;
  const df = Math.abs(ux * fiber[0] + uy * fiber[1] + uz * fiber[2]) * dist;
  const dr = Math.abs(ux * radial[0] + uy * radial[1] + uz * radial[2]) * dist;
  const ds = Math.sqrt(Math.max(0, dist * dist - df * df - dr * dr));

  const scale = Math.max(0.25, region.localConductionScale * velScale);
  let t = Math.sqrt(
    (df * COST_FIBER) ** 2 +
    (ds * COST_SHEET) ** 2 +
    (dr * COST_RADIAL) ** 2,
  ) / scale;

  if (region.id.includes('_endo')) t *= PURKINJE_ENDO;
  else if (region.id.includes('_mid')) t *= PURKINJE_MID;

  return t;
}

/** Helical fiber direction from wall normal and layer (Streeter-style). */
export function helicalFiber(
  radial: [number, number, number],
  layer: 'endo' | 'mid' | 'epi',
): [number, number, number] {
  const long: [number, number, number] = [0, 1, 0];
  let cx = radial[1] * long[2] - radial[2] * long[1];
  let cy = radial[2] * long[0] - radial[0] * long[2];
  let cz = radial[0] * long[1] - radial[1] * long[0];
  let cn = Math.hypot(cx, cy, cz);
  if (cn < 0.15) {
    cx = 0; cy = radial[2]; cz = -radial[1];
    cn = Math.hypot(cx, cy, cz) || 1;
  }
  cx /= cn; cy /= cn; cz /= cn;

  /* Project long-axis into the wall tangent plane. */
  const ld = dot(long, radial);
  let lx = long[0] - radial[0] * ld;
  let ly = long[1] - radial[1] * ld;
  let lz = long[2] - radial[2] * ld;
  const ln = Math.hypot(lx, ly, lz) || 1;
  lx /= ln; ly /= ln; lz /= ln;

  const ang = layer === 'endo' ? Math.PI / 3 : layer === 'epi' ? -Math.PI / 3 : 0;
  const c = Math.cos(ang), s = Math.sin(ang);
  const fx = cx * c + lx * s;
  const fy = cy * c + ly * s;
  const fz = cz * c + lz * s;
  const fn = Math.hypot(fx, fy, fz) || 1;
  return [fx / fn, fy / fn, fz / fn];
}
