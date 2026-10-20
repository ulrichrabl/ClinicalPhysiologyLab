import { DRUGS } from '../../evidence/drugs.ts';

/* ===========================================================================
   Drugs given in an arrest (ADR-018 step 4, decision 6d).

   A dose goes into a vein and reaches the central circulation within a
   minute or so (with its flush). From there adrenaline leaves with its measured half-life;
   amiodarone, whose half-life is weeks, stays for the length of a
   resuscitation.

   They act through inputs the models already have:
     - adrenaline constricts the arterioles (α): the systemic resistance,
       in proportion to its plasma level, up to the highest level at which
       its effect was measured;
     - amiodarone makes ventricular fibrillation less likely to come back
       after a shock has ended it (read by whoever draws the recurrence).

   Not modelled: adrenaline's β effects (rate, contractility, β2
   vasodilation at low levels), its venoconstriction, its effect on the
   fibrillating myocardium's oxygen use; amiodarone's hypotension and
   bradycardia. With no drug given every multiplier is exactly 1.
=========================================================================== */

export type DrugId = 'adrenaline' | 'amiodarone';
export const DRUG_IDS: DrugId[] = ['adrenaline', 'amiodarone'];

export class Drugs {
  /** mg given and not yet carried to the central circulation. */
  readonly vein: Record<DrugId, number> = { adrenaline: 0, amiodarone: 0 };
  /** mg in the central circulation. */
  readonly central: Record<DrugId, number> = { adrenaline: 0, amiodarone: 0 };
  /** mg given, in all. */
  readonly given: Record<DrugId, number> = { adrenaline: 0, amiodarone: 0 };

  give(drug: DrugId, mg: number): void {
    if (!(mg > 0)) throw new Error(`a dose of ${drug} must be positive, not ${mg}`);
    this.vein[drug] += mg;
    this.given[drug] += mg;
  }

  /** Advance by `seconds`. */
  step(seconds: number): void {
    const carried = 1 - Math.exp(-seconds / DRUGS.arrivalTau);
    for (const d of DRUG_IDS) {
      if (this.vein[d] > 0) { const x = this.vein[d] * carried; this.vein[d] -= x; this.central[d] += x; }
    }
    if (this.central.adrenaline > 0) this.central.adrenaline *= Math.exp(-Math.LN2 / DRUGS.adrenalineHalfLife * seconds);
  }

  /** Plasma adrenaline, ng/mL (mg/L × 1000). */
  adrenaline(): number { return this.central.adrenaline / DRUGS.adrenalineVolume * 1000; }

  /** Systemic arteriolar resistance, × what it would be without adrenaline. */
  resistanceMult(): number { return 1 + DRUGS.adrenalineResistanceGain * Math.min(this.adrenaline(), DRUGS.adrenalineMeasuredRange); }

  /** Amiodarone's antiarrhythmic effect, 0–1. */
  amiodarone(): number { return Math.min(1, this.central.amiodarone / DRUGS.amiodaroneFullDose); }

  /** The chance that fibrillation comes back after a terminating shock, × what it would be without amiodarone. */
  recurrenceMult(): number { return 1 - DRUGS.amiodaroneRecurrenceCut * this.amiodarone(); }
}
