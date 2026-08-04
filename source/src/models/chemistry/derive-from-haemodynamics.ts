import type { CardiovascularPublicState } from '../cardiovascular/public-state.ts';
import type { ChemistryPublicState } from './public-state.ts';
import { CHEMISTRY_DEFAULTS } from './public-state.ts';

export interface ChemistryDerivation {
  id: string;
  name: string;
  why: string;
  text: string;
  patch: Partial<ChemistryPublicState>;
}

/**
 * Derive chemistry consequences from canonical haemodynamics.
 * These update latent chemistry state — not laboratory observations.
 */
export function deriveChemistryFromHaemodynamics(
  cv: CardiovascularPublicState,
  baseline: ChemistryPublicState = CHEMISTRY_DEFAULTS,
): { statePatch: Partial<ChemistryPublicState>; active: ChemistryDerivation[] } {
  const active: ChemistryDerivation[] = [];
  const statePatch: Partial<ChemistryPublicState> = {};

  const map = cv.meanArterialPressure ?? 95;
  const co = cv.cardiacOutput ?? 5.2;
  const bv = cv.bloodVolume ?? 5000;
  const lap = cv.leftAtrialPressure ?? 6;
  const ef = cv.ejectionFraction ?? 55;

  if (map < 65 || co < 3.5) {
    const deficit = Math.max(0, (68 - map) / 22) + Math.max(0, (3.8 - co) / 2.2);
    const patch = {
      lactate: Math.min(18, 1.0 + deficit * 4.2),
      arterialPH: 7.40 - Math.min(0.32, deficit * 0.12),
      bicarbonate: Math.max(6, 24 - deficit * 8),
    };
    Object.assign(statePatch, patch);
    active.push({
      id: 'hypoperfusion-lactate',
      name: 'Hypoperfusion → lactate',
      text: `MAP ${Math.round(map)} mmHg, cardiac output ${co.toFixed(1)} L/min — `
        + 'oxygen delivery has fallen far enough that tissues are respiring anaerobically.',
      why: 'Lactate is produced whenever oxygen delivery fails to meet demand.',
      patch,
    });
  }

  if (bv < 4600) {
    const lost = 5000 - bv;
    const patch = { haemoglobin: Math.max(35, 150 * (1 - (lost / 5000) * 0.55)) };
    Object.assign(statePatch, patch);
    active.push({
      id: 'haemorrhage-hb',
      name: 'Haemorrhage → haemoglobin',
      text: `Circulating volume ${Math.round(bv)} mL — ${Math.round(lost)} mL below normal.`,
      why: 'Haemoglobin is a concentration, not an amount.',
      patch,
    });
  }

  if (map < 70) {
    const d = Math.max(0, (72 - map) / 30);
    const patch = { urea: 5.0 + d * 16, creatinine: 80 + d * 65 };
    Object.assign(statePatch, patch);
    active.push({
      id: 'renal-perfusion',
      name: 'Renal hypoperfusion → urea and creatinine',
      text: `MAP ${Math.round(map)} mmHg — below the autoregulatory range of the kidney.`,
      why: 'A prerenal kidney is a working kidney that is not being perfused.',
      patch,
    });
  }

  if (lap > 15 || ef < 40) {
    const stretch = Math.max(0, (lap - 10) / 14) + Math.max(0, (45 - ef) / 30);
    const patch = { bnp: Math.min(11000, 40 + stretch * 2600) };
    Object.assign(statePatch, patch);
    active.push({
      id: 'heart-failure-bnp',
      name: 'Wall stress → natriuretic peptide',
      text: `Left atrial pressure ${lap.toFixed(0)} mmHg, ejection fraction ${Math.round(ef)}%.`,
      why: 'Natriuretic peptides are released by stretched myocardium.',
      patch,
    });
  }

  // When no derivation fires for a physiology-derived field, restore baseline
  // so clearing shock returns lactate etc. (caller merges with pins).
  if (!('lactate' in statePatch)) statePatch.lactate = baseline.lactate;
  if (!('arterialPH' in statePatch) && !active.some((a) => a.id === 'hypoperfusion-lactate')) {
    statePatch.arterialPH = baseline.arterialPH;
    statePatch.bicarbonate = baseline.bicarbonate;
  }
  if (!('haemoglobin' in statePatch)) statePatch.haemoglobin = baseline.haemoglobin;
  if (!('urea' in statePatch)) {
    statePatch.urea = baseline.urea;
    statePatch.creatinine = baseline.creatinine;
  }
  if (!('bnp' in statePatch)) statePatch.bnp = baseline.bnp;

  return { statePatch, active };
}
