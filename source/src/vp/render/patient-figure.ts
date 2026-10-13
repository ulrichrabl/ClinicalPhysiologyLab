/* ---------------------------------------------------------------------------
   Patient figure: the whole patient in profile, seen from the right side of
   the bed, where the examiner stands. Near limbs are the patient's right,
   far limbs (drawn behind, in shade) the left.

   The figure is a jointed skeleton (hip, shoulder, elbow, wrist, knee,
   ankle) posed by joint angles for each position, drawn with tapered limbs,
   a gown and the trolley. Changing position interpolates the angles, so the
   patient sits up, lies down or stands rather than jumping. Every body part
   carries a data-region for touch, and none is highlighted: the examiner
   chooses where to look.
--------------------------------------------------------------------------- */

import { appearanceOf } from './face-canvas.ts';

export interface Pose {
  torso: number;            // degrees from horizontal, toward the head (180 = lying, head to the left)
  neck: number;             // head tilt relative to torso
  armUpper: [number, number]; armFore: [number, number];   // [near, far], absolute degrees
  thigh: [number, number]; shin: [number, number];
  hipY: number;             // hip height in the drawing
  hipX: number;
  bed: 'flat' | 'back-raised' | 'edge' | 'none';
  backrest: number;         // backrest angle when raised
}

export const POSES: Record<string, Pose> = {
  supine: { torso: 180, neck: 0, armUpper: [-4, 4], armFore: [-2, 2], thigh: [0, 2], shin: [0, 1], hipY: 236, hipX: 178, bed: 'flat', backrest: 0 },
  'left-lateral': { torso: 180, neck: -8, armUpper: [-40, -25], armFore: [10, 20], thigh: [40, 30], shin: [-30, -25], hipY: 236, hipX: 178, bed: 'flat', backrest: 0 },
  prone: { torso: 180, neck: 0, armUpper: [-4, 4], armFore: [-2, 2], thigh: [0, 2], shin: [0, 1], hipY: 236, hipX: 178, bed: 'flat', backrest: 0 },
  'reclined-45': { torso: 135, neck: -12, armUpper: [-75, -65], armFore: [-8, -2], thigh: [1, 3], shin: [-1, 0], hipY: 236, hipX: 168, bed: 'back-raised', backrest: 45 },
  sitting: { torso: 92, neck: 0, armUpper: [-98, -90], armFore: [-12, -6], thigh: [1, 4], shin: [-86, -80], hipY: 236, hipX: 220, bed: 'edge', backrest: 0 },
  'sitting-forward': { torso: 66, neck: 12, armUpper: [-78, -70], armFore: [-6, 0], thigh: [1, 4], shin: [-86, -80], hipY: 236, hipX: 220, bed: 'edge', backrest: 0 },
  standing: { torso: 90, neck: 0, armUpper: [-93, -87], armFore: [-88, -84], thigh: [-90, -88], shin: [-90, -90], hipY: 184, hipX: 180, bed: 'none', backrest: 0 },
  'head-hanging-left': { torso: 192, neck: -20, armUpper: [-4, 4], armFore: [-2, 2], thigh: [0, 2], shin: [0, 1], hipY: 236, hipX: 190, bed: 'flat', backrest: 0 },
  'head-hanging-right': { torso: 192, neck: -20, armUpper: [-4, 4], armFore: [-2, 2], thigh: [0, 2], shin: [0, 1], hipY: 236, hipX: 190, bed: 'flat', backrest: 0 },
};

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const l = (x: number, y: number) => x + (y - x) * t;
  const l2 = (x: [number, number], y: [number, number]): [number, number] => [l(x[0], y[0]), l(x[1], y[1])];
  return {
    torso: l(a.torso, b.torso), neck: l(a.neck, b.neck), armUpper: l2(a.armUpper, b.armUpper), armFore: l2(a.armFore, b.armFore),
    thigh: l2(a.thigh, b.thigh), shin: l2(a.shin, b.shin), hipY: l(a.hipY, b.hipY), hipX: l(a.hipX, b.hipX),
    bed: t < 0.5 ? a.bed : b.bed, backrest: l(a.backrest, b.backrest),
  };
}

const rad = (d: number) => (d * Math.PI) / 180;
const dir = (a: number) => ({ x: Math.cos(rad(a)), y: -Math.sin(rad(a)) });
const add = (p: { x: number; y: number }, a: number, len: number) => { const d = dir(a); return { x: p.x + d.x * len, y: p.y + d.y * len }; };
const f = (n: number) => n.toFixed(1);

/** A body segment chain drawn as a smooth, round-jointed limb: outline stroke under a fill stroke. */
function limb(points: Array<{ x: number; y: number }>, width: number, fill: string, outline: string, attrs = ''): string {
  const d = points.map((q, i) => `${i ? 'L' : 'M'}${f(q.x)} ${f(q.y)}`).join(' ');
  return `<g ${attrs}><path d="${d}" fill="none" stroke="${outline}" stroke-width="${width + 2.4}" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}

/** Everything the figure draws besides the pose. Built by figureLookFor from the case's patient and state; the app
    never assembles it itself, so the figure can use more of the patient (age, build, hair) without touching the app. */
export interface FigureLook {
  skin: string; shade: string;           // skin colour and its shadow
  hair: string;                          // hair colour
  hairText: string;                      // the case's own description: 'long, dark blonde', 'grey, thinning', 'tied back'
  gown: string; gownShade: string;
  exposed: Set<string>;                  // structures uncovered: 'chest', 'abdomen', …
  sex: 'F' | 'M';
  age: number;
  build: 'slim' | 'average' | 'heavy';
  oxygen?: string;                       // device on the patient, if any ('nasal cannula 2 L/min', …)
}

/** The parts of a case's patient the figure uses (CaseDef['patient'] satisfies it). */
export interface FigurePatient {
  age: number; sex: 'F' | 'M';
  appearance: { skinTone: number; hair: string; build?: 'slim' | 'average' | 'heavy'; eyes?: string };
}
/** The parts of the encounter state the figure uses (PatientState satisfies it). */
export interface FigureState { exposure?: string[]; oxygen?: { device: string; fio2: number } }

export function figureLookFor(patient: FigurePatient, state: FigureState, seed: number): FigureLook {
  const ap = appearanceOf(patient as Parameters<typeof appearanceOf>[0], seed);
  return {
    skin: ap.skin, shade: ap.skinShade, hair: ap.hair, hairText: patient.appearance.hair.toLowerCase(),
    gown: '#9fc4d9', gownShade: '#7fa9c2', exposed: new Set(state.exposure ?? []), sex: patient.sex, age: patient.age,
    build: patient.appearance.build ?? 'average',
    oxygen: state.oxygen && state.oxygen.fio2 > 0.21 ? state.oxygen.device : undefined,
  };
}

const L = { torso: 104, neck: 12, head: 19, upper: 52, fore: 46, thigh: 82, shin: 76, foot: 22 };

export function figureSvg(p: Pose, look: FigureLook): string {
  const hip = { x: p.hipX, y: p.hipY };
  const waist = add(hip, p.torso, 48);
  const shoulder = add(hip, p.torso, L.torso);
  const neckTop = add(shoulder, p.torso + p.neck, L.neck);
  const headC = add(neckTop, p.torso + p.neck, L.head + 2);
  const out: string[] = [];
  const bedY = p.hipY + 22;

  if (p.bed !== 'none') {
    out.push(`<g class="bed" pointer-events="none"><rect x="14" y="${bedY}" width="332" height="14" rx="6" fill="#c3ccc9"/><rect x="24" y="${bedY + 14}" width="312" height="6" fill="#9aa5a2"/>
      <rect x="40" y="${bedY + 20}" width="7" height="${364 - bedY - 20}" fill="#9aa5a2"/><rect x="313" y="${bedY + 20}" width="7" height="${364 - bedY - 20}" fill="#9aa5a2"/>
      <circle cx="43.5" cy="368" r="6" fill="#7d8885"/><circle cx="316.5" cy="368" r="6" fill="#7d8885"/></g>`);
    if (p.backrest > 1) {
      const pivot = { x: p.hipX - 8, y: bedY + 4 }, top = add(pivot, 180 - p.backrest, 135);
      out.push(`<path d="M${f(pivot.x)} ${f(pivot.y)} L${f(top.x)} ${f(top.y)}" stroke="#c3ccc9" stroke-width="14" stroke-linecap="round" pointer-events="none"/>`);
    } else if (p.bed === 'flat') {
      out.push(`<ellipse cx="${f(headC.x + 4)}" cy="${bedY - 6}" rx="34" ry="9" fill="#dde3e1" pointer-events="none"/>`);
    }
  } else {
    out.push('<line x1="10" y1="368" x2="350" y2="368" stroke="#b5bfbc" stroke-width="3"/>');
  }

  const knee = (i: 0 | 1) => add(hip, p.thigh[i], L.thigh);
  const ankle = (i: 0 | 1) => add(knee(i), p.shin[i], L.shin);
  const toe = (i: 0 | 1) => add(ankle(i), p.shin[i] + 90, L.foot);
  const elbow = (i: 0 | 1) => add(shoulder, p.armUpper[i], L.upper);
  const wrist = (i: 0 | 1) => add(elbow(i), p.armFore[i], L.fore);
  const hand = (i: 0 | 1) => add(wrist(i), p.armFore[i], 9);
  const legSvg = (i: 0 | 1) => {
    const far = i === 1, col = far ? look.shade : look.skin;
    return `<g data-region="legs" data-side="${far ? 'L' : 'R'}">${limb([hip, knee(i)], 25, col, look.shade)}${limb([knee(i), ankle(i)], 17, col, look.shade)}${limb([ankle(i), toe(i)], 11, col, look.shade)}</g>`;
  };
  const armSvg = (i: 0 | 1) => {
    const far = i === 1, col = far ? look.shade : look.skin;
    return `<g data-region="arm" data-side="${far ? 'L' : 'R'}">${limb([shoulder, elbow(i)], 16, col, look.shade)}${limb([elbow(i), wrist(i)], 12, col, look.shade)}${limb([wrist(i), hand(i)], 13, col, look.shade)}</g>`;
  };
  out.push(armSvg(1), legSvg(1));

  // torso: abdomen and chest as two touch regions
  out.push(limb([hip, waist], 46, look.skin, look.shade, 'data-region="abdomen"'));
  out.push(limb([waist, add(shoulder, p.torso, -6)], 46, look.skin, look.shade, 'data-region="chest"'));
  // the gown covers what is not exposed, and the near thigh
  const chestBare = look.exposed.has('chest'), abdoBare = look.exposed.has('abdomen');
  const gownParts: Array<[{ x: number; y: number }, { x: number; y: number }]> = [];
  if (!abdoBare && !chestBare) gownParts.push([add(hip, p.torso, -2), add(shoulder, p.torso, -2)]);
  else if (!abdoBare) gownParts.push([add(hip, p.torso, -2), waist]);
  else if (!chestBare) gownParts.push([waist, add(shoulder, p.torso, -2)]);
  for (const [a, b] of gownParts) out.push(`<g pointer-events="none">${limb([a, b], 52, look.gown, look.gownShade)}</g>`);
  if (gownParts.length) out.push(`<g pointer-events="none">${limb([hip, add(hip, p.thigh[0], 40)], 31, look.gown, look.gownShade)}</g>`);
  if (chestBare) {
    const nip = add(add(waist, p.torso, 32), p.torso - 90, -16);
    out.push(`<circle cx="${f(nip.x)}" cy="${f(nip.y)}" r="2" fill="${look.shade}" pointer-events="none"/>`);
  }

  // neck and head in profile
  out.push(limb([shoulder, neckTop], 15, look.skin, look.shade, 'data-region="neck"'));
  const up = p.torso + p.neck, faceDir = up - 90;
  const noseBase = add(headC, faceDir, L.head - 1), noseTip = add(add(headC, faceDir, L.head + 6), up, -2), noseBot = add(noseBase, up, -7);
  const eye = add(add(headC, faceDir, 11), up, 5);
  const ear = add(headC, faceDir, -3);
  const hairA = add(headC, up + 70, L.head), hairB = add(headC, up - 200, L.head);
  out.push(`<g data-region="head">
    <circle cx="${f(headC.x)}" cy="${f(headC.y)}" r="${L.head}" fill="${look.skin}" stroke="${look.shade}" stroke-width="1.2"/>
    <path d="M${f(noseBase.x)} ${f(noseBase.y)} L${f(noseTip.x)} ${f(noseTip.y)} L${f(noseBot.x)} ${f(noseBot.y)}" fill="${look.skin}" stroke="${look.shade}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M${f(hairA.x)} ${f(hairA.y)} A${L.head} ${L.head} 0 0 0 ${f(hairB.x)} ${f(hairB.y)}" fill="none" stroke="${look.hair}" stroke-width="9" stroke-linecap="round"/>
    <ellipse cx="${f(ear.x)}" cy="${f(ear.y)}" rx="4.5" ry="6" fill="${look.skin}" stroke="${look.shade}" stroke-width="1"/>
    <circle cx="${f(eye.x)}" cy="${f(eye.y)}" r="1.8" fill="#2a1d16"/>
  </g>`);

  out.push(legSvg(0), armSvg(0));
  return out.join('');
}
