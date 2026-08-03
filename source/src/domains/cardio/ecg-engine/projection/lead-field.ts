import type { CardiacRegion, LeadName } from '../types/index.ts';
import { LEADS } from '../types/index.ts';

export type ElectrodeId = 'RA' | 'LA' | 'LL' | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6';

const ELECTRODE_ORDER: ElectrodeId[] = ['RA', 'LA', 'LL', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

/** Default torso electrodes (cm-ish model units). +X left, +Y inferior, +Z anterior. */
export const DEFAULT_ELECTRODES: Record<ElectrodeId, [number, number, number]> = {
  RA: [-22, -6, 2],
  LA: [22, -6, 2],
  LL: [6, 32, 0],
  V1: [-3.2, 1.2, 11.5],
  V2: [0.2, 2.5, 12.2],
  V3: [3.0, 4.5, 11.5],
  V4: [5.8, 6.5, 9.5],
  V5: [9.0, 5.5, 5.5],
  V6: [12.0, 2.5, 1.5],
};

export interface LeadFieldOptions {
  /** Phenotype axis tilt (degrees). */
  axisTiltDeg?: number;
  /** Small electrode placement jitter seed index. */
  placementIndex?: number;
  /** Global scale (mV per source unit). */
  scale?: number;
}

/**
 * Patch → electrode lead-field matrix.
 * L[p,e] ≈ (n̂_p · r̂_{p→e}) / |r|²  — dipole at patch projected to electrode.
 */
export class LeadField {
  readonly nPatches: number;
  readonly regionIds: string[];
  /** Flat [nPatches × 9] */
  readonly matrix: Float64Array;
  readonly scale: number;
  private indexOf = new Map<string, number>();

  constructor(regions: CardiacRegion[], opts: LeadFieldOptions = {}) {
    const list = [...regions];
    this.nPatches = list.length;
    this.regionIds = list.map((r) => r.id);
    this.scale = opts.scale ?? 42;
    this.matrix = new Float64Array(this.nPatches * 9);
    for (let i = 0; i < list.length; i++) this.indexOf.set(list[i].id, i);

    const electrodes = placeElectrodes(opts);
    for (let p = 0; p < list.length; p++) {
      const r = list[p];
      const n = effectiveDipole(r);
      const chamberW = r.chamber === 'LV' ? 0.92
        : r.chamber === 'septum' ? 0.72
        : r.chamber === 'RV' ? 1.0
        : (r.chamber === 'RA' || r.chamber === 'LA') ? 1.35
        : 0.5;
      const massW = Math.sqrt(Math.max(0.05, r.electricalMass)) * chamberW;
      for (let e = 0; e < 9; e++) {
        const pos = electrodes[ELECTRODE_ORDER[e]];
        /* Map electrode frame (+Y inf, +Z ant) → heart frame (+Y sup, +Z post). */
        const ex = pos[0];
        const ey = -pos[1];
        const ez = -pos[2];
        const dx = ex - r.center[0];
        const dy = ey - r.center[1];
        const dz = ez - r.center[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.45;
        const rx = dx / dist, ry = dy / dist, rz = dz / dist;
        const cos = n[0] * rx + n[1] * ry + n[2] * rz;
        /* Softer near-nulls so frontal leads (II/aVF) don't vanish. */
        const coup = cos * 0.9 + 0.1 * Math.sign(cos || 1);
        this.matrix[p * 9 + e] = massW * coup / (dist * dist);
      }
    }
  }

  /** Project scalar patch sources → 12-lead. */
  project(sources: Float64Array | number[]): Record<LeadName, number> {
    const phi = new Float64Array(9);
    const n = Math.min(this.nPatches, sources.length);
    for (let p = 0; p < n; p++) {
      const s = sources[p];
      if (s === 0) continue;
      const base = p * 9;
      for (let e = 0; e < 9; e++) phi[e] += this.matrix[base + e] * s;
    }
    const RA = phi[0], LA = phi[1], LL = phi[2];
    const WCT = (RA + LA + LL) / 3;
    const g = this.scale;
    return {
      I: (LA - RA) * g,
      II: (LL - RA) * g,
      III: (LL - LA) * g,
      aVR: (RA - (LA + LL) / 2) * g,
      aVL: (LA - (RA + LL) / 2) * g,
      aVF: (LL - (RA + LA) / 2) * g,
      V1: (phi[3] - WCT) * g,
      V2: (phi[4] - WCT) * g,
      V3: (phi[5] - WCT) * g,
      V4: (phi[6] - WCT) * g,
      V5: (phi[7] - WCT) * g,
      V6: (phi[8] - WCT) * g,
    };
  }

  index(regionId: string): number {
    return this.indexOf.get(regionId) ?? -1;
  }
}

/**
 * Wall normal blended with a physiologic mean QRS axis so limb leads (esp. II)
 * carry a real R wave — pure outward normals on the LV are almost pure +X.
 * Heart frame: +X left, +Y base/superior, +Z posterior; inferior = −Y.
 */
function effectiveDipole(r: CardiacRegion): [number, number, number] {
  const [ox, oy, oz] = r.orientation;
  let bx = 0, by = 0, bz = 0, w = 0;
  if (r.chamber === 'LV') {
    /* ~+60° frontal, mild posterior — feeds II/aVF and left precordials. */
    bx = 0.5; by = -0.72; bz = -0.18; w = 0.38;
  } else if (r.chamber === 'septum') {
    /* Early septal force rightward / slightly anterior (small r in V1). */
    bx = -0.4; by = -0.2; bz = -0.25; w = 0.28;
  } else if (r.chamber === 'RV') {
    /* Right + anterior — late RV force must raise V1 (RBBB R′), not dig it. */
    bx = -0.55; by = -0.25; bz = -0.7; w = 0.48;
  } else if (r.chamber === 'RA' || r.chamber === 'LA') {
    /* Sinus P: inferior + left (upright in II, inverted in aVR). */
    bx = 0.4; by = -0.82; bz = -0.12; w = 0.62;
  } else {
    return [ox, oy, oz];
  }
  let x = ox * (1 - w) + bx * w;
  let y = oy * (1 - w) + by * w;
  let z = oz * (1 - w) + bz * w;
  const n = Math.hypot(x, y, z) || 1;
  return [x / n, y / n, z / n];
}

function placeElectrodes(opts: LeadFieldOptions): Record<ElectrodeId, [number, number, number]> {
  const out = {} as Record<ElectrodeId, [number, number, number]>;
  const idx = opts.placementIndex ?? 0;
  const tilt = ((opts.axisTiltDeg ?? 0) * Math.PI) / 180;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const jx = ((idx % 7) - 3) * 0.12;
  const jy = (((idx * 3) % 5) - 2) * 0.1;
  for (const id of ELECTRODE_ORDER) {
    const [x, y, z] = DEFAULT_ELECTRODES[id];
    /* Small torso rotation about Z for phenotype diversity. */
    const xr = x * ct - y * st + jx * (id.startsWith('V') ? 1 : 0.3);
    const yr = x * st + y * ct + jy * (id.startsWith('V') ? 1 : 0.3);
    out[id] = [xr, yr, z];
  }
  return out;
}

export function einthovenError(leads: Record<LeadName, number>): number {
  return Math.abs(leads.II - (leads.I + leads.III));
}

/** Zero template for all leads. */
export function zeroLeads(): Record<LeadName, number> {
  return Object.fromEntries(LEADS.map((l) => [l, 0])) as Record<LeadName, number>;
}
