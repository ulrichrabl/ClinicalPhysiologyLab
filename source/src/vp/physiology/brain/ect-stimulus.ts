import { ECT } from '../../evidence/ect.ts';
import { EEG } from '../../evidence/eeg.ts';
import { ForwardModel, standardHead, sphericalDir, patchPoints, toMap, vec, type Head, type Vec3 } from '../../measurements/eeg-forward.ts';
import { REGIONS, type RegionDef } from './corticothalamic.ts';
import { REGION_AREA } from '../../stations/eeg-seizure.ts';

/* ===========================================================================
   The ECT stimulus in the head (ECT station, part 1).

   The device drives a constant current between two pads. Where that current
   flows inside the head follows from the head's shells, the same four-shell
   sphere as the EEG station's (measurements/eeg-forward.ts), by reciprocity
   (Helmholtz): the field E at a point inside the head when a current I flows
   in at pad a and out at pad b equals I times the gradient, with respect to a
   dipole's moment at that point, of the voltage the dipole would make
   between a and b. So the EEG's forward model gives the stimulus's field.
   In the model's units (µV per nAm), 1 µV/nAm is 1000 V/(A·m).

   A pad is a disc of the pad's area on the scalp, its current spread evenly.

   How the field excites the cortex: a pulse of width w excites a neuron
   whose threshold field it exceeds; the threshold for a pulse of width w is
   E∞ / (1 − e^(−w/τ)) (the membrane charged through a time constant τ;
   Deng 2011), anchored at 0.35 V/cm for 0.3 ms (Deng 2013). The share of a
   region's cortex excited is the mean, over its patch, of a normal
   distribution of ln(E / threshold). Each excited pulse then pushes the
   region's relay by ECT.pulseDrive times that share times the synaptic
   resource the pulse releases (Brain.pulses: depression measured in human
   cortex), which is why a few pulses a second add up better than many.
=========================================================================== */

export type PlacementId = 'BT' | 'BF' | 'RUL' | 'LART';

export interface Placement {
  id: PlacementId;
  /** the two pads' centres as spherical angles (θ from the vertex, negative left; φ azimuth), as the 10-10 electrodes */
  a: [number, number]; b: [number, number];
  name: { en: string; de: string };
  where: { en: string; de: string };
}

/* The placements as the modelling literature defines them on real heads, carried onto the sphere through the 10-10
   positions near them:
   - bitemporal: the centre 2.5 cm above the midpoint of the line from the lateral canthus to the tragus (Lee 2012):
     about 15° above that midpoint, a little below and in front of FT7/FT8;
   - bifrontal: 5 cm above the lateral angle of each orbit (Lee 2012), between F7 and F3 (F8 and F4);
   - right unilateral (d'Elia): FT8 and C2, the positions Argyelan 2019 used for 151 patients;
   - left anterior right temporal: the left pad 5 cm in front of the left bitemporal site, the right at the right
     bitemporal site (Swartz & Nelson 2005). */
export const PLACEMENTS: Record<PlacementId, Placement> = {
  BT: { id: 'BT', a: [-100, -28], b: [100, 28], name: { en: 'Bitemporal', de: 'Bitemporal' },
    where: { en: 'each pad 2.5 cm above the midpoint between the outer corner of the eye and the tragus', de: 'jede Elektrode 2,5 cm über der Mitte zwischen äußerem Augenwinkel und Tragus' } },
  BF: { id: 'BF', a: [-80, -55], b: [80, 55], name: { en: 'Bifrontal', de: 'Bifrontal' },
    where: { en: 'each pad 5 cm above the outer angle of the orbit', de: 'jede Elektrode 5 cm über dem äußeren Orbitawinkel' } },
  RUL: { id: 'RUL', a: [92, 18], b: [23, 0], name: { en: 'Right unilateral (d’Elia)', de: 'Rechts unilateral (d’Elia)' },
    where: { en: 'one pad on the right temple, the other just right of the vertex', de: 'eine Elektrode an der rechten Schläfe, die andere knapp rechts des Scheitels' } },
  LART: { id: 'LART', a: [-100, -58], b: [100, 28], name: { en: 'Left anterior, right temporal', de: 'Links anterior, rechts temporal' },
    where: { en: 'the left pad 5 cm in front of the left temporal site, the right pad at the right temporal site', de: 'die linke Elektrode 5 cm vor der linken Temporalposition, die rechte an der rechten Temporalposition' } },
};

/** Points on the scalp covering a pad (unit directions), each carrying an equal share of the current. */
export function padPoints(centre: [number, number], rings = 3): Vec3[] {
  const c = sphericalDir(centre[0], centre[1]);
  const R = EEG.headRadius, radius = Math.sqrt((ECT.padArea * 100) / Math.PI) / R;   // angular radius
  const t = vec.unit(vec.cross(Math.abs(c[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], c)), b = vec.cross(c, t);
  const out: Vec3[] = [c];
  for (let k = 1; k <= rings; k++) for (let j = 0; j < 6 * k; j++) {
    const a = (2 * Math.PI * j) / (6 * k), arc = (radius * k) / rings;
    const dir = vec.add(vec.scale(t, Math.cos(a)), vec.scale(b, Math.sin(a)));
    out.push(vec.unit(vec.add(vec.scale(c, Math.cos(arc)), vec.scale(dir, Math.sin(arc)))));
  }
  return out;
}

export class StimulusField {
  readonly model: ForwardModel;
  readonly placement: Placement;
  private pa: Vec3[]; private pb: Vec3[];
  constructor(placement: Placement, head: Head = standardHead()) {
    this.model = new ForwardModel(head);
    this.placement = placement;
    this.pa = padPoints(placement.a); this.pb = padPoints(placement.b);
  }
  /** The field (V/m) at a point inside the brain (mm) for a current I (A) in at pad a, out at pad b. */
  at(r: Vec3, I = ECT.current): Vec3 {
    const g = (p: Vec3) => {
      let va = 0, vb = 0;
      for (const d of this.pa) va += this.model.scalp(r, p, d);
      for (const d of this.pb) vb += this.model.scalp(r, p, d);
      return va / this.pa.length - vb / this.pb.length;
    };
    /* the field is minus the potential's gradient; with current in at a, the lead field's sign gives it directly */
    return [g([1, 0, 0]) * 1000 * I, g([0, 1, 0]) * 1000 * I, g([0, 0, 1]) * 1000 * I];
  }
  magnitude(r: Vec3, I = ECT.current) { return vec.norm(this.at(r, I)); }

  /** The current that enters the brain (A): the inward flux through the brain's surface, over the injected current. */
  brainShare(n = 600): number {
    const rb = this.model.head.radii[0] - 0.5, sigma = this.model.head.sigma[0];
    let inflow = 0;
    for (let i = 0; i < n; i++) {
      const z = 1 - (2 * (i + 0.5)) / n, t = Math.acos(z), f = i * 2.399963229728653;
      const d: Vec3 = [Math.sin(t) * Math.cos(f), Math.sin(t) * Math.sin(f), z];
      const Er = vec.dot(this.at(vec.scale(d, rb), 1), d);      // V/m for 1 A
      inflow += Math.max(0, -Er) * sigma * (4 * Math.PI * (rb / 1000) ** 2) / n;
    }
    return inflow;
  }
}

/** The threshold field (V/cm) for a pulse of width w (ms). */
export function thresholdField(widthMs: number) {
  const tau = ECT.membraneTau, eInf = ECT.fieldThreshold03 * (1 - Math.exp(-0.3 / tau));
  return eInf / (1 - Math.exp(-widthMs / tau));
}

/** Standard normal cumulative distribution. */
function phi(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

export interface RegionDose {
  def: RegionDef;
  /** the field's median over the region's cortex (V/cm) */
  field: number;
  /** share of the region's cortex a pulse excites */
  excited: number;
}

/** Field and the share excited by one pulse in each region of the seizure model, for a placement and a pulse width. */
export function regionDoses(f: StimulusField, widthMs: number, I = ECT.current): RegionDose[] {
  const th = thresholdField(widthMs);
  return REGIONS.map((def) => {
    const pts = patchPoints({ at: toMap(sphericalDir(def.theta, def.phi)), depth: EEG.crownDepth, area: REGION_AREA, tilt: 0, toward: 0, density: 1 }, f.model.head, 2);
    const e = pts.map((p) => f.magnitude(p.r, I) / 100).sort((x, y) => x - y);
    const excited = e.reduce((s, x) => s + phi(Math.log(x / th) / ECT.thresholdSpread), 0) / e.length;
    return { def, field: e[e.length >> 1], excited };
  });
}

/** A stimulus as the device gives it. */
export interface StimulusSettings { frequency: number; pulseWidth: number; pulses: number }

/** The train for the brain: pulses of either polarity at twice the frequency, each region's push per pulse. */
export function pulseTrain(s: StimulusSettings, doses: RegionDose[]) {
  return { rate: 2 * s.frequency, count: s.pulses, area: doses.map((d) => ECT.pulseDrive * d.excited), release: ECT.synapseRelease, recovery: ECT.synapseRecovery };
}

/** Charge (mC) and energy (J) of a stimulus at a dynamic impedance (Ω). */
export function charge(s: StimulusSettings, I = ECT.current) { return I * s.pulseWidth * s.pulses; }
export function energy(s: StimulusSettings, dynamicOhm: number, I = ECT.current) { return (charge(s, I) / 1000) * I * dynamicOhm; }
export function duration(s: StimulusSettings) { return s.pulses / (2 * s.frequency); }

export interface FieldSection {
  /** the plane: through the head's centre and both pads; `up` the vertex's direction in it, `right` across */
  up: Vec3; right: Vec3;
  /** grid of field magnitudes (V/cm) over the head's square, row-major from the top; NaN outside the brain */
  n: number; grid: Float32Array; radius: number;
  /** the pads' centres in the plane's coordinates (units of the head radius, +y up) */
  pads: Array<[number, number]>;
}

/** The field's magnitude in the plane through both pads (for drawing). */
export function fieldSection(f: StimulusField, n = 48): FieldSection {
  const a = sphericalDir(...f.placement.a), b = sphericalDir(...f.placement.b);
  let nrm = vec.unit(vec.cross(a, b));
  if (!Number.isFinite(nrm[0])) nrm = [0, 1, 0];
  const z: Vec3 = [0, 0, 1];
  let up = vec.sub(z, vec.scale(nrm, vec.dot(z, nrm)));
  up = vec.norm(up) < 1e-6 ? vec.unit(vec.add(a, b)) : vec.unit(up);
  /* right is the patient's right when the plane is seen from behind or above: keep +x toward the patient's right */
  let right = vec.cross(up, nrm);
  if (right[0] < 0 || (Math.abs(right[0]) < 1e-6 && right[1] < 0)) { right = vec.scale(right, -1); }
  const R = f.model.R, rb = f.model.head.radii[0];
  const grid = new Float32Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = ((j + 0.5) / n) * 2 - 1, y = 1 - ((i + 0.5) / n) * 2;
    const p = vec.add(vec.scale(right, x * R), vec.scale(up, y * R));
    grid[i * n + j] = vec.norm(p) < rb - 0.5 ? f.magnitude(p) / 100 : NaN;
  }
  const pads = [a, b].map((d) => [vec.dot(d, right), vec.dot(d, up)] as [number, number]);
  return { up, right, n, grid, radius: R, pads };
}
