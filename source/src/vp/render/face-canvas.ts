import type { Side } from '../model/types.ts';

/* ===========================================================================
   Face canvas: a shaded, anatomically proportioned face for the eye and
   cranial-nerve examinations.

   Everything that moves is a parameter computed from findings:
   - each eye is a sphere; the iris is projected onto it, so it foreshortens
     into an ellipse as the eye turns, and its texture rotates with torsion;
   - the upper lid follows vertical gaze (lid–gaze coupling), droops with
     ptosis and closes with a blink or on command; a weak lid closes only
     partly and the globe rolls up beneath it (Bell's phenomenon);
   - the corneal reflection moves about half as far as the pupil, as on a
     real cornea, and brightens under the pen torch;
   - brows, forehead lines, nasolabial folds and the corners of the mouth
     move per side, so an upper motor neuron facial weakness and a facial
     nerve palsy look different.
   Frenzel goggles magnify and light the eyes; the cover card occludes one.

   Coordinates: a virtual face with its origin midway between the eyes,
   x to the viewer's right (the patient's left), y down, ~1 px per 0.23 mm.
=========================================================================== */

export type IrisColour = 'brown' | 'hazel' | 'green' | 'blue' | 'grey';

export interface Appearance {
  skin: string; skinShade: string; hair: string; iris: IrisColour; seed: number; sex: 'F' | 'M'; age: number;
}

export interface EyeParams {
  h: number; v: number; torsion: number; pupilMm: number; ptosisMm: number; closure: number;
  /** 0 white … 1 deep yellow sclera (icterus) */
  icterus?: number;
  /** palpebral conjunctiva: 0 red … 1 pale (anaemia); shown when the lower lid is drawn down */
  pallor?: number;
  /** upper lid drawn up above its normal place, mm (thyroid lid retraction and lag) */
  retractionMm?: number;
  /** globe pushed forward, mm (exophthalmos): the lids part around it */
  proptosisMm?: number;
  /** the examiner's thumb draws the lower lid down, 0 … 1 */
  lowerLidPull?: number;
}
export interface FaceState {
  yaw: number;                                   // head rotation, degrees (+ = patient's right)
  eyes: Record<Side, EyeParams>;
  brows: Record<Side, number>;                   // lift in px
  foreheadLines: Record<Side, number>;           // 0..1
  mouth: Record<Side, { lift: number; droop: number; pull: number }>;
  mouthOpen: number;                             // 0..1 (teeth showing)
  /** The mouth examination (optional): the jaw opened wide ("say ah"), its shift to one side (px, + toward the patient's
      left as drawn), the soft palate's lift on each side (0..1), the uvula's shift (px), the tongue put out (0..1), its
      deviation (px), a wasted half and fasciculations. */
  oral?: { wide: number; jawShift: number; palate: Record<Side, number>; uvulaShift: number; tongueOut: number; tongueShift: number; wasted: Side | null; fasciculation: boolean; t: number };
  folds: Record<Side, number>;                   // nasolabial fold depth 0..1
  light: Side | 'none';
  dim: boolean;
  frenzel: boolean;
  cover: Side | null;
  camera: 'eyes' | 'face';
}

export function neutralFace(): FaceState {
  const eye = (): EyeParams => ({ h: 0, v: 0, torsion: 0, pupilMm: 4, ptosisMm: 0, closure: 0 });
  return {
    yaw: 0, eyes: { L: eye(), R: eye() }, brows: { L: 0, R: 0 }, foreheadLines: { L: 0, R: 0 },
    mouth: { L: { lift: 0, droop: 0, pull: 0 }, R: { lift: 0, droop: 0, pull: 0 } }, mouthOpen: 0, folds: { L: 1, R: 1 },
    light: 'none', dim: false, frenzel: false, cover: null, camera: 'eyes',
  };
}

const IRIS: Record<IrisColour, [string, string, string]> = {
  brown: ['#a0703a', '#5a3417', '#2b170a'], hazel: ['#b08a3e', '#5b6233', '#2c2a17'],
  green: ['#8fae6a', '#46653a', '#1f2f1c'], blue: ['#a9c3da', '#5679a0', '#233448'], grey: ['#b3bcc2', '#66727a', '#2d3439'],
};

/* ---- small helpers ------------------------------------------------------------- */
function rng(seed: number) { let s = seed % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function rgba(hex: string, a: number) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
const D2R = Math.PI / 180;

/* ---- the iris, painted once per patient ------------------------------------------- */
function irisTexture(colour: IrisColour, seed: number): HTMLCanvasElement {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const R = S / 2, rand = rng(seed);
  const [light, mid, dark] = IRIS[colour];
  g.translate(R, R);
  const base = g.createRadialGradient(0, 0, R * 0.15, 0, 0, R);
  base.addColorStop(0, light); base.addColorStop(0.35, light); base.addColorStop(0.55, mid); base.addColorStop(0.9, mid); base.addColorStop(1, dark);
  g.fillStyle = base; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
  // stromal fibres
  for (let i = 0; i < 520; i++) {
    const a = rand() * Math.PI * 2, r0 = R * (0.18 + rand() * 0.2), r1 = R * (0.55 + rand() * 0.42);
    const wob = (rand() - 0.5) * 0.12;
    g.strokeStyle = rand() < 0.55 ? `rgba(255,240,220,${0.05 + rand() * 0.12})` : `rgba(0,0,0,${0.05 + rand() * 0.14})`;
    g.lineWidth = 0.6 + rand() * 1.4;
    g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    g.quadraticCurveTo(Math.cos(a + wob) * (r0 + r1) / 2, Math.sin(a + wob) * (r0 + r1) / 2, Math.cos(a + wob * 2) * r1, Math.sin(a + wob * 2) * r1);
    g.stroke();
  }
  // collarette
  g.strokeStyle = rgba(light, 0.55); g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2, r = R * (0.36 + Math.sin(i * 1.7 + seed) * 0.025); i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); g.stroke();
  // crypts
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2, r = R * (0.42 + rand() * 0.3);
    g.fillStyle = `rgba(0,0,0,${0.18 + rand() * 0.2})`;
    g.beginPath(); g.ellipse(Math.cos(a) * r, Math.sin(a) * r, 3 + rand() * 5, 1.5 + rand() * 2.5, a, 0, Math.PI * 2); g.fill();
  }
  // a pigment fleck: makes torsion visible
  g.fillStyle = 'rgba(70,40,15,0.75)'; g.beginPath(); g.ellipse(R * 0.1, -R * 0.62, 6, 4, 0.3, 0, Math.PI * 2); g.fill();
  // limbal ring
  const limb = g.createRadialGradient(0, 0, R * 0.82, 0, 0, R);
  limb.addColorStop(0, 'rgba(0,0,0,0)'); limb.addColorStop(1, 'rgba(0,0,0,0.65)');
  g.fillStyle = limb; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
  return c;
}

/* ---- the renderer ------------------------------------------------------------------- */
export class FaceCanvas {
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private irisTex: HTMLCanvasElement;
  private cam = { x: 0, y: -10, s: 0 };
  private nextBlink = 2 + Math.random() * 3;
  private blinkAt = -1;

  constructor(host: HTMLElement, private ap: Appearance) {
    host.innerHTML = '';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'facecanvas';
    host.appendChild(this.canvas);
    this.g = this.canvas.getContext('2d')!;
    this.irisTex = irisTexture(ap.iris, ap.seed);
  }

  /** Spontaneous blinks every few seconds, as real patients do. Returns closure 0..1. */
  blink(t: number): number {
    if (this.blinkAt < 0 && t > this.nextBlink) this.blinkAt = t;
    if (this.blinkAt >= 0) {
      const x = (t - this.blinkAt) / 0.16;
      if (x >= 1) { this.blinkAt = -1; this.nextBlink = t + 2.5 + Math.random() * 4; return 0; }
      return Math.sin(Math.PI * x);
    }
    return 0;
  }

  draw(st: FaceState) {
    const cv = this.canvas, g = this.g;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 600, h = cv.clientHeight || 360;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    // camera: ease toward the framing for this examination
    const box = st.camera === 'eyes' ? { x0: -215, x1: 215, y0: -150, y1: 120 } : { x0: -280, x1: 280, y0: -340, y1: 420 };
    const target = { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2, s: Math.min(w / (box.x1 - box.x0), h / (box.y1 - box.y0)) };
    if (!this.cam.s) this.cam = { ...target };
    this.cam.x += (target.x - this.cam.x) * 0.15; this.cam.y += (target.y - this.cam.y) * 0.15; this.cam.s += (target.s - this.cam.s) * 0.15;

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#d9dfdd'; g.fillRect(0, 0, w, h);
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#e6ebe9'); bg.addColorStop(1, '#c9d1ce');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.translate(w / 2, h / 2); g.scale(this.cam.s, this.cam.s); g.translate(-this.cam.x, -this.cam.y);

    // head yaw: the face slides and narrows a little; eyes keep pointing where the model says
    const yawPx = -st.yaw * 4.2;
    g.save();
    g.translate(yawPx, 0);
    g.scale(1 - Math.abs(st.yaw) * 0.004, 1);
    this.drawHead(st);
    this.drawEyes(st, 1);
    this.drawNoseMouth(st);
    g.restore();

    if (st.frenzel) this.drawFrenzel(st, yawPx);
    if (st.cover) this.drawCover(st.cover, yawPx);
    if (st.dim) {
      g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = st.light === 'none' && !st.frenzel ? 'rgba(10,14,20,0.55)' : 'rgba(10,14,20,0.38)'; g.fillRect(0, 0, w, h);
      g.restore();
    }
    if (st.light !== 'none') this.drawTorch(st.light, yawPx);
  }

  /* ---- head, hair, brows, forehead ------------------------------------------------------ */
  private drawHead(st: FaceState) {
    const g = this.g, { skin, skinShade, hair } = this.ap;
    // neck and gown
    g.fillStyle = shade(skin, -0.08);
    g.beginPath(); g.moveTo(-100, 250); g.lineTo(-115, 520); g.lineTo(115, 520); g.lineTo(100, 250); g.fill();
    g.fillStyle = '#9fbfd3'; g.beginPath(); g.moveTo(-340, 430); g.quadraticCurveTo(0, 370, 340, 430); g.lineTo(320, 600); g.lineTo(-320, 600); g.fill();
    // ears
    for (const sx of [-1, 1]) {
      g.fillStyle = shade(skin, -0.06);
      g.beginPath(); g.ellipse(sx * 214, 40, 26, 62, sx * 0.12, 0, Math.PI * 2); g.fill();
      g.strokeStyle = rgba(skinShade, 0.6); g.lineWidth = 2; g.beginPath(); g.ellipse(sx * 214, 40, 14, 44, sx * 0.12, -1.2, 1.4); g.stroke();
    }
    // skull and face
    const head = new Path2D();
    head.moveTo(0, -300);
    head.bezierCurveTo(140, -300, 214, -200, 214, -40);
    head.bezierCurveTo(212, 80, 196, 190, 150, 270);
    head.bezierCurveTo(110, 335, 60, 360, 0, 362);
    head.bezierCurveTo(-60, 360, -110, 335, -150, 270);
    head.bezierCurveTo(-196, 190, -212, 80, -214, -40);
    head.bezierCurveTo(-214, -200, -140, -300, 0, -300);
    const sk = g.createRadialGradient(-50, -60, 40, 0, 20, 310);
    sk.addColorStop(0, shade(skin, 0.1)); sk.addColorStop(0.55, skin); sk.addColorStop(1, shade(skin, -0.22));
    g.fillStyle = sk; g.fill(head);
    // temples and the hollow under the cheekbones give the face its volume
    for (const sx of [-1, 1]) {
      const tg = g.createRadialGradient(sx * 200, -60, 10, sx * 200, -60, 90);
      tg.addColorStop(0, rgba(skinShade, 0.35)); tg.addColorStop(1, rgba(skinShade, 0));
      g.fillStyle = tg; g.beginPath(); g.arc(sx * 200, -60, 90, 0, Math.PI * 2); g.fill();
      const cb = g.createRadialGradient(sx * 150, 175, 10, sx * 150, 175, 80);
      cb.addColorStop(0, rgba(skinShade, 0.22)); cb.addColorStop(1, rgba(skinShade, 0));
      g.fillStyle = cb; g.beginPath(); g.arc(sx * 150, 175, 80, 0, Math.PI * 2); g.fill();
    }
    // cheek warmth
    for (const sx of [-1, 1]) {
      const ch = g.createRadialGradient(sx * 120, 130, 5, sx * 120, 130, 90);
      ch.addColorStop(0, 'rgba(200,90,80,0.10)'); ch.addColorStop(1, 'rgba(200,90,80,0)');
      g.fillStyle = ch; g.beginPath(); g.arc(sx * 120, 130, 90, 0, Math.PI * 2); g.fill();
    }
    // hair
    const grey = /b9|c0|ccc|a9/.test(hair);
    g.fillStyle = hair;
    g.beginPath();
    g.moveTo(-222, -20);
    g.bezierCurveTo(-235, -260, -120, -335, 0, -332);
    g.bezierCurveTo(120, -335, 235, -260, 222, -20);
    g.bezierCurveTo(212, -110, 190, -160, 150, -190);
    g.bezierCurveTo(100, this.ap.sex === 'M' && this.ap.age > 60 ? -250 : -215, -100, this.ap.sex === 'M' && this.ap.age > 60 ? -250 : -215, -150, -190);
    g.bezierCurveTo(-190, -160, -212, -110, -222, -20);
    g.fill();
    const rand = rng(this.ap.seed + 7);
    g.strokeStyle = grey ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'; g.lineWidth = 1.2;
    for (let i = 0; i < 160; i++) {
      const x = (rand() - 0.5) * 400, y = -300 + rand() * 90;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y + 20, x + (rand() - 0.5) * 30, y + 45); g.stroke();
    }
    // forehead lines (frontalis)
    for (const S of ['R', 'L'] as Side[]) {
      const sx = S === 'R' ? -1 : 1, k = st.foreheadLines[S];
      if (k <= 0.02) continue;
      for (let i = 0; i < 3; i++) {
        const y = -150 - i * 20 - st.brows[S] * 0.4;
        g.strokeStyle = rgba(skinShade, 0.45 * k); g.lineWidth = 2;
        g.beginPath(); g.moveTo(sx * 8, y + 4); g.quadraticCurveTo(sx * 80, y - 8, sx * 150, y + 6); g.stroke();
        g.strokeStyle = `rgba(255,255,255,${0.18 * k})`; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(sx * 8, y + 7); g.quadraticCurveTo(sx * 80, y - 5, sx * 150, y + 9); g.stroke();
      }
    }
    // brows: short hairs along a curve
    const browHex = grey ? '#7d7a74' : (hair.startsWith('#') ? hair : '#3a2a20');
    for (const S of ['R', 'L'] as Side[]) {
      const cx = S === 'R' ? -100 : 100, nasal = S === 'R' ? 1 : -1, lift = st.brows[S];
      const r2 = rng(this.ap.seed + (S === 'R' ? 11 : 13));
      // a soft base gives the brow its body; individual hairs give it texture
      g.strokeStyle = rgba(browHex, 0.18); g.lineWidth = 10; g.lineCap = 'round';
      g.beginPath();
      for (let k = 0; k <= 20; k++) {
        const u = k / 20, x = cx + nasal * 60 - nasal * u * 136, y = -60 - lift - Math.sin(Math.min(1, u * 1.3) * Math.PI) * 16 + u * 8;
        k ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke(); g.lineCap = 'butt';
      for (let i = 0; i < 260; i++) {
        const u = r2();                                        // 0 = medial head, 1 = lateral tail
        const arch = Math.sin(Math.min(1, u * 1.3) * Math.PI) * 16;
        const x = cx + nasal * 60 - nasal * u * 136;
        const thick = 9 * (1 - u * 0.65);
        const y = -60 - lift - arch + u * 8 + (r2() - 0.5) * thick;
        // medial hairs stand up, the body lies along the brow toward the tail
        const along = -nasal;                                  // direction toward the tail
        const upness = u < 0.18 ? 0.9 : 0.25;
        const len = 7 + r2() * 6;
        const dx = along * len * (1 - upness), dy = -len * upness - 1.5;
        g.strokeStyle = rgba(browHex, 0.22 + r2() * 0.3); g.lineWidth = 0.8 + r2() * 0.6;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + dx * 0.5, y + dy * 0.7, x + dx, y + dy); g.stroke();
      }
    }
  }

  /* ---- eyes ---------------------------------------------------------------------------- */
  /** Geometry of one palpebral fissure, given lid state. */
  private fissure(S: Side, e: EyeParams, extraClose = 0) {
    const cx = S === 'R' ? -100 : 100, nasal = S === 'R' ? 1 : -1;
    const R = 50;
    const irisDy = -R * Math.sin(e.v * D2R);              // + = down on screen
    const close = Math.min(1, e.closure + extraClose);
    const ptosisPx = e.ptosisMm * 4.4;
    const prop = (e.proptosisMm ?? 0) * 4.4;
    // upper lid: follows the eye vertically, droops with ptosis, is drawn up by retraction, closes with closure
    let upper = -20 + 0.75 * irisDy + ptosisPx - (e.retractionMm ?? 0) * 4.4 - 0.25 * prop;
    /* a proptotic globe parts the lids; the examiner's thumb draws the lower lid down */
    const lowerBase = 21 + Math.max(0, 0.25 * irisDy) + 0.5 * prop + 16 * (e.lowerLidPull ?? 0);
    upper = upper + (lowerBase - 4 - upper) * close;
    upper = Math.min(upper, lowerBase - 3);
    const lower = lowerBase - 4 * close;
    const inner = { x: cx + nasal * 56, y: 5 }, outer = { x: cx - nasal * 62, y: -5 };
    const path = new Path2D();
    path.moveTo(outer.x, outer.y);
    path.quadraticCurveTo(cx - nasal * 4, 2 * upper - (inner.y + outer.y) / 2, inner.x, inner.y);
    path.quadraticCurveTo(cx - nasal * 8, 2 * lower - (inner.y + outer.y) / 2, outer.x, outer.y);
    path.closePath();
    return { cx, nasal, R, path, upper, lower, inner, outer, close };
  }

  private drawEyes(st: FaceState, mag: number, only?: Side) {
    const g = this.g;
    for (const S of ['R', 'L'] as Side[]) {
      if (only && only !== S) continue;
      const e = st.eyes[S];
      const f = this.fissure(S, e);
      // orbital shadow above the eye
      const orb = g.createRadialGradient(f.cx, -20, 10, f.cx, -20, 95);
      orb.addColorStop(0, rgba(this.ap.skinShade, 0.32)); orb.addColorStop(1, rgba(this.ap.skinShade, 0));
      g.fillStyle = orb; g.beginPath(); g.ellipse(f.cx, -20, 95, 62, 0, 0, Math.PI * 2); g.fill();

      g.save();
      g.clip(f.path);
      // sclera, shaded as a sphere
      const sc = g.createRadialGradient(f.cx, 0, 8, f.cx, 0, 72);
      sc.addColorStop(0, '#fbfaf6'); sc.addColorStop(0.6, '#f1ece4'); sc.addColorStop(1, '#d9c9c0');
      g.fillStyle = sc; g.fillRect(f.cx - 80, -60, 160, 120);
      /* bilirubin bound in the sclera: a yellow that deepens toward the fornices, where the sclera is thickest under
         the conjunctiva */
      const ict = Math.max(0, Math.min(1, e.icterus ?? 0));
      if (ict > 0) {
        const y = g.createRadialGradient(f.cx, 0, 10, f.cx, 0, 74);
        y.addColorStop(0, `rgba(222,186,40,${0.28 * ict})`); y.addColorStop(1, `rgba(200,160,20,${0.6 * ict})`);
        g.fillStyle = y; g.fillRect(f.cx - 80, -60, 160, 120);
      }
      /* the inner surface of the drawn-down lower lid: capillary blood under a thin membrane, red; pale in anaemia */
      const pull = Math.max(0, Math.min(1, e.lowerLidPull ?? 0));
      if (pull > 0) {
        const pal = Math.max(0, Math.min(1, e.pallor ?? 0));
        const mix = (a: number[], b: number[]) => a.map((x, i) => Math.round(x + (b[i] - x) * pal));
        const deep = mix([176, 52, 58], [226, 196, 190]), rim = mix([206, 96, 98], [240, 222, 216]);
        const band = g.createLinearGradient(0, f.lower - 18 * pull, 0, f.lower);
        band.addColorStop(0, `rgb(${rim.join(',')})`); band.addColorStop(1, `rgb(${deep.join(',')})`);
        g.fillStyle = band;
        g.beginPath(); g.moveTo(f.outer.x, f.outer.y);
        g.quadraticCurveTo(f.cx - f.nasal * 8, 2 * (f.lower - 17 * pull) - (f.inner.y + f.outer.y) / 2, f.inner.x, f.inner.y);
        g.quadraticCurveTo(f.cx - f.nasal * 8, 2 * f.lower - (f.inner.y + f.outer.y) / 2, f.outer.x, f.outer.y);
        g.fill();
      }
      // faint vessels near the canthi
      const rv = rng(this.ap.seed + (S === 'R' ? 3 : 5));
      g.strokeStyle = 'rgba(190,70,70,0.22)'; g.lineWidth = 0.8;
      for (let i = 0; i < 8; i++) {
        const side = i % 2 ? f.inner : f.outer, x0 = side.x, y0 = side.y + (rv() - 0.5) * 10;
        g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + (f.cx - x0) * 0.3, y0 + (rv() - 0.5) * 14, x0 + (f.cx - x0) * (0.4 + rv() * 0.2), y0 + (rv() - 0.5) * 18); g.stroke();
      }
      // iris: projected onto the globe
      const hRad = e.h * D2R, vRad = e.v * D2R;
      const ix = f.cx - f.R * Math.sin(hRad), iy = -f.R * Math.sin(vRad) + 1;
      const ir = 22 * mag;
      g.save();
      g.translate(ix, iy);
      g.scale(Math.max(0.35, Math.cos(hRad)), Math.max(0.35, Math.cos(vRad)));
      g.rotate(-e.torsion * D2R);
      g.drawImage(this.irisTex, -ir, -ir, ir * 2, ir * 2);
      // pupil (iris ≈ 12 mm across)
      const pr = Math.max(1.2, e.pupilMm / 12 * ir);
      const pg = g.createRadialGradient(0, 0, pr * 0.2, 0, 0, pr);
      pg.addColorStop(0, '#050505'); pg.addColorStop(1, '#111');
      g.fillStyle = pg; g.beginPath(); g.arc(0, 0, pr, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(60,35,20,0.6)'; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, pr + 0.8, 0, Math.PI * 2); g.stroke();
      g.restore();
      // corneal reflection: moves about half as far as the pupil
      const torch = st.light === S;
      const rx = f.cx + (ix - f.cx) * 0.5 - 5 + (st.light === 'none' ? 0 : (S === 'R' ? 2 : -2)), ry = iy * 0.5 - 6;
      g.fillStyle = torch ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.85)';
      g.beginPath(); g.ellipse(rx, ry, torch ? 4.5 : 3.2, torch ? 4 : 2.6, -0.4, 0, Math.PI * 2); g.fill();
      if (!torch) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(rx + 9, ry + 8, 1.6, 1.2, 0, 0, Math.PI * 2); g.fill(); }
      // shadow cast by the upper lid and lashes
      const sh = g.createLinearGradient(0, f.upper - 2, 0, f.upper + 16);
      sh.addColorStop(0, 'rgba(40,20,10,0.45)'); sh.addColorStop(1, 'rgba(40,20,10,0)');
      g.fillStyle = sh; g.fillRect(f.cx - 80, f.upper - 4, 160, 22);
      // caruncle and plica at the inner canthus
      const car = g.createRadialGradient(f.inner.x - f.nasal * 6, 4, 1, f.inner.x - f.nasal * 6, 4, 11);
      car.addColorStop(0, '#d98a86'); car.addColorStop(1, 'rgba(217,138,134,0)');
      g.fillStyle = car; g.beginPath(); g.ellipse(f.inner.x - f.nasal * 6, 4, 11, 9, 0, 0, Math.PI * 2); g.fill();
      g.restore();

      // upper lid skin above the margin: crease follows the margin
      const crease = f.upper - 14 - (1 - f.close) * 4;
      g.strokeStyle = rgba(this.ap.skinShade, 0.35); g.lineWidth = 4;
      g.beginPath(); g.moveTo(f.outer.x - f.nasal * 4, f.outer.y - 6);
      g.quadraticCurveTo(f.cx - f.nasal * 4, 2 * crease - (f.inner.y + f.outer.y) / 2 - 10, f.inner.x + f.nasal * 2, f.inner.y - 8); g.stroke();
      // lid margin, lashes
      g.strokeStyle = 'rgba(70,38,28,0.7)'; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(f.outer.x, f.outer.y);
      g.quadraticCurveTo(f.cx - f.nasal * 4, 2 * f.upper - (f.inner.y + f.outer.y) / 2, f.inner.x, f.inner.y); g.stroke();
      const lashRand = rng(this.ap.seed + (S === 'R' ? 17 : 19));
      for (let i = 0; i <= 34; i++) {
        const u = Math.min(1, Math.max(0, i / 34 + (lashRand() - 0.5) * 0.02));
        if (u > 0.9) continue;                                     // few lashes at the inner canthus
        const yc = 2 * f.upper - (f.inner.y + f.outer.y) / 2, xc = f.cx - f.nasal * 4;
        const x = (1 - u) * (1 - u) * f.outer.x + 2 * (1 - u) * u * xc + u * u * f.inner.x;
        const y = (1 - u) * (1 - u) * f.outer.y + 2 * (1 - u) * u * yc + u * u * f.inner.y;
        const len = (3 + 4 * Math.sin(Math.min(1, u * 1.3) * Math.PI) + lashRand() * 2.5) * (1 - f.close * 0.3) * (this.ap.age > 60 ? 0.8 : 1);
        const lateral = -f.nasal * (0.75 - u) * 9 + (lashRand() - 0.5) * 3;   // lashes fan outward at the lateral end
        g.strokeStyle = `rgba(35,24,18,${0.35 + lashRand() * 0.3})`; g.lineWidth = 0.7 + lashRand() * 0.5;
        g.beginPath(); g.moveTo(x, y + 0.5);
        g.quadraticCurveTo(x + lateral * 0.3, y - len * 0.9, x + lateral, y - len * 0.85 - 2);
        g.stroke();
      }
      // lower lid margin with its wet line
      g.strokeStyle = 'rgba(150,80,70,0.55)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(f.outer.x, f.outer.y);
      g.quadraticCurveTo(f.cx - f.nasal * 8, 2 * f.lower - (f.inner.y + f.outer.y) / 2, f.inner.x, f.inner.y); g.stroke();
      g.strokeStyle = rgba(this.ap.skinShade, 0.35); g.lineWidth = 3;
      g.beginPath(); g.moveTo(f.outer.x + f.nasal * 6, f.outer.y + 18);
      g.quadraticCurveTo(f.cx, f.lower + 20, f.inner.x - f.nasal * 6, f.inner.y + 14); g.stroke();
      /* a lid drawn down shows a deeper fold of skin below it */
      const pull2 = e.lowerLidPull ?? 0;
      if (pull2 > 0.05) {
        g.strokeStyle = rgba(this.ap.skinShade, 0.45 * pull2); g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(f.outer.x + f.nasal * 10, f.outer.y + 24); g.quadraticCurveTo(f.cx, f.lower + 26, f.inner.x - f.nasal * 10, f.inner.y + 20); g.stroke();
      }
    }
  }

  /* ---- nose, folds and mouth --------------------------------------------------------------- */
  private drawNoseMouth(st: FaceState) {
    const g = this.g, { skin, skinShade } = this.ap;
    // nasal bridge and sides
    for (const sx of [-1, 1]) {
      const side = g.createLinearGradient(sx * 8, 0, sx * 45, 0);
      side.addColorStop(0, rgba(skinShade, 0)); side.addColorStop(1, rgba(skinShade, 0.28));
      g.fillStyle = side;
      g.beginPath(); g.moveTo(sx * 10, -20); g.quadraticCurveTo(sx * 22, 60, sx * 40, 120); g.lineTo(sx * 48, 125); g.quadraticCurveTo(sx * 34, 40, sx * 26, -30); g.fill();
    }
    const tip = g.createRadialGradient(0, 112, 4, 0, 118, 40);
    tip.addColorStop(0, shade(skin, 0.14)); tip.addColorStop(1, rgba(skin, 0));
    g.fillStyle = tip; g.beginPath(); g.arc(0, 118, 40, 0, Math.PI * 2); g.fill();
    // alae and nostrils
    for (const sx of [-1, 1]) {
      g.strokeStyle = rgba(skinShade, 0.75); g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(sx * 18, 148); g.bezierCurveTo(sx * 30, 152, sx * 48, 146, sx * 46, 128); g.bezierCurveTo(sx * 44, 116, sx * 34, 112, sx * 30, 118); g.stroke();
      g.fillStyle = 'rgba(60,30,25,0.75)';
      g.beginPath(); g.ellipse(sx * 17, 145, 10, 5, sx * 0.25, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = rgba(skinShade, 0.4); g.lineWidth = 2;
    g.beginPath(); g.moveTo(-14, 140); g.quadraticCurveTo(0, 150, 14, 140); g.stroke();

    // nasolabial folds: deeper when the muscles are working, flattened when weak
    const corner = (S: Side) => {
      const sx = S === 'R' ? -1 : 1, m = st.mouth[S];
      return { x: sx * (54 + m.pull * 22), y: 214 + m.droop * 14 - m.lift * 20 };
    };
    for (const S of ['R', 'L'] as Side[]) {
      const sx = S === 'R' ? -1 : 1, k = st.folds[S], c = corner(S);
      g.strokeStyle = rgba(skinShade, 0.12 + 0.4 * k); g.lineWidth = 3;
      g.beginPath(); g.moveTo(sx * 50, 132); g.bezierCurveTo(sx * (72 + 10 * k), 160, c.x + sx * 22, c.y - 22, c.x + sx * 14, c.y + 14); g.stroke();
      g.strokeStyle = `rgba(255,255,255,${0.12 * k})`; g.lineWidth = 2;
      g.beginPath(); g.moveTo(sx * 56, 134); g.bezierCurveTo(sx * (80 + 10 * k), 162, c.x + sx * 28, c.y - 20, c.x + sx * 20, c.y + 14); g.stroke();
    }
    // philtrum
    g.strokeStyle = rgba(skinShade, 0.25); g.lineWidth = 2;
    for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 6, 152); g.lineTo(sx * 10, 196); g.stroke(); }

    // lips
    const cR = corner('R'), cL = corner('L');
    const open = st.mouthOpen;
    const midTop = 199 - open * 4, stomUp = 214 - open * 3, stomDn = 214 + open * 12, bottom = 238 + open * 12;
    const lip = this.ap.sex === 'F' && this.ap.age < 60 ? '#b5655e' : '#a8716a';
    const upperLip = new Path2D();
    upperLip.moveTo(cR.x, cR.y);
    upperLip.bezierCurveTo(cR.x * 0.6, midTop + 4, -16, midTop - 4, -9, midTop);
    upperLip.quadraticCurveTo(0, midTop + 6, 9, midTop);
    upperLip.bezierCurveTo(16, midTop - 4, cL.x * 0.6, midTop + 4, cL.x, cL.y);
    upperLip.bezierCurveTo(cL.x * 0.5, stomUp + 2, cR.x * 0.5, stomUp + 2, cR.x, cR.y);
    const lowerLip = new Path2D();
    lowerLip.moveTo(cR.x, cR.y);
    lowerLip.bezierCurveTo(cR.x * 0.5, stomDn, cL.x * 0.5, stomDn, cL.x, cL.y);
    lowerLip.bezierCurveTo(cL.x * 0.6, bottom, cR.x * 0.6, bottom, cR.x, cR.y);
    if (open > 0.02) {   // mouth interior and teeth
      const inner = new Path2D();
      inner.moveTo(cR.x, cR.y);
      inner.bezierCurveTo(cR.x * 0.5, stomUp + 2, cL.x * 0.5, stomUp + 2, cL.x, cL.y);
      inner.bezierCurveTo(cL.x * 0.5, stomDn, cR.x * 0.5, stomDn, cR.x, cR.y);
      g.fillStyle = '#4a1f1c'; g.fill(inner);
      g.save(); g.clip(inner);
      g.fillStyle = '#f3efe6'; g.fillRect(-80, stomUp - 2, 160, 10 + open * 4);
      g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1;
      for (let x = -40; x <= 40; x += 13) { g.beginPath(); g.moveTo(x, stomUp); g.lineTo(x, stomUp + 10); g.stroke(); }
      g.restore();
    }
    if (st.oral && (st.oral.wide > 0.02 || st.oral.tongueOut > 0.02)) { this.drawOral(st.oral, cR, cL); return; }
    const lg = g.createLinearGradient(0, midTop, 0, bottom);
    lg.addColorStop(0, shade(lip, -0.12)); lg.addColorStop(0.5, lip); lg.addColorStop(1, shade(lip, 0.08));
    g.fillStyle = lg; g.fill(upperLip); g.fill(lowerLip);
    g.strokeStyle = 'rgba(90,35,30,0.55)'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(cR.x, cR.y); g.bezierCurveTo(cR.x * 0.5, stomUp + 2, cL.x * 0.5, stomUp + 2, cL.x, cL.y); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.beginPath(); g.ellipse(0, (stomDn + bottom) / 2 + 2, 18, 4, 0, 0, Math.PI * 2); g.fill();
    // chin shadow
    const chin = g.createRadialGradient(0, 258, 2, 0, 258, 40);
    chin.addColorStop(0, rgba(skinShade, 0.25)); chin.addColorStop(1, rgba(skinShade, 0));
    g.fillStyle = chin; g.beginPath(); g.ellipse(0, 262, 44, 16, 0, 0, Math.PI * 2); g.fill();
  }

  /* ---- the mouth examined: "say ah", the tongue out, the jaw opened -------------------------- */
  private drawOral(o: NonNullable<FaceState['oral']>, cR: { x: number; y: number }, cL: { x: number; y: number }) {
    const g = this.g, { skinShade } = this.ap;
    const lip = this.ap.sex === 'F' && this.ap.age < 60 ? '#b5655e' : '#a8716a';
    const w = o.wide, top = 200 - w * 8, low = 222 + w * 62, js = o.jawShift * w;
    /* the opening: the upper lip stays, the lower lip and jaw come down (and across, if the jaw deviates) */
    const mouth = new Path2D();
    mouth.moveTo(cR.x + js * 0.3, 214);
    mouth.bezierCurveTo(cR.x * 0.7, top, cL.x * 0.7, top, cL.x + js * 0.3, 214);
    mouth.bezierCurveTo(cL.x * 0.9 + js, low, cR.x * 0.9 + js, low, cR.x + js * 0.3, 214);
    g.fillStyle = '#3d1514'; g.fill(mouth);
    g.save(); g.clip(mouth);
    /* upper teeth, the roof and the soft palate's two arches with the uvula between them */
    g.fillStyle = '#f3efe6'; g.fillRect(-70, top - 4, 140, 12);
    if (w > 0.3) {
      const pal = '#c97a74';
      g.fillStyle = '#7a2b28'; g.beginPath(); g.ellipse(js * 0.5, top + 46 * w, 30, 26 * w, 0, 0, Math.PI * 2); g.fill();   // the throat
      for (const S of ['R', 'L'] as Side[]) {
        const sx = S === 'R' ? -1 : 1, lift = o.palate[S];
        g.strokeStyle = pal; g.lineWidth = 7;
        g.beginPath(); g.moveTo(sx * 46, top + 60 * w); g.quadraticCurveTo(sx * 34, top + (30 - 12 * lift) * w, o.uvulaShift * 0.6, top + (18 - 8 * lift) * w); g.stroke();
      }
      const ux = o.uvulaShift, uy = top + (18 - 8 * Math.min(o.palate.L, o.palate.R)) * w;
      g.fillStyle = pal; g.beginPath(); g.moveTo(ux - 5, uy); g.quadraticCurveTo(ux + o.uvulaShift * 0.2, uy + 22 * w, ux, uy + 26 * w); g.quadraticCurveTo(ux + o.uvulaShift * 0.2 + 6, uy + 18 * w, ux + 5, uy); g.fill();
    }
    /* the tongue on the floor of the mouth */
    g.fillStyle = '#c86b6b'; g.beginPath(); g.ellipse(js * 0.8, low - 10, 50, 18, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#f3efe6'; g.fillRect(-60 + js, low - 6, 120, 8);
    g.restore();
    /* lips round the opening */
    g.strokeStyle = lip; g.lineWidth = 9;
    g.beginPath(); g.moveTo(cR.x + js * 0.3, 214); g.bezierCurveTo(cR.x * 0.7, top - 3, cL.x * 0.7, top - 3, cL.x + js * 0.3, 214); g.stroke();
    g.beginPath(); g.moveTo(cL.x + js * 0.3, 214); g.bezierCurveTo(cL.x * 0.9 + js, low + 4, cR.x * 0.9 + js, low + 4, cR.x + js * 0.3, 214); g.stroke();
    /* the tongue put out: toward its weak side; a wasted half narrow and furrowed, fasciculations as small flickers */
    if (o.tongueOut > 0.02) {
      const L = 20 + 58 * o.tongueOut, tx = o.tongueShift * o.tongueOut, base = 214 + w * 20;
      const wR = o.wasted === 'R' ? 13 : 20, wL = o.wasted === 'L' ? 13 : 20;
      const tip = { x: tx * 1.4, y: base + L };
      const tongue = new Path2D();
      tongue.moveTo(-wR - 4, base); tongue.bezierCurveTo(-wR - 2 + tx * 0.4, base + L * 0.6, tip.x - 16, tip.y, tip.x, tip.y);
      tongue.bezierCurveTo(tip.x + 16, tip.y, wL + 2 + tx * 0.4, base + L * 0.6, wL + 4, base);
      g.fillStyle = '#d27778'; g.fill(tongue);
      g.strokeStyle = 'rgba(120,40,40,0.5)'; g.lineWidth = 1.6; g.stroke(tongue);
      g.strokeStyle = 'rgba(120,40,40,0.35)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(0, base + 4); g.quadraticCurveTo(tx * 0.6, base + L * 0.6, tip.x, tip.y - 8); g.stroke();   // the median furrow
      if (o.wasted) {
        const sx = o.wasted === 'R' ? -1 : 1;
        for (let k = 0; k < 4; k++) { const y = base + 10 + k * L * 0.18; g.beginPath(); g.moveTo(sx * 4 + tx * (y - base) / L, y); g.quadraticCurveTo(sx * 10 + tx * (y - base) / L, y + 4, sx * 14 + tx * (y - base) / L, y + 1); g.stroke(); }
      }
      if (o.fasciculation) {
        g.fillStyle = 'rgba(150,50,55,0.6)';
        for (let k = 0; k < 7; k++) { const ph = Math.sin(o.t * 23 + k * 2.7); if (ph < 0.6) continue; const x = Math.sin(k * 3.1) * 12 + tx * 0.6, y = base + 12 + ((k * 37) % 40); g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill(); }
      }
    }
    void skinShade;
  }

  /* ---- examiner's instruments ----------------------------------------------------------------- */
  private drawFrenzel(st: FaceState, yawPx: number) {
    const g = this.g;
    g.save();
    g.translate(yawPx, 0);
    // goggle body
    g.fillStyle = '#1f2526';
    g.beginPath(); g.roundRect(-230, -95, 460, 175, 60); g.fill();
    g.fillStyle = '#2c3436'; g.fillRect(-250, -30, 30, 40); g.fillRect(220, -30, 30, 40);
    for (const S of ['R', 'L'] as Side[]) {
      const cx = S === 'R' ? -100 : 100;
      g.save();
      g.beginPath(); g.arc(cx, -8, 80, 0, Math.PI * 2); g.clip();
      // inside the lens: the eye, magnified about 1.6× and lit by the goggles' own lamps
      g.translate(cx, 0); g.scale(1.6, 1.6); g.translate(-cx, 0);
      g.fillStyle = this.ap.skin; g.fillRect(cx - 80, -80, 160, 140);
      this.drawEyes({ ...st, light: 'none' }, 1, S);
      g.restore();
      g.save();
      const glow = g.createRadialGradient(cx - 25, -40, 5, cx, -8, 82);
      glow.addColorStop(0, 'rgba(255,250,235,0.35)'); glow.addColorStop(0.5, 'rgba(255,250,235,0.05)'); glow.addColorStop(1, 'rgba(0,0,0,0.35)');
      g.fillStyle = glow; g.beginPath(); g.arc(cx, -8, 80, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#0d1011'; g.lineWidth = 9; g.beginPath(); g.arc(cx, -8, 82, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, -8, 74, -2.6, -1.6); g.stroke();
      g.restore();
    }
    g.restore();
  }

  private drawCover(S: Side, yawPx: number) {
    const g = this.g, cx = (S === 'R' ? -100 : 100) + yawPx;
    g.save();
    g.fillStyle = '#20282a';
    g.beginPath(); g.roundRect(cx - 78, -78, 156, 128, 26); g.fill();
    g.fillStyle = '#2d3739'; g.fillRect(cx - 12, 46, 24, 140);
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.roundRect(cx - 70, -70, 140, 30, 16); g.fill();
    g.restore();
  }

  private drawTorch(S: Side, yawPx: number) {
    const g = this.g, cx = (S === 'R' ? -100 : 100) + yawPx;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const glow = g.createRadialGradient(cx, 0, 4, cx, 0, 120);
    glow.addColorStop(0, 'rgba(255,240,200,0.35)'); glow.addColorStop(0.4, 'rgba(255,230,180,0.12)'); glow.addColorStop(1, 'rgba(255,230,180,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(cx, 0, 120, 0, Math.PI * 2); g.fill();
    g.restore();
    // the torch itself, held below and to the side
    g.save();
    g.translate(cx + (S === 'R' ? -70 : 70), 95);
    g.rotate(S === 'R' ? -0.7 : 0.7);
    g.fillStyle = '#c9ccce'; g.beginPath(); g.roundRect(-8, 0, 16, 120, 6); g.fill();
    g.fillStyle = '#fff6d6'; g.beginPath(); g.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
}

/** Appearance from a case's patient description. */
export function appearanceOf(p: { age: number; sex: 'F' | 'M'; appearance: { skinTone: number; hair: string; eyes?: string } }, seed: number): Appearance {
  const SKIN = ['#f3d6c2', '#e8c2a4', '#d1a07a', '#a8714d', '#7a4b2f', '#4f2f1e'];
  const SHADE = ['#c99f86', '#c4977a', '#a57a58', '#7f5236', '#583420', '#33200f'];
  const hairText = p.appearance.hair.toLowerCase();
  const hair = /grey|gray|white/.test(hairText) ? '#b9b6b0' : /blond/.test(hairText) ? '#c9a66b' : /red/.test(hairText) ? '#8a3f1f' : /dark/.test(hairText) ? '#2e2119' : /brown/.test(hairText) ? '#5a3c27' : '#2e2119';
  const tone = p.appearance.skinTone;
  const iris = (p.appearance.eyes as IrisColour | undefined) ?? (tone >= 4 ? 'brown' : (['blue', 'grey', 'green', 'hazel', 'brown'] as IrisColour[])[seed % 5]);
  return { skin: SKIN[tone - 1], skinShade: SHADE[tone - 1], hair, iris, seed, sex: p.sex, age: p.age };
}
