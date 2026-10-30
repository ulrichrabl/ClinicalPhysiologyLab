import { figureSvg, figureLookFor, POSES, viewAt, VIEW_FRONT, type FigureLook, type Pose } from './patient-figure.ts';
import { BED_TOP } from './figure-dress.ts';
import { toMap, sphericalDir } from '../measurements/eeg-forward.ts';
import { PLACEMENTS, type PlacementId } from '../physiology/brain/ect-stimulus.ts';
import { ECT } from '../evidence/ect.ts';

/* ===========================================================================
   The ECT patient, drawn (ECT station, PR B): the bedside figure lying on
   the trolley, seen from the right, and what the team puts on him: the
   stimulus pads, the EEG leads from above the eyebrow to the mastoid, the
   ECG on the chest, the EMG on the right forearm with the cuff on the upper
   arm (the device's manual: two electrodes about 3 inches apart on a limb
   cuffed against the relaxant, the arm with the standard leads; the owner
   uses the arm),
   the cannula, the mask and bag, the bite block. A close-up shows the same
   head enlarged and upright; the head seen from above carries the pad sites
   the learner chooses.

   Everything on the head is placed in the head's own frame (figure-head.ts:
   a up toward the crown, b forward toward the face, reference cm), so it
   sits where the placements are defined on real heads:
   - bitemporal and the right unilateral's temporal pad: 2.5 cm above the
     midpoint of the line from the lateral canthus to the tragus (Lee 2012,
     as ect-stimulus.ts); in the figure the canthus is at about (8.3, 7.1)
     and the tragus (6.6, −0.2), so the pad's centre is at (9.95, 3.45);
   - bifrontal: 5 cm above the lateral angle of the orbit (8.6, 7.3);
   - the right unilateral's vertex pad: just right of the vertex, seen from
     the right on the top of the skull;
   - the EEG: above the eyebrow (Fp2) and on the mastoid behind the ear.
   A pad is a disc of the pads' area (ECT.padArea), seen face-on on the side
   of the head and edge-on on the top or the front.
=========================================================================== */

type Pt = { x: number; y: number };
const f = (x: number) => (Math.round(x * 10) / 10).toString();

/** the ECT patient: the reference adult of the station (59 years) */
export const ECT_FIGURE_PATIENT = { age: 59, sex: 'M' as const, heightCm: 176, weightKg: 76, appearance: { skinTone: 2, hair: 'grey, short', build: 'average' as const, eyes: 'blue' } };

export interface EctFigure {
  svg: string;
  /** the head frame: origin and unit axes as drawn */
  o: Pt; ea: Pt; eb: Pt;
  wristR: Pt; elbowR: Pt; upperArmR: Pt; forearmR: [Pt, Pt]; chest: [number, number, number, number];
  /** the right arm's two outline edges across the cuff's place (as drawn), so that the cuff wraps the arm itself */
  armEdges: [Pt, Pt];
}

/** the right arm where the cuff goes: its place on the upper arm, the elbow, the arm's two outline edges across that
    place (the outline points nearest the line through it at right angles to the upper arm), the EMG's two points */
interface ArmGeom { c: Pt; e: Pt; edges: [Pt, Pt]; fore: [Pt, Pt] }
function armAt(got: Record<string, Pt[]>, reach = 2.2, fallback = 3.5): ArmGeom {
  const c = got.upperArmR[0], e = got.elbowR[0], al = Math.hypot(e.x - c.x, e.y - c.y) || 1;
  const ax = { x: (e.x - c.x) / al, y: (e.y - c.y) / al }, nx = { x: -ax.y, y: ax.x };
  const along = (q: Pt) => (q.x - c.x) * ax.x + (q.y - c.y) * ax.y, across = (q: Pt) => (q.x - c.x) * nx.x + (q.y - c.y) * nx.y;
  const near = (got.armR ?? []).filter((q) => Math.abs(along(q)) < reach);
  const side = (sg: number) => near.filter((q) => sg * across(q) > 0).reduce<Pt | null>((m, q) => (!m || Math.abs(across(q)) > Math.abs(across(m)) ? q : m), null) ?? { x: c.x + sg * fallback * nx.x, y: c.y + sg * fallback * nx.y };
  return { c, e, edges: [side(-1), side(1)], fore: [got.forearmR[0], got.forearmR[1]] };
}

/* ---- the kit, drawn at any scale (u: drawing units per cm) ------------------------------------------------------ */

/** a stick-on snap monitoring electrode, its long side along `rot` */
function snapSvg(c: Pt, rot: number, u: number): string {
  return `<rect x="${f(c.x - (MON_W * u) / 2)}" y="${f(c.y - (MON_H * u) / 2)}" width="${f(MON_W * u)}" height="${f(MON_H * u)}" rx="${f(0.4 * u)}" transform="rotate(${f(rot)} ${f(c.x)} ${f(c.y)})" fill="#f7f7f4" stroke="#a9aba6" stroke-width="${f(0.2 * u)}"/><circle cx="${f(c.x)}" cy="${f(c.y)}" r="${f(0.35 * u)}" fill="#c9ccce" stroke="#8a8d90" stroke-width="${f(0.14 * u)}"/>`;
}
/** a lead-wire: from a point through two control points to an end (a cubic, so that it can drape) */
function wireSvg(col: string, a: Pt, c1: Pt, c2: Pt, b: Pt, u: number, w = 0.3): string {
  return `<path d="M${f(a.x)} ${f(a.y)} C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(b.x)} ${f(b.y)}" fill="none" stroke="${col}" stroke-width="${f(w * u)}" stroke-linecap="round"/>`;
}
/** the cuff round the upper arm: a band across the whole arm, standing a little proud of it and more so as it fills; its
    ends bow along the arm as a ring round a cylinder does; the shade where it curves away at both edges; the overlapping
    end with its Velcro; the tube leaving from its edge (returned, for the gauge) */
function cuffSvg(g: ArmGeom, mmHg: number, u: number): { svg: string; outlet: Pt } {
  const [p, q] = g.edges, al = Math.hypot(g.e.x - g.c.x, g.e.y - g.c.y) || 1, ax = { x: (g.e.x - g.c.x) / al, y: (g.e.y - g.c.y) / al };
  const nl = Math.hypot(q.x - p.x, q.y - p.y) || 1, nn = { x: (q.x - p.x) / nl, y: (q.y - p.y) / nl };
  const full = Math.min(1, mmHg / 250), proud = (0.35 + 0.5 * full) * u, half = 3.8 * u;   // an adult cuff about 7.5 cm wide on the arm
  const P = (t: number, k: number): Pt => ({ x: p.x + (q.x - p.x) * k - nn.x * proud * (1 - 2 * k) + ax.x * t, y: p.y + (q.y - p.y) * k - nn.y * proud * (1 - 2 * k) + ax.y * t });
  const bow = (u0: Pt, u1: Pt, t: number) => { const m = { x: (u0.x + u1.x) / 2 + ax.x * t, y: (u0.y + u1.y) / 2 + ax.y * t }; return `Q${f(m.x)} ${f(m.y)} ${f(u1.x)} ${f(u1.y)}`; };
  const a0 = P(-half, 0), b0 = P(-half, 1), a1 = P(half, 0), b1 = P(half, 1), k = 0.9 * u;
  const line = (k0: number) => { const u0 = P(-half, k0), u1 = P(half, k0); return `${f(u0.x)} ${f(u0.y)} L${f(u1.x)} ${f(u1.y)}`; };
  const v0 = P(-half + 1.4 * u, 0.22), v1 = P(-half + 1.4 * u, 0.78);
  const svg = `<path d="M${f(a0.x)} ${f(a0.y)} ${bow(a0, b0, -k)} L${f(b1.x)} ${f(b1.y)} ${bow(b1, a1, -k)} Z" fill="#3e6f8f" stroke="#284a60" stroke-width="${f(0.3 * u)}" stroke-linejoin="round"/>`
    + `<path d="M${f(a1.x)} ${f(a1.y)} ${bow(a1, b1, k)}" fill="none" stroke="#284a60" stroke-width="${f(0.28 * u)}" opacity=".7"/>`
    + `<path d="M${line(0.04)}" stroke="#284a60" stroke-width="${f(0.6 * u)}" opacity=".45"/><path d="M${line(0.96)}" stroke="#284a60" stroke-width="${f(0.6 * u)}" opacity=".45"/>`
    + `<path d="M${f(v0.x)} ${f(v0.y)} L${f(v1.x)} ${f(v1.y)}" stroke="#6f9ab6" stroke-width="${f(0.75 * u)}" opacity=".8"/>`;
  return { svg, outlet: P(0.9 * u, 1) };
}

/** the cuff's gauge (0–300 mmHg) and its bulb below */
function gaugeSvg(g: Pt, mmHg: number): string {
  const nr = ((-220 + 260 * Math.min(1, mmHg / 300)) * Math.PI) / 180;
  return `<circle cx="${f(g.x)}" cy="${f(g.y)}" r="7" fill="#f7f7f2" stroke="#555" stroke-width=".7"/><line x1="${f(g.x)}" y1="${f(g.y)}" x2="${f(g.x + 5.5 * Math.cos(nr))}" y2="${f(g.y + 5.5 * Math.sin(nr))}" stroke="#b3261e" stroke-width=".8"/>`
    + `<ellipse cx="${f(g.x + 2)}" cy="${f(g.y + 16)}" rx="4" ry="6" fill="#2b2b2b"/><path d="M${f(g.x)} ${f(g.y + 7)} L${f(g.x + 2)} ${f(g.y + 10)}" stroke="#444" stroke-width=".7"/>`;
}

export function ectLook(seed = 7): FigureLook { return figureLookFor(ECT_FIGURE_PATIENT, { exposure: [] }, seed); }

/** the patient lying on the trolley, seen from his right; `jerk` (degrees) moves the cuffed right arm in the motor
    seizure: the elbow and the wrist flex a little with each clonic jerk */
export function ectFigure(look: FigureLook, jerk = 0): EctFigure {
  const b = POSES.supine;
  const pose: Pose = { ...b, armFore: [b.armFore[0] + jerk * 0.6, b.armFore[1]], hand: [b.hand[0] + jerk, b.hand[1]] };
  const got: Record<string, Pt[]> = {};
  const svg = figureSvg(pose, look, viewAt(0), { collect: (k, side, pts) => { (got[k + side] ??= []).push(...pts); } });
  const [o, A, B] = got.headFrame;
  const xs = (got.chest ?? []).map((p) => p.x), ys = (got.chest ?? []).map((p) => p.y);
  const armEdges = armAt(got).edges;
  return { armEdges, svg, o, ea: { x: A.x - o.x, y: A.y - o.y }, eb: { x: B.x - o.x, y: B.y - o.y }, wristR: got.wristR[0], elbowR: got.elbowR[0], upperArmR: got.upperArmR[0], forearmR: [got.forearmR[0], got.forearmR[1]],
    chest: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
}

/* ---- the pad sites ------------------------------------------------------------------------------------------- */

export type SiteId = 'Ltemp' | 'Rtemp' | 'Lfront' | 'Rfront' | 'vertexR' | 'LantL';
/** each site: where it is on the sphere (as PLACEMENTS), and where on the right profile, if it shows there (a, b, how it is seen) */
export const SITES: Record<SiteId, { sph: [number, number]; profile?: { a: number; b: number; seen: 'face' | 'top' | 'front' } }> = {
  Rtemp: { sph: PLACEMENTS.BT.b, profile: { a: 9.95, b: 3.45, seen: 'face' } },
  Ltemp: { sph: PLACEMENTS.BT.a },
  Rfront: { sph: PLACEMENTS.BF.b, profile: { a: 13.4, b: 7.0, seen: 'front' } },
  Lfront: { sph: PLACEMENTS.BF.a },
  vertexR: { sph: PLACEMENTS.RUL.b, profile: { a: 18.9, b: 0.6, seen: 'top' } },
  LantL: { sph: PLACEMENTS.LART.a },
};
/** which two sites make each placement (the right unilateral's temporal pad is taken at the bitemporal site) */
export const PLACEMENT_SITES: Record<PlacementId, [SiteId, SiteId]> = { BT: ['Ltemp', 'Rtemp'], BF: ['Lfront', 'Rfront'], RUL: ['Rtemp', 'vertexR'], LART: ['LantL', 'Rtemp'] };
/** the placement two chosen sites make, or null if they are not a standard pair */
export function placementOf(sites: SiteId[]): PlacementId | null {
  if (sites.length !== 2) return null;
  for (const [id, pair] of Object.entries(PLACEMENT_SITES) as Array<[PlacementId, [SiteId, SiteId]]>) if (pair.every((s) => sites.includes(s))) return id;
  return null;
}

/* ---- what is on the patient ----------------------------------------------------------------------------------- */

export interface EctDress {
  /** the pads on the head */
  pads: SiteId[];
  /** the skin cleaned at the pad sites (a sheen) */
  cleaned: boolean;
  leads: boolean;
  /** the cuff on the right upper arm: on, and its pressure (mmHg) */
  cuff: { on: boolean; mmHg: number } ;
  mask: boolean; bagging: boolean; biteBlock: boolean;
}
export const NO_DRESS: EctDress = { pads: [], cleaned: false, leads: false, cuff: { on: false, mmHg: 0 }, mask: false, bagging: false, biteBlock: false };

const PAD_R = Math.sqrt(ECT.padArea / Math.PI);   // cm: a disc of the pad's area (the map from above)
/* a Thymapad: 4.2 × 4.9 cm (Unal 2023, ECT.padArea), a white foam rectangle with a short lead ending in a socket for the
   stimulus cable's banana plug (the device's manual, "Stimulus electrodes application") */
const PAD_W = 4.2, PAD_H = 4.9;
/* a stick-on snap monitoring electrode: rectangular (the manual), about 2.4 × 3.4 cm (assumed: the size of common adult
   snap electrodes) */
const MON_W = 2.4, MON_H = 3.4;
/* the lead-wires' colours (the manual): each channel one black (negative) and one red (positive); the ground green */
const BLACK = '#26282b', RED = '#c0352b', GREEN = '#2f8a47';

function onHead(F: EctFigure) {
  const H = (a: number, b: number): Pt => ({ x: F.o.x + a * F.ea.x + b * F.eb.x, y: F.o.y + a * F.ea.y + b * F.eb.y });
  const s = Math.hypot(F.ea.x, F.ea.y);              // px per head cm
  const ang = (Math.atan2(F.ea.y, F.ea.x) * 180) / Math.PI;   // the head's "up", in the drawing
  return { H, s, ang };
}

/** everything the team put on the patient, over the figure */
export function dressSvg(F: EctFigure, d: EctDress, t = 0, headOnly = false): string {
  const { H, s, ang } = onHead(F);
  const out: string[] = [];
  const PAD = '#f6f4ee', PADLINE = '#9a9585', CABLE = '#4c5560';
  /* every lead and cable gathers at the head end of the bed, on the mattress beside the pillow, where the grey monitoring
     and stimulus cables go on to the device; a wire lying on the patient hangs down to the mattress and runs along it */
  const u = s / 1.06, T = { x: 18, y: BED_TOP - 1.5 };
  const hang = (a: Pt, col: string, w = 0.3) => out.push(wireSvg(col, a, { x: a.x, y: a.y + (BED_TOP - a.y) * 0.85 }, { x: T.x + (a.x - T.x) * 0.45, y: BED_TOP - 1 }, T, u, w));
  /* the cleaned skin: a faint sheen where the pads go */
  if (d.cleaned) for (const id of ['Rtemp', 'Rfront', 'vertexR'] as SiteId[]) { const p = SITES[id].profile!; const c = H(p.a, p.b); out.push(`<circle cx="${f(c.x)}" cy="${f(c.y)}" r="${f(PAD_R * s * 1.15)}" fill="#ffffff" opacity=".1"/>`); }
  /* the stimulus pads and their cable, toward the device at the head of the bed */
  for (const id of d.pads) {
    const p = SITES[id].profile; if (!p) continue;
    const c = H(p.a, p.b);
    /* the pad's long side runs up the head; on the side of the head it is seen face-on, on the top edge-on, on the
       front-lateral forehead about half turned */
    const w = PAD_W * s, h = PAD_H * s * (p.seen === 'face' ? 1 : p.seen === 'top' ? 0.28 : 0.5);
    const rot = p.seen === 'top' ? ang : ang - 90;
    out.push(`<rect x="${f(c.x - h / 2)}" y="${f(c.y - w / 2)}" width="${f(h)}" height="${f(w)}" rx="${f(0.5 * s)}" transform="rotate(${f(rot + 90)} ${f(c.x)} ${f(c.y)})" fill="${PAD}" stroke="${PADLINE}" stroke-width=".5"/>`);
    /* its lead leaves the upper back edge and ends in the socket the cable's plug goes into */
    const edge = H(p.a + (p.seen === 'top' ? 0.6 : 2.2), p.b - (p.seen === 'top' ? 2.3 : 1.2)), sock = H(p.a + (p.seen === 'top' ? 1.4 : 3.6), p.b - 4.2);
    out.push(`<path d="M${f(edge.x)} ${f(edge.y)} L${f(sock.x)} ${f(sock.y)}" stroke="#9aa3aa" stroke-width=".5"/><circle cx="${f(sock.x)}" cy="${f(sock.y)}" r="${f(0.45 * s)}" fill="#d9dde0" stroke="#7b848b" stroke-width=".35"/>`);
    /* the stimulus cable from the socket back over the crown, down to the head end of the bed */
    const over = H(p.a + 4, p.b - 9);
    out.push(wireSvg(CABLE, sock, over, { x: T.x + 14, y: T.y - 10 }, T, u, 0.55));
  }
  /* the monitoring leads (the device's manual): stick-on snap electrodes; each channel's black and red lead-wires, the green
     ground on the shoulder. EEG: above the right eyebrow (black) and on the right mastoid (red), as the model's channel 2;
     ECG: two on the front of the chest, above and below the heart, about 8 inches apart; EMG: two on the cuffed forearm,
     about 3 inches apart */
  if (d.leads) {
    /* the EEG: the frontal electrode's lead runs back over the scalp to the crown, the mastoid's straight down behind the
       ear; both then drop to the mattress at the head end */
    const fp = H(11.7, 8.9), ms = H(3.4, -4.8);       // just above the eyebrow (the brow at a ≈ 10.3–10.9), clear of a bifrontal pad
    out.push(snapSvg(fp, ang, s), snapSvg(ms, ang + 90, s));
    out.push(wireSvg(BLACK, fp, H(16, 2), H(9, -15), T, u));
    out.push(wireSvg(RED, ms, H(1.5, -7), { x: T.x + 12, y: T.y - 4 }, T, u));
    /* the ECG: the front of the chest is the top of its outline in this profile; the two electrodes 20 cm apart along it,
       the upper below the clavicle, the lower over the lower sternum (the close-up from above shows where on the chest);
       the ground on the point of the shoulder, 10 cm above the cuff */
    if (!headOnly) {
    const [x0, y0] = F.chest, e1 = { x: x0 + 7 * u, y: y0 + 1.4 }, e2 = { x: x0 + 27 * u, y: y0 + 1.4 };
    const A = armAt({ upperArmR: [F.upperArmR], elbowR: [F.elbowR], armR: [], forearmR: F.forearmR }), al = Math.hypot(A.e.x - A.c.x, A.e.y - A.c.y) || 1;
    const sh = { x: F.armEdges[0].x - ((A.e.x - A.c.x) / al) * 10 * u, y: F.armEdges[0].y - ((A.e.y - A.c.y) / al) * 10 * u + 1 };
    out.push(snapSvg(e1, 90, u), snapSvg(e2, 90, u), snapSvg(sh, 90, u));
    hang(e1, RED); hang(e2, BLACK); hang(sh, GREEN);
    /* the EMG on the forearm below the cuff */
    const [f1, f2] = F.forearmR, fa = (Math.atan2(f2.y - f1.y, f2.x - f1.x) * 180) / Math.PI;
    out.push(snapSvg(f1, fa + 90, u), snapSvg(f2, fa + 90, u));
    hang(f1, RED); hang(f2, BLACK);
    }
  }
  /* the cuff round the right upper arm, its tube to the gauge and bulb hanging over the side of the bed */
  if (d.cuff.on && !headOnly) {
    const g: ArmGeom = { c: F.upperArmR, e: F.elbowR, edges: F.armEdges, fore: F.forearmR };
    const cf = cuffSvg(g, d.cuff.mmHg, u);
    out.push(cf.svg);
    const o = cf.outlet, gg = { x: g.c.x + 4, y: BED_TOP + 24 };
    out.push(`<path d="M${f(o.x)} ${f(o.y)} Q${f(o.x - 2)} ${f(BED_TOP + 6)} ${f(gg.x - 6)} ${f(gg.y)}" fill="none" stroke="#444" stroke-width=".7"/>`);
    out.push(gaugeSvg(gg, d.cuff.mmHg));
  }
  /* the grey cables from the head end of the bed to the device */
  if (d.leads || d.pads.length) out.push(`<path d="M${f(T.x)} ${f(T.y)} C${f(T.x - 4)} ${f(T.y)} ${f(T.x - 6)} ${f(T.y - 2)} 0 ${f(T.y - 6)}" fill="none" stroke="#6b7177" stroke-width="2"/>`);
  /* the mask over nose and mouth, and the bag above it, squeezed while ventilating */
  if (d.mask) {
    /* a clear mask from the bridge of the nose to below the lower lip, its cushion on the cheeks, its dome over the nose */
    const m = [H(7.4, 10.2), H(6.2, 13.6), H(3.2, 15.0), H(0.4, 13.4), H(-1.2, 10.6), H(0.8, 9.4), H(4.4, 9.2)];
    const path = (pts: Pt[]) => `M${pts.map((p) => `${f(p.x)} ${f(p.y)}`).join(' L')} Z`;
    out.push(`<path d="${path(m)}" fill="rgba(220,236,241,.6)" stroke="#7aa3b3" stroke-width="${f(0.22 * s)}" stroke-linejoin="round"/>`);
    out.push(`<path d="${path([H(7.2, 10.3), H(4.4, 9.4), H(0.8, 9.6), H(-1.0, 10.7)])}" fill="none" stroke="#5f8fa1" stroke-width="${f(0.45 * s)}" stroke-linejoin="round" opacity=".8"/>`);
    /* the connector and the bag on it, held above the face, squeezed while ventilating (16 a minute) */
    const squeeze = d.bagging ? 0.18 * (1 + Math.sin(t * 2 * Math.PI * (16 / 60))) : 0;
    const c0 = H(3.2, 15.0), c1 = H(3.6, 17.6), bag = H(4.0, 23.4);
    out.push(`<path d="M${f(c0.x)} ${f(c0.y)} L${f(c1.x)} ${f(c1.y)}" stroke="#5f8fa1" stroke-width="${f(1.3 * s)}" stroke-linecap="round"/>`);
    out.push(`<ellipse cx="${f(bag.x)}" cy="${f(bag.y)}" rx="${f(6 * s)}" ry="${f(3.2 * s * (1 - squeeze))}" transform="rotate(${f(ang + 90)} ${f(bag.x)} ${f(bag.y)})" fill="#e8d7a8" stroke="#a48f55" stroke-width=".6"/>`);
    const tail = H(4.2, 31);
    out.push(`<path d="M${f(H(4.1, 29.2).x)} ${f(H(4.1, 29.2).y)} L${f(tail.x)} ${f(tail.y)}" stroke="#7aa3b3" stroke-width="${f(0.9 * s)}" stroke-linecap="round"/>`);
  }
  return `<g pointer-events="none">${out.join('')}</g>`;
}

/** where taps land on the scene: the head (the close-up), the chest (the leads), the right arm (the cuff) */
function hitsSvg(F: EctFigure): string {
  const { H, s } = onHead(F);
  const c = H(9, 2), [x0, y0, x1, y1] = F.chest, a = F.upperArmR;
  return `<g class="ect-hits"><circle data-hit="head" cx="${f(c.x)}" cy="${f(c.y)}" r="${f(12 * s)}" fill="transparent"/>`
    + `<rect data-hit="chest" x="${f(x0)}" y="${f(y0 - 6)}" width="${f(x1 - x0)}" height="${f(y1 - y0 + 6)}" fill="transparent"/>`
    + `<rect data-hit="arm" x="${f(a.x - 16)}" y="${f(a.y - 10)}" width="40" height="22" fill="transparent"/></g>`;
}

/** the whole patient on the trolley; the SVG's viewBox crops the figure's 360 × 380 to the bed */
export const SCENE_VIEWBOX = '10 172 345 112';
export function sceneSvg(F: EctFigure, d: EctDress, t = 0): string { return `${F.svg}${dressSvg(F, d, t)}${hitsSvg(F)}`; }

/** the head enlarged and turned upright, from the right: a viewBox and the content (the same figure and dress) */
export function headCloseUp(F: EctFigure, d: EctDress, t = 0): { viewBox: string; svg: string } {
  const { H, s, ang } = onHead(F);
  const c = H(9.5, 1.5);
  const half = 18.5 * s;
  /* turn the drawing about the head's centre so that its "up" points up the page */
  const rot = -90 - ang;
  return { viewBox: `${f(c.x - half)} ${f(c.y - half)} ${f(2 * half)} ${f(2 * half)}`,
    svg: `<g transform="rotate(${f(rot)} ${f(c.x)} ${f(c.y)})">${F.svg}${dressSvg(F, d, t, true)}</g>` };
}

/** The chest and the right arm from above (the patient lying on his back, seen as the chest views of the ECG station draw
    him: standing, from the front, in chest centimetres with the 4th intercostal space at the midline at (0, 0) and the
    patient's right on the viewer's left): the two ECG electrodes above and below the heart, about 8 inches apart (the
    device's manual), the upper below the right clavicle beside the sternum, the lower over the left lower chest; the
    ground on the right shoulder; the cuff round the right upper arm and the EMG on the forearm below it. The leads lie on
    the body and run up toward the head, where they leave the picture to the device. */
export const CHEST_VIEWBOX = '-31 -24 48 76';
export function chestCloseUp(look: FigureLook, d: EctDress): string {
  const got: Record<string, Pt[]> = {};
  const bare: FigureLook = { ...look, exposed: new Set(['chest', 'abdomen', 'arm', 'neck']) };
  const body = figureSvg(POSES.standing, bare, VIEW_FRONT, { scene: false, head: false, chestFrame: true, collect: (k, side, pts) => { (got[k + side] ??= []).push(...pts); } });
  const out: string[] = [];
  const exit = { x: -24, y: -24 };                                  // toward the head end, beside the right shoulder
  const run = (a: Pt, col: string) => out.push(wireSvg(col, a, { x: a.x - 2, y: a.y - 5 }, { x: exit.x + 3, y: exit.y + 7 }, exit, 1, 0.32));
  if (d.leads) {
    const g = armAt(got, 1.2, 4);
    const e1 = { x: -5, y: -6.2 }, e2 = { x: 6, y: 11.5 };          // 20 cm apart: below the clavicle, and below the heart
    /* the point of the right shoulder: the acromion, about 19 cm from the midline (40 cm across the acromions in a man,
       the figure's brief) at the level of the outer clavicle */
    const shoulder = { x: -16.8, y: -9.6 };
    out.push(snapSvg(e1, 0, 1), snapSvg(e2, 0, 1), snapSvg(shoulder, 0, 1));
    run(e1, RED); run(e2, BLACK); run(shoulder, GREEN);
    const [f1, f2] = g.fore, fa = (Math.atan2(f2.y - f1.y, f2.x - f1.x) * 180) / Math.PI;
    out.push(snapSvg(f1, fa + 90, 1), snapSvg(f2, fa + 90, 1));
    run(f1, RED); run(f2, BLACK);
  }
  if (d.cuff.on) {
    const g = armAt(got, 1.2, 4), cf = cuffSvg(g, d.cuff.mmHg, 1);
    out.push(cf.svg, `<path d="M${f(cf.outlet.x)} ${f(cf.outlet.y)} Q${f(cf.outlet.x - 3)} ${f(cf.outlet.y + 6)} -31 ${f(cf.outlet.y + 10)}" fill="none" stroke="#444" stroke-width=".4"/>`);
  }
  return `${body}<g pointer-events="none">${out.join('')}</g>`;
}

/** the head from above, nose up, the patient's right on the right of the page (as the station's other maps): the six
    sites, the chosen ones as pads */
export function topViewSvg(chosen: SiteId[], labels: { nose: string; left: string; right: string }, site: Partial<Record<SiteId, string>> = {}): string {
  const R = 100, C = 120, head = R * (90 / 130);
  const at = (sph: [number, number]) => { const [x, y] = toMap(sphericalDir(sph[0], sph[1])); return { x: C + x * R, y: C + y * R }; };
  const pr = (PAD_R / 9.2) * head;   // the pad on a head of 9.2 cm radius
  const out = [`<circle cx="${C}" cy="${C}" r="${f(head)}" fill="var(--surface, #fff)" stroke="currentColor" stroke-width="1.2"/>`,
    `<path d="M${C - 9} ${f(C - head + 1)} L${C} ${f(C - head - 12)} L${C + 9} ${f(C - head + 1)}" fill="none" stroke="currentColor" stroke-width="1.2"/>`,
    `<ellipse cx="${f(C - head - 4)}" cy="${C}" rx="5" ry="11" fill="none" stroke="currentColor" stroke-width="1.2"/><ellipse cx="${f(C + head + 4)}" cy="${C}" rx="5" ry="11" fill="none" stroke="currentColor" stroke-width="1.2"/>`,
    `<text x="${C}" y="${f(C - head - 16)}" text-anchor="middle" font-size="11" fill="currentColor">${labels.nose}</text>`,
    `<text x="8" y="${C + 32}" font-size="11" fill="currentColor">${labels.left}</text><text x="${2 * C - 8}" y="${C + 32}" text-anchor="end" font-size="11" fill="currentColor">${labels.right}</text>`];
  for (const id of Object.keys(SITES) as SiteId[]) {
    const p = at(SITES[id].sph), on = chosen.includes(id);
    /* a site not chosen is a small target (the pads would overlap: the left frontal and anterior sites lie 2 cm apart); a
       chosen one is drawn as the pad, to scale */
    out.push(`<g data-site="${id}" role="button" tabindex="0" aria-pressed="${on}" aria-label="${site[id] ?? id}" class="ect-site${on ? ' on' : ''}"><circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(on ? pr : 9)}" fill="${on ? '#f4f1e8' : 'var(--surface, #fff)'}" stroke="${on ? '#8b8676' : 'currentColor'}" stroke-width="${on ? 1.2 : 1.4}"/>${on ? `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(pr * 0.25)}" fill="#cfd6da"/>` : `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="2.5" fill="currentColor"/>`}<circle cx="${f(p.x)}" cy="${f(p.y)}" r="13" fill="transparent"/></g>`);
  }
  return out.join('');
}
