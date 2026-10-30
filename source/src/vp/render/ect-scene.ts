import { figureSvg, figureLookFor, POSES, viewAt, type FigureLook, type Pose } from './patient-figure.ts';
import { toMap, sphericalDir } from '../measurements/eeg-forward.ts';
import { PLACEMENTS, type PlacementId } from '../physiology/brain/ect-stimulus.ts';
import { ECT } from '../evidence/ect.ts';

/* ===========================================================================
   The ECT patient, drawn (ECT station, PR B): the bedside figure lying on
   the trolley, seen from the right, and what the team puts on him: the
   stimulus pads, the EEG leads from above the eyebrow to the mastoid, the
   ECG on the chest, the EMG on the right foot with the cuff above the ankle,
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
  ankleR: Pt; wristR: Pt; chest: [number, number, number, number];
}

export function ectLook(seed = 7): FigureLook { return figureLookFor(ECT_FIGURE_PATIENT, { exposure: [] }, seed); }

/** the patient lying on the trolley, seen from his right; `footJerk` (degrees) moves the cuffed foot in the motor seizure */
export function ectFigure(look: FigureLook, footJerk = 0): EctFigure {
  const pose: Pose = { ...POSES.supine, foot: [POSES.supine.foot[0] + footJerk, POSES.supine.foot[1]] };
  const got: Record<string, Pt[]> = {};
  const svg = figureSvg(pose, look, viewAt(0), { collect: (k, side, pts) => { (got[k + side] ??= []).push(...pts); } });
  const [o, A, B] = got.headFrame;
  const xs = (got.chest ?? []).map((p) => p.x), ys = (got.chest ?? []).map((p) => p.y);
  return { svg, o, ea: { x: A.x - o.x, y: A.y - o.y }, eb: { x: B.x - o.x, y: B.y - o.y }, ankleR: got.ankleR[0], wristR: got.wristR[0],
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
  /** the cuff above the right ankle: on, and its pressure (mmHg) */
  cuff: { on: boolean; mmHg: number } ;
  mask: boolean; bagging: boolean; biteBlock: boolean;
}
export const NO_DRESS: EctDress = { pads: [], cleaned: false, leads: false, cuff: { on: false, mmHg: 0 }, mask: false, bagging: false, biteBlock: false };

const PAD_R = Math.sqrt(ECT.padArea / Math.PI);   // cm: a disc of the pad's area

function onHead(F: EctFigure) {
  const H = (a: number, b: number): Pt => ({ x: F.o.x + a * F.ea.x + b * F.eb.x, y: F.o.y + a * F.ea.y + b * F.eb.y });
  const s = Math.hypot(F.ea.x, F.ea.y);              // px per head cm
  const ang = (Math.atan2(F.ea.y, F.ea.x) * 180) / Math.PI;   // the head's "up", in the drawing
  return { H, s, ang };
}

/** everything the team put on the patient, over the figure */
export function dressSvg(F: EctFigure, d: EctDress, t = 0): string {
  const { H, s, ang } = onHead(F);
  const out: string[] = [];
  const PAD = '#f4f1e8', PADLINE = '#8b8676', CABLE = '#4c5560', LEAD = '#2c5d8f';
  /* the cleaned skin: a faint sheen where the pads go */
  if (d.cleaned) for (const id of ['Rtemp', 'Rfront', 'vertexR'] as SiteId[]) { const p = SITES[id].profile!; const c = H(p.a, p.b); out.push(`<circle cx="${f(c.x)}" cy="${f(c.y)}" r="${f(PAD_R * s * 1.15)}" fill="#ffffff" opacity=".1"/>`); }
  /* the stimulus pads and their cable, toward the device at the head of the bed */
  for (const id of d.pads) {
    const p = SITES[id].profile; if (!p) continue;
    const c = H(p.a, p.b), r = PAD_R * s;
    const rot = p.seen === 'face' ? 0 : p.seen === 'top' ? ang + 90 : ang;
    /* a pad on the side is seen face-on; on the top of the head edge-on; on the front-lateral forehead about half turned */
    const ry = p.seen === 'face' ? r : p.seen === 'top' ? r * 0.28 : r * 0.5;
    out.push(`<ellipse cx="${f(c.x)}" cy="${f(c.y)}" rx="${f(r)}" ry="${f(ry)}" transform="rotate(${f(rot)} ${f(c.x)} ${f(c.y)})" fill="${PAD}" stroke="${PADLINE}" stroke-width=".5"/>`);
    if (p.seen === 'face') out.push(`<circle cx="${f(c.x)}" cy="${f(c.y)}" r="${f(r * 0.25)}" fill="#cfd6da" stroke="${PADLINE}" stroke-width=".3"/>`);
    const back = H(p.a + 4, -14);
    out.push(`<path d="M${f(c.x)} ${f(c.y)} Q${f((c.x + back.x) / 2)} ${f(Math.min(c.y, back.y) - 6)} ${f(back.x)} ${f(back.y)}" fill="none" stroke="${CABLE}" stroke-width=".9"/>`);
  }
  /* the monitoring leads: EEG above the right eyebrow and on the mastoid; the ECG on the chest; the EMG on the right foot */
  if (d.leads) {
    const lead = (c: Pt, to: Pt, via?: Pt) => out.push(`<circle cx="${f(c.x)}" cy="${f(c.y)}" r="${f(0.55 * s)}" fill="#eef2f5" stroke="${LEAD}" stroke-width=".5"/><path d="M${f(c.x)} ${f(c.y)} Q${f((via ?? { x: (c.x + to.x) / 2, y: Math.max(c.y, to.y) + 4 }).x)} ${f((via ?? { x: 0, y: Math.max(c.y, to.y) + 4 }).y)} ${f(to.x)} ${f(to.y)}" fill="none" stroke="${LEAD}" stroke-width=".45"/>`);
    /* the EEG leads run back over the hair, above the ear, to behind the head (a cubic that stays on the scalp) */
    const eeg = (c: Pt, c1: Pt, c2: Pt, to: Pt) => out.push(`<circle cx="${f(c.x)}" cy="${f(c.y)}" r="${f(0.55 * s)}" fill="#eef2f5" stroke="${LEAD}" stroke-width=".5"/><path d="M${f(c.x)} ${f(c.y)} C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(to.x)} ${f(to.y)}" fill="none" stroke="${LEAD}" stroke-width=".45"/>`);
    const behind = H(5, -14);
    eeg(H(12.2, 8.6), H(14.6, 4.5), H(13.6, -7), behind); eeg(H(3.4, -4.8), H(3.8, -8), H(4.4, -11), behind);
    const [x0, y0, x1] = F.chest;
    for (const k of [0.25, 0.5, 0.8]) lead({ x: x0 + (x1 - x0) * k, y: y0 + 1.2 }, { x: x0 - 8, y: y0 + 10 });
    const a = F.ankleR;
    lead({ x: a.x + 6, y: a.y - 4 }, { x: a.x + 2, y: a.y + 14 }); lead({ x: a.x + 11, y: a.y - 9 }, { x: a.x + 2, y: a.y + 14 });
  }
  /* the cuff above the right ankle, its tube to the gauge and bulb hanging at the foot of the bed */
  if (d.cuff.on) {
    const a = F.ankleR, w = 12, h = 8;
    const full = Math.min(1, d.cuff.mmHg / 250);
    out.push(`<rect x="${f(a.x - w / 2 - 4)}" y="${f(a.y - h / 2 - 1 - full * 1.2)}" width="${f(w)}" height="${f(h + full * 2.4)}" rx="2" fill="#3e6f8f" stroke="#284a60" stroke-width=".5"/>`);
    const g = { x: a.x + 22, y: a.y + 34 };
    out.push(`<path d="M${f(a.x - 4)} ${f(a.y + 4)} Q${f(a.x + 4)} ${f(a.y + 22)} ${f(g.x - 6)} ${f(g.y)}" fill="none" stroke="#444" stroke-width=".7"/>`);
    out.push(`<circle cx="${f(g.x)}" cy="${f(g.y)}" r="7" fill="#f7f7f2" stroke="#555" stroke-width=".7"/>`);
    const needle = -220 + 260 * Math.min(1, d.cuff.mmHg / 300);
    const nr = (needle * Math.PI) / 180;
    out.push(`<line x1="${f(g.x)}" y1="${f(g.y)}" x2="${f(g.x + 5.5 * Math.cos(nr))}" y2="${f(g.y + 5.5 * Math.sin(nr))}" stroke="#b3261e" stroke-width=".8"/>`);
    out.push(`<ellipse cx="${f(g.x + 2)}" cy="${f(g.y + 16)}" rx="4" ry="6" fill="#2b2b2b"/><path d="M${f(g.x)} ${f(g.y + 7)} L${f(g.x + 2)} ${f(g.y + 10)}" stroke="#444" stroke-width=".7"/>`);
  }
  /* the bite block between the teeth: its flange shows at the lips */
  if (d.biteBlock) { const b = H(1.7, 10.9); out.push(`<rect x="${f(b.x - 1.6)}" y="${f(b.y - 0.9)}" width="3.2" height="1.8" rx=".8" transform="rotate(${f(ang)} ${f(b.x)} ${f(b.y)})" fill="#4a90c2" stroke="#2c5d8f" stroke-width=".4"/>`); }
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

/** where taps land on the scene: the head (the close-up), the chest (the leads), the right ankle (the cuff) */
function hitsSvg(F: EctFigure): string {
  const { H, s } = onHead(F);
  const c = H(9, 2), [x0, y0, x1, y1] = F.chest, a = F.ankleR;
  return `<g class="ect-hits"><circle data-hit="head" cx="${f(c.x)}" cy="${f(c.y)}" r="${f(12 * s)}" fill="transparent"/>`
    + `<rect data-hit="chest" x="${f(x0)}" y="${f(y0 - 6)}" width="${f(x1 - x0)}" height="${f(y1 - y0 + 6)}" fill="transparent"/>`
    + `<rect data-hit="ankle" x="${f(a.x - 14)}" y="${f(a.y - 14)}" width="34" height="30" fill="transparent"/></g>`;
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
    svg: `<g transform="rotate(${f(rot)} ${f(c.x)} ${f(c.y)})">${F.svg}${dressSvg(F, d, t)}</g>` };
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
