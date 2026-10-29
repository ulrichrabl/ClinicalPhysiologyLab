import { defineConstants } from './constants.ts';

/* The head as a volume conductor, and the strength of the cortex as a source (measurements/eeg-forward.ts, the EEG
   station). The head is four concentric spheres: brain, cerebrospinal fluid, skull and scalp, each of one conductivity.
   That is the classic model of EEG source analysis: it gets right what the station teaches (how far the skull smears a
   field, why a radial source and a tangential one look different, why a small or deep source is not seen), and it can
   be solved exactly. A real head is not a sphere (the 10-20 electrodes lie up to 10 mm off the best sphere), its skull
   is thinner at the temples and has holes; the station says so. */

export const EEG = defineConstants('eeg', {
  headRadius: { value: 95.6, unit: 'mm', status: 'derived', refs: ['oostenveld2001'],
    means: 'Radius of the scalp sphere the electrodes sit on.',
    derivation: 'Least-squares sphere through the 19 electrodes of the 10-20 system in the standard template (standard_1020, built on the MNI head by Oostenveld after the 2001 system): 95.6 mm, the electrodes lying within ±10 mm of it. The template head is an average of adults, somewhat larger than a median head.' },
  scalpThickness: { value: 6, unit: 'mm', status: 'assumed', refs: ['saindane2013'],
    means: 'Thickness of the scalp (skin and the soft tissue over the skull).',
    derivation: 'No normative adult series was found. Saindane 2013 measured 6.4 mm in adults without raised intracranial pressure (not a normative cohort); 6 mm is also the value common in four-shell models.' },
  skullThickness: { value: 6, unit: 'mm', status: 'measured', refs: ['antonakakis2020'],
    means: 'Thickness of the skull.', derivation: 'Antonakakis 2020: 5.97 ± 1.19 mm on MRI in 20 adults.' },
  csfThickness: { value: 2, unit: 'mm', status: 'assumed',
    means: 'Thickness of the cerebrospinal fluid between the brain’s surface and the skull, over the convexity.',
    derivation: 'No normative measurement was found. Spherical models use 1–3 mm; it is thicker in the old and over atrophied cortex. A placement, inside that range.' },
  sigmaScalp: { value: 0.41, unit: 'S/m', status: 'measured', refs: ['mccann2019'],
    means: 'Electrical conductivity of the scalp.', derivation: 'McCann 2019, weighted mean of reported values: 0.41 ± 0.18 S/m.' },
  sigmaSkull: { value: 0.02, unit: 'S/m', status: 'measured', refs: ['mccann2019', 'oostendorp2000', 'lai2005', 'goncalves2003', 'rush1968'],
    means: 'Electrical conductivity of the skull, whole (the three layers together).',
    derivation: 'McCann 2019, weighted mean: 0.02 ± 0.02 S/m. With the brain’s 0.33 S/m this is a brain-to-skull ratio of 16.5. The ratio is the most disputed number in EEG modelling: 80 classically (Rush & Driscoll 1968), 15 (Oostendorp 2000), 18–34 in living people (Lai 2005), 20–50 (Gonçalves 2003). The station lets the learner choose among them.' },
  sigmaCsf: { value: 1.79, unit: 'S/m', status: 'measured', refs: ['baumann1997'],
    means: 'Electrical conductivity of the cerebrospinal fluid.', derivation: 'Baumann 1997: 1.79 S/m at 37 °C.' },
  sigmaBrain: { value: 0.33, unit: 'S/m', status: 'measured', refs: ['goncalves2003', 'mccann2019'],
    means: 'Electrical conductivity of the brain, grey and white matter taken together.',
    derivation: 'Gonçalves 2003, in living subjects: about 301 Ω·cm (0.33 S/m). McCann 2019 gives grey matter 0.47 and white matter 0.22; one value is used for the whole brain in a shell model.' },
  crownDepth: { value: 1.25, unit: 'mm', status: 'assumed',
    means: 'Depth of the current dipole layer below the brain’s surface at the crown of a gyrus.',
    derivation: 'Half the cortical thickness: the pyramidal cells’ dipoles are taken at the middle of a cortex about 2.5 mm thick. A placement; it moves the scalp amplitude by a few per cent.' },
  sulcusDepth: { value: 10, unit: 'mm', status: 'assumed',
    means: 'Depth of the middle of a sulcal wall below the brain’s surface.',
    derivation: 'Sulci are about 1–3 cm deep; the middle of a wall of a sulcus 2 cm deep. A placement for the “sulcal wall” setting.' },
  momentDensity: { value: 0.5, unit: 'nAm/mm²', status: 'derived', refs: ['murakami2015'],
    means: 'Current dipole moment per area of synchronously active human neocortex at the peak of an interictal spike.',
    derivation: 'Murakami & Okada 2015: human neocortex 0.16–0.77 nAm/mm²; their larger series, 275 nAm over about 5.5 cm², gives 0.5. Murakami’s proposed maximum is 1–2.' },
});
