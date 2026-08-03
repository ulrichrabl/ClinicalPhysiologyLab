/** Wavefront kernels — monophasic activation-rate pulses (no biphasic ringing). */

export interface KernelParams {
  riseMs: number;
  widthMs: number;
  decayMs: number;
  amplitude: number;
}

export const DEP_KERNEL: KernelParams = { riseMs: 6, widthMs: 18, decayMs: 12, amplitude: 1.0 };
export const REP_KERNEL: KernelParams = { riseMs: 20, widthMs: 60, decayMs: 80, amplitude: -0.35 };

export interface WavefrontParams {
  sigmaMs: number;
  amplitude: number;
}

/**
 * Ventricular activation. With parent×layer coalescing, a sharper kernel is
 * safe — one pulse per wavefront, not 302 competing Gaussians.
 */
export const DEP_WAVEFRONT: WavefrontParams = { sigmaMs: 5.5, amplitude: 1.0 };
/** Atrial P contribution (coalesced per parent seed). */
export const ATRIAL_WAVEFRONT: WavefrontParams = { sigmaMs: 14, amplitude: 0.55 };
/** Fine atrial wavelets (AF) — brief, lower. */
export const AF_WAVEFRONT: WavefrontParams = { sigmaMs: 6.5, amplitude: 0.26 };
/** T-wave source — broader, lower than QRS. */
export const REP_WAVEFRONT: WavefrontParams = { sigmaMs: 26, amplitude: 0.18 };

/** Peak-normalized Gaussian (activation rate / P / T). */
export function monophasicPulse(tMs: number, centerMs: number, params: WavefrontParams): number {
  const sigma = Math.max(0.5, params.sigmaMs);
  const x = (tMs - centerMs) / sigma;
  if (x < -5 || x > 5) return 0;
  return params.amplitude * Math.exp(-0.5 * x * x);
}

/** @deprecated alias — kept for older call sites / tests. */
export function wavefrontPulse(tMs: number, centerMs: number, params: WavefrontParams): number {
  return monophasicPulse(tMs, centerMs, params);
}

/** @deprecated biphasic caused QRS fragmentation when many regions overlapped. */
export function biphasicPulse(tMs: number, centerMs: number, params: WavefrontParams): number {
  return monophasicPulse(tMs, centerMs, params);
}

export function evalKernel(tMs: number, params: KernelParams): number {
  if (tMs < 0) return 0;
  const { riseMs, widthMs, decayMs, amplitude } = params;
  const peak = riseMs + widthMs * 0.4;
  if (tMs <= peak) {
    const x = tMs / Math.max(1, peak);
    return amplitude * hermite(x);
  }
  const tail = tMs - peak;
  return amplitude * Math.exp(-tail / Math.max(1, decayMs));
}

function hermite(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
}

export function evalInjury(tMs: number, activationMs: number, repolMs: number, magnitude: number): number {
  /* Single raised-cosine injury envelope: J rise → rounded ST → merge into T.
     One smooth lobe — no hermite/cos seam that reads as a flat shelf. */
  const j = activationMs + 30;
  const end = repolMs + 60;
  if (tMs < j || tMs > end) return 0;
  const u = (tMs - j) / Math.max(1, end - j);
  /* Asymmetric: peak ~40% through ST-T window (earlier than mid-T). */
  const skew = u < 0.4 ? (u / 0.4) * 0.5 : 0.5 + ((u - 0.4) / 0.6) * 0.5;
  return magnitude * Math.pow(Math.sin(Math.PI * skew), 1.25);
}

export function regionalSource(
  tMs: number,
  activationMs: number | undefined,
  repolMs: number | undefined,
  mass: number,
  injury: number,
  apdScale = 1,
): number {
  if (activationMs == null) return injury > 0 ? evalInjury(tMs, tMs - 100, tMs, injury) : 0;
  const dep = monophasicPulse(tMs, activationMs, DEP_WAVEFRONT) * mass;
  const rep = repolMs != null
    ? monophasicPulse(tMs, repolMs, { ...REP_WAVEFRONT, amplitude: REP_WAVEFRONT.amplitude * apdScale }) * mass
    : 0;
  const inj = injury !== 0 ? evalInjury(tMs, activationMs, repolMs ?? activationMs + 280 * apdScale, injury) : 0;
  return dep + rep + inj;
}
