/* ---------------------------------------------------------------------------
   Figure dress: the gown, the trolley, and what shows on bare skin.

   The gown is cut from the body it covers: the trunk outline let out by the
   thickness of the cloth, with its hollows bridged (cloth spans the small of
   the back and the dip under a belly or the breasts rather than following
   them in), a hem across the thighs and short sleeves. Because it is built
   from the posed body it drapes the same way in every position. Exposing the
   chest lowers it to the waist; exposing the abdomen lifts it to the ribs and
   leaves a drape over the pelvis. A woman with her chest exposed wears a
   plain bra.

   The trolley is muted on purpose: it carries the patient and should not be
   looked at. It is a few boxes with real width (a 66 cm mattress), so from
   the front it is seen from above (lying) or end-on (sitting) like the
   patient on it. The gown's cloth is built in 3D as well; its folds, edges
   and hem are drawn here for the profile and in figure-front.ts for the
   front and back.
--------------------------------------------------------------------------- */

import { add, closedPath, dir, f, openPath, type Pt } from './figure-geom.ts';
import { limb3, stationAt, trunk3, trunkA, trunkPt, type Shape, type Skeleton, type Station } from './figure-body.ts';
import { boxCorners, hull, type Projector } from './figure-view.ts';
import type { FigureLook } from './patient-figure.ts';
import type { Palette } from './figure-head.ts';

export const BED_TOP = 258, FLOOR = 368, BED_RIGHT = 346;

/** Cloth spans hollows: each station is at least as deep as its neighbours minus a slope. */
function bridge(st: Station[], slope: number): Station[] {
  return st.map((t) => {
    let a = t.a, p = t.p;
    let w = t.w ?? (t.a + t.p) / 2;
    for (const o of st) {
      const d = Math.abs(o.s - t.s); a = Math.max(a, o.a - slope * d); p = Math.max(p, o.p - slope * d);
      /* across, the cloth lies on the slope of the shoulders (trapezius) rather than spanning from one acromion to the other */
      if (t.s < 46 && o.s < 46) w = Math.max(w, (o.w ?? (o.a + o.p) / 2) - slope * d);
    }
    return { s: t.s, a, p, w };
  });
}

export interface GownParts {
  trunk: Pt[][];                       // the cloth over the trunk (one or two pieces)
  thigh: [Pt[][], Pt[][]];             // the skirt over each thigh [right, left]
  sleeve: [Pt[][], Pt[][]] | null;     // short sleeves, when the arms are covered
  sleeveCut: [string, string];         // the sleeve's hem, in profile
  profileLines: string;                // folds, rolled edges, neckline and hem, drawn for the profile
  spans: Array<[number, number]>;      // the stretches of trunk it covers (for the front and back drawings)
  hem: number;                         // where the hem crosses the thighs (station)
}

/** The gown on this body in this view. zs: the lateral offsets of the limbs (hip, knee; shoulder, elbow) per side. */
export function gown(pr: Projector, k: Skeleton, sh: Shape, look: FigureLook, pal: { gown: string; gownLight: string; gownDark: string; gownLine: string },
  z: { thigh: (i: 0 | 1) => [number, number]; upper: (i: 0 | 1) => [number, number] }): GownParts {
  const ex = look.exposed, chestBare = ex.has('chest'), abdoBare = ex.has('abdomen');
  const armBare = ex.has('arm') || chestBare;
  const u = k.u, g = 1.1;
  /* the pieces of trunk the gown covers now */
  const spans: Array<[number, number]> = [];
  if (!chestBare && !abdoBare) spans.push([-99, 55.5]);
  else if (chestBare && !abdoBare) spans.push([-99, 23]);
  else if (!chestBare && abdoBare) { spans.push([28, 55.5], [-99, 0]); }
  else spans.push([-99, 0]);
  /* bare legs (the chest views, for limb electrodes): only a drape over the groin */
  const hem = ex.has('legs') ? 5 : 26;
  const thighCloth = bridge(sh.thigh.filter((t) => t.s <= hem), 0.25).map((t, i, all) => ({ ...t, a: t.a + (i === all.length - 1 ? 0.8 : 0), p: t.p + (i === all.length - 1 ? 0.9 : 0) }));
  const thighShape = (i: 0 | 1) => {
    const st: Station[] = [...thighCloth];
    const last = stationAt(sh.thigh, hem);
    st.push({ s: hem, a: last.a + 0.9, p: last.p + 1.0, w: (last.w ?? 6) + 1.0 });
    const [z0, z1] = z.thigh(i);
    return limb3(pr, k.hip, k.thighA[i], st.filter((t) => t.s >= -4), k.flip, z0, z0 + ((z1 - z0) * hem) / 43, g);
  };
  /* cloth bridges the hollows of the part it covers, not of what lies beyond its edge */
  const clothFor = ([a, b]: [number, number]) => [...sh.trunk.filter((t) => t.s < a - 4), ...bridge(sh.trunk.filter((t) => t.s >= a - 4 && t.s <= b + 4), 0.32), ...sh.trunk.filter((t) => t.s > b + 4)];
  const cloth = { ...sh, trunk: clothFor(spans[0]) };
  const trunkShapes = spans.map((sp) => trunk3(pr, k, sh, sp[0], sp[1], g, clothFor(sp)));

  /* folds: where cloth bunches (waist, groin, the elbow of a bent trunk) and long folds from the shoulder (profile) */
  const lines: string[] = [];
  const fold = (pts: Pt[], o = 0.55, w = 0.8) => lines.push(`<path d="${openPath(pts)}" fill="none" stroke="${pal.gownLine}" stroke-width="${f(w)}" stroke-linecap="round" opacity="${o}"/>`);
  const at = (s: number) => stationAt(cloth.trunk, s);
  for (const [s0, s1] of spans) {
    const lo = Math.max(s0, -10), hi = Math.min(s1, 53);
    if (hi - lo > 20) {
      fold([trunkPt(k, hi - 6, -at(hi - 6).p * 0.2), trunkPt(k, lo + (hi - lo) * 0.55, at(lo + (hi - lo) * 0.55).a * 0.35), trunkPt(k, lo + 10, at(lo + 10).a * 0.7)]);
      fold([trunkPt(k, hi - 3, at(hi - 3).a * 0.4), trunkPt(k, hi - 14, at(hi - 14).a * 0.75)], 0.4);
      fold([trunkPt(k, lo + (hi - lo) * 0.45, -at(lo + (hi - lo) * 0.45).p * 0.6), trunkPt(k, lo + (hi - lo) * 0.3, -at(lo + (hi - lo) * 0.3).p * 0.1), trunkPt(k, lo + 4, at(lo + 4).a * 0.3)], 0.4);
    }
    /* a rolled edge where the gown is pushed up or down */
    const edge = (s: number) => [trunkPt(k, s, at(s).a + g), trunkPt(k, s, (at(s).a - at(s).p) / 2), trunkPt(k, s, -at(s).p - g)];
    if (s1 < 55) lines.push(`<path d="${openPath(edge(s1))}" fill="none" stroke="${pal.gownDark}" stroke-width="2.2" stroke-linecap="round"/>`
      + `<path d="${openPath(edge(s1 - 0.6))}" fill="none" stroke="${pal.gownLight}" stroke-width="0.9" stroke-linecap="round"/>`);
    if (s0 > -99) lines.push(`<path d="${openPath(edge(s0))}" fill="none" stroke="${pal.gownDark}" stroke-width="2.2" stroke-linecap="round"/>`);
    if (s1 >= 55) {   // neckline
      lines.push(`<path d="${openPath([trunkPt(k, 53.5, at(53.5).a + g * 0.6), trunkPt(k, 55.4, 0), trunkPt(k, 54.8, -at(54.8).p)])}" fill="none" stroke="${pal.gownLine}" stroke-width="1" opacity=".8"/>`);
    }
  }
  /* hem and lap folds on the thigh */
  const tA = k.thighA[0], hemSt = stationAt(sh.thigh, hem);
  const H = (s: number, x: number) => add(add(k.hip, tA, s * u), tA + 90 * k.flip, x * u);
  lines.push(`<path d="${openPath([H(hem + 0.3, hemSt.a + 1.6), H(hem + 0.8, 0), H(hem + 0.3, -hemSt.p - 1.7)])}" fill="none" stroke="${pal.gownLine}" stroke-width="1.1" opacity=".9"/>`);
  fold([H(6, hemSt.a * 0.5), H(16, hemSt.a * 0.2), H(hem - 1, hemSt.a * 0.6)], 0.4);
  fold([H(2, -2), H(12, -hemSt.p * 0.4)], 0.35);

  /* sleeves: short, flared, over the upper arm */
  const sleeve = (i: 0 | 1) => {
    const st: Station[] = sh.upper.filter((t) => t.s <= 10).map((t) => ({ ...t }));
    /* over the top of the deltoid the sleeve is the gown's shoulder seam: let it reach a little higher, so no skin shows */
    st.unshift({ s: st[0].s - 0.9, a: st[0].a * 0.8, p: st[0].p * 0.8, w: (st[0].w ?? 3) * 0.8 });
    const end = stationAt(sh.upper, 12);
    st.push({ s: 12, a: end.a + 0.6, p: end.p + 0.7, w: (end.w ?? 4) + 0.8 });
    const [z0, z1] = z.upper(i);
    return limb3(pr, k.shoulder, k.upperA[i], st, k.flip, z0, z0 + ((z1 - z0) * 12) / 32.7, 0.7);
  };
  const sleeveCut = (i: 0 | 1) => { const e = stationAt(sh.upper, 12); return `<path d="${openPath([add(add(k.shoulder, k.upperA[i], 12.2 * u), k.upperA[i] + 90 * k.flip, (e.a + 1.3) * u), add(k.shoulder, k.upperA[i], 12.6 * u), add(add(k.shoulder, k.upperA[i], 12.2 * u), k.upperA[i] - 90 * k.flip, (e.p + 1.4) * u)])}" fill="none" stroke="${pal.gownLine}" stroke-width="1" opacity=".9"/>`; };
  const sleevesOn = !armBare && !chestBare && spans.some(([, b]) => b >= 55);
  /* From the front the gown is one skirt over both thighs, not a leg of shorts on each: the cloth between the thighs is
     the hull of the two (and of the hips it hangs from). */
  const thighs = [thighShape(0), thighShape(1)] as [Pt[][], Pt[][]];
  if (!pr.profile && Math.abs(pr.c) < 0.9) {
    const hips = trunk3(pr, k, sh, -99, 4, g, clothFor(spans[spans.length - 1]));
    /* only the thighs below the hip joint: their rounded tops belong inside the trunk */
    const h0 = pr.P(k.hip), up = pr.vec(dir(trunkA(k, 0)));
    const below = (q: Pt) => (q.x - h0.x) * up.x + (q.y - h0.y) * up.y < 0;
    const skirt = hull([...thighs[0][0].filter(below), ...thighs[1][0].filter(below), ...hips]);
    trunkShapes.push(skirt);
    /* the skirt is the cloth over the thighs now; their own pieces would poke above it */
    if (Math.abs(pr.c) < 0.5) { thighs[0] = []; thighs[1] = []; }
  }
  return {
    trunk: trunkShapes, thigh: thighs, sleeve: sleevesOn ? [sleeve(0), sleeve(1)] : null, sleeveCut: [sleeveCut(0), sleeveCut(1)],
    profileLines: `<g pointer-events="none">${lines.join('')}</g>`, spans, hem,
  };
}

/** Cloth drawn as one piece: all outlines, then all fills. */
export function cloth(parts: Pt[][], fill: string, stroke: string): string {
  const d = parts.map((p) => `<path d="${closedPath(p)}"/>`).join('');
  return `<g pointer-events="none"><g fill="${stroke}" stroke="${stroke}" stroke-width="1.3" stroke-linejoin="round">${d}</g><g fill="${fill}">${d}</g></g>`;
}

/** A sleeve: filled whole but outlined only along its sides, since at the top it is the same cloth as the gown. */
export function sleeveSvg(parts: Pt[][], fill: string, line: string, cut: string): string {
  const sl = parts[0], n = sl.length / 2;
  const side = (pts: Pt[]) => `<path d="${openPath(pts)}" fill="none" stroke="${line}" stroke-width="1.3" stroke-linecap="round"/>`;
  return `<g pointer-events="none">${parts.slice(1).map((p) => `<path d="${closedPath(p)}" fill="${fill}"/>`).join('')}<path d="${closedPath(sl)}" fill="${fill}"/>${side(sl.slice(1, n))}${side(sl.slice(n + 1, sl.length - 1))}${cut}</g>`;
}

/** A plain bra for a woman whose chest is exposed: a soft band over the breasts and a strap to the shoulder. */
export function bra(k: Skeleton, sh: Shape): string {
  if (!sh.breast) return '';
  const st = (s: number) => stationAt(sh.trunk, s);
  /* the cup follows the front of the breast and returns along its base; the band runs round the chest below it */
  const cup: Pt[] = [];
  for (let s = 31; s <= 42; s += 1) cup.push(trunkPt(k, s, st(s).a + 0.35));
  cup.push(trunkPt(k, 42.6, st(42.6).a - 1.2));
  for (let s = 41; s >= 31; s -= 2.5) cup.push(trunkPt(k, s, st(s).a - sh.breast * (0.5 + 0.4 * Math.sin(((s - 31) / 10) * Math.PI)) - 1.4));
  const band = [trunkPt(k, 30.6, st(30.6).a * 0.6), trunkPt(k, 30.8, -st(30.8).p - 0.3), trunkPt(k, 33, -st(33).p - 0.3), trunkPt(k, 33, st(33).a * 0.5)];
  const strap = [trunkPt(k, 41.5, st(41.5).a - 1.4), trunkPt(k, 46, st(46).a * 0.35), trunkPt(k, 51.5, -1.5)];
  const c = '#e9e1d8', line = '#bcae9f';
  return `<g pointer-events="none"><path d="${closedPath(band)}" fill="${c}" stroke="${line}" stroke-width=".6"/><path d="${closedPath(cup)}" fill="${c}" stroke="${line}" stroke-width=".7"/>`
    + `<path d="${openPath(strap)}" fill="none" stroke="${line}" stroke-width="2.2" stroke-linecap="round"/><path d="${openPath(strap)}" fill="none" stroke="${c}" stroke-width="1.3" stroke-linecap="round"/></g>`;
}

/* ---- trolley ---- */

/** The trolley in this view: frame, wheels, mattress, the backrest (head section) and the pillow. */
export function trolley(pr: Projector, left: number, backrest: { pivot: Pt; angle: number; len: number } | null, pillow: Pt[] | null, fade: number): string {
  const top = BED_TOP, frame = '#b4bfbc', frameDark = '#97a3a0', matt = 'url(#fig-§-matt)';
  const out: string[] = [];
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, fill: string, stroke = '', sw = 1) =>
    out.push(`<path d="${poly(hull(boxCorners(pr, x0, x1, y0, y1, z0, z1)))}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''} stroke-linejoin="round"/>`);
  const topFace = (x0: number, x1: number, y: number, z0: number, z1: number, fill: string) => {
    const q = [pr.P({ x: x0, y }, z0), pr.P({ x: x1, y }, z0), pr.P({ x: x1, y }, z1), pr.P({ x: x0, y }, z1)];
    if (Math.abs(area(q)) > 40) out.push(`<path d="${poly(q)}" fill="${fill}" stroke="#c9d2cf" stroke-width="1" stroke-linejoin="round"/>`);
  };
  const ZM = 33, ZP = 27;
  out.push(`<g class="bed" pointer-events="none" opacity="${f(1 - 0.45 * fade)}">`);
  /* posts, wheels and the lower rail, on both sides of the trolley */
  for (const zs of [ZP, -ZP]) {
    for (const x of [left + 24, BED_RIGHT - 30]) {
      box(x, x + 6, top + 19, FLOOR - 11, zs - 1.5, zs + 1.5, frame);
      const wheel: Pt[] = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; wheel.push(pr.P({ x: x + 3 + Math.cos(a) * 6, y: FLOOR - 6 + Math.sin(a) * 6 }, zs)); }
      out.push(`<path d="${poly(wheel)}" fill="#7f8b88"/>`);
      const hub = pr.P({ x: x + 3, y: FLOOR - 6 }, zs);
      out.push(`<circle cx="${f(hub.x)}" cy="${f(hub.y)}" r="2.2" fill="#c9d1cf"/>`);
    }
    box(left + 20, BED_RIGHT - 20, FLOOR - 26, FLOOR - 22, zs - 1, zs + 1, frame);
  }
  box(left, BED_RIGHT, top + 13, top + 19, -ZP - 2, ZP + 2, frameDark);
  if (backrest) {
    const { pivot, angle, len } = backrest;
    const d = dir(angle), n = dir(angle + 90);     // n points into the mattress, away from the patient
    const p1 = { x: pivot.x + d.x * len, y: pivot.y + d.y * len };
    const q = (p: Pt, t: number) => ({ x: p.x + n.x * t, y: p.y + n.y * t });
    const strut = q(add(pivot, angle, len * 0.55), 13);
    for (const zs of [ZP - 4, -ZP + 4]) out.push(`<path d="${poly([pr.P(strut, zs), pr.P({ x: pivot.x + (p1.x - pivot.x) * 0.15, y: top + 16 }, zs)])}" fill="none" stroke="${frameDark}" stroke-width="4" stroke-linecap="round"/>`);
    const corners = [pivot, p1, q(p1, 13), q(pivot, 13)].flatMap((p) => [pr.P(p, -ZM), pr.P(p, ZM)]);
    out.push(`<path d="${poly(hull(corners))}" fill="${matt}" stroke="#b9c4c1" stroke-width="1" stroke-linejoin="round"/>`);
    const face = [pr.P(pivot, -ZM), pr.P(p1, -ZM), pr.P(p1, ZM), pr.P(pivot, ZM)];
    if (Math.abs(area(face)) > 40) out.push(`<path d="${poly(face)}" fill="#eef2f0" stroke="#c9d2cf" stroke-width="1" stroke-linejoin="round"/>`);
  }
  const mx0 = backrest ? backrest.pivot.x : left;
  box(mx0, BED_RIGHT, top, top + 14, -ZM, ZM, matt, '#b9c4c1');
  topFace(mx0, BED_RIGHT, top, -ZM, ZM, '#eef2f0');
  if (pillow) {
    const pts = pillow.flatMap((p) => [pr.P(p, -21), pr.P(p, 21)]);
    out.push(`<path d="${closedPath(pr.profile ? pillow.map((p) => pr.P(p)) : hull(pts))}" fill="#f4f6f5" stroke="#c8d0ce" stroke-width="1"/>`);
  }
  out.push('</g>');
  return out.join('');
}
const poly = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join('') + 'Z';
const area = (q: Pt[]) => q.reduce((s, p, i) => { const r = q[(i + 1) % q.length]; return s + p.x * r.y - r.x * p.y; }, 0) / 2;

/** Gradient defs shared by the dress (gown cloth, mattress). */
export function dressDefs(pal: { gown: string; gownLight: string; gownDark: string }): string {
  return `<linearGradient id="fig-§-gown" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal.gownLight}"/><stop offset=".55" stop-color="${pal.gown}"/><stop offset="1" stop-color="${pal.gownDark}"/></linearGradient>`
    + `<linearGradient id="fig-§-matt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9eeec"/><stop offset="1" stop-color="#cdd6d3"/></linearGradient>`;
}

export type { Palette };
