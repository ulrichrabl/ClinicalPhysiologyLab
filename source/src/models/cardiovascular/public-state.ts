/**
 * Canonical cardiovascular public state.
 * Owned by the Patient Runtime. Private Circulation fields never appear here.
 */

export interface CardiovascularPublicState {
  meanArterialPressure: number | null;
  systolicPressure: number | null;
  diastolicPressure: number | null;
  pulsePressure: number | null;
  heartRate: number | null;
  strokeVolume: number | null;
  cardiacOutput: number | null;
  ejectionFraction: number | null;
  centralVenousPressure: number | null;
  leftAtrialPressure: number | null;
  pulmonaryArteryPressure: number | null;
  pulmonaryArteryMean: number | null;
  meanFillingPressure: number | null;
  bloodVolume: number | null;
  systemicVascularResistance: number | null;
  baroreflexEnabled: boolean | null;
}

export interface ElectrophysiologyPublicState {
  leadIISample: number | null;
  /** Sparse lead buffers from the latest snapshot, for observation models. */
  leads: Record<string, Float64Array | number[] | undefined> | null;
  qrsAxis: number | null;
  pathology: string | null;
  effectiveHeartRate: number | null;
}

export const EMPTY_CARDIOVASCULAR_PUBLIC: CardiovascularPublicState = {
  meanArterialPressure: null,
  systolicPressure: null,
  diastolicPressure: null,
  pulsePressure: null,
  heartRate: null,
  strokeVolume: null,
  cardiacOutput: null,
  ejectionFraction: null,
  centralVenousPressure: null,
  leftAtrialPressure: null,
  pulmonaryArteryPressure: null,
  pulmonaryArteryMean: null,
  meanFillingPressure: null,
  bloodVolume: null,
  systemicVascularResistance: null,
  baroreflexEnabled: null,
};

export const EMPTY_ELECTROPHYSIOLOGY_PUBLIC: ElectrophysiologyPublicState = {
  leadIISample: null,
  leads: null,
  qrsAxis: null,
  pathology: null,
  effectiveHeartRate: null,
};

/**
 * Translate a Circulation.snapshot() bag into canonical public state.
 * This is the only place that may read private/snapshot field names like Pmean.
 */
export function snapshotToCardiovascularPublic(
  snap: Record<string, unknown> | null | undefined,
): CardiovascularPublicState {
  if (!snap) return { ...EMPTY_CARDIOVASCULAR_PUBLIC };
  const num = (k: string): number | null => {
    const v = snap[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };
  const metrics = (snap.metrics && typeof snap.metrics === 'object')
    ? snap.metrics as Record<string, unknown>
    : null;
  const metricNum = (k: string): number | null => {
    if (!metrics) return null;
    const v = metrics[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };

  const psys = num('Psys');
  const pdia = num('Pdia');
  return {
    meanArterialPressure: num('Pmean'),
    systolicPressure: psys,
    diastolicPressure: pdia,
    pulsePressure: psys != null && pdia != null ? psys - pdia : null,
    heartRate: num('HR'),
    strokeVolume: num('SV'),
    cardiacOutput: num('CO'),
    ejectionFraction: num('EF'),
    centralVenousPressure: num('CVP'),
    leftAtrialPressure: num('Pla') ?? metricNum('PlaMean'),
    pulmonaryArteryPressure: num('Ppa'),
    pulmonaryArteryMean: num('PpaMean'),
    meanFillingPressure: num('Pmsf'),
    bloodVolume: num('bloodVolume'),
    systemicVascularResistance: num('Rsys'),
    baroreflexEnabled: typeof snap.baroEnabled === 'boolean' ? snap.baroEnabled : null,
  };
}

export function snapshotToElectrophysiologyPublic(
  snap: Record<string, unknown> | null | undefined,
): ElectrophysiologyPublicState {
  if (!snap) return { ...EMPTY_ELECTROPHYSIOLOGY_PUBLIC };
  const leads = snap.ecgLeads && typeof snap.ecgLeads === 'object'
    ? snap.ecgLeads as Record<string, Float64Array | number[]>
    : null;
  return {
    leadIISample: typeof snap.ecgValue === 'number' ? snap.ecgValue : null,
    leads,
    qrsAxis: typeof snap.qrsAxis === 'number' ? snap.qrsAxis : null,
    pathology: typeof snap.pathology === 'string' ? snap.pathology : null,
    effectiveHeartRate: typeof snap.HR === 'number' ? snap.HR : null,
  };
}

/** Derived channel projections for consumers that still read Patient channels (e.g. labs). */
export function cardiovascularToChannelProjection(cv: CardiovascularPublicState): Record<string, number> {
  const out: Record<string, number> = {};
  if (cv.meanArterialPressure != null) out.MAP = Math.round(cv.meanArterialPressure);
  if (cv.heartRate != null) out.HR = Math.round(cv.heartRate);
  if (cv.cardiacOutput != null) out.CO = +cv.cardiacOutput.toFixed(1);
  if (cv.bloodVolume != null) out.bloodVolume = Math.round(cv.bloodVolume);
  if (cv.leftAtrialPressure != null) out.LAP = +cv.leftAtrialPressure.toFixed(1);
  if (cv.ejectionFraction != null) out.EF = Math.round(cv.ejectionFraction);
  if (cv.centralVenousPressure != null) out.CVP = +cv.centralVenousPressure.toFixed(1);
  return out;
}
