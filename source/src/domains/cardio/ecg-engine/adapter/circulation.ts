import type { MechanicalTrigger, SharedPhysiology } from '../types/index.ts';

/** Bidirectional circulation ↔ electrical coupling (spec §14). */
export interface CirculationSnapshot {
  Pra: number;
  Pla: number;
  Prv: number;
  Pv: number;
  Vra: number;
  Vla: number;
  Vrv: number;
  Vlv: number;
  Rpul: number;
  Rsys: number;
  Emax: number;
  EmaxRv: number;
}

export function snapshotToPhysiology(snap: CirculationSnapshot, timeMs: number): Partial<SharedPhysiology> {
  return {
    timeMs,
    mechanics: {
      leftAtrialPressure: snap.Pla,
      rightAtrialPressure: snap.Pra,
      leftVentricularPressure: snap.Pv,
      rightVentricularPressure: snap.Prv,
      leftAtrialVolume: snap.Vla,
      rightAtrialVolume: snap.Vra,
      leftVentricularVolume: snap.Vlv,
      rightVentricularVolume: snap.Vrv,
      pulmonaryVascularResistance: snap.Rpul,
      systemicVascularResistance: snap.Rsys,
      lvContractilityScale: 1,
      rvContractilityScale: 1,
    },
  };
}

export function triggersToActivation(triggers: MechanicalTrigger[]): {
  ventricular: number;
  atrial: number;
  lvScale: number;
  rvScale: number;
} {
  let ventricular = 0;
  let atrial = 0;
  let lvScale = 1;
  let rvScale = 1;
  for (const t of triggers) {
    if (t.chamber === 'LV' || t.chamber === 'RV') {
      ventricular = Math.max(ventricular, t.activationFraction * t.synchrony);
      if (t.chamber === 'LV') lvScale = t.contractilityScale;
      if (t.chamber === 'RV') rvScale = t.contractilityScale;
    }
    if (t.chamber === 'RA' || t.chamber === 'LA') {
      atrial = Math.max(atrial, t.activationFraction);
    }
  }
  return { ventricular, atrial, lvScale, rvScale };
}
