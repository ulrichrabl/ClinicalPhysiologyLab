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
  emgThreshold: { value: 50, unit: '1/s', status: 'derived', refs: ['gazdag2004'], means: 'Excess firing of the motor cortex (the left central region, for the cuffed right foot) above which the spinal motor neurons fire: the motor seizure.',
    derivation: 'Fitted once (scripts/fit-ect.mjs --emg, a scan) so that the device’s EMG endpoint is on average 0.755 of its EEG endpoint over six seeds (0.76 at 50/s), the ratio of the means Gazdag 2004 measured in the same seizures under etomidate (EMG 46.3 ± 23.8 s, EEG 61.3 ± 22.4 s): the reference adult, bitemporal, 30 % of the 0.5 ms program. Fragile (known gap 66): the ratio jumps (0.76 at 50/s, 0.64 at 51/s) because the model’s late clonic bursts stay as large as its early ones. Other series give 0.43–0.76 (propofol lower); Swedish guidance puts the EEG 10–20 s beyond the motor seizure (Gillving 2024).' },
  emgPerFiring: { value: 10, unit: 'µV per 1/s', status: 'assumed', means: 'Surface EMG of the cuffed foot per 1/s of motor cortical firing above that threshold.',
    derivation: 'Sets only the EMG trace’s size on paper (printed at 1000 µV/cm); the device’s EMG endpoint is relative to the EMG’s own baseline. Placed so that the tonic phase fills a channel at that gain.' },
  restingHeartRate: { value: 75, unit: '/min', status: 'assumed', means: 'Heart rate on the ECG channel, constant in this part.',
    derivation: 'A placeholder: the vagal response to the stimulus and the seizure’s sympathetic surge come with the next part (ECT 2), from the circulation and autonomic models.' },

  /* the one fitted constant */
  pulseDrive: { value: 0.4506, unit: 'mV·s', status: 'derived', refs: ['vanwaarde2012'], means: 'Input to a region’s relay from one pulse when all its cortex is excited and the synapses are rested (the area of the pulse’s push).',
    derivation: 'Fitted once (scripts/fit-ect.mjs) so that a reference adult’s seizure threshold with bitemporal pads and the 0.5 ms program is 95.4 mC, the mean van Waarde 2012 measured with this device (bilateral 0.5 ms, 0.9 A, etomidate: 95.4 ± 59.5 mC). Their titration doubled the charge from step to step, so their thresholds lie above the true ones by up to a step; the fit takes the mean as it is.' },
});
