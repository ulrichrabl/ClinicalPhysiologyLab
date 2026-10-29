import type { LocalizedText } from '../model/i18n.ts';
import { EEG } from '../evidence/eeg.ts';
import { sphericalDir, toMap, type Patch } from '../measurements/eeg-forward.ts';
import type { Discharge } from '../measurements/eeg-record.ts';

/* ---------------------------------------------------------------------------
   The EEG station's starting points (part 1): sources, each a patch of
   cortex with a discharge, named by where it is and how it lies. Each
   says what the field should show by the localisation rules a reader
   uses; a test checks that the model's field does (scripts/eeg.test.mjs).
   A starting point the model cannot bring is reported as a gap, never
   drawn as if it did.

   Places are given as the 10-10 system's spherical angles (θ from the
   vertex, negative on the left; φ the azimuth), the way the electrode
   positions are, so a patch "under F7" is under F7 by the same numbers.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });

export interface EegScene {
  patch: Patch;
  /** surface negative (most discharges) or surface positive */
  polarity: 'negative' | 'positive';
  discharge: Discharge;
  /** a discharge every so many seconds */
  every: number;
  /** brain-to-skull conductivity ratio; null = the registry's */
  skullRatio: number | null;
  csf: boolean;
}

export const SPIKE: Discharge = { duration: 50, slowWave: 0.4, slowMs: 200 };
export const SHARP: Discharge = { duration: 120, slowWave: 0.4, slowMs: 250 };

export const at = (theta: number, phi: number): [number, number] => toMap(sphericalDir(theta, phi));

export function sceneOf(p: Partial<Patch> & { at: [number, number] }, d: Discharge = SPIKE): EegScene {
  return {
    patch: { depth: EEG.crownDepth, area: 15, tilt: 0, toward: 0, density: EEG.momentDensity, ...p },
    polarity: 'negative', discharge: { ...d }, every: 2, skullRatio: null, csf: true,
  };
}

export interface EegPreset {
  id: string;
  label: LocalizedText;
  scene: EegScene;
  /** what a reader would find (checked by the test) */
  expect: { negMax?: string[]; reversal?: string; endOfChain?: boolean; twoPoles?: boolean; posMax?: string[]; invisible?: boolean };
}

export const EEG_PRESETS: EegPreset[] = [
  { id: 'temporal-left', label: L('Left anterior temporal spike (lateral cortex)', 'Spike links temporal vorn (laterale Rinde)'),
    scene: sceneOf({ at: at(-98, -18) }), expect: { negMax: ['F7', 'T7'], reversal: 'F7=T7' } },
  { id: 'temporal-mid-left', label: L('Left mid-temporal spike', 'Spike links mitteltemporal'),
    scene: sceneOf({ at: at(-95, 0) }), expect: { negMax: ['T7'], reversal: 'T7' } },
  { id: 'frontal-right', label: L('Right frontal sharp wave', 'Sharp Wave rechts frontal'),
    scene: sceneOf({ at: at(60, 51) }, SHARP), expect: { negMax: ['F4'], reversal: 'F4' } },
  { id: 'occipital-left', label: L('Left occipital spike: at the end of the chain', 'Spike links okzipital: am Ende der Kette'),
    scene: sceneOf({ at: at(-95, 72) }), expect: { negMax: ['O1'], endOfChain: true } },
  { id: 'frontopolar-right', label: L('Right frontopolar spike: at the end of the chain', 'Spike rechts frontopolar: am Ende der Kette'),
    scene: sceneOf({ at: at(92, 72) }), expect: { negMax: ['Fp2'], endOfChain: true } },
  { id: 'vertex', label: L('Vertex (midline) spike', 'Spike am Vertex (Mittellinie)'),
    scene: sceneOf({ at: at(0, 0) }), expect: { negMax: ['Cz'], reversal: 'Cz' } },
  { id: 'rolandic-left', label: L('Left centrotemporal (rolandic) spike: a tangential source', 'Spike links zentrotemporal (rolandisch): eine tangentiale Quelle'),
    scene: sceneOf({ at: at(-72, -21), tilt: 90, toward: 180, area: 10 }, { duration: 60, slowWave: 0.4, slowMs: 200 }), expect: { negMax: ['C3', 'T7', 'P3', 'P7'], twoPoles: true, posMax: ['Fp1', 'F3', 'F7', 'Fz'] } },
  { id: 'basal-temporal-left', label: L('Left basal temporal spike: the field points down', 'Spike links basal temporal: das Feld zeigt nach unten'),
    scene: sceneOf({ at: at(-118, -20) }), expect: { negMax: ['F7', 'T7'] } },
  { id: 'small-patch', label: L('The same temporal spike from 4 cm²', 'Derselbe temporale Spike aus 4 cm²'),
    scene: sceneOf({ at: at(-98, -18), area: 4 }), expect: { negMax: ['F7', 'T7'] } },
  { id: 'deep-mesial', label: L('A discharge 3 cm deep (mesial temporal)', 'Eine Entladung 3 cm tief (mesial temporal)'),
    scene: sceneOf({ at: at(-105, -10), depth: 30, area: 4 }), expect: { invisible: true } },
];

export const EEG_PRESET_GROUPS: Array<{ group: LocalizedText; ids: string[] }> = [
  { group: L('Radial sources: where the maximum is', 'Radiale Quellen: wo das Maximum liegt'), ids: ['temporal-left', 'temporal-mid-left', 'frontal-right', 'vertex'] },
  { group: L('At the end of a chain', 'Am Ende einer Kette'), ids: ['occipital-left', 'frontopolar-right'] },
  { group: L('Tangential and basal sources', 'Tangentiale und basale Quellen'), ids: ['rolandic-left', 'basal-temporal-left'] },
  { group: L('What the scalp hardly sees', 'Was die Kopfhaut kaum sieht'), ids: ['small-patch', 'deep-mesial'] },
];

export const presetById = (id: string) => EEG_PRESETS.find((p) => p.id === id);
