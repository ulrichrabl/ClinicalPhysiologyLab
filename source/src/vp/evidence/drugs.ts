import { defineConstants } from './constants.ts';

/* Constants of the drugs given in an arrest (ADR-018 step 4, decision 6d; physiology/drugs/drugs.ts).

   Adrenaline: how fast it leaves the blood is measured in people in arrest (Heradstveit 2023); how much blood it
   spreads into is derived from the plasma level measured after a standard dose (Wortsman 1993); how strongly it
   constricts the arterioles is fitted once, to the rise of coronary perfusion pressure after a standard dose
   (Paradis 1991, scripts/fit-drugs.mjs). The high dose, a fixed-rate compressor's pressures and the plasma peak are
   validations (scripts/arrest.test.mjs).

   Amiodarone: no human study measures what it does to a shock or to fibrillation coming back. Its one effect here is
   derived from a trial's average and labelled so; the trials' outcomes are a check, not a fit.

   Alteplase: how fast it dissolves pulmonary emboli is derived from serial angiograms in people (Dalla-Volta 1992,
   PAIMS 2); that a bolus in an arrest acts as the 2-h infusion did is an assumption. */

export const DRUGS = defineConstants('drugs', {
  arrivalTau: { value: 30, unit: 's', status: 'assumed', refs: ['heradstveit2023'],
    means: 'Time constant with which a dose given into a peripheral vein, with its flush, reaches the central circulation.',
    derivation: 'A placement: a peak within a minute or two of a peripheral dose. Heradstveit 2023 sampled jugular blood every minute after 1 mg and fitted a decline after the peak in 8 of 9 patients (the time of the peak is not in the abstract). Not tied to the flow the compressions make: the model’s flow in CPR is not validated, and when it carried the dose in (adrenaline lowering the very flow that brings it), the plasma level stood for minutes and never showed the measured decline. At a normal output the arm-to-tongue circulation time is 10–15 s (textbook), faster than this.' },
  adrenalineHalfLife: { value: 156, unit: 's', status: 'measured', refs: ['heradstveit2023'],
    means: 'Half-life of adrenaline in the blood during cardiopulmonary resuscitation.',
    derivation: 'Heradstveit 2023: 1 mg into a peripheral vein in 8 patients in arrest, jugular samples every minute; the decline after the peak gives a half-life of 2.6 min (95 % CI 1.9–4.4). In healthy people clearance is faster (Clutter 1980: 52–89 mL/min/kg); a patient whose circulation has returned keeps the arrest value here, which is not grounded.' },
  adrenalineVolume: { value: 6.38, unit: 'L', status: 'derived', refs: ['wortsman1993', 'heradstveit2023'],
    means: 'Volume of distribution of adrenaline during cardiopulmonary resuscitation.',
    derivation: 'Wortsman 1993: about 0.5 µmol/L (91.6 ng/mL at 183.2 g/mol) at the first sample, 2.5 min after a standard dose in patients in arrest. With the arrival time constant and the measured half-life, 1 mg spread in 6.38 L gives that level at 2.5 min (scripts/fit-drugs.mjs; the level scales as 1 / volume). About the blood volume, as expected when compressions move the blood too little to reach most tissue; in health the measured clearance and half-life imply some 20 L. Rests on the arrival placement: with a 60 s arrival it would be about 5 L.' },
  adrenalineResistanceGain: { value: 0.0301, unit: 'per ng/mL', status: 'derived', refs: ['paradis1991'],
    means: 'Rise of systemic arteriolar resistance per ng/mL of plasma adrenaline (α-adrenergic vasoconstriction), as a fraction of the resistance without it.',
    derivation: 'Fitted once (scripts/fit-drugs.mjs) to Paradis 1991’s rise of coronary perfusion pressure after a standard dose, 3.7 mmHg: the first 1 mg, 6 min into manual compressions after 4 min of untreated VF, raises the highest 30-s mean in the next 5 min 3.7 mmHg above the minute before (16.7 → 20.4); at its peak (115 ng/mL) the resistance is 4.5 times what it was. Paradis measured a dose given after several earlier ones; in the model a dose onto a circulation that already has adrenaline adds far less (the coronary perfusion pressure is near a ceiling: its arteries keep full reflex tone in an arrest, gap 20), so the fit uses the first dose, the one with room, and Paradis’s own protocol is a validation (and a known gap). Weakly determined: half the gain gives +2.9 mmHg, a quarter more +3.9; the rise cannot exceed about 4.5. Linear in the level, as Paradis’s two doses suggest (3.7 and 11.3 mmHg at 152 and 393 ng/mL), and held above the measured range. The same constriction acts in a beating heart, where no human measurement at these levels was found.' },
  adrenalineMeasuredRange: { value: 400, unit: 'ng/mL', status: 'measured', refs: ['paradis1991'],
    means: 'Highest plasma adrenaline at which its effect is grounded: above it the effect is held, not extrapolated.',
    derivation: 'Paradis 1991: the highest arterial adrenaline after a high dose (0.2 mg/kg) was 393 ± 289 ng/mL, the top of the range the fitted effect has been compared with.' },
  amiodaroneFullDose: { value: 300, unit: 'mg', status: 'assumed', refs: ['kudenchuk1999'],
    means: 'Amount of amiodarone that has arrived in the central circulation at which its antiarrhythmic effect is full; less acts in proportion.',
    derivation: 'The dose the trials gave and found an effect of (ARREST: 300 mg; ALPS: 300 mg, then 150 mg). Its terminal half-life is weeks, so over a resuscitation the effect is held once it has arrived. No dose–response in arrest was found: the guideline’s second dose of 150 mg adds nothing here.' },
  amiodaroneRecurrenceCut: { value: 0.13, unit: 'fraction', status: 'derived', refs: ['kudenchuk1999', 'vanalem2003'],
    means: 'Fraction by which a full dose of amiodarone lowers the chance that ventricular fibrillation comes back after a shock has ended it.',
    derivation: 'ARREST (Kudenchuk 1999) gave 4 ± 3 shocks with amiodarone against 6 ± 5 with placebo (not significant). If every return of VF takes its own shocks (each ending VF with the same chance), the number of shocks goes with the number of episodes, 1 / (1 − r) for a recurrence chance r: 6 / 4 = (1 − r′) / (1 − 0.79) gives r′ = 0.685, a cut of 1 − 0.685 / 0.79 = 0.13. It assumes the shocks counted were those after the drug, and ignores that resuscitation ends (whether the abstract’s counts are after the drug is not stated). Termination by a shock is left unchanged: no human data say amiodarone changes it. Its haemodynamic effects (ARREST: hypotension 59 % against 48 %, bradycardia 41 % against 25 %) are not modelled.' },
  alteplaseLyticDose: { value: 50, unit: 'mg', status: 'assumed',
    means: 'Amount of alteplase that has arrived in the central circulation at which its lytic effect on pulmonary emboli is full; less acts in proportion.',
    derivation: 'The dose given in an arrest from suspected pulmonary embolism (alteplase 50 mg as an IV bolus, the dose usually given; ERC 2025 says to consider immediate thrombolysis when pulmonary embolism is the suspected or confirmed cause, without fixing a dose). That 50 mg as a bolus lyses as fast as the 100 mg over 2 h whose effect was measured (PAIMS 2) is an assumption. The lytic is held for the length of a resuscitation: alteplase leaves the plasma within minutes, but lysis of the clot it has bound goes on; no measurement in an arrest was found.' },
  calciumTau: { value: 1800, unit: 's', status: 'assumed',
    means: 'Time constant with which calcium given IV leaves the extracellular fluid (and its membrane effect wanes).',
    derivation: 'A placement: its effect on the hyperkalaemic membrane is taught to last 30–60 min; no measurement in an arrest was found.' },
  insulinDose: { value: 10, unit: 'units', status: 'assumed', refs: ['lott2025'], means: 'The dose of soluble insulin (with 25 g glucose) the guideline gives for hyperkalaemia.', derivation: 'ERC 2025 Special circumstances: "Give 10 units soluble insulin and 25 g glucose IV for treatment of moderate and severe hyperkalaemia."' },
  insulinKFall: { value: 0.82, unit: 'mmol/L', status: 'derived', refs: ['harel2016'],
    means: 'The fall of plasma potassium that 10 units of insulin with glucose moves into cells, approached exponentially.',
    derivation: 'Harel 2016 (systematic review, 11 studies): a 10-unit bolus lowered potassium by 0.78 ± 0.25 mmol/L at 60 min. With the placement time constant below, 0.78 / (1 − e^(−60/20)) = 0.82.' },
  insulinKTau: { value: 1200, unit: 's', status: 'assumed', means: 'Time constant of insulin’s shift of potassium into cells.', derivation: 'A placement: its effect is taught to start within 15 min and peak at 30–60 min.' },
  lysisRate: { value: 1.83e-5, unit: '1/s', status: 'derived', refs: ['dallavolta1992'],
    means: 'Rate at which the pulmonary embolic obstruction left falls while alteplase acts (the obstruction falls as e^(−k·t)).',
    derivation: 'PAIMS 2 (Dalla-Volta 1992): in 20 people with angiographically proven pulmonary embolism, alteplase (10 mg bolus, 90 mg over 2 h) lowered the angiographic Miller index from 28.3 ± 2.9 to 24.8 ± 5.2 at 2 h; with heparin alone it did not change (25.3 to 25.2). ln(28.3 / 24.8) / 7200 s = 1.83 × 10⁻⁵ /s: the obstruction left falls by about 12 % in two hours, 2 % in twenty minutes. Taking the Miller index as proportional to the obstructed fraction of the pulmonary bed, and its fall as exponential, are assumptions. The same trial’s mean pulmonary artery pressure, 30.2 mmHg at a Miller index of 28.3 of 34 (83 %), is a validation (scripts/arrest.test.mjs).' },
});
