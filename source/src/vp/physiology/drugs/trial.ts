import { createCirculation } from '../../engine/circulation-host.ts';
import { healthyModel, type PatientModel } from '../state.ts';
import { Compressor } from '../cpr/compressions.ts';
import { CPR } from '../../evidence/cpr.ts';
import type { DrugId } from './drugs.ts';

/* ---------------------------------------------------------------------------
   One protocol for comparing drugs in an arrest with the human studies, used
   by the fit (scripts/fit-drugs.mjs) and the tests alike: a patient in VF,
   untreated for a while, then compressions at a steady rate, with doses at
   given times after compressions began. Returns what a catheter reads every
   second (the circulation's windows, 8 s each without a heartbeat) and the
   plasma level, so a study's own measure can be taken from it.
--------------------------------------------------------------------------- */

export interface DrugTrialRow { t: number; CPP: number; Psys: number; Pdia: number; CO: number; adrenaline: number }

export function drugTrial(o: {
  device: 'manual' | 'mechanical'; rate: number;
  /** Seconds of VF before compressions begin. */
  vfSeconds: number;
  /** Doses, at seconds after compressions began. */
  doses: Array<{ at: number; drug: DrugId; mg: number }>;
  /** Seconds of compressions in all. */
  cprSeconds: number;
  model?: PatientModel;
}): DrugTrialRow[] {
  const m = o.model ?? healthyModel();
  const run = createCirculation(m);
  run.settle(20);
  run.apply({ ...m, electrical: { ...m.electrical, ventricular: 'vf' } });
  run.advance(o.vfSeconds);
  const c = new Compressor(o.device === 'mechanical' ? CPR.itpMechanical : CPR.itpManual);
  c.steady(o.rate, run.sim.t);
  run.setCompressor(c);
  const doses = [...o.doses].sort((a, b) => a.at - b.at);
  const rows: DrugTrialRow[] = [];
  for (let t = 0; t < o.cprSeconds; t++) {
    while (doses.length && doses[0].at <= t) { const d = doses.shift()!; run.drugs.give(d.drug, d.mg); }
    run.advance(1);
    const mt = run.sim.metrics;
    rows.push({ t: t + 1, CPP: mt?.CPP ?? NaN, Psys: mt?.Psys ?? NaN, Pdia: mt?.Pdia ?? NaN, CO: mt?.CO ?? NaN, adrenaline: run.drugs.adrenaline() });
  }
  return rows;
}

/** Mean of a column over (from, to] seconds after compressions began. */
export function trialMean(rows: DrugTrialRow[], k: keyof DrugTrialRow, from: number, to: number): number {
  const xs = rows.filter((r) => r.t > from && r.t <= to).map((r) => r[k]);
  return xs.reduce((a, x) => a + x, 0) / xs.length;
}

/** The highest mean of a column over any `width` seconds within (from, to]. */
export function trialPeak(rows: DrugTrialRow[], k: keyof DrugTrialRow, from: number, to: number, width: number): number {
  let best = -Infinity;
  for (let s = from; s + width <= to; s++) best = Math.max(best, trialMean(rows, k, s, s + width));
  return best;
}

/* Paradis 1991's patients: prolonged CPR, several standard doses before the one measured (1 mg every 5 min, the ACLS of
   the time), the rise of coronary perfusion pressure from before a dose to its peak after. The model: 4 min of untreated
   VF, then manual compressions at 110/min; 1 mg at 6 and 11 min; the measured dose at 16 min. A dose's rise is the
   highest 30-s mean in the 5 min after it, less the mean over the minute before. The first dose (at 6 min, onto a
   circulation without adrenaline) is what the fit uses; the measured dose is Paradis's own protocol. */
export const PARADIS = { vfSeconds: 240, earlier: [360, 660], measuredAt: 960, cprSeconds: 960 + 300 };

export interface DoseRise { before: number; peak: number; rise: number; plasmaPeak: number }
const riseAfter = (rows: DrugTrialRow[], at: number): DoseRise => {
  const before = trialMean(rows, 'CPP', at - 60, at), peak = trialPeak(rows, 'CPP', at, at + 300, 30);
  return { before, peak, rise: peak - before, plasmaPeak: Math.max(...rows.filter((r) => r.t > at && r.t <= at + 300).map((r) => r.adrenaline)) };
};

/** The first standard dose only (the fit): the protocol up to 5 min after it. */
export function firstDoseRise(model?: PatientModel): DoseRise & { at150: number; rows: DrugTrialRow[] } {
  const at = PARADIS.earlier[0];
  const rows = drugTrial({ device: 'manual', rate: 110, vfSeconds: PARADIS.vfSeconds, cprSeconds: at + 300, model, doses: [{ at, drug: 'adrenaline', mg: 1 }] });
  return { ...riseAfter(rows, at), at150: rows.find((r) => r.t === at + 150)!.adrenaline, rows };
}

/** Paradis's protocol: the rise after the third dose, of `measuredMg`. */
export function paradisRise(measuredMg: number, model?: PatientModel): DoseRise & { rows: DrugTrialRow[] } {
  const rows = drugTrial({
    device: 'manual', rate: 110, vfSeconds: PARADIS.vfSeconds, cprSeconds: PARADIS.cprSeconds, model,
    doses: [...PARADIS.earlier.map((at) => ({ at, drug: 'adrenaline' as const, mg: 1 })), { at: PARADIS.measuredAt, drug: 'adrenaline', mg: measuredMg }],
  });
  return { ...riseAfter(rows, PARADIS.measuredAt), rows };
}
