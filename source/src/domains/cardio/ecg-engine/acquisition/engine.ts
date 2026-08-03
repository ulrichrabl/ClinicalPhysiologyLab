/** Acquisition chain: filters and artifacts (spec §19). */
export interface AcquisitionState {
  baselineWander: number;
  muscleNoise: number;
  mainsNoise: number;
}

export function applyAcquisition(
  sample: number,
  _lead: string,
  tMs: number,
  cfg: AcquisitionState,
  rng: { gaussian: (m: number, s: number) => number },
): number {
  let v = sample;
  if (cfg.baselineWander > 0) v += cfg.baselineWander * Math.sin(tMs * 0.001);
  if (cfg.muscleNoise > 0) v += cfg.muscleNoise * rng.gaussian(0, 0.02);
  if (cfg.mainsNoise > 0) v += cfg.mainsNoise * Math.sin(tMs * 0.377);
  return v;
}
