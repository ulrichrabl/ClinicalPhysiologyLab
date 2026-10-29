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
       after a shock has ended it (read by whoever draws the recurrence);
     - alteplase dissolves pulmonary emboli: the obstruction left falls by
       a measured fraction per hour while it acts (`lysed`, read by the
       lungs as a smaller embolic obstruction in every lobe).

   Calcium and potassium spread through the extracellular fluid; potassium chloride then moves on into the cells.
   Bupivacaine (a local anaesthetic gone into a vein) depresses both ventricles; lipid emulsion shortens its half-life.

   For ECT (part 2), the premedications at the heart: atropine and glycopyrrolate block its muscarinic receptors (the
   sinus node's vagal slowing and the direct vagal discharge of the stimulus), esmolol and labetalol its β1 receptors (the
   sympathetic rise in rate and contractility). Not modelled: atropine's paradoxical slowing at very low doses, labetalol's
   α-blockade (a seventh of its β effect intravenously).

   Not modelled: adrenaline's β effects (rate, contractility, β2
   vasodilation at low levels), its venoconstriction, its effect on the
   fibrillating myocardium's oxygen use; amiodarone's hypotension and
   bradycardia; alteplase's bleeding, and any lysis of a coronary clot. With no drug given every multiplier is exactly 1.
=========================================================================== */

export type DrugId = 'adrenaline' | 'amiodarone' | 'alteplase' | 'calcium' | 'insulin' | 'potassium' | 'bupivacaine' | 'lipid' | 'atropine' | 'glycopyrrolate' | 'esmolol' | 'labetalol';
export const DRUG_IDS: DrugId[] = ['adrenaline', 'amiodarone', 'alteplase', 'calcium', 'insulin', 'potassium', 'bupivacaine', 'lipid', 'atropine', 'glycopyrrolate', 'esmolol', 'labetalol'];

export class Drugs {
  /** mg given and not yet carried to the central circulation. */
  readonly vein: Record<DrugId, number> = { adrenaline: 0, amiodarone: 0, alteplase: 0, calcium: 0, insulin: 0, potassium: 0, bupivacaine: 0, lipid: 0, atropine: 0, glycopyrrolate: 0, esmolol: 0, labetalol: 0 };
  /** mg in the central circulation (calcium and potassium in mmol, insulin in units, lipid emulsion in mL). Potassium here
      is what is still in the extracellular fluid. Bupivacaine is held as its free (unbound) plasma concentration, mg/L,
      the measure its toxicity was measured by (Knudsen 1997); a poisoning gives it as such. */
  readonly central: Record<DrugId, number> = { adrenaline: 0, amiodarone: 0, alteplase: 0, calcium: 0, insulin: 0, potassium: 0, bupivacaine: 0, lipid: 0, atropine: 0, glycopyrrolate: 0, esmolol: 0, labetalol: 0 };
  /** mg given, in all. */
  readonly given: Record<DrugId, number> = { adrenaline: 0, amiodarone: 0, alteplase: 0, calcium: 0, insulin: 0, potassium: 0, bupivacaine: 0, lipid: 0, atropine: 0, glycopyrrolate: 0, esmolol: 0, labetalol: 0 };
  /** Potassium (mmol) that has reached the circulation, in all. */
  potassiumArrived = 0;
  /** Seconds since insulin (with its glucose) reached the circulation; NaN before. */
  insulinFor = NaN;
  /** Core temperature, °C: below 30 °C adrenaline is cleared more slowly and accumulates (ERC 2025). */
  temperature = 37;
  /** Fraction of the pulmonary embolic obstruction dissolved so far (0 with no alteplase given). */
  lysed = 0;

  give(drug: DrugId, mg: number): void {
    if (!(mg > 0)) throw new Error(`a dose of ${drug} must be positive, not ${mg}`);
    this.vein[drug] += mg;
    this.given[drug] += mg;
  }

  /** Advance by `seconds`. */
  step(seconds: number): void {
    const carried = 1 - Math.exp(-seconds / DRUGS.arrivalTau);
    for (const d of DRUG_IDS) {
      if (this.vein[d] > 0) { const x = this.vein[d] * carried; this.vein[d] -= x; this.central[d] += x; if (d === 'potassium') this.potassiumArrived += x; }
    }
    /* potassium given moves on into the cells, down to the part that stays in the extracellular fluid (Kruse 1990) */
    if (this.potassiumArrived > 0) {
      const stays = DRUGS.potassiumRetained * this.potassiumArrived;
      this.central.potassium = stays + (this.central.potassium - stays) * Math.exp(-seconds / DRUGS.potassiumTau);
    }
    const cold = this.temperature < 30 ? DRUGS.adrenalineColdSlowing : 1;
    if (this.central.adrenaline > 0) this.central.adrenaline *= Math.exp(-Math.LN2 / (DRUGS.adrenalineHalfLife * cold) * seconds);
    /* the obstruction left falls exponentially while the lytic acts: (1 − lysed) × e^(−k·a·t) */
    /* calcium leaves the extracellular fluid it spread into (DRUGS.calciumTau) */
    if (this.central.calcium > 0) this.central.calcium *= Math.exp(-seconds / DRUGS.calciumTau);
    if (this.central.insulin >= DRUGS.insulinDose * 0.5) this.insulinFor = Number.isFinite(this.insulinFor) ? this.insulinFor + seconds : 0;
    /* bupivacaine leaves the plasma with its context-sensitive half-life, shorter while lipid emulsion runs (Litonius 2012) */
    if (this.central.bupivacaine > 0) {
      const half = this.central.lipid + this.vein.lipid >= DRUGS.lipidBolus * 0.5 ? DRUGS.bupivacaineLipidHalfLife : DRUGS.bupivacaineHalfLife;
      this.central.bupivacaine *= Math.exp(-Math.LN2 / half * seconds);
    }
    /* the ECT premedications: the anticholinergics stay for the length of a session; esmolol is cleared in minutes, by red-cell
       esterases; labetalol over hours */
    for (const [d, half] of [['atropine', DRUGS.atropineHalfLife], ['glycopyrrolate', DRUGS.glycopyrrolateHalfLife], ['esmolol', DRUGS.esmololHalfLife], ['labetalol', DRUGS.labetalolHalfLife]] as const)
      if (this.central[d] > 0) this.central[d] *= Math.exp((-Math.LN2 / half) * seconds);
    const a = this.lytic();
    if (a > 0) this.lysed = 1 - (1 - this.lysed) * Math.exp(-DRUGS.lysisRate * a * seconds);
  }

  /** Total calcium added to the extracellular fluid by doses given, mmol/L, for an extracellular volume in litres. */
  calciumRise(ecfL: number): number { return this.central.calcium / Math.max(5, ecfL); }

  /** How far potassium chloride given has raised plasma potassium, mmol/L, for an extracellular volume in litres. */
  potassiumRise(ecfL: number): number { return this.central.potassium / Math.max(5, ecfL); }

  /** Free plasma bupivacaine, mg/L. */
  bupivacaine(): number { return this.central.bupivacaine; }

  /** What bupivacaine leaves of the ventricles' contractility, 0–1 (1 with none): a sodium-channel and calcium-handling
      depressant, here one sigmoid of the free level (DRUGS.bupivacaineHalfContractility, a placement). */
  cardiacDepression(): number { const c = this.central.bupivacaine; return c > 0 ? 1 / (1 + Math.pow(c / DRUGS.bupivacaineHalfContractility, DRUGS.bupivacaineHill)) : 1; }

  /** How far insulin with glucose has lowered plasma potassium by moving it into cells, mmol/L. */
  potassiumShift(): number { return Number.isFinite(this.insulinFor) ? DRUGS.insulinKFall * (1 - Math.exp(-this.insulinFor / DRUGS.insulinKTau)) : 0; }

  /** Alteplase's lytic activity, 0–1: full once a lytic dose has arrived, held for the length of a resuscitation. */
  lytic(): number { return Math.min(1, this.central.alteplase / DRUGS.alteplaseLyticDose); }

  /** Plasma adrenaline, ng/mL (mg/L × 1000). */
  adrenaline(): number { return this.central.adrenaline / DRUGS.adrenalineVolume * 1000; }

  /** Fraction of the heart's muscarinic receptors blocked, 0 without a drug: atropine and glycopyrrolate (in its
      equipotent atropine dose) as one exponential approach to full block (DRUGS.atropineBlockDose). */
  vagalBlock(): number {
    const eq = this.central.atropine + DRUGS.glycopyrrolatePotency * this.central.glycopyrrolate;
    return eq > 0 ? 1 - Math.exp(-eq / DRUGS.atropineBlockDose) : 0;
  }
  /** Fraction of the heart's β1-adrenergic receptors blocked, 0 without a drug: esmolol and labetalol (in its equipotent
      esmolol dose), mg/kg, on a hyperbola (DRUGS.esmololHalfBlock). */
  betaBlock(): number {
    const eq = (this.central.esmolol + DRUGS.labetalolPotency * this.central.labetalol) / this.weightKg;
    return eq > 0 ? eq / (eq + DRUGS.esmololHalfBlock) : 0;
  }
  /** Body weight (kg), for doses that act per kilogram; set by the host. */
  weightKg = 70;

  /** Systemic arteriolar resistance, × what it would be without adrenaline. */
  resistanceMult(): number { return 1 + DRUGS.adrenalineResistanceGain * Math.min(this.adrenaline(), DRUGS.adrenalineMeasuredRange); }

  /** Amiodarone's antiarrhythmic effect, 0–1. */
  amiodarone(): number { return Math.min(1, this.central.amiodarone / DRUGS.amiodaroneFullDose); }

  /** The chance that fibrillation comes back after a terminating shock, × what it would be without amiodarone. */
  recurrenceMult(): number { return 1 - DRUGS.amiodaroneRecurrenceCut * this.amiodarone(); }
}
