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
   looked at.
--------------------------------------------------------------------------- */

import { add, closedPath, dir, f, openPath, type Pt } from './figure-geom.ts';
import { limbOutline, stationAt, trunkOutline, trunkPt, type Shape, type Skeleton, type Station } from './figure-body.ts';
import type { FigureLook } from './patient-figure.ts';
import type { Palette } from './figure-head.ts';

export const BED_TOP = 258, FLOOR = 368, BED_RIGHT = 346;

/** Cloth spans hollows: each station is at least as deep as its neighbours minus a slope. */
function bridge(st: Station[], slope: number): Station[] {
  return st.map((t) => {
    let a = t.a, p = t.p;
    for (const o of st) { const d = Math.abs(o.s - t.s); a = Math.max(a, o.a - slope * d); p = Math.max(p, o.p - slope * d); }
    return { s: t.s, a, p };
  });
}

export interface GownParts { far: string; body: string; sleeveNear: string; lines: string }

export function gown(k: Skeleton, sh: Shape, look: FigureLook, pal: { gown: string; gownLight: string; gownDark: string; gownLine: string; far: string }): GownParts {
  const ex = look.exposed, chestBare = ex.has('chest'), abdoBare = ex.has('abdomen');
  const armBare = ex.has('arm') || chestBare;
  const u = k.u, g = 1.1;
  /* the pieces of trunk the gown covers now */
  const spans: Array<[number, number]> = [];
  if (!chestBare && !abdoBare) spans.push([-99, 55.5]);
  else if (chestBare && !abdoBare) spans.push([-99, 23]);
  else if (!chestBare && abdoBare) { spans.push([28, 55.5], [-99, 0]); }
  else spans.push([-99, 0]);
  const hem = 26;
  const thighCloth = bridge(sh.thigh.filter((t) => t.s <= hem), 0.25).map((t, i, all) => ({ ...t, a: t.a + (i === all.length - 1 ? 0.8 : 0), p: t.p + (i === all.length - 1 ? 0.9 : 0) }));
  const thighShape = (i: 0 | 1) => {
    const st = [...thighCloth];
    const last = stationAt(sh.thigh, hem);
    st.push({ s: hem, a: last.a + 0.9, p: last.p + 1.0 });
    return limbOutline(k.hip, k.thighA[i], st.filter((t) => t.s >= -4), u, k.flip, g);
  };
  /* cloth bridges the hollows of the part it covers, not of what lies beyond its edge */
  const clothFor = ([a, b]: [number, number]) => ({ ...sh, trunk: [...sh.trunk.filter((t) => t.s < a - 4), ...bridge(sh.trunk.filter((t) => t.s >= a - 4 && t.s <= b + 4), 0.32), ...sh.trunk.filter((t) => t.s > b + 4)] });
  const cloth = clothFor(spans[0]);
  const trunkShapes = spans.map((sp) => trunkOutline(k, clothFor(sp), sp[0], sp[1], g));
  const grad = `url(#fig-§-gown)`;
  const shapes = [...trunkShapes, thighShape(0)];
  const pass = (pts: Pt[][], fill: string, stroke: string) => {
    const d = pts.map((p) => `<path d="${closedPath(p)}"/>`).join('');
    return `<g fill="${stroke}" stroke="${stroke}" stroke-width="1.3" stroke-linejoin="round">${d}</g><g fill="${fill}">${d}</g>`;
  };

  /* folds: where cloth bunches (waist, groin, the elbow of a bent trunk) and long folds from the shoulder */
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
    const st = sh.upper.filter((t) => t.s <= 10).map((t) => ({ s: t.s, a: t.a, p: t.p }));
    const end = stationAt(sh.upper, 12);
    st.push({ s: 12, a: end.a + 0.6, p: end.p + 0.7 });
    return limbOutline(k.shoulder, k.upperA[i], st, u, k.flip, 0.7);
  };
  let sleeveNear = '', far = '';
  const sleeveCut = (i: 0 | 1) => { const e = stationAt(sh.upper, 12); return `<path d="${openPath([add(add(k.shoulder, k.upperA[i], 12.2 * u), k.upperA[i] + 90 * k.flip, (e.a + 1.3) * u), add(k.shoulder, k.upperA[i], 12.6 * u), add(add(k.shoulder, k.upperA[i], 12.2 * u), k.upperA[i] - 90 * k.flip, (e.p + 1.4) * u)])}" fill="none" stroke="${pal.gownLine}" stroke-width="1" opacity=".9"/>`; };
  const sleevesOn = !armBare && !chestBare && spans.some(([, b]) => b >= 55);
  if (sleevesOn) {
    /* The sleeve is filled whole but outlined only along its sides: at the top it is the same cloth as the gown. */
    const sl = sleeve(0), n = sl.length / 2;
    const side = (pts: Pt[]) => `<path d="${openPath(pts)}" fill="none" stroke="${pal.gownLine}" stroke-width="1.3" stroke-linecap="round"/>`;
    sleeveNear = `<g pointer-events="none"><path d="${closedPath(sl)}" fill="${grad}"/>${side(sl.slice(1, n))}${side(sl.slice(n + 1, sl.length - 1))}${sleeveCut(0)}</g>`;
  }
  /* the far side: the far thigh's gown and sleeve, in shade */
  const farParts: Pt[][] = [thighShape(1)];
  if (sleevesOn) farParts.push(sleeve(1));
  far = `<g pointer-events="none">${pass(farParts, pal.far, pal.gownLine)}</g>`;
  return { far, body: `<g pointer-events="none">${pass(shapes, grad, pal.gownLine)}</g>`, sleeveNear, lines: `<g pointer-events="none">${lines.join('')}</g>` };
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

export interface BedGeom { svg: string; pillowTop: number | null }

export function trolley(left: number, backrest: { pivot: Pt; angle: number; len: number } | null, pillow: Pt[] | null, fade: number): string {
  const top = BED_TOP, frame = '#b4bfbc', frameDark = '#97a3a0', matt = 'url(#fig-§-matt)';
  const out: string[] = [];
  out.push(`<g class="bed" pointer-events="none" opacity="${f(1 - 0.45 * fade)}">`);
  out.push(`<rect x="${f(left)}" y="${top + 13}" width="${f(BED_RIGHT - left)}" height="6" rx="2" fill="${frameDark}"/>`);
  for (const x of [left + 24, BED_RIGHT - 30]) out.push(`<rect x="${f(x)}" y="${top + 19}" width="6" height="${FLOOR - top - 30}" fill="${frame}"/><circle cx="${f(x + 3)}" cy="${FLOOR - 6}" r="6" fill="#7f8b88"/><circle cx="${f(x + 3)}" cy="${FLOOR - 6}" r="2.2" fill="#c9d1cf"/>`);
  out.push(`<rect x="${f(left + 20)}" y="${FLOOR - 26}" width="${f(BED_RIGHT - left - 40)}" height="4" rx="2" fill="${frame}"/>`);
  if (backrest) {
    const { pivot, angle, len } = backrest;
    const d = dir(angle), n = dir(angle + 90);     // n points into the mattress, away from the patient
    const p0 = pivot, p1 = { x: pivot.x + d.x * len, y: pivot.y + d.y * len };
    const q = (p: Pt, t: number) => ({ x: p.x + n.x * t, y: p.y + n.y * t });
    out.push(`<path d="M${f(p0.x)} ${f(p0.y)}L${f(p1.x)} ${f(p1.y)}L${f(q(p1, 13).x)} ${f(q(p1, 13).y)}L${f(q(p0, 13).x)} ${f(q(p0, 13).y)}Z" fill="${matt}" stroke="#b9c4c1" stroke-width="1" stroke-linejoin="round"/>`);
    const strut = q(add(p0, angle, len * 0.55), 13);
    out.push(`<path d="M${f(strut.x)} ${f(strut.y)}L${f(p0.x + (p1.x - p0.x) * 0.15)} ${top + 16}" stroke="${frameDark}" stroke-width="4" stroke-linecap="round"/>`);
  }
  out.push(`<rect x="${f(left)}" y="${top}" width="${f(BED_RIGHT - left)}" height="14" rx="6" fill="${matt}" stroke="#b9c4c1" stroke-width="1"/>`);
  if (pillow) out.push(`<path d="${closedPath(pillow)}" fill="#f4f6f5" stroke="#c8d0ce" stroke-width="1"/>`);
  out.push('</g>');
  return out.join('');
}

/** Gradient defs shared by the dress (gown cloth, mattress). */
export function dressDefs(pal: { gown: string; gownLight: string; gownDark: string }): string {
  return `<linearGradient id="fig-§-gown" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal.gownLight}"/><stop offset=".55" stop-color="${pal.gown}"/><stop offset="1" stop-color="${pal.gownDark}"/></linearGradient>`
    + `<linearGradient id="fig-§-matt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9eeec"/><stop offset="1" stop-color="#cdd6d3"/></linearGradient>`;
}

export type { Palette };
