import { defineConstants } from './constants.ts';

/* The ECT station (part 1): the device, the stimulus through the head, and how its pulses reach the seizure model.

   The device's numbers come from its manual (Thymatron System IV Instructions for Use, Rev 21: specifications on its
   printed p. 25, the program tables in Addendum VII; stations/ect-programs.ts holds the tables). The current through the
   head comes from part 1's four-shell head by reciprocity (physiology/brain/ect-stimulus.ts). How a pulse excites the
   cortex rests on the field thresholds of Deng, Lisanby & Peterchev (from human motor thresholds), and how a train of
   pulses adds up on the short-term depression of synapses measured in human neocortex (Testa-Silva 2014). One constant
   is fitted: the drive of one pulse, to the seizure threshold measured with this device (van Waarde 2012). */

export const ECT = defineConstants('ect', {
  /* the device (manual, specifications) */
  current: { value: 0.9, unit: 'A', status: 'measured', refs: ['thymatron2021'], means: 'Stimulus current: constant, limited to 450 V.', derivation: 'Manual, specifications: 0.9 A constant current.' },
  maxDuration: { value: 8, unit: 's', status: 'measured', refs: ['thymatron2021'], means: 'Longest stimulus train.', derivation: 'Manual, specifications: 0.08 to 8.00 s.' },
  staticLow: { value: 100, unit: 'Ω', status: 'measured', refs: ['thymatron2021'], means: 'Static impedance below which the manual suspects a short circuit.', derivation: 'Manual, “Impedance test”: more than 100 and less than 3000 Ω before treating.' },
  staticHigh: { value: 3000, unit: 'Ω', status: 'measured', refs: ['thymatron2021'], means: 'Static impedance at and above which the display flashes 3000 and the warning tone before a stimulus lasts 3 s.', derivation: 'Manual, “Impedance test” and “Treatment stimulus administration”.' },
  baselineSeconds: { value: 8, unit: 's', status: 'measured', refs: ['thymatron2021'], means: 'Time the device collects the baseline EEG after the impedance test button is released, before READY.', derivation: 'Manual: READY appears after 6–10 s of baseline collection; the middle.' },
  warningTone: { value: 1, unit: 's', status: 'measured', refs: ['thymatron2021'], means: 'Continuous warning tone after the treatment button is pressed, before any current flows.', derivation: 'Manual, “Treatment stimulus administration”: 1 s (3 s if the impedance is over 3000 Ω).' },

  /* the electrodes */
  padArea: { value: 20.6, unit: 'cm²', status: 'measured', refs: ['unal2023'], means: 'Contact area of one adhesive stimulus pad.', derivation: 'Unal 2023: Thymapads 4.2 × 4.9 cm (20.6 cm²); modelled as a disc of the same area.' },

  /* the impedance the patient presents (measured with this device) */
  staticMean: { value: 1272, unit: 'Ω', status: 'measured', refs: ['exner2023'], means: 'Static impedance of a prepared head with adhesive pads, mean.', derivation: 'Exner 2023: Thymatron IV, bifrontal pads, 78 patients, 1757 sessions: 1272 ± 368 Ω (women 1467 ± 345, men 1078 ± 279).' },
  dynamicMean: { value: 242, unit: 'Ω', status: 'measured', refs: ['exner2023', 'unal2023'], means: 'Dynamic impedance during the stimulus (peak pulse voltage over the current), mean.', derivation: 'Exner 2023: 242 ± 31 Ω (women 262 ± 25, men 223 ± 24). Unal 2023: the drop from kilohms to a few hundred ohms depends on the current’s amplitude (the skin’s conductivity rises with the field in it), not on the waveform.' },
  staticSD: { value: 368, unit: 'Ω', status: 'measured', refs: ['exner2023'], means: 'Spread (SD) of the static impedance between sessions and patients.', derivation: 'Exner 2023: 1272 ± 368 Ω.' },
  dynamicSD: { value: 31, unit: 'Ω', status: 'measured', refs: ['exner2023'], means: 'Spread (SD) of the dynamic impedance.', derivation: 'Exner 2023: 242 ± 31 Ω.' },
  staticToDynamic: { value: 0.66, unit: 'SD per SD', status: 'measured', refs: ['exner2023'], means: 'How far the dynamic impedance follows the static one: the standardised slope.', derivation: 'Exner 2023: static impedance predicts dynamic with β = 0.66.' },
  unpreparedSkin: { value: 3.5, unit: 'times', status: 'assumed', refs: ['thymatron2021', 'unal2021'], means: 'How much higher the static impedance is when the skin was not cleaned and the pads not pressed on.',
    derivation: 'The manual names omitted skin preparation as the common cause of a static impedance over 3000 Ω; Unal 2021 found that halving the contact area raised it 1.5–2.7 times. No measurement of unprepared skin was found; 3.5 times takes a typical head (1272 Ω) over 3000 Ω, as the manual describes.' },

  /* how a pulse excites cortex */
  fieldThreshold03: { value: 0.35, unit: 'V/cm', status: 'derived', refs: ['deng2013', 'deng2011'], means: 'Electric field that excites cortical neurons with a 0.3 ms pulse.',
    derivation: 'Deng 2013 (and 2015): 1.4 times the field at the human TMS motor threshold (0.85 V/cm, range 0.3–1.3), carried to a 0.3 ms ECT pulse with a membrane time constant of 150 µs. Slice recordings give higher thresholds (Radman 2009: over 80–120 V/m at 0.5 ms in rat cortex), with cut axons; the human derivation is used.' },
  membraneTau: { value: 0.15, unit: 'ms', status: 'derived', refs: ['deng2011', 'peterchev2010'], means: 'Time constant of the axonal membrane that a brief pulse charges: the threshold field for a pulse of width w is E∞ / (1 − e^(−w/τ)).',
    derivation: 'Deng 2011 used 150 µs; Peterchev 2010 reviews chronaxies of 0.1–0.2 ms for transcranial stimulation, the axonal value.' },
  thresholdSpread: { value: 0.3, unit: 'ln units (SD)', status: 'assumed', refs: ['radman2009', 'deng2013'], means: 'Spread of the neurons’ thresholds around the field threshold: the share excited is a normal distribution of ln(E / threshold).',
    derivation: 'Radman 2009 found thresholds varying about two-fold between cell types (layer V/VI 28–72 V/m, layer II/III 70–104 V/m at 100 ms); Deng 2013: a 35 % higher threshold removes about 25 % of the activated volume. SD 0.3 of ln covers that range. At ECT currents most of the cortex is far above threshold, so the value matters little.' },

  /* how pulses add up: short-term synaptic depression in human neocortex */
  synapseRelease: { value: 0.45, unit: 'fraction', status: 'measured', refs: ['testasilva2014'], means: 'Share of the available synaptic resource a pulse releases (Tsodyks–Markram U).', derivation: 'Testa-Silva 2014: adult human layer 2/3 pyramidal connections, U 0.45 ± 0.03.' },
  synapseRecovery: { value: 0.144, unit: 's', status: 'measured', refs: ['testasilva2014'], means: 'Time constant of the synapses’ recovery from depression.', derivation: 'Testa-Silva 2014: 144 ± 13 ms in human cortex (three times faster than in mice), unchanged with age in adults.' },

  /* the recording's other channels */
  emgThreshold: { value: 50, unit: '1/s', status: 'derived', refs: ['gazdag2004'], means: 'Excess firing of the motor cortex (the left central region, for the cuffed right arm) above which the spinal motor neurons fire: the motor seizure.',
    derivation: 'Fitted once (scripts/fit-ect.mjs --emg, a scan) so that the device’s EMG endpoint is on average 0.755 of its EEG endpoint over six seeds (0.76 at 50/s), the ratio of the means Gazdag 2004 measured in the same seizures under etomidate (EMG 46.3 ± 23.8 s, EEG 61.3 ± 22.4 s): the reference adult, bitemporal, 30 % of the 0.5 ms program. Fragile (known gap 66): the ratio jumps (0.76 at 50/s, 0.64 at 51/s) because the model’s late clonic bursts stay as large as its early ones. Other series give 0.43–0.76 (propofol lower); Swedish guidance puts the EEG 10–20 s beyond the motor seizure (Gillving 2024).' },
  emgPerFiring: { value: 10, unit: 'µV per 1/s', status: 'assumed', means: 'Surface EMG of the cuffed arm per 1/s of motor cortical firing above that threshold.',
    derivation: 'Sets only the EMG trace’s size on paper (printed at 1000 µV/cm); the device’s EMG endpoint is relative to the EMG’s own baseline. Placed so that the tonic phase fills a channel at that gain.' },

  /* the heart (part 2): the stimulus's vagal discharge and the seizure's sympathetic drive */
  vagalBifrontal: { value: 0.069, unit: 'fraction', status: 'derived', refs: ['stewart2010'], means: 'Direct vagal discharge on the heart’s pacemakers while a bifrontal stimulus flows: the fraction by which it slows them (1 stops them).',
    derivation: 'Fitted once (scripts/fit-ect-heart.mjs vagal; the lab’s healthy adult without premedication, a 5 s stimulus, eight starting moments in the cycle) to Stewart 2010: from 85 /min before the stimulus, 78 /min during it (476 treatments, 114 patients; 1.5 times threshold): the model 0.937 of its rate before (target 0.918; beats are counted whole). Why placements differ so (bifrontal hardly at all) is not known; the field at deep structures does not explain it in this head, so the measured effect is used, not derived (known gap).' },
  vagalBitemporal: { value: 0.574, unit: 'fraction', status: 'derived', refs: ['stewart2010'], means: 'The same for a bitemporal stimulus (and, as no figure was found, for left anterior right temporal).',
    derivation: 'Fitted the same way to Stewart 2010: 85 to 46 /min; the model 0.521 of its rate before (target 0.541).' },
  vagalUnilateral: { value: 0.785, unit: 'fraction', status: 'derived', refs: ['stewart2010'], means: 'The same for a right unilateral stimulus with brief pulses (1.0 ms; taken for 0.5 ms and longer).',
    derivation: 'Fitted the same way to Stewart 2010: 86 to 26 /min; the model 0.292 (target 0.302).' },
  vagalUnilateralUltrabrief: { value: 0.587, unit: 'fraction', status: 'derived', refs: ['stewart2010'], means: 'The same for a right unilateral stimulus with ultrabrief pulses (0.3 ms; taken for under 0.5 ms). Its share of the brief value is applied to the other placements’ ultrabrief stimuli.',
    derivation: 'Fitted the same way to Stewart 2010: 86 to 43 /min; the model 0.500 (target 0.500).' },
  seizureSympathetic: { value: 0.0223, unit: 'drive units per 1/s', status: 'derived', refs: ['nagler2013'], means: 'Central sympathetic drive of a seizure per 1/s of its excess cortical firing (averaged over the regions), joining the body’s chemoreflex and adrenergic drive.',
    derivation: 'Fitted once (scripts/fit-ect-heart.mjs surge) so that the peak heart rate after the stimulus is 1.5 times the rate before it, as Nagler 2013 measured under etomidate with atropine 0.25 mg (90 ± 18 to 135 ± 20 /min): the reference session (bitemporal, 30 % of the 0.5 ms program), atropine 0.25 mg, model 76 to 114 /min. The drive follows the seizure’s firing through the sympathetic time constant (BARO.tauS); hormonal catecholamines (adrenaline 15-fold, noradrenaline 3-fold, Weinger 1991) are not modelled separately.' },

  /* the anaesthetic (PR C): the breathing, the oxygen, the relaxant */
  apnoeaAfterInduction: { value: 300, unit: 's', status: 'measured', refs: ['deng2026'], means: 'From the induction of anaesthesia to the return of spontaneous breathing.',
    derivation: 'Deng 2026 (Thymatron IV, propofol 1.5–2.0 mg/kg, succinylcholine 0.8–1.0 mg/kg once unconscious, facemask ventilation with 100 % oxygen): apnoea, from induction to spontaneous breathing, median 5 (IQR 4–6) min. The model stops the breathing drive at induction and gives it back after this time.' },
  relaxantOnset: { value: 60, unit: 's', status: 'assumed', refs: ['shen2026', 'parikh2017'], means: 'From succinylcholine to full relaxation of a limb it reaches.',
    derivation: 'No measured onset in ECT was found. Shen 2026 waited about a minute before the stimulus; Parikh 2017 until the fasciculations stopped. Used for the arm that the cuff did not protect.' },
  maskFiO2: { value: 1.0, unit: 'fraction', status: 'assumed', refs: ['deng2026'], means: 'Inspired oxygen fraction with the mask on and oxygen flowing.',
    derivation: 'Deng 2026 preoxygenated for 3 min with 100 % oxygen at 10 L/min by facemask and ventilated with 100 % oxygen. A tight mask is assumed, so the inspired fraction is taken as 1.' },
  bagRate: { value: 20, unit: '/min', status: 'assumed', refs: ['czerwonka2024', 'shen2025hv'], means: 'Rate of the breaths given by bag and mask from the relaxant until the stimulus and after it.',
    derivation: 'Czerwonka 2024: hyperventilate before the stimulus. No rate is given; the trials of hyperventilation targeted an end-tidal CO₂ of 18–35 mmHg (Shen 2025, 7 RCTs). 20/min with a standard bag breath is taken; the end-tidal CO₂ it gives is checked, not fitted.' },
  desaturation: { value: 92, unit: '%', status: 'measured', refs: ['deng2026'], means: 'SpO₂ at or below which the station counts a desaturation.',
    derivation: 'Deng 2026: oxygen desaturation defined as SpO₂ ≤ 92 %; 1 of 35 patients with facemask ventilation (2.9 %); the paper cites 2.5–29 % in earlier facemask series.' },

  /* the seizure threshold's fitted constant */
  pulseDrive: { value: 0.4506, unit: 'mV·s', status: 'derived', refs: ['vanwaarde2012'], means: 'Input to a region’s relay from one pulse when all its cortex is excited and the synapses are rested (the area of the pulse’s push).',
    derivation: 'Fitted once (scripts/fit-ect.mjs) so that a reference adult’s seizure threshold with bitemporal pads and the 0.5 ms program is 95.4 mC, the mean van Waarde 2012 measured with this device (bilateral 0.5 ms, 0.9 A, etomidate: 95.4 ± 59.5 mC). Their titration doubled the charge from step to step, so their thresholds lie above the true ones by up to a step; the fit takes the mean as it is.' },
});
