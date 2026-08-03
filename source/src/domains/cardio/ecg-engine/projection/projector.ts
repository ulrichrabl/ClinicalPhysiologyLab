import type { LeadName } from '../types/index.ts';

export type ElectrodeId = 'RA' | 'LA' | 'LL' | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6';

/** Generate 50 baseline projection profiles with anatomical diversity. */
export function createProjectionProfiles(count = 50): Float64Array[] {
  const profiles: Float64Array[] = [];
  for (let p = 0; p < count; p++) {
    profiles.push(generateProfile(p, count));
  }
  return profiles;
}

function generateProfile(index: number, total: number): Float64Array {
  const t = index / Math.max(1, total - 1);
  const axisRad = ((40 + t * 50 + (index % 7) * 8 - 28) * Math.PI) / 180;
  const rot = ((index % 11) - 5) * 3;
  const elev = Math.sin(index * 0.7) * 0.08;
  const scale = 0.85 + (index % 5) * 0.06;

  const cosA = Math.cos(axisRad);
  const sinA = Math.sin(axisRad);
  const electrodes: Record<ElectrodeId, [number, number, number]> = {
    RA: [-25, 20, 0],
    LA: [25, 20, 0],
    LL: [8 + rot * 0.3, -35, 0],
    V1: [-2.5 + rot * 0.2, 0.5 + elev * 10, 9],
    V2: [2.5 + rot * 0.15, 0.5 + elev * 10, 9],
    V3: [4.5 + rot * 0.1, -1 + elev * 8, 8.5],
    V4: [6.5 + rot * 0.08, -2 + elev * 6, 7],
    V5: [9 + rot * 0.05, -2 + elev * 4, 4.5],
    V6: [11 + rot * 0.03, -2, 1.5],
  };

  // 64 regions × 10 electrodes matrix stored flat
  const nRegions = 64;
  const nElec = 10;
  const M = new Float64Array(nRegions * nElec);

  for (let r = 0; r < nRegions; r++) {
    const regionAngle = axisRad + (r / nRegions - 0.5) * 1.2;
    const depth = 1 / (1 + Math.abs(r % 8 - 4) * 0.15);
    const chamberWeight = r < 16 ? 0.4 : 1.0;
    for (let e = 0; e < nElec; e++) {
      const elecId = ELECTRODE_ORDER[e];
      const pos = electrodes[elecId];
      const dx = Math.cos(regionAngle) * (r % 16) * 0.3 - pos[0] * 0.02;
      const dy = Math.sin(regionAngle) * (r % 16) * 0.3 - pos[1] * 0.02;
      const dz = (r < 16 ? 2.5 : -1.5) - pos[2] * 0.05;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.5;
      const leadFactor = elecId.startsWith('V') ? 1.2 + (parseInt(elecId[1]) - 1) * 0.05 : 1;
      M[r * nElec + e] = scale * chamberWeight * depth * leadFactor / (dist * dist) * (0.8 + 0.2 * cosA);
    }
  }
  return M;
}

const ELECTRODE_ORDER: ElectrodeId[] = ['RA', 'LA', 'LL', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'LL'];

/** Compute virtual electrode potentials then standard 12-lead (spec §13). */
export function projectLeads(
  regionSources: Float64Array,
  matrix: Float64Array,
  nRegions: number,
): Record<LeadName, number> {
  const nElec = 10;
  const phi = new Float64Array(nElec);
  for (let e = 0; e < nElec; e++) {
    let sum = 0;
    for (let r = 0; r < nRegions; r++) {
      sum += matrix[r * nElec + e] * regionSources[r];
    }
    phi[e] = sum;
  }

  const RA = phi[0], LA = phi[1], LL = phi[2];
  const V1 = phi[3], V2 = phi[4], V3 = phi[5], V4 = phi[6], V5 = phi[7], V6 = phi[8];
  const WCT = (RA + LA + LL) / 3;
  const scale = 28;

  return {
    I: (LA - RA) * scale,
    II: (LL - RA) * scale,
    III: (LL - LA) * scale,
    aVR: (RA - (LA + LL) / 2) * scale,
    aVL: (LA - (RA + LL) / 2) * scale,
    aVF: (LL - (RA + LA) / 2) * scale,
    V1: (V1 - WCT) * scale,
    V2: (V2 - WCT) * scale,
    V3: (V3 - WCT) * scale,
    V4: (V4 - WCT) * scale,
    V5: (V5 - WCT) * scale,
    V6: (V6 - WCT) * scale,
  };
}

/** Verify Einthoven's law: II = I + III (before noise). */
export function einthovenError(leads: Record<LeadName, number>): number {
  return Math.abs(leads.II - (leads.I + leads.III));
}
