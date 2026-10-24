import { defineConstants } from './constants.ts';

/* Constants of the heart in an arrest (ADR-018 step 3; physiology/heart/arrest.ts and the shock in scenario/run.ts).

   What human data measure directly is used as measured: how often a biphasic shock ends VF, how often VF comes back and
   when. What they do not measure (the time course of the myocardium's state, how compressions restore it, and how that
   state sets the rhythm after a shock) rests on placements, each said to be one, and on one derivation from a trial's
   averages. They are checked against outcomes not used to set them (scripts/arrest.test.mjs). */

export const ARREST = defineConstants('arrest', {
  shockTermination: { value: 0.868, unit: 'probability', status: 'measured', refs: ['stiell2007'],
    means: 'Chance that a 150 J biphasic shock ends ventricular fibrillation (no VF 5 s after it).',
    derivation: 'Stiell 2007 (BIPHASIC): first-shock termination 86.8 % with fixed 150 J (88.8 % with 200 J). Hess 2008 and 2011 (150 J and rectilinear biphasic) found 92 and 88 %, Koster 2008 92 %. Human data show termination hardly falling with the duration of VF at these energies, so it does not depend on the myocardium’s state here. Later shocks terminate somewhat less often (Hess 2011: 84 %); not modelled.' },
  organisedExponent: { value: 0.39, unit: '', status: 'derived', refs: ['stiell2007', 'conover2014'],
    means: 'Shape of the chance that a terminating shock is followed by an organised rhythm rather than asystole: M^k (1 for a fresh heart).',
    derivation: 'A fresh heart (VF induced and shocked within seconds) takes up an organised rhythm; Stiell 2007 found conversion to an organised rhythm in 38.4 % of first shocks against 86.8 % terminated: 44 % of terminations (Conover 2014: 53 % over all shocks). Taken to be at the state of a heart after 10 min of VF without compressions, M = e^(−600/280) = 0.117 (an assumption: the trials’ collapse-to-shock times are not in their abstracts; ORCA’s call-to-shock was 8.9 min): k = ln 0.44 / ln 0.117 = 0.39. No human study was found that relates the rhythm after a shock to the duration of VF directly.' },
  depletionTau: { value: 280, unit: 's', status: 'assumed', refs: ['weisfeldt2002'],
    means: 'Time constant with which the myocardium’s state falls in VF or asystole without coronary flow.',
    derivation: 'Placed so that after about 10 min without compressions an organised rhythm no longer makes a pulse: the end of the “circulatory phase” of Weisfeldt & Becker’s three-phase model (electrical 0–4, circulatory 4–10 min; read as quoted by Wik 2003, the original not read; its boundaries rest largely on animal studies). The model’s circulation loses a palpable pulse below about 12 % of normal contractility (systolic about 45 mmHg), so M(600 s) = 0.12: τ = 600 / ln(1/0.12) = 283 s.' },
  recoveryTau: { value: 280, unit: 's', status: 'assumed',
    means: 'Time constant with which the myocardium’s state recovers under full coronary flow.',
    derivation: 'A placement, taken equal to the depletion time constant. Validated, not fitted, by whether three minutes of compressions before a late shock turn its organised rhythm from pulseless into perfusing (Wik 2003, Cobb 1999).' },
  cppNoFlow: { value: 0, unit: 'mmHg', status: 'derived', refs: ['paradis1990'],
    means: 'Coronary perfusion pressure at or below which the myocardium gets no flow.',
    derivation: 'Paradis 1990: no patient whose initial coronary perfusion pressure was below 0 regained a circulation.' },
  cppFullFlow: { value: 65, unit: 'mmHg', status: 'assumed',
    means: 'Coronary perfusion pressure at which the myocardium is fully supplied: that of a normal beating heart in diastole.',
    derivation: 'Normal diastolic aortic pressure (about 70 mmHg) less right atrial pressure (about 5); supply rises linearly between 0 and this. Linear coronary pressure–flow with a zero-flow pressure near 0 is a simplification (in arrest the zero-flow pressure may be higher).' },
  normalCaO2: { value: 20, unit: 'mL/dL', status: 'assumed', means: 'Arterial oxygen content of a healthy adult breathing air.', derivation: 'Hb 15 g/dL × 1.34 × 0.98 + dissolved: about 20 mL/dL (textbook).' },
  criticalCaO2: { value: 10, unit: 'mL/dL', status: 'assumed',
    means: 'Arterial oxygen content below which the myocardium’s oxygen supply falls short in proportion, whatever the coronary flow.',
    derivation: 'A placement: the coronary flow can rise to make up for a lower oxygen content (anaemia, moderate hypoxaemia) up to its reserve; taken as half the normal content, so that anaemia (Hb 8: about 11 mL/dL) does not starve the heart and severe hypoxaemia (saturation below about 50 % at a normal haemoglobin) does. Not measured.' },
  standstillM: { value: 0.05, unit: 'state', status: 'ungrounded',
    means: 'Myocardial state below which an organised heart stops (asystole); it starts again above twice this.',
    derivation: 'A placement: PEA from hypoxia, hypovolaemia or obstruction ends in asystole in people (ERC: bradycardia, then PEA, then asystole in hypoxic arrest), without a measured threshold.' },
  demandPerDegree: { value: 0.065, unit: 'per °C', status: 'measured', refs: ['lott2025'],
    means: 'Fall of the myocardium’s (and the body’s) oxygen demand per °C of cooling below 37 °C.',
    derivation: 'ERC 2025 Special circumstances: "Hypothermia diminishes the oxygen demand of the body (6–7 % per 1 °C cooling)." The middle, 6.5 %; held at 20 % of normal at the least. Applied to the myocardium’s state: it runs down and recovers against what a cold heart needs.' },
  coldShockTemperature: { value: 30, unit: '°C', status: 'measured', refs: ['lott2025'],
    means: 'Core temperature below which a shock rarely ends ventricular fibrillation.',
    derivation: 'ERC 2025: "Delay further defibrillation attempts if ventricular fibrillation (VF) persists after three shocks until core temperature is > 30 °C"; "Hypothermic cardiac arrest is often refractory to defibrillation and adrenaline."' },
  coldShockFactor: { value: 0.3, unit: 'fraction', status: 'ungrounded',
    means: 'Chance that a shock ends VF below the cold threshold, as a fraction of the normal chance.',
    derivation: 'A placement for "often refractory" (ERC 2025); defibrillation has succeeded above 24 °C. No rate was found.' },
  contractilityFloor: { value: 0, unit: 'fraction', status: 'assumed',
    means: 'Contractility of an organised heart whose state has run down to 0, as a fraction of its own.',
    derivation: 'A placement: contractility follows the state linearly from 0. Post-arrest myocardial stunning (days) is not this variable; it comes later (ADR-018 decision 6e).' },
  vfFineScale: { value: 0.2, unit: 'fraction', status: 'assumed', refs: ['weaver1985'],
    means: 'Amplitude of the fibrillation of an exhausted myocardium, as a fraction of fresh VF.',
    derivation: 'Weaver 1985 called VF of 0.2 mV or less “fine” (17 % of 394 patients at the crew’s arrival, mean 0.55 ± 0.25 mV); the model’s fresh VF is about 0.55 mV peak to peak on lead II, and its exhausted VF a fifth of that, about 0.1 mV. Amplitude falls with time in people (Weaver; Waalewijn 2002), but no slope in mV per minute was found.' },
  refibrillationChance: { value: 0.79, unit: 'probability', status: 'measured', refs: ['vanalem2003'],
    means: 'Chance that VF comes back after a shock has ended it.',
    derivation: 'van Alem 2003: VF recurred in 79 % of 322 patients after successful defibrillation (median 2 episodes), independently of the time to defibrillation. Other cohorts found 61–80 % (White 2002, Hess 2008 and 2011); Koster 2008 48 % within 2 min. Drawn after every terminating shock.' },
  refibrillationMedian: { value: 45, unit: 's', status: 'measured', refs: ['vanalem2003'],
    means: 'Median time from the terminating shock to VF coming back, in those in whom it does.',
    derivation: 'van Alem 2003: median 45 s (interquartile range 23–115 s). Drawn from an exponential distribution with this median (its interquartile range would be 19–90 s): the shape is an assumption.' },
});
