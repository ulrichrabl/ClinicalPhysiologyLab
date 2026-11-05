import { defineConstants } from './constants.ts';

/* The anaesthetic for ECT (ECT part 2b, second half): the drugs of the owner's hospital (propofol with esketamine,
   rocuronium reversed by sugammadex; succinylcholine as the alternative; flumazenil for a patient on a benzodiazepine;
   urapidil and lorazepam for complications), how they move through the body, and how they act on the seizure, the
   muscles and the waking patient.

   Where a published human model exists it is used as published (propofol: Schnider 1998/1999; rocuronium: Magorian
   1995's healthy controls and the adductor pollicis's effect model). One constant is fitted: how strongly the
   anticonvulsant load shortens the seizure, to Avramov 1995's crossover at 1.0 mg/kg of propofol; the other doses of
   that study, the ketofol trial and the flumazenil series check it. */

export const ANAES = defineConstants('ect-anaesthesia', {
  /* propofol, Schnider's model (V in L, Cl in L/min, at the reference age 53, weight 77, LBM 59, height 177) */
  propV1: { value: 4.27, unit: 'L', status: 'measured', refs: ['schnider1998'], means: 'Propofol: central volume (Schnider).', derivation: 'Schnider 1998: V1 4.27 L, fixed.' },
  propV2: { value: 18.9, unit: 'L', status: 'measured', refs: ['schnider1998'], means: 'Propofol: rapid peripheral volume at age 53 (falls 0.391 L a year).', derivation: 'Schnider 1998: V2 = 18.9 − 0.391 × (age − 53).' },
  propV3: { value: 238, unit: 'L', status: 'measured', refs: ['schnider1998'], means: 'Propofol: slow peripheral volume (Schnider).', derivation: 'Schnider 1998: V3 238 L, fixed.' },
  propCl1: { value: 1.89, unit: 'L/min', status: 'measured', refs: ['schnider1998'], means: 'Propofol: metabolic clearance at the reference covariates (+0.0456 per kg, −0.0681 per kg lean body mass, +0.0264 per cm).', derivation: 'Schnider 1998: Cl1 = 1.89 + 0.0456 (weight − 77) − 0.0681 (LBM − 59) + 0.0264 (height − 177).' },
  propCl2: { value: 1.29, unit: 'L/min', status: 'measured', refs: ['schnider1998'], means: 'Propofol: rapid intercompartmental clearance at age 53 (falls 0.024 L/min a year).', derivation: 'Schnider 1998: Cl2 = 1.29 − 0.024 (age − 53).' },
  propCl3: { value: 0.836, unit: 'L/min', status: 'measured', refs: ['schnider1998'], means: 'Propofol: slow intercompartmental clearance (Schnider).', derivation: 'Schnider 1998: Cl3 0.836 L/min.' },
  propKe0: { value: 0.456, unit: '1/min', status: 'measured', refs: ['schnider1999'], means: 'Propofol: plasma to effect-site rate constant (the EEG effect).', derivation: 'Schnider 1999: ke0 0.456 /min (time to peak effect 1.6 min).' },

  /* the anticonvulsant load on the seizure */
  loadTermination: { value: 0.22, unit: 'per mg/L', status: 'derived', refs: ['avramov1995'], means: 'How much faster the seizure is ended per mg/L of propofol at the effect site (or its equivalent in benzodiazepine): the thalamic relay’s activity-driven hyperpolarisation, which ends the seizure, grows by this fraction per unit.',
    derivation: 'Fitted once (scripts/fit-ect-anaesthesia.mjs) so that propofol 1.0 mg/kg, the stimulus 120 s after it, gives an EEG seizure 0.65 times as long as with no anticonvulsant load: Avramov 1995, a crossover in ten patients at a fixed bilateral stimulus, EEG seizure 50 ± 17 s with propofol 1.0 mg/kg against 77 ± 19 s with etomidate (whose duration did not depend on its dose). The seizure model’s reference is taken as etomidate’s: its threshold was fitted under etomidate (van Waarde 2012). The fit (seed 7, the stimulus 120 s after the dose): no load 72.1 s, 1.0 mg/kg 46.7 s (0.648). Checked, not fitted: 0.75 mg/kg 0.688 against Avramov’s 0.727; 1.5 mg/kg 0.584 against 0.429: the model’s dose–response is flatter than measured at the high dose (known gap 73).' },
  propofolThreshold: { value: 0, unit: 'per mg/L', status: 'measured', refs: ['scott2002'], means: 'How much propofol raises the seizure threshold: not at all at the doses used for ECT.',
    derivation: 'The median initial seizure threshold with propofol induction was the same as with methohexitone (75 mC, ranges 50–150 and 50–200) while the seizure was 25 % shorter (Scott & Boddy 2002, 13 patients with a course under each, Royal Edinburgh Hospital, bilateral, empirical titration). So the load acts on how the seizure ends, not on whether it starts.' },
  stimulusDelayAvramov: { value: 120, unit: 's', status: 'assumed', refs: ['avramov1995'], means: 'Time from the hypnotic to the stimulus in Avramov 1995, for the fit.',
    derivation: 'Not stated in the abstract: the induction, succinylcholine and its fasciculations took about two minutes in the trials of that time. A shorter delay would put more propofol at the effect site and fit a smaller constant.' },

  /* benzodiazepines and flumazenil */
  benzoLoad: { value: 1.14, unit: 'mg/L per mg/day', status: 'derived', refs: ['gistelinck2024'], means: 'Anticonvulsant load (in propofol-equivalent mg/L) of a patient taking lorazepam regularly, per mg a day.',
    derivation: 'Fitted so that, in the model’s standard treatment, reversing it with flumazenil lengthens the EEG seizure by 10.5 s, as Gistelinck 2024 measured (26 patients, 363 treatments, 263 with flumazenil) at an assumed 2.5 mg of lorazepam a day (the series reports no mean dose). The fit (seed 7, the hospital’s induction 240 s before the stimulus): 1.0 gives +9.0 s, 1.2 gives +11.2 s; 1.14 interpolated. The evidence conflicts: Krystal 1998 (35 patients) found no difference in seizure duration with flumazenil.' },
  benzoDoseAssumed: { value: 2.5, unit: 'mg/day', status: 'assumed', refs: ['gistelinck2024'], means: 'Lorazepam a day in the fit of the benzodiazepine load (and the station’s benzodiazepine patient).',
    derivation: 'A common inpatient dose; Gistelinck 2024 (abstract, Psychiatr Danub 2022) found no correlation between the benzodiazepine dose and the seizure duration after flumazenil.' },
  flumazenilFull: { value: 0.5, unit: 'mg', status: 'assumed', refs: ['krystal1998'], means: 'Flumazenil dose that reverses a regular benzodiazepine fully for the treatment; less reverses in proportion.',
    derivation: 'Krystal 1998 gave 0.4–1.0 mg just before the anaesthetic to 35 patients on benzodiazepines; Yang 2024 (MUSC) averaged 0.37 mg. The proportional reversal below 0.5 mg is an assumption.' },
  flumazenilAgitation: { value: 0.346, unit: 'probability per patient', status: 'measured', refs: ['gistelinck2024'], means: 'Chance of postictal agitation after flumazenil in a patient on benzodiazepines.',
    derivation: 'Gistelinck 2024: postictal agitation at least once in 34.6 % of the patients given flumazenil; managed with sedatives.' },

  /* esketamine */
  esketamineSeizure: { value: 0, unit: 'per mg/kg', status: 'measured', refs: ['kayhan2012'], means: 'Esketamine’s own effect on the seizure: none in the model.',
    derivation: 'Kayhan 2012 (crossover, 24 patients, 144 treatments): ketofol (propofol 0.5 + ketamine 0.5 mg/kg) gave EEG seizures of 41 ± 17 s against 38 ± 16 s with propofol 1 mg/kg, not different. The combination’s benefit is the smaller propofol dose it allows. Retrospective series find more (Gurel 2022: less shortening over the course with ketofol), so this is the conservative reading.' },
  esketaminePotency: { value: 1, unit: 'mg propofol per mg', status: 'assumed', refs: ['methfessel2023', 'sartorius2021'], means: 'How much propofol a mg of esketamine stands for in the depth of hypnosis, for when the patient wakes.',
    derivation: 'Methfessel 2023 (Göttingen) gave about 64 mg of propofol with 51 mg of esketamine in place of 89 mg of methohexital; the combination is used as roughly equal parts (Sartorius 2021). Taken as equipotent mg for mg, with propofol’s time course: an assumption, as the model has no ketamine pharmacokinetics. Esketamine’s sympathetic effects on the heart are not modelled.' },
  apnoeaDose: { value: 1.75, unit: 'mg/kg', status: 'measured', refs: ['deng2026'], means: 'Propofol dose of the series that fixes when breathing returns (Deng 2026: 1.5–2.0 mg/kg).',
    derivation: 'Deng 2026: propofol 1.5–2.0 mg/kg with succinylcholine, induction to spontaneous breathing 5 (4–6) min. The effect-site propofol that dose leaves at 300 s (about 3.5 mg/L in the station’s patient) is taken as the level below which the respiratory drive returns: before consciousness does (1.8 mg/L). Esketamine does not count toward the apnoea: ketamine leaves the breathing largely intact.' },
  wakeCe: { value: 1.8, unit: 'mg/L', status: 'measured', refs: ['iwakiri2005'], means: 'Propofol at the effect site at which consciousness returns (and, in the model, breathing, once the muscles allow it).',
    derivation: 'Iwakiri 2005: 20 adults, target-controlled propofol, three times each: effect-site concentration 2.0 ± 0.9 µg/mL at loss and 1.8 ± 0.7 at return of consciousness. Checked, not fitted: with succinylcholine and propofol 1.5–2.0 mg/kg, breathing back at 5 (4–6) min (Deng 2026).' },

  /* rocuronium: Magorian 1995's healthy controls (two compartments, per 70 kg), the adductor pollicis's effect model */
  rocV1: { value: 5.96, unit: 'L per 70 kg', status: 'measured', refs: ['magorian1995'], means: 'Rocuronium: central volume.', derivation: 'Magorian 1995, 10 healthy controls given 0.6 mg/kg: V1 5.96 ± 1.01 L.' },
  rocVss: { value: 16.4, unit: 'L per 70 kg', status: 'measured', refs: ['magorian1995'], means: 'Rocuronium: volume at steady state.', derivation: 'Magorian 1995: Vss 16.4 L (controls).' },
  rocCl: { value: 0.217, unit: 'L/min per 70 kg', status: 'measured', refs: ['magorian1995'], means: 'Rocuronium: plasma clearance.', derivation: 'Magorian 1995: 217 ± 21.8 mL/min.' },
  rocHalfLife: { value: 75.4, unit: 'min', status: 'measured', refs: ['magorian1995'], means: 'Rocuronium: elimination half-life, which fixes the intercompartmental clearance of the two-compartment model.', derivation: 'Magorian 1995: 75.4 min (controls).' },
  rocKe0: { value: 0.213, unit: '1/min', status: 'measured', refs: ['vega2016'], means: 'Rocuronium: plasma to effect-site rate constant at the adductor pollicis.', derivation: 'Equilibration half-time 3.25 (2.34–3.69) min at the adductor pollicis after 0.3 mg/kg under propofol (ln 2 / 3.25).' },
  rocCe50: { value: 1.24, unit: 'mg/L', status: 'measured', refs: ['vega2016'], means: 'Rocuronium: effect-site concentration for half depression of the first twitch at the adductor pollicis.', derivation: 'Ce50 1.24 (1.13–1.56) mg/L.' },
  rocHill: { value: 3.97, unit: '', status: 'measured', refs: ['vega2016'], means: 'Rocuronium: steepness of the concentration–effect curve.', derivation: 'Hill coefficient 3.97 (3.82–5.62).' },
  sugammadexRatio: { value: 3.57, unit: 'mg per mg rocuronium', status: 'measured', refs: ['bom2002'], means: 'Sugammadex that binds one mg of rocuronium: one molecule each (molar masses 2178 and 610 g/mol).', derivation: 'Sugammadex encapsulates rocuronium 1:1 with very high affinity (Bom 2002); the model binds it at once wherever it meets free rocuronium in the plasma.' },
  diaphragmT1: { value: 0.25, unit: 'fraction of control', status: 'assumed', refs: ['donati1990'], means: 'First twitch at the adductor pollicis above which the more resistant diaphragm breathes again.',
    derivation: 'The diaphragm needs about twice the blocking dose of the adductor pollicis and recovers sooner (Donati 1990, vecuronium); a quarter of the hand’s twitch is taken as the point where breathing can return. With succinylcholine this puts the first breath at about 6 min, at the upper end of Deng 2026’s 4–6 min.' },

  /* succinylcholine (the alternative) */
  suxRecovery90: { value: 654, unit: 's', status: 'measured', refs: ['lee2009'], means: 'Succinylcholine 1 mg/kg: from the dose to 90 % recovery of the first twitch.', derivation: 'Lee 2009: T1 to 90 % 10.9 ± 2.4 min after succinylcholine 1 mg/kg.' },
  suxRecoveryFrom: { value: 240, unit: 's', status: 'assumed', refs: ['lee2009'], means: 'Succinylcholine: when the first twitch starts to come back; it rises in a straight line from there to 90 %.', derivation: 'Placed so that breathing returns within Deng 2026’s 4–6 min; the shape of the recovery is not taken from a source.' },

  /* the train of four */
  tofRatioPower: { value: 3, unit: '', status: 'assumed', means: 'TOF ratio as the first twitch to this power: 0.9 needs the first twitch back to about 96 %.',
    derivation: 'With a non-depolarising relaxant the fourth twitch fades more than the first, so the ratio lags: a ratio of 0.9 comes only with the first twitch near control. The power is an assumption that gives that.' },

});
