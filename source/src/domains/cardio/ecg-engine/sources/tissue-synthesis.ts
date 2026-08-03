import type { CardiacRegion, LeadName, MechanismModifiers } from '../types/index.ts';
import {
  evalInjury,
  monophasicPulse,
  DEP_WAVEFRONT,
  REP_WAVEFRONT,
  ATRIAL_WAVEFRONT,
  AF_WAVEFRONT,
} from './kernels.ts';
import { LeadField } from '../projection/lead-field.ts';
import { parentIdOf } from '../regions/mesh.ts';

type WaveGroup = {
  members: CardiacRegion[];
  mass: number;
  act: number | null;
  rep: number | null;
  repMass: number;
};

/**
 * Mid-scale tissue synthesis with wavefront coalescing.
 *
 * Fine patches keep injury (territorial ST). Depolarization / repolarization
 * fire as one coherent pulse per parent territory (earliest act / mean repol)
 * so endo–mid–epi twins don't notch the QRS into three peaks.
 */
export function synthesizeTissueLeads(
  regions: Map<string, CardiacRegion> | Iterable<CardiacRegion>,
  tMs: number,
  leadField: LeadField,
  modifiers: MechanismModifiers = {},
): Record<LeadName, number> {
  const list = regions instanceof Map ? [...regions.values()] : [...regions];
  const sources = new Float64Array(leadField.nPatches);
  const afAct = modifiers.af_source_activity ?? 0;
  const atrialKernel = afAct > 0.2 ? AF_WAVEFRONT : ATRIAL_WAVEFRONT;
  /* P ~0.15–0.3× R in II — small but obvious, isoelectric PR after. */
  const atrialGain = afAct > 0.2 ? 0.55 * (0.9 + afAct * 0.4) : 0.72;
  const injuryGain = 1.55 + (modifiers.ischemia_severity ?? 0) * 0.9;
  const disp = modifiers.repolarization_dispersion ?? 0;
  const lbb = modifiers.left_bundle_delay_ms ?? 0;
  const rbb = modifiers.right_bundle_delay_ms ?? 0;
  const bbbWiden = Math.max(lbb, rbb) >= 40;
  const depSigma = bbbWiden ? DEP_WAVEFRONT.sigmaMs * 1.9 : DEP_WAVEFRONT.sigmaMs;
  const ventDepGain = bbbWiden ? 1.05 : 1.1;

  const atrGroups = new Map<string, WaveGroup>();
  const depGroups = new Map<string, WaveGroup>();
  const repGroups = new Map<string, WaveGroup>();

  for (const r of list) {
    const idx = leadField.index(r.id);
    if (idx < 0) continue;
    const mass = r.electricalMass * r.viableFraction * (1 - r.scarFraction);
    if (mass <= 0) continue;

    const atrial = r.chamber === 'RA' || r.chamber === 'LA';
    if (atrial) {
      addToGroup(atrGroups, parentIdOf(r.id), r, mass);
      continue;
    }

    /* One QRS/T wavefront per parent seed — mesh timing still sets earliest act. */
    const parent = parentIdOf(r.id);
    addToGroup(depGroups, parent, r, mass);
    addToGroup(repGroups, parent, r, mass);

    /* Injury stays per-patch for territorial ST / Brugada. */
    if (r.injuryCurrent !== 0 && r.activationTimeMs != null) {
      const repT = r.repolarizationTimeMs ?? r.activationTimeMs + r.actionPotentialDurationMs;
      sources[idx] += evalInjury(tMs, r.activationTimeMs, repT, r.injuryCurrent) * mass * injuryGain;
    }
  }

  emitCoalesced(atrGroups, sources, leadField, (g) => {
    if (g.act == null) return 0;
    return monophasicPulse(tMs, g.act, atrialKernel) * g.mass * atrialGain;
  });

  emitCoalesced(depGroups, sources, leadField, (g) => {
    if (g.act == null) return 0;
    return monophasicPulse(tMs, g.act, { ...DEP_WAVEFRONT, sigmaMs: depSigma }) * g.mass * ventDepGain;
  });

  const repSigma = REP_WAVEFRONT.sigmaMs * (1 + disp * 0.35);
  emitCoalesced(repGroups, sources, leadField, (g) => {
    if (g.rep == null) return 0;
    return monophasicPulse(tMs, g.rep, { ...REP_WAVEFRONT, sigmaMs: repSigma }) * g.mass * 0.7;
  });

  return leadField.project(sources);
}

function addToGroup(
  map: Map<string, WaveGroup>,
  key: string,
  r: CardiacRegion,
  mass: number,
): void {
  let g = map.get(key);
  if (!g) {
    g = { members: [], mass: 0, act: null, rep: null, repMass: 0 };
    map.set(key, g);
  }
  g.members.push(r);
  g.mass += mass;
  if (r.activationTimeMs != null) {
    g.act = g.act == null ? r.activationTimeMs : Math.min(g.act, r.activationTimeMs);
  }
  if (r.repolarizationTimeMs != null) {
    /* Mass-weighted mean repolarization — smoother T than min/max. */
    const prev = g.rep == null ? 0 : g.rep * g.repMass;
    g.repMass += mass;
    g.rep = (prev + r.repolarizationTimeMs * mass) / g.repMass;
  }
}

/** Deposit a group pulse onto member patches in mass proportion (shared clock). */
function emitCoalesced(
  groups: Map<string, WaveGroup>,
  sources: Float64Array,
  leadField: LeadField,
  ampOf: (g: WaveGroup) => number,
): void {
  for (const g of groups.values()) {
    const pulse = ampOf(g);
    if (pulse === 0 || g.mass <= 0) continue;
    for (const r of g.members) {
      const idx = leadField.index(r.id);
      if (idx < 0) continue;
      const m = r.electricalMass * r.viableFraction * (1 - r.scarFraction);
      if (m <= 0) continue;
      sources[idx] += pulse * (m / g.mass);
    }
  }
}

export { einthovenError } from '../projection/lead-field.ts';
