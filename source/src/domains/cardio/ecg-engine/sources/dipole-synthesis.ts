import type { CardiacRegion, LeadName, MechanismModifiers } from '../types/index.ts';
import {
  evalInjury,
  monophasicPulse,
  DEP_WAVEFRONT,
  REP_WAVEFRONT,
  ATRIAL_WAVEFRONT,
  AF_WAVEFRONT,
} from './kernels.ts';

/* Lead frame: +X left, +Y inferior, +Z anterior. */
const E_RA: [number, number, number] = [-25, -5, 2];
const E_LA: [number, number, number] = [25, -5, 2];
const E_LL: [number, number, number] = [8, 35, 0];
const E_PREC: [number, number, number][] = [
  [-3.5, 1.5, 11], [-0.5, 3.5, 12.5], [2.5, 5.5, 12],
  [5.5, 7.5, 10], [9, 6, 6], [12, 2, 2],
];

type QrsMode = 'normal' | 'rbbb' | 'lbbb';

function toLeadFrame(x: number, y: number, z: number): [number, number, number] {
  return [x * 0.95 - y * 0.12, -y * 0.92 + x * 0.18, -z * 0.85];
}

function cavityOf(r: CardiacRegion): [number, number, number] {
  if (r.chamber === 'RA') return [0.5, 2.0, 0];
  if (r.chamber === 'LA') return [-0.8, 2.0, 0];
  if (r.chamber === 'RV') return [-1.2, -1.8, 1.0];
  return [1.6, -2.0, -0.35];
}

function wallNormal(r: CardiacRegion): [number, number, number] {
  const c = cavityOf(r);
  const [x, y, z] = toLeadFrame(
    r.center[0] - c[0],
    r.center[1] - c[1],
    r.center[2] - c[2],
  );
  const n = Math.hypot(x, y, z) || 1;
  return [x / n, y / n, z / n];
}

function qrsModeFrom(modifiers: MechanismModifiers): QrsMode {
  const lbb = modifiers.left_bundle_delay_ms ?? 0;
  const rbb = modifiers.right_bundle_delay_ms ?? 0;
  if (lbb >= 40 && lbb >= rbb) return 'lbbb';
  if (rbb >= 40 && rbb > lbb) return 'rbbb';
  return 'normal';
}

/** Vectorcardiographic QRS path — mode-specific terminal forces for BBB. */
function qrsTrajectory(u: number, mode: QrsMode): [number, number, number] {
  const t = Math.max(0, Math.min(1, u));
  let keys: Array<[number, number, number, number]>;
  if (mode === 'rbbb') {
    /* Early LV (left-inferior), then late rightward/anterior R' (positive in V1). */
    keys = [
      [0.00, -0.12, 0.08, 0.10],
      [0.28, 0.45, 0.42, -0.04],
      [0.52, 0.55, 0.32, -0.10],
      [0.74, -0.38, 0.10, 0.55],
      [1.00, -0.42, 0.04, 0.32],
    ];
  } else if (mode === 'lbbb') {
    /* No septal Q; broad leftward force (tall wide R in I/V6), right precordial QS. */
    keys = [
      [0.00, 0.28, 0.16, -0.12],
      [0.30, 0.55, 0.35, -0.18],
      [0.55, 0.72, 0.40, -0.22],
      [0.80, 0.58, 0.18, -0.25],
      [1.00, 0.32, 0.04, -0.18],
    ];
  } else {
    /* Keep mid-QRS slightly anterior so V2–V3 are not quieter than V1. */
    keys = [
      [0.00, -0.22, 0.10, 0.22],
      [0.22, 0.18, 0.48, 0.18],
      [0.48, 0.88, 0.72, 0.08],
      [0.72, 0.48, 0.20, -0.18],
      [1.00, 0.16, -0.02, -0.22],
    ];
  }
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1];
  const span = b[0] - a[0] || 1;
  const f = (t - a[0]) / span;
  const s = f * f * (3 - 2 * f);
  return [
    a[1] + (b[1] - a[1]) * s,
    a[2] + (b[2] - a[2]) * s,
    a[3] + (b[3] - a[3]) * s,
  ];
}

function ventActivationWindow(
  regions: Iterable<CardiacRegion>,
  minWidthMs: number,
): { t0: number; t1: number } | null {
  let t0 = Infinity, t1 = -Infinity;
  for (const r of regions) {
    if (r.chamber === 'RA' || r.chamber === 'LA') continue;
    if (r.activationTimeMs == null) continue;
    if (r.activationTimeMs < t0) t0 = r.activationTimeMs;
    if (r.activationTimeMs > t1) t1 = r.activationTimeMs;
  }
  if (!Number.isFinite(t0)) return null;
  if (t1 - t0 < minWidthMs) t1 = t0 + minWidthMs;
  return { t0, t1 };
}

function dipoleMoment(
  regions: Iterable<CardiacRegion>,
  tMs: number,
  modifiers: MechanismModifiers,
): [number, number, number] {
  const list = regions instanceof Array ? regions : [...regions];
  const mode = qrsModeFrom(modifiers);
  const minQrs = mode === 'normal' ? 85 : 140;
  const win = ventActivationWindow(list, minQrs);
  let x = 0, y = 0, z = 0;

  const afAct = modifiers.af_source_activity ?? 0;
  const atrialScale = modifiers.atrial_mass_scale != null
    ? Math.max(0, 0.28 * modifiers.atrial_mass_scale)
    : 0.28;
  /* AF: model-derived f-waves from rapid atrial region activations. */
  const atrialKernel = afAct > 0.2 ? AF_WAVEFRONT : ATRIAL_WAVEFRONT;
  const atrialGain = afAct > 0.2 ? atrialScale * (0.9 + afAct * 0.55) : atrialScale;

  for (const r of list) {
    if (r.chamber !== 'RA' && r.chamber !== 'LA') continue;
    if (r.activationTimeMs == null) continue;
    const mass = r.electricalMass * r.viableFraction * (1 - r.scarFraction);
    const w = monophasicPulse(tMs, r.activationTimeMs, atrialKernel) * mass * atrialGain;
    const [dx, dy, dz] = wallNormal(r);
    x += w * dx; y += w * dy; z += w * dz;
  }

  if (win) {
    const depSigma = mode === 'normal' ? DEP_WAVEFRONT.sigmaMs : DEP_WAVEFRONT.sigmaMs * 1.7;
    let rate = 0;
    let massSum = 0;
    let lx = 0, ly = 0, lz = 0, localW = 0;
    for (const r of list) {
      if (r.chamber === 'RA' || r.chamber === 'LA') continue;
      if (r.activationTimeMs == null) continue;
      const mass = r.electricalMass * r.viableFraction * (1 - r.scarFraction);
      massSum += mass;
      const w = monophasicPulse(tMs, r.activationTimeMs, { ...DEP_WAVEFRONT, sigmaMs: depSigma }) * mass;
      if (w === 0) continue;
      rate += w;
      const [dx, dy, dz] = wallNormal(r);
      lx += w * dx; ly += w * dy; lz += w * dz;
      localW += w;
    }
    /* BBB: drive trajectory across the full widened window so QRS stays broad
       even when regional activations are clustered. Keep envelope modest —
       otherwise R'/S' forces soft-clip at ±2.6 mV and look cartoonish. */
    if (mode !== 'normal' && massSum > 0) {
      const mid = (win.t0 + win.t1) / 2;
      const sigma = Math.max(22, (win.t1 - win.t0) / 3.0);
      const env = Math.exp(-0.5 * ((tMs - mid) / sigma) ** 2);
      rate = Math.max(rate, env * massSum * 0.22);
    }
    if (rate > 1e-8) {
      const u = (tMs - win.t0) / (win.t1 - win.t0);
      const [tx, ty, tz] = qrsTrajectory(u, mode);
      /* Blend VCG path with local wall normals — more tissue-derived, less cartoon. */
      const localScale = localW > 0 ? (mode === 'normal' ? 0.28 : 0.18) : 0;
      const inv = localW > 0 ? 1 / localW : 0;
      const trajW = mode === 'normal' ? 0.72 : 0.50;
      const amp = mode === 'normal' ? 1 : 0.55;
      x += amp * (rate * trajW * tx + localScale * lx * inv * rate);
      y += amp * (rate * trajW * ty + localScale * ly * inv * rate);
      z += amp * (rate * trajW * tz + localScale * lz * inv * rate);

      if (mode === 'normal' && u >= 0 && u < 0.14) {
        const q = Math.sin((u / 0.14) * Math.PI) * rate * 0.10;
        x -= q * 0.55;
      }
    }
  }

  const injuryGain = 0.85 + (modifiers.ischemia_severity ?? 0) * 0.4;
  const disp = modifiers.repolarization_dispersion ?? 0;
  for (const r of list) {
    if (r.chamber === 'RA' || r.chamber === 'LA') continue;
    if (r.repolarizationTimeMs == null && r.injuryCurrent === 0) continue;
    const mass = r.electricalMass * r.viableFraction * (1 - r.scarFraction);
    let [dx, dy, dz] = wallNormal(r);
    /* Steer injury vectors toward the clinically expected lead field. */
    if (r.injuryCurrent !== 0 && (r.id.includes('ant') || r.id.includes('sept'))) {
      dz += 0.45 * Math.sign(r.injuryCurrent || 1);
      const n = Math.hypot(dx, dy, dz) || 1;
      dx /= n; dy /= n; dz /= n;
    }
    if (r.injuryCurrent !== 0 && (r.id.includes('inf') || r.id.includes('bas_inf'))) {
      dy += 0.22 * Math.sign(r.injuryCurrent || 1);
      dx *= 0.85; // limit lateral spill into I/aVL
      const n = Math.hypot(dx, dy, dz) || 1;
      dx /= n; dy /= n; dz /= n;
    }

    if (r.repolarizationTimeMs != null) {
      const sigma = REP_WAVEFRONT.sigmaMs * (1 + disp * 0.35);
      const w = monophasicPulse(tMs, r.repolarizationTimeMs, { ...REP_WAVEFRONT, sigmaMs: sigma }) * mass * 1.05;
      x += w * dx; y += w * dy; z += w * dz;
    }

    if (r.injuryCurrent !== 0 && r.activationTimeMs != null) {
      const repT = r.repolarizationTimeMs ?? r.activationTimeMs + r.actionPotentialDurationMs;
      const inj = evalInjury(tMs, r.activationTimeMs, repT, r.injuryCurrent) * mass * injuryGain;
      x += inj * dx;
      y += inj * dy;
      z += inj * dz;
    }
  }

  return [x, y, z];
}

function phiAt(pos: [number, number, number], dip: [number, number, number]): number {
  const r2 = pos[0] ** 2 + pos[1] ** 2 + pos[2] ** 2;
  const rm = Math.sqrt(r2) || 1;
  return (dip[0] * (pos[0] / rm) + dip[1] * (pos[1] / rm) + dip[2] * (pos[2] / rm)) / r2;
}

export function dipoleToLeads(
  regions: Map<string, CardiacRegion> | Iterable<CardiacRegion>,
  tMs: number,
  modifiers: MechanismModifiers = {},
  gain = 95,
): Record<LeadName, number> {
  const iter = regions instanceof Map ? regions.values() : regions;
  const d = dipoleMoment(iter, tMs, modifiers);
  const ra = phiAt(E_RA, d), la = phiAt(E_LA, d), ll = phiAt(E_LL, d);
  const wct = (ra + la + ll) / 3;
  const precGain = gain * 0.55;
  const v = E_PREC.map((p) => (phiAt(p, d) - wct) * precGain);
  return {
    I: (la - ra) * gain,
    II: (ll - ra) * gain,
    III: (ll - la) * gain,
    aVR: (ra - (la + ll) / 2) * gain,
    aVL: (la - (ra + ll) / 2) * gain,
    aVF: (ll - (ra + la) / 2) * gain,
    V1: v[0], V2: v[1], V3: v[2], V4: v[3], V5: v[4], V6: v[5],
  };
}

export function einthovenError(leads: Record<LeadName, number>): number {
  return Math.abs(leads.II - (leads.I + leads.III));
}
