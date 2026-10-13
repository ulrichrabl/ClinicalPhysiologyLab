import { defineConstants } from './constants.ts';

/* Constants of infection, inflammation and sepsis (physiology/body/body.ts and the vascular coupling in
   engine/circulation-host.ts).

   The model's inflammatory signal IL is abstract: 1 is the response to a systemic infection, and severity
   (organ dysfunction) runs from 0 at IL 0.8 to 1 at IL 2.0. Full severity is meant to be septic shock as
   Sepsis-3 defines it: hypotension needing a vasopressor after fluid, with a lactate above 2. */

export const INF = defineConstants('inflammation', {
  /* --- the inflammatory signal and the severity scale --------------------- */
  ilGain: { value: 2.2, unit: '× systemic response', status: 'ungrounded', means: 'Inflammatory signal at an overwhelming infection (infection 1).' },
  ilExponent: { value: 1.5, unit: '', status: 'ungrounded', means: 'Steepness of the signal with the extent of infection: IL = gain·infection^k.' },
  ilTau: { value: 4, unit: 'h', status: 'ungrounded', means: 'Time constant of the inflammatory signal.' },
  sepsisOnset: { value: 0.8, unit: 'IL', status: 'assumed', refs: ['singer2016'], means: 'Inflammatory signal at which organ dysfunction (sepsis) begins.',
    derivation: 'A definition of the model’s scale: a local infection (infection 0.3, IL 0.36) and a systemic one without organ failure (0.6, IL 1.0) stay below or just above it, as Sepsis-3 separates infection from sepsis by organ dysfunction.' },
  sepsisSpan: { value: 1.2, unit: 'IL', status: 'assumed', refs: ['singer2016'], means: 'Rise in the signal over which sepsis goes from its onset to full severity (septic shock).',
    derivation: 'A definition of the scale: full severity (IL 2.0) is reached at infection 0.9, the setting the septic shock case uses.' },
  /* --- fever -------------------------------------------------------------- */
  tempBase: { value: 36.9, unit: '°C', status: 'derived', refs: ['mackowiak1992'], means: 'Normal body temperature.',
    derivation: 'Mackowiak measured a mean oral temperature of 36.8 °C in healthy adults; core runs a few tenths higher: 36.9.' },
  feverMax: { value: 2.6, unit: '°C', status: 'assumed', means: 'Largest rise of the hypothalamic set point that inflammation produces.',
    derivation: 'Bacterial sepsis seldom drives the temperature beyond 39.5–40 °C; 36.9 + 2.6 = 39.5.' },
  feverHalf: { value: 0.6, unit: 'IL', status: 'ungrounded', means: 'Signal at which half of the maximal fever is reached.' },
  shockHypothermia: { value: 2.2, unit: '°C', status: 'ungrounded', means: 'Fall in temperature in refractory septic shock (heat production fails with perfusion).' },
  hypothermiaMap: { value: 65, unit: 'mmHg', status: 'assumed', refs: ['singer2016'], means: 'Mean pressure below which septic shock begins to lower the temperature.',
    derivation: 'The Sepsis-3 threshold for septic shock.' },
  hypothermiaSpan: { value: 20, unit: 'mmHg', status: 'ungrounded', means: 'Fall in pressure below that threshold over which the full hypothermia develops.' },
  tempTau: { value: 1.5, unit: 'h', status: 'ungrounded', means: 'Time constant of body temperature.' },
  /* --- acute-phase response ------------------------------------------------ */
  crpClearance: { value: 0.0365, unit: '/h', status: 'derived', refs: ['vigushin1993'], means: 'Fractional clearance of C-reactive protein.',
    derivation: 'Radio-iodinated CRP is cleared with a 19 h half-life, the same in health and in infection, arthritis, lupus and cancer (Vigushin): ln 2 / 19 = 0.0365 /h. The plasma level is therefore set by synthesis alone.' },
  crpBasal: { value: 0.11, unit: 'mg/L/h', status: 'assumed', refs: ['vigushin1993'], means: 'Basal CRP synthesis.',
    derivation: 'With Vigushin’s clearance it sets the healthy steady state at 0.11/0.0365 = 3 mg/L, within what laboratories report as normal (below 5).' },
  crpSynthesis: { value: 8, unit: 'mg/L/h per IL', status: 'ungrounded', means: 'CRP synthesis per unit of inflammatory signal.' },
  wccBase: { value: 7, unit: '×10⁹/L', status: 'assumed', means: 'Normal white cell count.', derivation: 'Mid-range of the usual 4–11 ×10⁹/L reference interval.' },
  wccRise: { value: 13, unit: '×10⁹/L', status: 'ungrounded', means: 'Largest rise of the white cell count with inflammation (demargination and marrow release).' },
  wccHalf: { value: 0.5, unit: 'IL', status: 'ungrounded', means: 'Signal at which half of that rise is reached.' },
  wccCollapse: { value: 12, unit: '×10⁹/L per unit severity', status: 'ungrounded', means: 'Fall of the white cell count in overwhelming sepsis (consumption, marrow failure).' },
  wccCollapseOnset: { value: 0.7, unit: 'severity', status: 'ungrounded', means: 'Severity beyond which the white cell count falls.' },
  wccTau: { value: 8, unit: 'h', status: 'ungrounded', means: 'Time constant of the white cell count.' },
  plateletBase: { value: 250, unit: '×10⁹/L', status: 'assumed', means: 'Normal platelet count.', derivation: 'Mid-range of the usual 150–400 ×10⁹/L reference interval.' },
  plateletSepticLoss: { value: 0.5, unit: 'fraction', status: 'ungrounded', means: 'Platelets consumed at full sepsis severity.' },
  plateletTau: { value: 24, unit: 'h', status: 'ungrounded', means: 'Time constant of the platelet count.' },
  albuminSepticLoss: { value: 0.45, unit: 'fraction', status: 'ungrounded', means: 'Plasma albumin lost at full severity (leak into the tissues, less synthesis).' },
  albuminInflammationLoss: { value: 0.1, unit: 'fraction', status: 'ungrounded', means: 'Plasma albumin lost to inflammation itself (a negative acute-phase protein).' },
  albuminSepticTau: { value: 30, unit: 'h', status: 'derived', refs: ['fleck1985'], means: 'Time constant of plasma albumin while septic.',
    derivation: 'Albumin normally escapes the plasma at 5 %/h, ten times its synthesis, and more than 300 % faster in septic shock (Fleck): the plasma level falls over a day or two, not over the weeks set by synthesis (half-life about 20 days). 30 h is an assumption within that.' },
  inrSepsis: { value: 0.4, unit: 'INR', status: 'ungrounded', means: 'Rise in INR at full severity (consumptive coagulopathy).' },
  lactateSepsis: { value: 0.5, unit: 'mmol/h per kg', status: 'ungrounded', means: 'Extra lactate production at full severity (adrenaline-driven glycolysis, the microcirculation).' },
  /* --- the circulation in sepsis -------------------------------------------- */
  vasoplegiaExponent: { value: 1.3, unit: '', status: 'ungrounded', means: 'Vasoplegia against severity: severity^k (little in mild sepsis, most in shock).' },
  resistanceLoss: { value: 0.72, unit: 'fraction', status: 'derived', refs: ['suffredini1989', 'parker1987'], means: 'Arteriolar resistance lost to nitric oxide and other mediators at full severity, before reflex compensation.',
    derivation: 'Calibrated on the coupled model, with its baroreflex, renin and vasopressin all answering, so that full severity holds systemic vascular resistance at about half of normal after 30 mL/kg of saline: endotoxin alone lowered the SVR index 46 % in healthy volunteers (Suffredini), and in septic shock an SVRI below 1529 dyn·s·cm⁻⁵·m², about 0.7 of normal, marked those who died, 82 % of early deaths from low resistance (Parker 1987). 0.72 gives 52 %. The resistance falls steeply with this constant (0.6 gave 64 %, 0.75 gave 48 %), because the vasoplegia also blunts the reflex that would restore it.' },
  venousCapacity: { value: 0.2, unit: 'fraction', status: 'ungrounded', means: 'Rise in venous unstressed volume at full severity (venodilatation pools blood).' },
  reflexResistanceLoss: { value: 0.7, unit: 'fraction', status: 'ungrounded', means: 'Arteriolar response to sympathetic drive lost at full severity (vascular hyporeactivity).' },
  reflexVenousLoss: { value: 0.6, unit: 'fraction', status: 'ungrounded', means: 'Venous response to sympathetic drive lost at full severity.' },
  myocardialDepression: { value: 0.2, unit: 'fraction', status: 'assumed', refs: ['suffredini1989', 'parker1984'], means: 'Left ventricular contractility lost at full severity.',
    derivation: 'Endotoxin lowered the peak-systolic-pressure/end-systolic-volume ratio in healthy volunteers (Suffredini) and septic shock survivors start with an ejection fraction of 0.32 that recovers over 10 days (Parker 1984): the depression is real and reversible; its size here is an assumption.' },
  /* --- breathing and the brain ------------------------------------------------ */
  ventilationSepsis: { value: 1.0, unit: 'drive', status: 'ungrounded', means: 'Ventilatory drive added at full severity.' },
  ventilationIl: { value: 0.25, unit: 'drive', status: 'ungrounded', means: 'Ventilatory drive added by the inflammatory signal itself.' },
  ventilationFever: { value: 0.08, unit: 'drive per °C', status: 'ungrounded', means: 'Ventilatory drive added per °C of fever above 37.5.' },
  encephalopathyIl: { value: 0.5, unit: 'grade', status: 'ungrounded', means: 'Encephalopathy from the inflammatory signal when the liver is failing.' },
  encephalopathyIlLiverOk: { value: 0.2, unit: '× ', status: 'ungrounded', means: 'Share of that encephalopathy when the liver is working.' },
  encephalopathySepsis: { value: 0.8, unit: 'grade', status: 'ungrounded', means: 'Septic encephalopathy at full severity.' },
});
