import { defineConstants } from './constants.ts';

/* The corticothalamic model behind the EEG's rhythms and generalised seizures (physiology/brain/corticothalamic.ts).

   The model is Robinson's corticothalamic mean field: cortical excitatory and inhibitory populations, the thalamic relay
   (specific) and reticular nuclei, a loop delay between cortex and thalamus. Its parameter set here is the one Deeba,
   Sanz-Leon & Robinson 2020 used for tonic-clonic seizures (their Table 1), itself taken from Robinson's work in which the
   model was fitted to human EEG (Robinson 2001/2002; Rowe 2004: the spectra of 100 healthy adults). The same model was
   fitted to 345 ictal and 345 postictal EEGs of 33 patients after ECT with a Thymatron System IV (Stuiver 2025, 2026);
   those fits give the directions the seizure's slow path takes, and the postictal state it is checked against.

   What is ours, and said so: how a seizure moves through the model's parameters (one slow progression variable raising the
   corticothalamic drive and the cortical excitation-inhibition balance, as Stuiver found toward termination), and the
   relay's activity-driven hyperpolarisation that ends it and silences the EEG afterwards. Their rates are fitted once to
   the human seizure's duration and the time it starts to slow; the rest is checked, not fitted. */

export const CT = defineConstants('seizure', {
  /* the published model (Deeba 2020, Table 1) */
  nuEE: { value: 1.2, unit: 'mV·s', status: 'derived', refs: ['deeba2020', 'rowe2004'], means: 'Excitatory corticocortical connection strength (νee).', derivation: 'Deeba 2020, Table 1, the corticothalamic parameter set near the alpha instability, taken from Robinson’s fits to human EEG.' },
  nuEI: { value: -1.8, unit: 'mV·s', status: 'derived', refs: ['deeba2020', 'rowe2004'], means: 'Inhibitory corticocortical connection strength (νei).', derivation: 'Deeba 2020, Table 1.' },
  nuES: { value: 1.4, unit: 'mV·s', status: 'derived', refs: ['deeba2020', 'rowe2004'], means: 'Thalamic relay to cortex (νes).', derivation: 'Deeba 2020, Table 1.' },
  nuSE: { value: 0.95, unit: 'mV·s', status: 'derived', refs: ['deeba2020'], means: 'Cortex to thalamic relay at rest (νse).',
    derivation: 'Deeba 2020 ramp the cortex-to-relay strength from 0.8 to 1.2; the low firing state loses stability at 1.025 and the 10 Hz seizure cycle, once present, survives down to about 0.98 (subcritical: bistable). 0.95 is inside their range, below the instability, where the model rests and a strong enough perturbation starts a seizure: the resting brain of a patient who can have one.' },
  nuSR: { value: -1.0, unit: 'mV·s', status: 'derived', refs: ['deeba2020'], means: 'Reticular to relay inhibition (νsr).', derivation: 'Deeba 2020, Table 1.' },
  nuRE: { value: 0.2, unit: 'mV·s', status: 'derived', refs: ['deeba2020'], means: 'Cortex to reticular nucleus (νre).', derivation: 'Deeba 2020, Table 1.' },
  nuRS: { value: 0.2, unit: 'mV·s', status: 'derived', refs: ['deeba2020'], means: 'Relay to reticular nucleus (νrs).', derivation: 'Deeba 2020, Table 1.' },
  inputSN: { value: 2.0, unit: 'mV', status: 'derived', refs: ['deeba2020'], means: 'Input to the relay nucleus from outside the corticothalamic system (νsn·φn), its mean.', derivation: 'Deeba 2020, Table 1.' },
  qMax: { value: 250, unit: '1/s', status: 'derived', refs: ['deeba2020'], means: 'Maximum firing rate of a population.', derivation: 'Deeba 2020, Table 1.' },
  theta: { value: 15, unit: 'mV', status: 'derived', refs: ['deeba2020'], means: 'Mean firing threshold.', derivation: 'Deeba 2020, Table 1.' },
  sigma: { value: 6, unit: 'mV', status: 'derived', refs: ['deeba2020'], means: 'Standard deviation of the firing threshold (the sigmoid’s width is σ√3/π).', derivation: 'Deeba 2020, Table 1; the logistic scaled to that standard deviation as in Robinson’s model.' },
  gammaE: { value: 100, unit: '1/s', status: 'derived', refs: ['deeba2020'], means: 'Damping rate of the cortical excitatory axonal field.', derivation: 'Deeba 2020, Table 1.' },
  alpha: { value: 60, unit: '1/s', status: 'derived', refs: ['deeba2020'], means: 'Decay rate of the cell-body potential after a synaptic input.', derivation: 'Deeba 2020, Table 1.' },
  beta: { value: 240, unit: '1/s', status: 'derived', refs: ['deeba2020'], means: 'Rise rate of the cell-body potential.', derivation: 'Deeba 2020, Table 1.' },
  loopDelay: { value: 0.08, unit: 's', status: 'derived', refs: ['deeba2020', 'stuiver2026'], means: 'Corticothalamic return time t0 (half each way).', derivation: 'Deeba 2020, Table 1: 80 ms; Stuiver 2026 use 40 ms each way.' },

  /* the background's driving noise */
  inputNoise: { value: 0.3, unit: 'mV·√ms', status: 'assumed',
    means: 'Strength of the white noise in the relay’s outside input, which makes the resting rhythm.',
    derivation: 'Robinson’s model is driven by broadband input from outside the corticothalamic system; its size sets only the background’s amplitude, which the station scales to the scalp separately. A placement: the background’s own topography and reactivity are part 1b.' },

  /* the seizure's path through the model: ours */
  pathDrive: { value: 0.6, unit: 'fraction', status: 'assumed', refs: ['stuiver2025'],
    means: 'How far the corticothalamic drive (cortex to relay and to reticular nucleus together) rises over a seizure’s course, as a share of its resting value.',
    derivation: 'Stuiver 2025 found the corticothalamic loop gain rising toward the termination of ECT seizures. In the model, raising it with the cortical balance (below) slows the seizure from 10 Hz toward 2.5 Hz; 60 % reaches that regime. The direction is measured; the size is a placement.' },
  pathInhibition: { value: 0.3, unit: 'mV·s', status: 'assumed', refs: ['stuiver2025'],
    means: 'How much weaker cortical inhibition (νei) becomes over a seizure’s course: the cortical excitation-inhibition balance rising.',
    derivation: 'Stuiver 2025: the cortical excitation-inhibition ratio rises toward termination. With the drive above, 0.3 (from −1.8 to −1.5 mV·s) brings the model’s seizure cycle to about 2.5 Hz, the frequency of the late spike-and-wave phase of ECT seizures (Pottkämper 2021: 2.5–3.5 Hz). A placement guided by that frequency.' },
  progressRate: { value: 0.0012, unit: 'per excess spike', status: 'assumed', refs: ['pottkamper2021'],
    means: 'How fast a seizure moves along its path, per unit of excess cortical firing.',
    derivation: 'Placed so that the slowing spans the seizure, as in Pottkämper 2021’s ECT seizures (12 to 2 Hz over 72–78 s): the model’s seizure leaves 10 Hz after about a third of its course. No series gives the time course of the frequency in enough detail to fit it.' },
  relayInhibitionRate: { value: 0.0122, unit: 'mV per excess spike', status: 'derived', refs: ['luccarelli2021'],
    means: 'How fast the thalamic relay is hyperpolarised by the seizure’s firing, rising with the square of its progression: the late, activity-driven inhibition that ends it.',
    derivation: 'Fitted once (scripts/fit-seizure.mjs; median of six noise seeds 71.8 s) so that a seizure started at rest in every region lasts as long as a first treatment: Luccarelli 2021, 3648 patients, first treatment 71.5 ± 34.7 s of EEG seizure. The mechanism (adenosine, GABA-B, potassium) is not modelled; the model only needs the relay to fall silent, as Stuiver 2026 found right after ECT seizures (intrathalamic gain near zero).' },
  progressDecay: { value: 10, unit: 's', status: 'assumed', means: 'Time constant with which the seizure’s path relaxes once it has ended.',
    derivation: 'The drive and the cortical balance must fall back before the relay’s inhibition wears off, or the resting state is unstable and the seizure restarts. A placement shorter than the relay’s recovery.' },
  relayRecovery: { value: 180, unit: 's', status: 'assumed', refs: ['pottkamper2021', 'stuiver2026'],
    means: 'Time constant with which the relay’s hyperpolarisation wears off after the seizure: the postictal suppression and its recovery.',
    derivation: 'Postictal suppression after ECT lasted 0.6–6.3 min in Pottkämper 2021 (3 patients); Stuiver 2026 found the thalamus returning over the first postictal hour. Three minutes, a placement inside that range.' },
  firingToMoment: { value: 0.00457, unit: 'nAm/mm² per 1/s', status: 'derived', refs: ['pottkamper2021', 'murakami2015'],
    means: 'Current dipole moment per area of a region’s cortex for each 1/s its excitatory firing rises above rest (surface negative).',
    derivation: 'Fitted once (scripts/fit-seizure.mjs) so that the largest 2 s of a generalised seizure at Fz against the linked ears reach 275 µV peak to peak, the middle of Pottkämper 2021’s 150–400 µV frontocentrally in ECT seizures. Checked against Murakami & Okada 2015: at the seizure’s firing swing the moment density should stay within the human cortex’s 0.16–0.77 nAm/mm² (proposed maximum 1–2).' },
  seizingThreshold: { value: 2, unit: '1/s', status: 'assumed', means: 'Excess cortical firing (averaged over half a second) above which a region counts as seizing: its path advances; below it, the path relaxes.',
    derivation: 'Between the background’s fluctuations (well under 1/s) and a seizure’s (over 10/s). A placement.' },
});
