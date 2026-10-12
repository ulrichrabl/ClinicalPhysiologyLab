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
  'body.temp': (view): Resolved | undefined => {
    const b = body(view); if (!b) return undefined;
    return { value: r1(b.temperature, 1), basis: `core temperature ${b.temperature.toFixed(1)} °C; inflammatory signal ×${b.inflammation.toFixed(2)}` };
  },
  'body.sclera': (view): Resolved | undefined => {
    const b = body(view); if (!b) return undefined;
    const icterus = b.bilirubin >= 85 ? 'marked' : b.bilirubin >= 40 ? 'mild' : 'none';
    return { value: { icterus }, basis: `bilirubin ${b.bilirubin.toFixed(0)} µmol/L (visible in the sclerae from about 40)` };
  },
  'body.conjunctiva': (view): Resolved | undefined => {
    const b = body(view); if (!b) return undefined;
    const pallor = b.haemoglobin < 75 ? 'marked' : b.haemoglobin < 105 ? 'mild' : 'none';
    return { value: { pallor }, basis: `haemoglobin ${b.haemoglobin.toFixed(0)} g/L` };
  },
  'body.asterixis': (view): Resolved | undefined => {
    const b = body(view); if (!b) return undefined;
    return { value: { flap: b.encephalopathy >= 1.2 }, basis: `encephalopathy grade ${b.encephalopathy.toFixed(1)}, ammonia ${b.ammonia.toFixed(0)} µmol/L` };
  },
  'body.ascites': (view): Resolved | undefined => {
    const b = body(view); if (!b) return undefined;
    const grade = b.ascites >= 4 ? 'tense' : b.ascites >= 1.5 ? 'shifting' : b.ascites >= 0.8 ? 'flank' : 'none';
    return { value: { ascites: grade }, basis: `ascites ${b.ascites.toFixed(1)} L (shifting dullness needs about 1.5 L)` };
  },
  'body.rectal': (view): Resolved | undefined => {
    const b = body(view); if (!b) return undefined;
    const p = b.params;
    const stool = (p.upperGIBleed ?? 0) >= 20 ? 'melaena' : (p.lowerGIBleed ?? 0) >= 10 ? 'fresh-blood' : (p.cholestasis ?? 0) >= 0.6 ? 'pale' : 'normal';
    return { value: { stool }, basis: `upper GI bleeding ${(p.upperGIBleed ?? 0).toFixed(0)} mL/h, lower ${(p.lowerGIBleed ?? 0).toFixed(1)} mL/h` };
  },
  'body.liver-stigmata': (view): Resolved | undefined => {
    const b = body(view); if (!b) return undefined;
    const p = b.params;
    const chronic = (1 - (p.liverFunction ?? 1)) * 1 + (p.alcohol ?? 0) * 0.3 + (p.portalHypertension ?? 0) * 0.5;
    return { value: { spiderNaevi: chronic >= 0.7, palmarErythema: chronic >= 0.6, caputMedusae: (p.portalHypertension ?? 0) >= 0.8 }, basis: `chronic liver disease: liver function ×${(p.liverFunction ?? 1).toFixed(2)}, portal hypertension ${(p.portalHypertension ?? 0).toFixed(2)}` };
  },
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
    /* An infected urine: white cells (leukocyte esterase), nitrite from Gram-negative bacteria, some blood and protein from the inflamed urothelium. */
    const uti = (b.params.urinarySource ?? 0) > 0 && (b.params.infection ?? 0) > 0.15;
    const inf = b.params.infection ?? 0;
    const bilirubin = b.bilirubinConjugated > 40 ? '2+' : b.bilirubinConjugated > 15 ? '1+' : 'negative';
    return { value: { voided: true, glucose, ketones, bilirubin, protein: uti ? '1+' : 'negative', blood: uti ? (inf > 0.5 ? '2+' : '1+') : 'negative',
      leukocytes: uti ? (inf > 0.5 ? '3+' : '2+') : 'negative', nitrites: uti ? '1+' : 'negative', sg, ph },
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
  'body.lft': (view): Resolved | undefined => {
    const b = body(view); if (!b) return undefined;
    return { value: { bilirubin: r1(b.bilirubin), alt: r1(b.alt), alp: r1(b.alp), ggt: r1(b.ggt), albumin: r1(b.albumin) }, basis: `conjugated bilirubin ${b.bilirubinConjugated.toFixed(0)} µmol/L` };
  },
  'body.coag': (view): Resolved | undefined => {
    const b = body(view); if (!b) return undefined;
    return { value: { inr: r1(b.inr, 1), aptt: r1(30 + 12 * (b.inr - 1)) } };
  },
  'body.ammonia': (view): Resolved | undefined => {
    const b = body(view); if (!b) return undefined;
    return { value: { ammonia: r1(b.ammonia) } };
  },
  'body.haematinics': (view): Resolved | undefined => {
    const b = body(view); if (!b) return undefined;
    return { value: { ferritin: r1(b.ferritin), b12: r1(b.b12), folate: 9 } };
  },
  'body.haemolysis': (view): Resolved | undefined => {
    const b = body(view); if (!b) return undefined;
    return { value: { reticulocytes: r1(b.reticulocytes, 1), ldh: r1(b.ldh), haptoglobin: r1(b.haptoglobin, 2), bilirubinUnconjugated: r1(b.bilirubin - b.bilirubinConjugated) } };
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
