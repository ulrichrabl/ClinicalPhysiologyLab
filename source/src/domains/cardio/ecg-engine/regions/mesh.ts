import type { CardiacRegion, Chamber } from '../types/index.ts';
import { helicalFiber } from '../graph/anisotropy.ts';

/**
 * Mid-scale tissue mesh (~300 patches).
 * Parent seeds are subdivided into endo/mid/epi layers with local offsets so
 * activation timing and lead fields vary across the wall — not one dipole.
 */

type Seed = [string, Chamber, [number, number, number], number];

const ATRIAL_SEEDS: Seed[] = [
  ['ra_high', 'RA', [1.2, 2.8, -0.2], 0.8],
  ['ra_mid', 'RA', [0.8, 2.2, -0.1], 0.9],
  ['ra_low', 'RA', [0.3, 1.6, 0], 1.0],
  ['ra_fw', 'RA', [-0.5, 1.8, 0.3], 0.7],
  ['crista', 'RA', [0.6, 2.0, 0.2], 0.5],
  ['ias', 'septum', [0, 1.8, 0], 0.6],
  ['cs_region', 'RA', [-0.8, 1.2, 0.1], 0.4],
  ['bachmann', 'LA', [0.2, 2.6, 0.1], 0.5],
  ['la_high', 'LA', [-0.6, 2.5, 0], 0.8],
  ['la_ant', 'LA', [-1.0, 2.0, 0.4], 0.9],
  ['la_lat', 'LA', [-1.4, 1.8, 0.6], 0.85],
  ['la_inf', 'LA', [-0.8, 1.2, 0.2], 0.75],
  ['la_post', 'LA', [-1.2, 1.5, -0.2], 0.8],
  ['la_append', 'LA', [-1.6, 2.2, 0.5], 0.6],
  ['rpvein', 'LA', [-0.4, 2.8, -0.3], 0.4],
  ['lpvein', 'LA', [-1.0, 2.9, -0.2], 0.4],
];

const VENT_SEEDS: Seed[] = [
  ['septum_basal', 'septum', [0.2, -0.5, 0], 1.2],
  ['septum_mid', 'septum', [0.2, -1.5, 0], 1.3],
  ['septum_apical', 'septum', [0.1, -3.0, 0], 1.0],
  ['rv_inflow', 'RV', [-1.0, -0.8, 0.8], 0.9],
  ['rv_outflow', 'RV', [-0.5, -1.8, 1.2], 1.1],
  ['rv_fw_basal', 'RV', [-2.0, -1.0, 1.4], 1.0],
  ['rv_fw_mid', 'RV', [-2.3, -2.0, 1.5], 1.0],
  ['rv_fw_apical', 'RV', [-2.0, -3.2, 1.3], 0.8],
  ['lv_anteroseptal', 'LV', [1.5, -1.2, -0.3], 1.2],
  ['lv_anterior', 'LV', [2.2, -1.5, -0.6], 1.3],
  ['lv_anterolateral', 'LV', [3.0, -2.0, -0.8], 1.2],
  ['lv_inferoseptal', 'LV', [0.8, -2.0, -0.2], 1.1],
  ['lv_inferior', 'LV', [1.5, -2.8, -0.4], 1.2],
  ['lv_inferolateral', 'LV', [2.8, -3.0, -0.9], 1.1],
  ['lv_lateral', 'LV', [3.5, -2.5, -1.0], 1.0],
  ['lv_apical', 'LV', [2.0, -3.8, -0.7], 0.9],
  ['lv_post_basal', 'LV', [1.0, -1.0, -0.5], 1.0],
  ['lv_post_mid', 'LV', [1.2, -2.2, -0.6], 1.0],
  ['lv_epi_ant', 'LV', [2.4, -1.4, -0.9], 0.8],
  ['lv_epi_inf', 'LV', [1.6, -2.6, -0.7], 0.8],
  ['lv_endo_ant', 'LV', [2.0, -1.6, -0.3], 0.9],
  ['lv_endo_inf', 'LV', [1.4, -2.7, -0.2], 0.9],
  ['rv_epi', 'RV', [-2.2, -1.8, 1.6], 0.7],
  ['rv_endo', 'RV', [-1.8, -1.6, 1.0], 0.8],
  ['lbb_root', 'septum', [0.3, -0.8, 0.1], 0.5],
  ['rbb_root', 'septum', [-0.2, -0.8, 0.2], 0.5],
  ['lv_basal_post', 'LV', [0.6, -0.8, -0.4], 1.0],
  ['lv_mid_lat', 'LV', [3.2, -2.8, -1.0], 1.0],
  ['rv_mid_sept', 'RV', [-0.5, -1.5, 0.6], 0.8],
  ['lv_mid_ant', 'LV', [2.4, -2.2, -0.7], 1.1],
  ['septum_inf', 'septum', [0.1, -2.5, 0], 1.0],
  ['lv_inf_lat', 'LV', [3.0, -3.2, -1.0], 1.0],
  ['rv_bas_inf', 'RV', [-1.8, -2.8, 1.4], 0.9],
  ['lv_ant_sept_mid', 'LV', [1.2, -1.8, -0.3], 1.1],
  ['lv_post_apical', 'LV', [1.5, -3.5, -0.6], 0.85],
  ['rv_ot_anterior', 'RV', [-0.3, -2.0, 1.4], 1.0],
  ['lv_bas_anterolat', 'LV', [2.8, -1.0, -0.8], 1.0],
  ['lv_bas_inferolat', 'LV', [2.5, -1.2, -0.7], 1.0],
  ['rv_trabec', 'RV', [-1.5, -2.2, 1.1], 0.7],
  ['lv_trabec', 'LV', [1.6, -2.0, -0.3], 0.7],
  ['rv_subpulm', 'RV', [-0.8, -1.2, 1.0], 0.8],
  ['lv_subaortic', 'LV', [1.8, -0.6, -0.5], 0.9],
  ['rv_apical_cap', 'RV', [-1.6, -3.5, 1.2], 0.7],
  ['lv_lat_bas', 'LV', [3.4, -1.5, -1.0], 1.0],
  ['rv_lat_bas', 'RV', [-2.4, -0.8, 1.5], 0.9],
];

type Layer = 'endo' | 'mid' | 'epi';
const LAYERS: Layer[] = ['endo', 'mid', 'epi'];
const LAYER_RADIAL: Record<Layer, number> = { endo: -0.22, mid: 0, epi: 0.28 };
const LAYER_APD: Record<Layer, number> = { endo: 18, mid: 0, epi: -28 };
const LAYER_COND: Record<Layer, number> = { endo: 1.08, mid: 1, epi: 0.92 };

function cavityOf(ch: Chamber): [number, number, number] {
  if (ch === 'RA') return [0.5, 2.0, 0];
  if (ch === 'LA') return [-0.8, 2.0, 0];
  if (ch === 'RV') return [-1.2, -1.8, 1.0];
  if (ch === 'septum') return [0.1, -1.5, 0];
  return [1.6, -2.0, -0.35];
}

function norm3(v: [number, number, number]): [number, number, number] {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
}

function outwardNormal(center: [number, number, number], chamber: Chamber): [number, number, number] {
  const c = cavityOf(chamber);
  return norm3([center[0] - c[0], center[1] - c[1], center[2] - c[2]]);
}

function orthonormalBasis(n: [number, number, number]): [[number, number, number], [number, number, number]] {
  const a = Math.abs(n[0]) < 0.9 ? [1, 0, 0] as const : [0, 1, 0] as const;
  const t1 = norm3([
    n[1] * a[2] - n[2] * a[1],
    n[2] * a[0] - n[0] * a[2],
    n[0] * a[1] - n[1] * a[0],
  ]);
  const t2 = norm3([
    n[1] * t1[2] - n[2] * t1[1],
    n[2] * t1[0] - n[0] * t1[2],
    n[0] * t1[1] - n[1] * t1[0],
  ]);
  return [t1, t2];
}

function makePatch(
  id: string,
  chamber: Chamber,
  center: [number, number, number],
  orientation: [number, number, number],
  mass: number,
  apd: number,
  conduction: number,
  fiberDir?: [number, number, number],
): CardiacRegion {
  return {
    id,
    chamber,
    center,
    orientation,
    fiberDir,
    electricalMass: mass,
    viableFraction: 1,
    scarFraction: 0,
    fibrosisFraction: 0,
    localConductionScale: conduction,
    excitability: 1,
    actionPotentialDurationMs: apd,
    plateauScale: 1,
    notchScale: 1,
    injuryCurrent: 0,
    restingPotentialShift: 0,
    depolarizationKernelId: 'standard_dep',
    repolarizationKernelId: 'standard_rep',
  };
}

/** Subdivide a seed into layered local patches. */
function expandSeed(seed: Seed, atrial: boolean): CardiacRegion[] {
  const [parentId, chamber, center, mass] = seed;
  const n = outwardNormal(center, chamber);
  const [t1, t2] = orthonormalBasis(n);
  const baseApd = atrial ? 160 : 280;
  const out: CardiacRegion[] = [];

  if (atrial) {
    /* 2 patches per atrial seed → ~32 atrial sources. */
    for (let k = 0; k < 2; k++) {
      const ang = (k / 2) * Math.PI * 2;
      const ox = (t1[0] * Math.cos(ang) + t2[0] * Math.sin(ang)) * 0.18;
      const oy = (t1[1] * Math.cos(ang) + t2[1] * Math.sin(ang)) * 0.18;
      const oz = (t1[2] * Math.cos(ang) + t2[2] * Math.sin(ang)) * 0.18;
      out.push(makePatch(
        `${parentId}_p${k}`,
        chamber,
        [center[0] + ox, center[1] + oy, center[2] + oz],
        n,
        mass / 2,
        baseApd,
        1,
      ));
    }
    return out;
  }

  /* Ventricle: 3 layers × 2 azimuthal → 6 patches/seed ≈ 270 vent patches. */
  const nAz = 2;
  for (let li = 0; li < LAYERS.length; li++) {
    const layer = LAYERS[li];
    const rad = LAYER_RADIAL[layer];
    for (let k = 0; k < nAz; k++) {
      const ang = (k / nAz) * Math.PI * 2 + li * 0.4;
      const tang = 0.2;
      const ox = n[0] * rad + (t1[0] * Math.cos(ang) + t2[0] * Math.sin(ang)) * tang;
      const oy = n[1] * rad + (t1[1] * Math.cos(ang) + t2[1] * Math.sin(ang)) * tang;
      const oz = n[2] * rad + (t1[2] * Math.cos(ang) + t2[2] * Math.sin(ang)) * tang;
      const pos: [number, number, number] = [center[0] + ox, center[1] + oy, center[2] + oz];
      const ori = outwardNormal(pos, chamber);
      out.push(makePatch(
        `${parentId}_p${k}_${layer}`,
        chamber,
        pos,
        ori,
        mass / (LAYERS.length * nAz),
        baseApd + LAYER_APD[layer],
        LAYER_COND[layer],
        helicalFiber(ori, layer),
      ));
    }
  }
  return out;
}

/** Full dense mesh used by the mid-scale engine. */
export function createDenseRegions(): CardiacRegion[] {
  const atrial = ATRIAL_SEEDS.flatMap((s) => expandSeed(s, true));
  const vent = VENT_SEEDS.flatMap((s) => expandSeed(s, false));
  return [...atrial, ...vent];
}

export function parentIdOf(regionId: string): string {
  const i = regionId.indexOf('_p');
  return i >= 0 ? regionId.slice(0, i) : regionId;
}

/** Territory / wall keys → parent seed ids (patches match by prefix). */
export const TERRITORY_PARENTS: Record<string, string[]> = {
  LAD: ['lv_anterior', 'lv_anteroseptal', 'lv_anterolateral', 'lv_mid_ant', 'lv_apical', 'septum_mid', 'lv_ant_sept_mid', 'lv_endo_ant', 'lv_epi_ant'],
  RCA: ['lv_inferior', 'lv_inferoseptal', 'rv_fw_mid', 'rv_outflow', 'septum_inf', 'lv_endo_inf', 'lv_epi_inf', 'rv_bas_inf'],
  LCx: ['lv_lateral', 'lv_inferolateral', 'lv_post_mid', 'lv_mid_lat', 'lv_inf_lat', 'lv_lat_bas'],
  anterior: ['lv_anterior', 'lv_anteroseptal', 'lv_mid_ant', 'lv_endo_ant', 'lv_epi_ant'],
  lateral: ['lv_lateral', 'lv_anterolateral', 'lv_inferolateral', 'lv_mid_lat'],
  inferior: ['lv_inferior', 'lv_inferoseptal', 'lv_endo_inf', 'lv_epi_inf'],
  septal: ['septum_basal', 'septum_mid', 'septum_apical', 'septum_inf'],
  rv: ['rv_outflow', 'rv_fw_basal', 'rv_fw_mid', 'rv_fw_apical', 'rv_ot_anterior'],
  posterior: ['lv_post_basal', 'lv_post_mid', 'lv_basal_post'],
};

export const WALL_PARENTS: Record<string, string[]> = {
  anterior: TERRITORY_PARENTS.anterior,
  lateral: TERRITORY_PARENTS.lateral,
  inferior: TERRITORY_PARENTS.inferior,
  septal: TERRITORY_PARENTS.septal,
  rv: TERRITORY_PARENTS.rv,
};

export function regionsMatchingParents(
  regions: CardiacRegion[],
  parents: string[],
): CardiacRegion[] {
  return regions.filter((r) => {
    const p = parentIdOf(r.id);
    return parents.some((key) => p === key || p.startsWith(key));
  });
}

export function meshStats(regions: CardiacRegion[] = createDenseRegions()): {
  total: number;
  atrial: number;
  ventricular: number;
} {
  let atrial = 0, ventricular = 0;
  for (const r of regions) {
    if (r.chamber === 'RA' || r.chamber === 'LA') atrial++;
    else ventricular++;
  }
  return { total: regions.length, atrial, ventricular };
}
