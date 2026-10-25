import type { Pt } from './figure-geom.ts';

/* ===========================================================================
   The hand seen from its side (the back of the hand facing the viewer), for
   pointing (finger–nose), and at rest (the hand hanging or lying on the
   thigh, its fingers a little bent, more so in distress, a fist when it
   grips). Seen from the back, bent fingers are foreshortened: they point
   away from the viewer as they bend, so they look shorter, not turned.

   The outline is a template in the hand's own centimetres: x along the hand
   from the wrist crease toward the fingertips, y across it, positive toward
   the thumb. Proportions of an adult hand: wrist 5.8 cm across, the
   knuckles 8.5 cm, wrist to knuckles 9.5 cm, the index 9 cm beyond them
   (anthropometric tables give a hand length about 10.8 % of stature, here
   18.5 cm, the figure's LEN.hand).

   Pointing: the index straight, the thumb laid along the folded middle
   finger, the middle, ring and little fingers curled into the palm, so that
   their middle phalanges make the rounded front of a loose fist below the
   index.
=========================================================================== */

/** The outline, counter-clockwise from the ulnar side of the wrist, for a hand pointing with its index finger. */
const POINTING: Array<[number, number]> = [
  [-3.0, -1], [0, -2.75], [3.5, -3.5], [7.0, -3.9],       // over the end of the forearm (its width: below), the ulnar border of the back of the hand
  [8.8, -4.0], [10.4, -3.6], [11.6, -2.6],             // the little and ring fingers folded: the fist's lower front
  [12.2, -1.3], [12.3, -0.2],                          // the middle finger's middle phalanx, folded
  [12.0, 0.25],                                         // the cleft under the index
  [14.5, 0.35], [17.0, 0.45], [18.3, 0.85],             // the index, underside, to its tip
  [18.4, 1.35], [18.0, 1.75], [16.0, 1.95],             // the tip and its top
  [12.5, 2.1], [10.0, 2.3],                             // the index's top to its knuckle
  [8.8, 2.6], [7.0, 3.0], [5.2, 3.3],                   // the web, where the thumb (behind the hand) begins
  [3.0, 3.5], [0, 2.75], [-3.0, 1],            // the thenar eminence to the radial side of the wrist, over the forearm's end
];

/** Creases drawn over the outline (open polylines): the thumb's edge over the fist, the folded fingers' knuckles. */
const POINTING_LINES: Array<Array<[number, number]>> = [
  [[10.2, -0.1], [11.4, -1.0], [11.6, -2.0]],
  [[9.0, -2.4], [10.6, -3.0]],
  [[10.0, 2.25], [12.0, 1.95]],
  [[8.6, 2.45], [10.4, 2.6], [11.4, 2.2]],              // the thumb's tip, showing over the folded middle finger
];

export interface HandFrame {
  /** the wrist crease, in drawing coordinates */
  wrist: Pt;
  /** direction of the hand, wrist toward fingertips (degrees, 0 right, 90 up) */
  angle: number;
  /** +1 if the thumb side is to the left of the hand's direction as drawn, −1 if to its right */
  thumb: 1 | -1;
  /** drawing units per centimetre */
  u: number;
  /** 1 the back of the hand faces the viewer; toward 0 it is seen edge-on (the hand rotated) */
  broad: number;
  /** half-widths of the forearm at the wrist (cm), toward the thumb and away from it, so the hand joins it without a step */
  wristThumb: number; wristUlnar: number;
}

const toWorld = (h: HandFrame) => {
  const a = (h.angle * Math.PI) / 180, ax = Math.cos(a), ay = -Math.sin(a);
  /* across the hand: 90° counter-clockwise from its direction, times the thumb side */
  const cx = -ay * h.thumb, cy = ax * h.thumb;
  const k = Math.max(0.28, h.broad);
  /* the rows at the wrist (|y| = 1 in the template) take the forearm's own half-widths */
  /* the wrist keeps the forearm's width whichever way the hand is turned; the turning shows from the wrist forward */
  return ([x, y0]: [number, number]): Pt => {
    const atWrist = Math.abs(y0) === 1, y = atWrist ? (y0 > 0 ? h.wristThumb : -h.wristUlnar) : y0;
    const kk = atWrist ? 1 : k + (1 - k) * Math.max(0, Math.min(1, (2 - x) / 4));
    return { x: h.wrist.x + (ax * x + cx * y * kk) * h.u, y: h.wrist.y + (ay * x + cy * y * kk) * h.u };
  };
};

export function pointingHand(h: HandFrame): { outline: Pt[]; lines: Pt[][] } {
  const w = toWorld(h);
  return { outline: POINTING.map(w), lines: POINTING_LINES.map((l) => l.map(w)) };
}

/** The hand at rest, from its back: the fingers together, bent by `curl` degrees (16 at rest, about 70 gripping), so
    they look shorter; the thumb along the radial edge; the knuckles and the clefts between the fingers drawn. */
export function restingHand(h: HandFrame, curl: number): { outline: Pt[]; lines: Pt[][]; nail: Pt; nailLen: number } {
  const w = toWorld(h);
  const c = Math.max(0, Math.min(1, curl / 90));
  /* the fingers' apparent length past the knuckles: the middle finger 9.5 cm straight; folded, the proximal phalanx
     still shows about 3 cm end-on */
  const L = 3 + 6.5 * Math.cos((Math.PI / 2) * c);
  const K = 9.3;                                       // the knuckle line
  const tip = (y: number, len: number) => K + L * len;
  const out: Array<[number, number]> = [
    [-3.0, -1], [0, -2.75], [4, -3.5], [K - 0.6, -3.9],                       // ulnar border of the back of the hand
    [tip(-3.0, 0.72) - 1, -3.85], [tip(-3.0, 0.72), -3.1], [tip(-2.4, 0.74), -2.35],   // the little finger, the shortest
    [tip(-1.6, 0.88), -1.9], [tip(-1.2, 0.9), -1.05],                         // the ring finger
    [tip(-0.4, 1.0), -0.6], [tip(0.2, 1.0), 0.25],                            // the middle finger, the longest
    [tip(0.9, 0.92), 0.7], [tip(1.6, 0.9), 1.55],                             // the index
    [tip(2.1, 0.86) - 0.8, 2.15], [K + 0.4, 2.45],                            // the index's radial side back to its knuckle
    [K - 0.2 + 2.6 * (1 - c), 3.15], [K - 1.2 + 2.4 * (1 - c), 3.55], [K - 2.6, 3.45],   // the thumb, along the index, its tip
    [5.2, 3.6], [3.0, 3.6], [0, 2.75], [-3.0, 1],                            // the thenar eminence to the wrist
  ];
  const lines: Array<Array<[number, number]>> = [
    [[K, -2.6], [K + 0.5 + L * 0.55, -2.15]],                                // the clefts between the fingers
    [[K + 0.2, -0.95], [K + 0.6 + L * 0.7, -0.8]],
    [[K + 0.2, 0.75], [K + 0.6 + L * 0.65, 0.95]],
    [[K - 0.4, -3.2], [K, -1.7], [K - 0.2, -0.1], [K + 0.1, 1.6]],           // the knuckles
    [[K - 2.4, 2.75], [K - 0.6 + 2.2 * (1 - c), 2.85]],                       // the thumb's edge over the index
  ];
  /* the nail of the middle finger, on its back near the tip: where cyanosis and pallor show first (shortened as the finger bends) */
  return { outline: out.map(w), lines: lines.map((l) => l.map(w)), nail: w([K + L * 0.98 - 1.1, -0.2]), nailLen: 1.1 * Math.max(0.3, Math.cos((Math.PI / 2) * c)) };
}
