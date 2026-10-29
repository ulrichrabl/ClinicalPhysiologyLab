import { ForwardModel, standardHead, patchPoints, leadField, fieldAt, fieldInside, fromMap, tangentToward, vec, ALL_ELECTRODES, type PatchPoint, type Vec3 } from '../measurements/eeg-forward.ts';
import { readField, type FieldReading } from '../measurements/eeg-montage.ts';
import { dischargeAt, recordPage, type Page, type Source } from '../measurements/eeg-record.ts';
import type { EegScene } from './eeg-presets.ts';

/* ---------------------------------------------------------------------------
   A scene in the EEG station, computed: the head, the patch as dipoles,
   its field at every electrode (µV at the discharge's peak), the field as
   a reader would read it, and the page the machine records.
--------------------------------------------------------------------------- */

const models = new Map<string, ForwardModel>();
export function modelFor(scene: Pick<EegScene, 'skullRatio' | 'csf'>): ForwardModel {
  const key = `${scene.skullRatio ?? 'reg'}|${scene.csf}`;
  let m = models.get(key);
  if (!m) { m = new ForwardModel(standardHead({ skullRatio: scene.skullRatio ?? undefined, csf: scene.csf })); models.set(key, m); }
  return m;
}

export interface Computed {
  model: ForwardModel;
  pts: PatchPoint[];
  /** signed density: negative-end-outward strength per area, with the polarity applied */
  density: number;
  /** µV at each electrode at the discharge's peak */
  field: Record<string, number>;
  reading: FieldReading;
}

export function compute(scene: EegScene): Computed {
  const model = modelFor(scene);
  const pts = patchPoints(scene.patch, model.head);
  const density = scene.patch.density * (scene.polarity === 'negative' ? 1 : -1);
  const field = leadField(model, pts, density, ALL_ELECTRODES);
  return { model, pts, density, field, reading: readField(field) };
}

/** The discharges' peaks on a page (ms): the first a second in, then every `every` seconds. */
export const peaksOn = (scene: EegScene, seconds: number) => {
  const out: number[] = [];
  for (let t = 1000; t < seconds * 1000 - 300; t += scene.every * 1000) out.push(t);
  return out;
};

export function sourcesOf(scene: EegScene, c: Computed, seconds: number): Source[] {
  const peaks = peaksOn(scene, seconds);
  return [{ field: c.field, course: (t) => { let v = 0; for (const p of peaks) v += dischargeAt(scene.discharge, t - p); return v; } }];
}

export const pageOf = (scene: EegScene, c: Computed, seconds = 10): Page => recordPage(sourcesOf(scene, c, seconds), ALL_ELECTRODES, seconds);

/* ---- the field drawn: on the scalp from above, and in a section through the source ---------------- */

/** The scalp potential (µV at the peak) on an n × n grid over the map's unit disk; NaN outside the head. */
export function mapGrid(c: Computed, n: number): Float32Array {
  const g = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n) * 2 - 1, y = ((j + 0.5) / n) * 2 - 1;
    g[j * n + i] = Math.hypot(x, y) > 1 ? NaN : fieldAt(c.model, c.pts, c.density, fromMap(x, y));
  }
  return g;
}

export interface Section {
  /** the plane's two axes: u drawn up, v drawn right */
  u: Vec3; v: Vec3;
  n: number;
  /** µV at the peak, row by row from the top, NaN outside the head */
  values: Float32Array;
  R: number;
}

/** A section through the head's centre, the patch's centre and the direction its dipole leans (or, for a radial patch,
    the head's vertical, so the section is coronal-like where it can be). */
export function sectionOf(scene: EegScene, c: Computed, n: number): Section {
  const centre = fromMap(scene.patch.at[0], scene.patch.at[1]);
  let lean: Vec3;
  if (scene.patch.tilt > 1) lean = tangentToward(scene.patch.at, scene.patch.toward);
  else {
    /* a radial patch: the plane through it and the vertical, or (at the vertex) the coronal plane */
    const side = vec.cross([0, 1, 0], centre);
    lean = vec.norm(side) > 0.2 ? vec.unit(side) : [1, 0, 0];
  }
  lean = vec.unit(vec.sub(lean, vec.scale(centre, vec.dot(lean, centre))));
  const normal = vec.unit(vec.cross(centre, lean));
  /* drawn upright: "up" is the head's vertical as it lies in the plane (forward if the plane is nearly horizontal);
     "right" is the patient's right where it can be, as on the map seen from above and behind */
  const inPlaneOf = (d: Vec3) => vec.sub(d, vec.scale(normal, vec.dot(d, normal)));
  let u = inPlaneOf([0, 0, 1]);
  if (vec.norm(u) < 0.3) u = inPlaneOf([0, 1, 0]);
  u = vec.unit(u);
  let v = vec.unit(vec.cross(u, normal));
  if (Math.abs(v[0]) > 0.2 ? v[0] < 0 : v[1] < 0) v = vec.scale(v, -1);
  const R = c.model.R, values = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = (1 - ((j + 0.5) / n) * 2) * R, b = (((i + 0.5) / n) * 2 - 1) * R;
    if (Math.hypot(a, b) > R) { values[j * n + i] = NaN; continue; }
    const p: Vec3 = vec.add(vec.scale(u, a), vec.scale(v, b));
    values[j * n + i] = fieldInside(c.model, c.pts, c.density, p);
  }
  return { u, v, n, values, R };
}
