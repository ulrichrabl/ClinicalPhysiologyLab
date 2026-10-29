import { EEG } from '../evidence/eeg.ts';
import { CT } from '../evidence/seizure.ts';
import { ForwardModel, standardHead, patchPoints, leadField, sphericalDir, toMap, ALL_ELECTRODES, E1020 } from '../measurements/eeg-forward.ts';
import { REGIONS, type RegionDef } from '../physiology/brain/corticothalamic.ts';

/* ---------------------------------------------------------------------------
   From the corticothalamic regions to the scalp (EEG station, part 2a).

   Each region is a patch of convexity cortex under the electrodes that look
   at it (REGIONS), radial, at a gyral crown, of `REGION_AREA` cm². Its
   current dipole moment per area follows its excitatory cortical firing:
   CT.firingToMoment nAm/mm² per 1/s above rest, surface negative when
   firing rises. The head is part 1's (four shells), so the montages, the
   references and the reading of a field are the same as for a single
   discharge.
--------------------------------------------------------------------------- */

/** each region's patch area (cm²): the five regions per hemisphere cover about half of the model's convexity */
export const REGION_AREA = 30;

export interface RegionFields {
  /** µV at each electrode per 1/s of a region's excess firing, region by region */
  perRegion: Array<Record<string, number>>;
  defs: RegionDef[];
}

let cached: RegionFields | null = null;
export function regionFields(): RegionFields {
  if (cached) return cached;
  const model = new ForwardModel(standardHead());
  const perRegion = REGIONS.map((d) => {
    const pts = patchPoints({ at: toMap(sphericalDir(d.theta, d.phi)), depth: EEG.crownDepth, area: REGION_AREA, tilt: 0, toward: 0, density: CT.firingToMoment }, model.head);
    return leadField(model, pts, CT.firingToMoment, ALL_ELECTRODES);
  });
  cached = { perRegion, defs: REGIONS };
  return cached;
}

/** The electrodes' potentials (µV) over time from the regions' activity (1/s above rest, as the brain records it). */
export function scalpFromActivity(activity: Float32Array[]): Record<string, Float32Array> {
  const f = regionFields(), N = activity[0]?.length ?? 0;
  const out: Record<string, Float32Array> = {};
  for (const e of ALL_ELECTRODES) {
    const o = new Float32Array(N);
    f.perRegion.forEach((field, r) => { const k = field[e]; const a = activity[r]; for (let i = 0; i < N; i++) o[i] += k * a[i]; });
    out[e] = o;
  }
  return out;
}

/** Fz against the linked ears, the amplitude the scale is fitted to (a frontocentral derivation with a distant reference). */
export const frontocentral = (scalp: Record<string, Float32Array>) => {
  const a = scalp.Fz, l = scalp.A1, r = scalp.A2, o = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) o[i] = a[i] - (l[i] + r[i]) / 2;
  return o;
};

export { E1020 };
