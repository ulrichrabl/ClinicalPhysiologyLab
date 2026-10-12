import type { Resolved, Resolver, RuntimeView } from '../engine/observe.ts';

/* ===========================================================================
   Signs of the internal milieu at the bedside, and the tests of it.

   The mouth dries when the interstitium shrinks and when the plasma is
   hypertonic; the skin's turgor falls with interstitial volume (and, in the
   old, with age, which is why it is a poor sign in them). Standing pools
   about 600 mL in the legs: a normal blood volume and intact reflexes absorb
   it, a contracted one does not. Ketones are smelt on the breath.

   The urine and the plasma are measured from the body model directly: a
   dipstick reads urine glucose and acetoacetate in coarse steps, the
   osmometer the plasma's osmolality, the laboratory the urine's sodium.
=========================================================================== */

const r1 = (x: number, d = 0) => { const f = 10 ** d; return Math.round(x * f) / f; };
const body = (v: RuntimeView) => v.body;

/** Fraction of the normal blood volume lost (0 when expanded). */
const deficit = (v: RuntimeView) => {
  const b = body(v); if (!b) return 0;
  return Math.max(0, -b.bloodVolumeDelta) / Math.max(3000, b.bloodVolume - b.bloodVolumeDelta);
};

const step = (x: number, cuts: number[], codes: string[]) => { let i = 0; while (i < cuts.length && x >= cuts[i]) i++; return codes[i]; };

export const BODY_EXAM_RESOLVERS: Record<string, Resolver> = {
  'body.mucosa': (view): Resolved | undefined => {
    const b = body(view); if (!b) return undefined;
    const isf0 = Math.max(4, b.ISF - b.dISF);
    const rr = view.respiratory?.RR ?? 14;
    const score = Math.max(0, -b.dISF) / (0.08 * isf0) + Math.max(0, b.tonicity - 296) / 8 + (rr > 26 ? 0.4 : 0);
    const moisture = score >= 2.2 ? 'parched' : score >= 1 ? 'dry' : 'moist';
    return { value: { moisture }, basis: `interstitial fluid ${b.dISF >= 0 ? '+' : ''}${b.dISF.toFixed(1)} L, tonicity ${b.tonicity.toFixed(0)} mosmol/kg` };
  },
  'body.turgor': (view): Resolved | undefined => {
    const b = body(view); if (!b) return undefined;
    const isf0 = Math.max(4, b.ISF - b.dISF);
    const lost = Math.max(0, -b.dISF) / isf0;
    const old = view.patient.age >= 75;
    const turgor = lost > 0.12 || old ? 'reduced' : 'normal';
    return { value: { turgor }, basis: `interstitial fluid ${b.dISF.toFixed(1)} L (${(lost * 100).toFixed(0)} % lost)${old ? '; elastic tissue lost with age' : ''}` };
  },
  'body.breath': (view): Resolved | undefined => {
    const b = body(view); if (!b) return undefined;
    const odour = b.ketones >= 3 ? 'ketones' : b.urea >= 40 ? 'uraemic' : 'none';
    return { value: { odour }, basis: `ketoacids ${b.ketones.toFixed(1)} mmol/L (acetone is breathed out), urea ${b.urea.toFixed(0)} mmol/L` };
  },
};

/* ---- tests ---------------------------------------------------------------------------- */
export const BODY_LAB_RESOLVERS: Record<string, Resolver> = {
  'body.urinalysis': (view): Resolved | undefined => {
    const b = body(view); if (!b) return undefined;
    if (b.urineMlPerH < 3) return { value: { voided: false }, basis: 'no urine produced' };
    const glucose = step(b.glucosuria, [2.8, 5.5, 14, 28, 55], ['negative', 'trace', '1+', '2+', '3+', '4+']);
    const ketones = step(0.3 * b.ketonuria, [0.5, 1.5, 4, 8], ['negative', 'trace', '1+', '2+', '3+']);
    const sg = r1(1.0 + 0.000033 * b.urineOsm + (b.glucosuria > 50 ? 0.004 : 0), 3);
    const ph = r1(Math.min(8.5, Math.max(4.6, 6.0 + 1.6 * b.bicarbonaturia / (b.bicarbonaturia + 25) - 0.9 * Math.log10(Math.max(4, b.NH4) / 28))) * 2, 0) / 2;
    return { value: { voided: true, glucose, ketones, protein: 'negative', blood: 'negative', leukocytes: 'negative', nitrites: 'negative', sg, ph },
      basis: `urine glucose ${b.glucosuria.toFixed(0)} mmol/L, ketones ${b.ketonuria.toFixed(1)} mmol/L, osmolality ${b.urineOsm.toFixed(0)} mosmol/kg` };
  },
  'body.urine-chem': (view): Resolved | undefined => {
    const b = body(view); if (!b) return undefined;
    if (b.urineMlPerH < 3) return undefined;
    return { value: { sodium: r1(b.urineNa), potassium: r1(b.urineK), chloride: r1(b.urineCl), osmolality: r1(b.urineOsm) },
      basis: `sodium excreted ${b.uNaRate.toFixed(0)} mmol/day, FENa ${b.FENa.toFixed(2)} %` };
  },
  'body.osmolality': (view): Resolved | undefined => {
    const b = body(view); if (!b) return undefined;
    return { value: { osmolality: r1(b.osmolality) }, basis: `2 × Na ${b.sodium.toFixed(0)} + glucose ${b.glucose.toFixed(1)} + urea ${b.urea.toFixed(1)}` };
  },
  'body.ketones': (view): Resolved | undefined => {
    const b = body(view); if (!b) return undefined;
    return { value: { betaHydroxybutyrate: r1(b.betaHydroxybutyrate, 1) }, basis: `ketoacids ${b.ketones.toFixed(1)} mmol/L, of which about four fifths β-hydroxybutyrate` };
  },
  'body.urine-output': (view): Resolved | undefined => {
    const b = body(view); if (!b) return undefined;
    return { value: { mlPerHour: Math.round(b.urineMlPerH), mlPerKgPerHour: r1(b.urineMlPerH / Math.max(30, view.patient.weightKg ?? 70), 2) },
      basis: `urine flow ${b.urineMlPerH.toFixed(0)} mL/h, osmolality ${b.urineOsm.toFixed(0)} mosmol/kg` };
  },
};

/** Standing: the BP and rate a contracted circulation gives when 600 mL pools in the legs. Old age blunts the baroreflex;
    an ACE inhibitor removes angiotensin II, the slower defence. */
export function orthostatic(view: RuntimeView): { dSys: number; dDia: number; dHR: number; basis: string } {
  const b = body(view);
  const ecfLost = b ? Math.max(0, -b.dECF) / Math.max(5, b.ECF - b.dECF) : 0;
  const d = Math.max(deficit(view), 0.4 * ecfLost);
  const blunt = (1 + 0.01 * Math.max(0, view.patient.age - 50)) * (1 + 0.5 * (b?.params.aceInhibitor ?? 0));
  const dSys = -Math.min(55, (3 + 200 * d) * blunt), dDia = -Math.min(30, Math.max(-3, -2 + 90 * d * blunt));
  const dHR = Math.min(45, (10 + 250 * d) / Math.sqrt(blunt));
  return { dSys, dDia, dHR, basis: `standing pools about 600 mL in the legs; blood volume ${(deficit(view) * 100).toFixed(0)} % and extracellular fluid ${(ecfLost * 100).toFixed(0)} % below normal${blunt > 1.2 ? '; reflexes blunted by age and ACE inhibition' : ''}` };
}
