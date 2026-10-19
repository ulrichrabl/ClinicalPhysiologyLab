import type { Side } from '../model/types.ts';
import type { NeuroExamState } from '../models/neuro-exam.ts';
import type { Scene, SceneControls } from './eye-scene.ts';
import type { EyeTest, EyeBody } from '../stations/eye-texts.ts';
import { EXAM } from '../evidence/exam.ts';
import { withAlpha } from './station-strip.ts';

/* ---------------------------------------------------------------------------
   The eye station's mechanism: the pathway each test reads, drawn from the
   examination model's state and lit by what the examiner is doing now.

   - pupils and the swinging light: both eyes, the afferent pathway to the
     pretectal nuclei, the parasympathetic loop back through the oculomotor
     nerve, and the sympathetic chain; the light lights the fibres it
     drives, a cut pathway is dashed;
   - eye movements and the cover test: the six muscles of each eye as
     arrows, coloured by how far each still moves the eye, with their
     nerves; for the cover test, the vertical deviation in each gaze;
   - nystagmus: the two labyrinths' resting tone, the integrator, and the
     trace of the drawn eye's horizontal position over the last seconds;
   - head impulse: head and eye in the world during the last impulse;
   - visual fields: the pathway from above, with what each eye still sees.

   Nothing here decides what the eyes do: the scene the eye view drew is
   the input, so the trace is the animation's own.
--------------------------------------------------------------------------- */

export interface TracePoint { t: number; h: number; v: number; head: number; vR: number; vL: number }

export interface MechanismInput {
  test: EyeTest;
  s: NeuroExamState;
  lesions: Set<string>;
  controls: SceneControls;
  scene: Scene | null;
  trace: TracePoint[];
  /** vertical deviation (prism dioptres, right eye higher positive) by gaze, for the cover test */
  verticalPD: { primary: number; up: number; down: number };
  gain: Record<Side, number>;
  /** the body run through the illness (null while it runs) and the eye signs it gives */
  body: EyeBody | null;
  findings: { icterus: string; pallor: string; thyroid: { lidRetraction?: boolean; lidLag?: boolean; exophthalmos?: boolean } };
  lang: 'en' | 'de';
  colors: { fg: string; muted: string; accent: string; abn: string; line: string; surface: string; light: string };
}

const SIDES: Side[] = ['L', 'R'];
const T = (i: MechanismInput, en: string, de: string) => (i.lang === 'de' ? de : en);
const num = (i: MechanismInput, x: number, d = 1) => (i.lang === 'de' ? x.toFixed(d).replace('.', ',') : x.toFixed(d));
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export function eyeMechanismHeight(test: EyeTest, w: number): number {
  switch (test) {
    case 'pupils': case 'swinging': return 330;
    case 'movements': return w < 520 ? 430 : 270;
    case 'cover': return w < 520 ? 520 : 340;
    case 'nystagmus': return 300;
    case 'impulse': return 280;
    case 'fields': return 380;
    case 'sclera': return w < 520 ? 330 : 270;
    case 'conjunctiva': return w < 520 ? 300 : 250;
    case 'thyroid': return w < 520 ? 330 : 240;
  }
}

function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, o: { size?: number; color: string; align?: CanvasTextAlign; weight?: number; base?: CanvasTextBaseline }) {
  g.font = `${o.weight ?? 500} ${o.size ?? 11}px "Inter", system-ui, sans-serif`;
  g.fillStyle = o.color; g.textAlign = o.align ?? 'left'; g.textBaseline = o.base ?? 'alphabetic';
  g.fillText(s, x, y);
}
function arrowHead(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, size = 7) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - size * Math.cos(a - 0.45), y2 - size * Math.sin(a - 0.45)); g.lineTo(x2 - size * Math.cos(a + 0.45), y2 - size * Math.sin(a + 0.45)); g.closePath(); g.fill();
}
/** A pathway segment: lit when it carries the signal now, dashed red when cut. */
function seg(g: CanvasRenderingContext2D, i: MechanismInput, pts: Array<[number, number]>, ok: boolean, lit: boolean) {
  g.strokeStyle = !ok ? i.colors.abn : lit ? i.colors.light : i.colors.muted;
  g.lineWidth = lit && ok ? 3 : 2; g.lineJoin = 'round'; g.lineCap = 'round';
  g.setLineDash(ok ? [] : [6, 5]);
  g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  g.setLineDash([]);
}
function node(g: CanvasRenderingContext2D, i: MechanismInput, x: number, y: number, ok: boolean, lit: boolean) {
  g.fillStyle = !ok ? i.colors.abn : lit ? i.colors.light : i.colors.surface;
  g.strokeStyle = !ok ? i.colors.abn : i.colors.fg; g.lineWidth = 1.5;
  g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); g.stroke();
}
function eyeIcon(g: CanvasRenderingContext2D, i: MechanismInput, x: number, y: number, r: number, pupilMm: number, h = 0, v = 0) {
  g.fillStyle = '#fbfbf8'; g.strokeStyle = i.colors.fg; g.lineWidth = 1.5;
  g.beginPath(); g.ellipse(x, y, r * 1.55, r, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.save(); g.beginPath(); g.ellipse(x, y, r * 1.55, r, 0, 0, Math.PI * 2); g.clip();
  const ix = x + clamp(h, -40, 40) / 40 * r * 0.9, iy = y - clamp(v, -30, 30) / 30 * r * 0.6;
  g.fillStyle = '#6b8a8f'; g.beginPath(); g.arc(ix, iy, r * 0.62, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#111'; g.beginPath(); g.arc(ix, iy, clamp(pupilMm, 1, 8) / 8 * r * 0.55, 0, Math.PI * 2); g.fill();
  g.restore();
}

export function drawEyeMechanism(g: CanvasRenderingContext2D, w: number, h: number, i: MechanismInput): void {
  g.fillStyle = i.colors.surface; g.fillRect(0, 0, w, h);
  switch (i.test) {
    case 'pupils': case 'swinging': pupilPath(g, w, h, i); break;
    case 'movements': muscles(g, w, h, i, false); break;
    case 'cover': muscles(g, w, h, i, true); break;
    case 'nystagmus': vestibular(g, w, h, i); break;
    case 'impulse': impulse(g, w, h, i); break;
    case 'fields': fields(g, w, h, i); break;
    case 'sclera': bilirubinPath(g, w, h, i); break;
    case 'conjunctiva': haemoglobin(g, w, h, i); break;
    case 'thyroid': orbit(g, w, h, i); break;
  }
}

/* ---- pupils: the light reflex and the sympathetic chain --------------------------------------------------------- */
function pupilPath(g: CanvasRenderingContext2D, w: number, h: number, i: MechanismInput) {
  const p = i.s.pupil, mid = w / 2, lit = i.controls.lightOn;
  const dx = Math.min(150, w * 0.3);
  // facing the patient: their right eye on our left
  const X: Record<Side, number> = { R: mid - dx, L: mid + dx };
  const outer: Record<Side, number> = { R: Math.max(20, mid - dx - Math.min(110, w * 0.2)), L: Math.min(w - 20, mid + dx + Math.min(110, w * 0.2)) };
  const yEye = 46, yPre = 140, yEw = 186, yCil = 250, ySym = [118, 170, 222, 272];
  const drive = (lit === 'L' || lit === 'R') && p.afferent[lit];
  text(g, T(i, 'Facing the patient: their right eye on your left', 'Blick auf den Patienten: sein rechtes Auge links'), mid, 14, { size: 10, color: i.colors.muted, align: 'center' });
  // afferent: each optic nerve to both pretectal nuclei
  const pre: Record<Side, number> = { R: mid - 34, L: mid + 34 };
  for (const S of SIDES) {
    const on = lit === S && p.afferent[S];
    for (const P of SIDES) seg(g, i, [[X[S], yEye + 20], [X[S] + (mid - X[S]) * 0.55, yPre - 40], [pre[P], yPre]], p.afferent[S], on);
  }
  for (const S of SIDES) {
    node(g, i, pre[S], yPre, true, drive);
    seg(g, i, [[pre[S], yPre], [pre.R, yEw]], true, drive); seg(g, i, [[pre[S], yPre], [pre.L, yEw]], true, drive);
  }
  // efferent: Edinger–Westphal, oculomotor nerve, ciliary ganglion, sphincter
  for (const S of SIDES) {
    const ok = p.efferent[S];
    const cutIII = i.lesions.has(`${S}_cn3`), cutCil = i.lesions.has(`${S}_ciliary`);
    const cx = X[S] + (S === 'R' ? 26 : -26);
    node(g, i, pre[S], yEw, ok || cutIII || cutCil, drive && ok);
    seg(g, i, [[pre[S], yEw], [cx, yCil]], ok || cutCil, drive && ok);
    node(g, i, cx, yCil, ok || cutIII, drive && ok);
    seg(g, i, [[cx, yCil], [X[S], yEye + 22]], ok || cutIII, drive && ok);
  }
  // sympathetic: hypothalamus, lateral brainstem, C8–T2, superior cervical ganglion, dilator
  for (const S of SIDES) {
    const ok = !p.horner[S], x = outer[S];
    const at = (k: number): [number, number] => [x, ySym[k]];
    /* down from the hypothalamus to the cord, and back up beside the carotid to the eye */
    const back = x + (S === 'R' ? -12 : 12);
    seg(g, i, [at(0), at(1), at(2), at(3), [back, ySym[3]], [back, yEye], [X[S] + (S === 'R' ? -42 : 42), yEye]], ok, false);
    for (let k = 0; k < 4; k++) node(g, i, x, ySym[k], ok || !i.lesions.has([`${S}_hypothal`, `${S}_lat_bs`, `${S}_cilio_C`, `${S}_scg`][k]), false);
  }
  // the eyes and the light
  for (const S of SIDES) {
    const e = i.scene?.[S];
    eyeIcon(g, i, X[S], yEye, 18, e?.pupilMm ?? 4);
    text(g, `${num(i, e?.pupilMm ?? 4)} mm`, X[S] + (S === 'R' ? 36 : -36), yEye + 30, { size: 11, color: i.colors.fg, align: S === 'R' ? 'left' : 'right', weight: 600 });
    if (lit === S) { g.fillStyle = withAlpha(i.colors.light, 0.5); g.beginPath(); g.moveTo(X[S] - 6, yEye - 2); g.lineTo(X[S] - 46, yEye - 34); g.lineTo(X[S] + 34, yEye - 34); g.closePath(); g.fill(); }
  }
  const lab = (s: string, x: number, y: number, align: CanvasTextAlign = 'center') => text(g, s, x, y, { size: 10, color: i.colors.muted, align });
  lab(T(i, 'optic nerves', 'Sehnerven'), mid, yPre - 46);
  lab(T(i, 'pretectal nuclei', 'prätektale Kerne'), pre.L + 12, yPre + 4, 'left');
  lab('Edinger–Westphal', pre.L + 12, yEw + 4, 'left');
  lab(T(i, 'III → ciliary ganglion → sphincter', 'III → Ggl. ciliare → Sphinkter'), mid, yCil + 22);
  const symLab = [T(i, 'hypothalamus', 'Hypothalamus'), T(i, 'lateral medulla', 'laterale Medulla'), 'C8–T2', T(i, 'sup. cervical gangl.', 'Ggl. cerv. sup.')];
  const narrow = w < 560;
  if (!narrow) for (let k = 0; k < 4; k++) { lab(symLab[k], outer.R + 10, ySym[k] + 4, 'left'); lab(symLab[k], outer.L - 10, ySym[k] + 4, 'right'); }
  text(g, T(i, 'sympathetic → dilator, lid', 'Sympathikus → Dilatator, Lid'), mid, h - 8, { size: 10, color: i.colors.muted, align: 'center' });
  // legend
  g.lineWidth = 3; g.strokeStyle = i.colors.light; g.beginPath(); g.moveTo(10, h - 30); g.lineTo(28, h - 30); g.stroke();
  lab(T(i, 'carrying the light now', 'leitet jetzt das Licht'), 32, h - 26, 'left');
  g.strokeStyle = i.colors.abn; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(10, h - 14); g.lineTo(28, h - 14); g.stroke(); g.setLineDash([]);
  lab(T(i, 'cut', 'unterbrochen'), 32, h - 10, 'left');
}

/* ---- the six muscles of each eye ----------------------------------------------------------------------------------------- */
interface Muscle { id: string; nerve: 'III' | 'IV' | 'VI'; dx: number; dy: number; of: 'abduction' | 'adduction' | 'elevation' | 'depression' }
/* Facing the patient: x toward our right. For the patient's right eye "out" (abduction) is to our left. */
const MUSCLES = (S: Side): Muscle[] => {
  const out = S === 'R' ? -1 : 1;
  return [
    { id: 'LR', nerve: 'VI', dx: out, dy: 0, of: 'abduction' },
    { id: 'MR', nerve: 'III', dx: -out, dy: 0, of: 'adduction' },
    { id: 'SR', nerve: 'III', dx: out * 0.7, dy: -0.7, of: 'elevation' },
    { id: 'IR', nerve: 'III', dx: out * 0.7, dy: 0.7, of: 'depression' },
    { id: 'IO', nerve: 'III', dx: -out * 0.7, dy: -0.7, of: 'elevation' },
    { id: 'SO', nerve: 'IV', dx: -out * 0.7, dy: 0.7, of: 'depression' },
  ];
};
function muscles(g: CanvasRenderingContext2D, w: number, h: number, i: MechanismInput, cover: boolean) {
  /* side by side on a wide canvas; on a phone one eye above the other, so the arrows and their names have room */
  const mid = w / 2, narrow = w < 520, stacked = cover && narrow;
  const dx = Math.min(140, w * 0.24);
  const X: Record<Side, number> = narrow ? { R: mid, L: mid } : { R: mid - dx, L: mid + dx };
  const Y: Record<Side, number> = narrow ? { R: 110, L: 270 } : { R: 110, L: 110 };
  const y0 = narrow ? 270 : 110;
  text(g, T(i, 'Facing the patient: their right eye on your left', 'Blick auf den Patienten: sein rechtes Auge links'), mid, 14, { size: 10, color: i.colors.muted, align: 'center' });
  for (const S of SIDES) {
    const d = i.s.ductions[S];
    /* each nerve's strength, read back from the ductions the model gives: the oculomotor nerve moves the eye in, the
       abducens out, the trochlear down (in a third nerve palsy depression is partly lost with the inferior rectus, not IV) */
    const iii = d.adduction / 100, vi = d.abduction / 100, iv = iii >= 0.5 ? clamp(1 - 2 * (1 - d.depression / 100), 0, 1) : 1;
    const strength: Record<string, number> = { III: iii, IV: iv, VI: vi };
    const nerveOk: Record<string, boolean> = { III: iii >= 0.9, IV: iv >= 0.9, VI: vi >= 0.9 };
    for (const m of MUSCLES(S)) {
      const k = strength[m.nerve];
      const len = 58, x1 = X[S] + m.dx * 30, y1 = Y[S] + m.dy * 22, x2 = X[S] + m.dx * (30 + len * 0.9), y2 = Y[S] + m.dy * (22 + len * 0.7);
      const col = k >= 0.9 ? i.colors.accent : k > 0.2 ? withAlpha(i.colors.abn, 0.65) : i.colors.abn;
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 3 + 2 * k; g.setLineDash(k <= 0.2 ? [5, 4] : []);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.setLineDash([]);
      arrowHead(g, x1, y1, x2, y2, 9);
      text(g, `${m.id} ${m.nerve}`, x2 + m.dx * 8, y2 + m.dy * 10 + 4, { size: 10, color: k >= 0.9 ? i.colors.muted : i.colors.abn, align: m.dx > 0.1 ? 'left' : m.dx < -0.1 ? 'right' : 'center', weight: 600 });
    }
    const e = i.scene?.[S];
    eyeIcon(g, i, X[S], Y[S], 20, e?.pupilMm ?? 4, e?.h ?? 0, e?.v ?? 0);
    const bad = Object.entries(nerveOk).filter(([, ok]) => !ok).map(([n]) => n);
    text(g, `${S === 'L' ? T(i, 'left eye', 'linkes Auge') : T(i, 'right eye', 'rechtes Auge')}${bad.length ? ` · ${T(i, 'nerve', 'Nerv')} ${bad.join(', ')} ${T(i, 'cut', 'unterbrochen')}` : ''}`,
      X[S], Y[S] + 74, { size: 11, color: bad.length ? i.colors.abn : i.colors.fg, align: 'center', weight: 600 });
  }
  text(g, narrow ? T(i, 'Arrow: a muscle’s pull; colour: how far it still can', 'Pfeil: Zug eines Muskels; Farbe: wie weit noch') : T(i, 'Arrow: where each muscle moves the eye; colour: how far it still can', 'Pfeil: wohin jeder Muskel das Auge bewegt; Farbe: wie weit er es noch kann'), mid, y0 + 96, { size: 10, color: i.colors.muted, align: 'center' });
  if (!cover) {
    text(g, `${T(i, 'Gaze holding: integrator', 'Blickhalten: Integrator')} τ = ${num(i, i.s.tauSeconds, 0)} s ${i.s.tauSeconds < 25 ? T(i, '(leaks: normal ≈ 25 s)', '(leckt: normal ≈ 25 s)') : T(i, '(normal)', '(normal)')}`, mid, h - 14,
      { size: 11, color: i.s.tauSeconds < 25 ? i.colors.abn : i.colors.fg, align: 'center', weight: 600 });
    return;
  }
  // the vertical deviation in each gaze
  const v = i.verticalPD;
  const top = y0 + 116, bx = stacked ? 40 : mid - 150, bw = stacked ? w - 80 : 300;
  text(g, T(i, 'Vertical deviation on cover, by gaze (prism dioptres)', 'Vertikale Abweichung im Abdecktest, nach Blickrichtung (pdpt)'), mid, top, { size: 11, color: i.colors.fg, align: 'center', weight: 600 });
  const rows: Array<[string, number]> = [[T(i, 'up', 'oben'), v.up], [T(i, 'ahead', 'geradeaus'), v.primary], [T(i, 'down', 'unten'), v.down]];
  const scale = (bw / 2) / Math.max(10, ...rows.map(([, x]) => Math.abs(x)));
  const cx = bx + bw / 2;
  g.strokeStyle = i.colors.line; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, top + 10); g.lineTo(cx, top + 10 + rows.length * 26); g.stroke();
  rows.forEach(([name, x], k) => {
    const y = top + 18 + k * 26;
    text(g, name, bx - 6, y + 10, { size: 10, color: i.colors.muted, align: 'right' });
    g.fillStyle = x === 0 ? i.colors.line : i.colors.accent;
    const a = cx, b = cx + x * scale;
    g.fillRect(Math.min(a, b), y, Math.max(2, Math.abs(b - a)), 14);
    /* the value always to the right of the bar's outer end, or of the axis when the bar goes left */
    text(g, x === 0 ? '0' : `${Math.abs(x)} ${x > 0 ? T(i, 'right higher', 'rechts höher') : T(i, 'left higher', 'links höher')}`, cx + (x > 0 ? x * scale : 0) + 6, y + 11,
      { size: 10, color: i.colors.fg, align: 'left' });
  });
  const vals = rows.map(([, x]) => x);
  const any = vals.some((x) => x !== 0);
  const comitant = any && Math.max(...vals) - Math.min(...vals) <= 5;
  text(g, !any ? T(i, 'no vertical deviation', 'keine vertikale Abweichung') : comitant ? T(i, 'the same in every gaze: comitant (skew)', 'in jeder Blickrichtung gleich: komitant (Skew)') : T(i, 'changes with gaze: incomitant (a weak muscle)', 'ändert sich mit dem Blick: inkomitant (ein schwacher Muskel)'),
    mid, top + 18 + rows.length * 26 + 16, { size: 11, color: any ? i.colors.abn : i.colors.muted, align: 'center', weight: 600 });
}

/* ---- vestibular tone and the eye's trace ------------------------------------------------------------------------------ */
function vestibular(g: CanvasRenderingContext2D, w: number, h: number, i: MechanismInput) {
  const s = i.s, mid = w / 2;
  const tone: Record<Side, number> = { L: s.periphery.L * s.nucleus.L, R: s.periphery.R * s.nucleus.R };
  // patient's left on our left here: a trace reads left/right as the patient's
  const X: Record<Side, number> = { L: mid - Math.min(160, w * 0.3), R: mid + Math.min(160, w * 0.3) };
  text(g, T(i, 'Resting tone of each labyrinth and vestibular nerve', 'Ruhetonus jedes Labyrinths und Vestibularisnervs'), mid, 16, { size: 11, color: i.colors.fg, align: 'center', weight: 600 });
  for (const S of SIDES) {
    const x = X[S];
    g.strokeStyle = tone[S] < 0.6 ? i.colors.abn : i.colors.fg; g.lineWidth = 2;
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x, 44, 9 + k * 6, Math.PI * (0.9 + k * 0.25), Math.PI * (2.3 + k * 0.25)); g.stroke(); }
    g.fillStyle = i.colors.line; g.fillRect(x - 40, 70, 80, 9);
    g.fillStyle = tone[S] < 0.6 ? i.colors.abn : i.colors.accent; g.fillRect(x - 40, 70, 80 * clamp(tone[S], 0, 1), 9);
    text(g, `${S === 'L' ? T(i, 'left', 'links') : T(i, 'right', 'rechts')} ${num(i, tone[S], 2)}`, x, 94, { size: 11, color: i.colors.fg, align: 'center' });
  }
  const imb = (tone.R - tone.L) * (1 - s.compensation);
  if (Math.abs(imb) > 0.02) {
    const toward: Side = imb > 0 ? 'L' : 'R';
    g.fillStyle = i.colors.abn; g.strokeStyle = i.colors.abn; g.lineWidth = 2;
    const x1 = mid + (toward === 'L' ? 30 : -30), x2 = mid + (toward === 'L' ? -30 : 30);
    g.beginPath(); g.moveTo(x1, 56); g.lineTo(x2, 56); g.stroke(); arrowHead(g, x1, 56, x2, 56);
    text(g, T(i, 'slow drift', 'langsame Drift'), mid, 46, { size: 10, color: i.colors.abn, align: 'center' });
  }
  text(g, `${T(i, 'compensation', 'Kompensation')} ${Math.round(s.compensation * 100)} % · ${T(i, 'integrator', 'Integrator')} τ ${num(i, s.tauSeconds, 0)} s · ${T(i, 'fixation leaves', 'Fixation lässt')} ${Math.round(s.fixationResidual * 100)} %`,
    mid, 114, { size: 10, color: i.colors.muted, align: 'center' });
  // the trace: horizontal eye position over the last seconds, as the eye view drew it
  const top = 132, th = h - top - 30, x0 = 46, tw = w - x0 - 12;
  g.strokeStyle = i.colors.line; g.lineWidth = 1; g.strokeRect(x0, top, tw, th);
  g.beginPath(); g.moveTo(x0, top + th / 2); g.lineTo(x0 + tw, top + th / 2); g.stroke();
  text(g, T(i, 'right', 'rechts'), x0 - 4, top + 10, { size: 10, color: i.colors.muted, align: 'right' });
  text(g, T(i, 'left', 'links'), x0 - 4, top + th - 2, { size: 10, color: i.colors.muted, align: 'right' });
  const now = i.trace.at(-1)?.t ?? 0, span = 5;
  const pts = i.trace.filter((p) => p.t > now - span);
  const range = Math.max(8, ...pts.map((p) => Math.abs(p.h) + 2));
  g.strokeStyle = i.colors.fg; g.lineWidth = 1.6; g.beginPath();
  pts.forEach((p, k) => { const x = x0 + tw * (1 - (now - p.t) / span), y = top + th / 2 - (p.h / range) * (th / 2); k ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.stroke();
  text(g, T(i, `The right eye’s horizontal position, last ${span} s, as drawn (±${Math.round(range)}°)`, `Horizontale Position des rechten Auges, letzte ${span} s, wie gezeichnet (±${Math.round(range)}°)`), mid, h - 10, { size: 10, color: i.colors.muted, align: 'center' });
}

/* ---- head impulse: head and eye in the world ------------------------------------------------------------------------- */
function impulse(g: CanvasRenderingContext2D, w: number, h: number, i: MechanismInput) {
  const mid = w / 2;
  text(g, T(i, 'During the impulse: head angle, and where the eye points in the world', 'Während des Impulses: Kopfwinkel und wohin das Auge im Raum zeigt'), mid, 16, { size: 11, color: i.colors.fg, align: 'center', weight: 600 });
  const top = 30, th = h - top - 70, x0 = 46, tw = w - x0 - 12;
  g.strokeStyle = i.colors.line; g.lineWidth = 1; g.strokeRect(x0, top, tw, th);
  const now = i.trace.at(-1)?.t ?? 0, span = 2.4;
  const pts = i.trace.filter((p) => p.t > now - span);
  const yAt = (deg: number) => top + th / 2 - (deg / 18) * (th / 2);
  g.beginPath(); g.moveTo(x0, yAt(0)); g.lineTo(x0 + tw, yAt(0)); g.stroke();
  const line = (sel: (p: TracePoint) => number, color: string, width: number) => {
    g.strokeStyle = color; g.lineWidth = width; g.beginPath();
    pts.forEach((p, k) => { const x = x0 + tw * (1 - (now - p.t) / span); k ? g.lineTo(x, yAt(sel(p))) : g.moveTo(x, yAt(sel(p))); });
    g.stroke();
  };
  line((p) => p.head, i.colors.muted, 2);
  line((p) => p.h, i.colors.abn, 2);
  g.fillStyle = i.colors.muted; g.fillRect(x0, h - 56, 14, 3); text(g, T(i, 'head', 'Kopf'), x0 + 18, h - 52, { size: 10, color: i.colors.muted });
  g.fillStyle = i.colors.abn; g.fillRect(x0 + 80, h - 56, 14, 3); text(g, T(i, 'eye in the world (0 = on target)', 'Auge im Raum (0 = am Ziel)'), x0 + 98, h - 52, { size: 10, color: i.colors.muted });
  for (const S of SIDES) {
    const x = S === 'L' ? mid - Math.min(130, w * 0.24) : mid + Math.min(130, w * 0.24);
    const gg = i.gain[S];
    text(g, `${S === 'L' ? T(i, 'head to the left', 'Kopf nach links') : T(i, 'head to the right', 'Kopf nach rechts')}: ${T(i, 'gain', 'Verstärkung')} ${num(i, gg, 1)}`, x, h - 30,
      { size: 11, color: gg < 0.8 ? i.colors.abn : i.colors.fg, align: 'center', weight: 600 });
    text(g, gg < 0.6 ? T(i, 'overt catch-up saccade', 'sichtbare Korrektursakkade') : gg < 0.8 ? T(i, 'covert saccade', 'verdeckte Sakkade') : T(i, 'eyes stay on target', 'Augen bleiben am Ziel'), x, h - 14,
      { size: 10, color: gg < 0.8 ? i.colors.abn : i.colors.muted, align: 'center' });
  }
}

/* ---- visual pathway from above ---------------------------------------------------------------------------------------- */
function fields(g: CanvasRenderingContext2D, w: number, h: number, i: MechanismInput) {
  const mid = w / 2, f = i.s.fields, cut = (id: string) => i.lesions.has(id);
  // seen from above and behind: the patient's left on our left
  const dx = Math.min(120, w * 0.24);
  const X: Record<Side, number> = { L: mid - dx, R: mid + dx };
  text(g, T(i, 'Seen from above: the patient’s left on your left.', 'Von oben: die linke Seite des Patienten links.'), mid, 14, { size: 10, color: i.colors.muted, align: 'center' });
  text(g, T(i, 'Each eye’s field as the patient sees it.', 'Das Feld jedes Auges, wie der Patient es sieht.'), mid, 28, { size: 10, color: i.colors.muted, align: 'center' });
  // fields
  const fy = 84, fr = Math.min(32, w * 0.07);
  for (const S of SIDES) {
    const x = X[S];
    // the temporal half is on the patient's side of that eye: left eye's temporal field is on the left
    const tempLeft = S === 'L';
    const half = (left: boolean, lost: boolean) => {
      g.fillStyle = lost ? '#2a2a2a' : withAlpha(i.colors.accent, 0.18);
      g.beginPath(); g.moveTo(x, fy); g.arc(x, fy, fr, left ? Math.PI / 2 : -Math.PI / 2, left ? Math.PI * 1.5 : Math.PI / 2); g.closePath(); g.fill();
    };
    half(tempLeft, f[S].temporal === 'lost'); half(!tempLeft, f[S].nasal === 'lost');
    g.strokeStyle = i.colors.fg; g.lineWidth = 1.2; g.beginPath(); g.arc(x, fy, fr, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(x, fy - fr); g.lineTo(x, fy + fr); g.stroke();
    text(g, S === 'L' ? T(i, 'left eye', 'linkes Auge') : T(i, 'right eye', 'rechtes Auge'), x, fy - fr - 6, { size: 10, color: i.colors.fg, align: 'center', weight: 600 });
  }
  // the pathway: retina halves → optic nerves → chiasm → tracts → LGN → radiations → cortex
  const yEye = 142, yCh = 198, yLgn = 250, yCx = h - 40;
  for (const S of SIDES) eyeIcon(g, i, X[S], yEye, 13, 3.5);
  const chX = mid;
  const lgn: Record<Side, number> = { L: mid - dx * 0.75, R: mid + dx * 0.75 };
  const cx: Record<Side, number> = { L: mid - dx * 0.45, R: mid + dx * 0.45 };
  for (const S of SIDES) {
    const o: Side = S === 'L' ? 'R' : 'L';
    const out = S === 'L' ? -1 : 1;
    // temporal retina (sees nasal field) stays on its side; nasal retina (sees temporal field) crosses
    const nerveOk = !cut(`${S}_cn2`);
    const tempOk = nerveOk && !cut(`${S}_retina_temp`) && !cut(`${S}_optic_tract`);
    const nasOk = nerveOk && !cut(`${S}_retina_nas`) && !cut('chiasm') && !cut(`${o}_optic_tract`);
    seg(g, i, [[X[S] + out * 6, yEye + 12], [chX + out * 22, yCh - 4], [lgn[S], yLgn]], tempOk, false);
    seg(g, i, [[X[S] - out * 6, yEye + 12], [chX - out * 2, yCh], [lgn[o], yLgn]], nasOk, false);
  }
  for (const S of SIDES) {
    const ok = !cut(`${S}_lgn`) && !cut(`${S}_optic_rad`) && !cut(`${S}_vis_cx`);
    seg(g, i, [[lgn[S], yLgn], [lgn[S] + (S === 'L' ? -14 : 14), (yLgn + yCx) / 2], [cx[S], yCx]], ok, false);
    node(g, i, lgn[S], yLgn, !cut(`${S}_lgn`) && !cut(`${S}_optic_tract`), false);
    g.fillStyle = cut(`${S}_vis_cx`) ? i.colors.abn : withAlpha(i.colors.accent, 0.35);
    g.beginPath(); g.ellipse(cx[S], yCx + 8, 26, 10, 0, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = cut('chiasm') ? i.colors.abn : i.colors.fg; g.beginPath(); g.ellipse(chX, yCh, 9, 5, 0, 0, Math.PI * 2); g.fill();
  const lab = (s: string, x: number, y: number, align: CanvasTextAlign) => text(g, s, x, y, { size: 10, color: i.colors.muted, align });
  lab(T(i, 'optic nerves', 'Sehnerven'), X.R + 26, (yEye + yCh) / 2, 'left');
  lab(T(i, 'chiasm', 'Chiasma'), chX + 14, yCh + 4, 'left');
  lab(T(i, 'optic tracts → LGN', 'Tractus → CGL'), lgn.R + 12, yLgn + 4, 'left');
  lab(T(i, 'radiations', 'Sehstrahlung'), lgn.R + 20, (yLgn + yCx) / 2, 'left');
  lab(T(i, 'occipital cortex', 'Sehrinde'), mid, yCx + 30, 'center');
  g.fillStyle = '#2a2a2a'; g.fillRect(10, h - 22, 12, 10); lab(T(i, 'field lost', 'Feld fehlt'), 26, h - 13, 'left');
}

/* ---- the body in the eye ------------------------------------------------------------------------------------------------ */
function waiting(g: CanvasRenderingContext2D, w: number, h: number, i: MechanismInput): boolean {
  if (i.body) return false;
  text(g, T(i, 'The body is being run through the illness…', 'Der Körper wird durch die Erkrankung gerechnet…'), w / 2, h / 2, { size: 12, color: i.colors.muted, align: 'center' });
  return true;
}
function box(g: CanvasRenderingContext2D, i: MechanismInput, x: number, y: number, bw: number, bh: number, title: string, sub: string, bad: boolean) {
  g.fillStyle = bad ? withAlpha(i.colors.abn, 0.12) : withAlpha(i.colors.accent, 0.08);
  g.strokeStyle = bad ? i.colors.abn : i.colors.line; g.lineWidth = bad ? 2 : 1.2;
  g.beginPath(); g.roundRect(x, y, bw, bh, 8); g.fill(); g.stroke();
  text(g, title, x + bw / 2, y + bh / 2 - 3, { size: 11, color: bad ? i.colors.abn : i.colors.fg, align: 'center', weight: 600 });
  text(g, sub, x + bw / 2, y + bh / 2 + 12, { size: 10, color: i.colors.muted, align: 'center' });
}
function flow(g: CanvasRenderingContext2D, i: MechanismInput, x1: number, y1: number, x2: number, y2: number, width: number, bad: boolean) {
  g.strokeStyle = bad ? i.colors.abn : i.colors.muted; g.fillStyle = g.strokeStyle; g.lineWidth = width;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); arrowHead(g, x1, y1, x2, y2, 6 + width);
}
/** A horizontal scale with zones and a marker, for a blood value against the thresholds the eye reads it by. */
function scale(g: CanvasRenderingContext2D, i: MechanismInput, x: number, y: number, sw: number, lo: number, hi: number, value: number, marks: Array<[number, string]>, unit: string, badAbove: boolean) {
  const X = (v: number) => x + (clamp(v, lo, hi) - lo) / (hi - lo) * sw;
  g.fillStyle = i.colors.line; g.fillRect(x, y, sw, 8);
  for (const [m, lab] of marks) {
    g.strokeStyle = i.colors.fg; g.lineWidth = 1; g.beginPath(); g.moveTo(X(m), y - 4); g.lineTo(X(m), y + 12); g.stroke();
    text(g, `${m} ${lab}`, X(m), y + 24, { size: 10, color: i.colors.muted, align: 'center' });
  }
  const bad = badAbove ? value >= marks[0][0] : value < marks[0][0];
  g.fillStyle = bad ? i.colors.abn : i.colors.accent;
  g.beginPath(); g.moveTo(X(value), y - 2); g.lineTo(X(value) - 7, y - 14); g.lineTo(X(value) + 7, y - 14); g.closePath(); g.fill();
  text(g, `${Math.round(value)} ${unit}`, X(value), y - 18, { size: 11, color: bad ? i.colors.abn : i.colors.fg, align: 'center', weight: 700 });
}

function bilirubinPath(g: CanvasRenderingContext2D, w: number, h: number, i: MechanismInput) {
  if (waiting(g, w, h, i)) return;
  const b = i.body!, narrow = w < 520;
  text(g, T(i, 'Where bilirubin comes from and where it goes', 'Woher Bilirubin kommt und wohin es geht'), w / 2, 16, { size: 11, color: i.colors.fg, align: 'center', weight: 600 });
  const steps = [
    { t: T(i, 'Red cells', 'Erythrozyten'), s: T(i, 'haem', 'Häm'), bad: b.haemolysis > 0.3 },
    { t: T(i, 'Blood', 'Blut'), s: T(i, 'on albumin', 'an Albumin'), bad: false },
    { t: T(i, 'Liver', 'Leber'), s: T(i, 'conjugates', 'konjugiert'), bad: b.liverFunction < 0.6 },
    { t: T(i, 'Bile duct', 'Gallengang'), s: T(i, 'to the gut', 'zum Darm'), bad: b.cholestasis > 0.2 },
  ];
  const n = steps.length, gap = narrow ? 10 : 26, bw = Math.min(130, (w - 24 - gap * (n - 1)) / n), bh = 46;
  const x0 = (w - (bw * n + gap * (n - 1))) / 2, y = 34;
  steps.forEach((st, k) => {
    const x = x0 + k * (bw + gap);
    box(g, i, x, y, bw, bh, st.t, st.s, st.bad);
    if (k < n - 1) flow(g, i, x + bw + 2, y + bh / 2, x + bw + gap - 2, y + bh / 2, k === 0 ? 2 + 2 * Math.min(2, b.haemolysis) : 2, k === 0 ? b.haemolysis > 0.3 : k === 2 ? b.cholestasis > 0.2 : false);
  });
  if (b.cholestasis > 0.2) text(g, T(i, 'blocked: conjugated bilirubin flows back into the blood', 'blockiert: konjugiertes Bilirubin fließt ins Blut zurück'), w / 2, y + bh + 16, { size: 10, color: i.colors.abn, align: 'center' });
  else if (b.haemolysis > 0.3) text(g, T(i, `${n1(1 + b.haemolysis)} × the haem to clear`, `${de1(1 + b.haemolysis)} × so viel Häm zu klären`), w / 2, y + bh + 16, { size: 10, color: i.colors.abn, align: 'center' });
  else if (b.liverFunction < 0.6) text(g, T(i, `the liver works at ×${n1(b.liverFunction)}`, `die Leber arbeitet mit ×${de1(b.liverFunction)}`), w / 2, y + bh + 16, { size: 10, color: i.colors.abn, align: 'center' });
  // plasma bilirubin, split, against the thresholds the sclera shows it by
  const sy = y + bh + 70, sx = 30, sw = w - 60, max = Math.max(200, b.bilirubin * 1.15);
  const X = (v: number) => sx + v / max * sw;
  const unc = Math.max(0, b.bilirubin - b.conjugated);
  text(g, T(i, 'Plasma bilirubin, µmol/L', 'Bilirubin im Plasma, µmol/l'), sx, sy - 22, { size: 11, color: i.colors.fg, weight: 600 });
  g.fillStyle = i.colors.line; g.fillRect(sx, sy, sw, 16);
  g.fillStyle = '#d9a91e'; g.fillRect(sx, sy, X(unc) - sx, 16);
  g.fillStyle = '#8a6a10'; g.fillRect(X(unc), sy, X(b.bilirubin) - X(unc), 16);
  for (const [m, lab] of [[EXAM.icterusMild, T(i, 'visible in the sclera', 'in der Sklera sichtbar')], [EXAM.icterusMarked, T(i, 'obvious', 'offensichtlich')]] as Array<[number, string]>) {
    g.strokeStyle = i.colors.fg; g.lineWidth = 1.2; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(X(m), sy - 6); g.lineTo(X(m), sy + 24); g.stroke(); g.setLineDash([]);
    text(g, `${m} ${lab}`, X(m) + 3, sy + 36, { size: 10, color: i.colors.muted });
  }
  g.fillStyle = '#d9a91e'; g.fillRect(sx, h - 22, 12, 10); text(g, `${T(i, 'unconjugated', 'unkonjugiert')} ${Math.round(unc)}`, sx + 16, h - 13, { size: 10, color: i.colors.muted });
  g.fillStyle = '#8a6a10'; g.fillRect(sx + 150, h - 22, 12, 10); text(g, `${T(i, 'conjugated', 'konjugiert')} ${Math.round(b.conjugated)}`, sx + 166, h - 13, { size: 10, color: i.colors.muted });
}

function haemoglobin(g: CanvasRenderingContext2D, w: number, h: number, i: MechanismInput) {
  if (waiting(g, w, h, i)) return;
  const b = i.body!, mid = w / 2;
  text(g, T(i, 'The colour of the inner lower lid follows the haemoglobin', 'Die Farbe des inneren Unterlids folgt dem Hämoglobin'), mid, 16, { size: 11, color: i.colors.fg, align: 'center', weight: 600 });
  // conjunctival colour along the haemoglobin scale, drawn with the eye view's own colours for none, mild and marked pallor
  const sx = 30, sw = w - 60, lo = 40, hi = 170, y = 40;
  const X = (v: number) => sx + (v - lo) / (hi - lo) * sw;
  const col = (pal: number) => { const m = (a: number[], c: number[]) => a.map((x, k) => Math.round(x + (c[k] - x) * pal)); return `rgb(${m([176, 52, 58], [226, 196, 190]).join(',')})`; };
  for (const [a, z, pal] of [[lo, EXAM.pallorMarked, 1], [EXAM.pallorMarked, EXAM.pallorMild, 0.5], [EXAM.pallorMild, hi, 0]] as Array<[number, number, number]>) {
    g.fillStyle = col(pal); g.fillRect(X(a), y, X(z) - X(a), 26);
  }
  text(g, T(i, 'marked pallor', 'deutliche Blässe'), (X(lo) + X(EXAM.pallorMarked)) / 2, y + 17, { size: 10, color: '#5a3a36', align: 'center', weight: 600 });
  text(g, T(i, 'pale', 'blass'), (X(EXAM.pallorMarked) + X(EXAM.pallorMild)) / 2, y + 17, { size: 10, color: '#5a3a36', align: 'center', weight: 600 });
  text(g, T(i, 'red: normal colour', 'rot: normale Farbe'), (X(EXAM.pallorMild) + X(hi)) / 2, y + 17, { size: 10, color: '#fff', align: 'center', weight: 600 });
  scale(g, i, sx, y + 62, sw, lo, hi, b.haemoglobin, [[EXAM.pallorMild, ''], [EXAM.pallorMarked, '']], 'g/L', false);
  // the balance: made and lost
  const by = y + 128;
  /* made on the left of the line, lost on the right; on a phone one under the other */
  const narrow = w < 520, mx = narrow ? 20 : mid - 10, lx = narrow ? 20 : mid + 10, ly = narrow ? by + 40 : by;
  text(g, T(i, 'Made by the marrow', 'Gebildet vom Knochenmark'), mx, by, { size: 11, color: i.colors.fg, align: narrow ? 'left' : 'right', weight: 600 });
  text(g, T(i, 'Lost or destroyed', 'Verloren oder abgebaut'), lx, ly, { size: 11, color: i.colors.fg, weight: 600 });
  text(g, `${T(i, 'reticulocytes', 'Retikulozyten')} ${num(i, b.reticulocytes, 1)} % · MCV ${Math.round(b.mcv)} fL`, mx, by + 18, { size: 10, color: b.mcv < 80 ? i.colors.abn : i.colors.muted, align: narrow ? 'left' : 'right' });
  const lost: string[] = [];
  if (b.bleed > 0) lost.push(`${T(i, 'bleeding', 'Blutung')} ${num(i, b.bleed, 1)} mL/h`);
  if (b.haemolysis > 0) lost.push(`${T(i, 'haemolysis', 'Hämolyse')} +${num(i, b.haemolysis, 1)} ×`);
  text(g, lost.length ? lost.join(' · ') : T(i, 'old cells only (about 120 days)', 'nur alte Zellen (etwa 120 Tage)'), lx, ly + 18, { size: 10, color: lost.length ? i.colors.abn : i.colors.muted });
  if (!narrow) { g.strokeStyle = i.colors.line; g.beginPath(); g.moveTo(mid, by - 12); g.lineTo(mid, by + 24); g.stroke(); }
  if (b.mcv < 80) text(g, T(i, 'small cells: the iron has run out', 'kleine Zellen: das Eisen ist aufgebraucht'), mid, ly + 40, { size: 10, color: i.colors.abn, align: 'center' });
}

function orbit(g: CanvasRenderingContext2D, w: number, h: number, i: MechanismInput) {
  if (waiting(g, w, h, i)) return;
  const b = i.body!, th = i.findings.thyroid, narrow = w < 520;
  text(g, T(i, 'The right eye from the side: the lid and the orbit', 'Das rechte Auge von der Seite: Lid und Orbita'), w / 2, 16, { size: 11, color: i.colors.fg, align: 'center', weight: 600 });
  // profile: the patient faces right; the bony rim of the orbit is a fixed line, the globe sits behind it or stands forward
  const cx = narrow ? w * 0.36 : w * 0.3, cy = 120, R = 46;
  const prop = th.exophthalmos ? 4 : 0, px = prop * 6;
  // orbit: bone above and below, fat behind
  g.fillStyle = withAlpha(i.colors.muted, 0.15);
  g.beginPath(); g.ellipse(cx - 30, cy, 80 + (b.orbitopathy > 0.3 ? 10 : 0), 62, 0, Math.PI * 0.5, Math.PI * 1.5); g.fill();
  if (b.orbitopathy > 0.05) {
    g.fillStyle = withAlpha(i.colors.abn, 0.12 + 0.25 * b.orbitopathy);
    g.beginPath(); g.ellipse(cx - 40, cy, 54 + 20 * b.orbitopathy, 40 + 10 * b.orbitopathy, 0, 0, Math.PI * 2); g.fill();
    text(g, T(i, 'swollen muscles and fat', 'geschwollene Muskeln und Fett'), Math.max(8, cx - 120), cy + 80, { size: 10, color: i.colors.abn });
  }
  g.strokeStyle = i.colors.fg; g.lineWidth = 3;
  const rimX = cx + R * 0.55;
  g.beginPath(); g.moveTo(rimX - 6, cy - 70); g.quadraticCurveTo(rimX + 8, cy - 58, rimX, cy - 44); g.stroke();
  g.beginPath(); g.moveTo(rimX, cy + 44); g.quadraticCurveTo(rimX + 6, cy + 58, rimX - 8, cy + 70); g.stroke();
  text(g, T(i, 'orbital rim', 'Orbitarand'), rimX + 14, cy - 60, { size: 10, color: i.colors.muted });
  // globe
  g.fillStyle = '#fbfbf8'; g.strokeStyle = i.colors.fg; g.lineWidth = 1.5;
  g.beginPath(); g.arc(cx + px, cy, R, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#6b8a8f'; g.beginPath(); g.ellipse(cx + px + R - 4, cy - (i.scene?.R.v ?? 0) * 0.8, 5, 16, 0, 0, Math.PI * 2); g.fill();
  if (px) { arrowHeadLine(g, i, cx + R + 4, cy + R + 8, cx + R + 4 + px, cy + R + 8); text(g, `+${prop} mm`, cx + R + 6 + px / 2, cy + R + 24, { size: 10, color: i.colors.abn, align: 'center' }); }
  // upper lid, its edge at the top of the iris, or higher
  const ret = i.scene?.R.retractionMm ?? 0;
  const irisTop = cy - (i.scene?.R.v ?? 0) * 0.8 - 16;
  const lidEdge = irisTop + 2 - ret * 5;
  g.strokeStyle = '#a0603a'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(rimX - 4, cy - 46); g.quadraticCurveTo(cx + px + R + 10, cy - 40, cx + px + R + 2, lidEdge); g.stroke();
  if (ret > 0.5) { g.fillStyle = i.colors.abn; text(g, T(i, 'sclera above the iris', 'Sklera über der Iris'), cx + px + R + 14, lidEdge + 2, { size: 10, color: i.colors.abn }); }
  // Müller's muscle and its sympathetic drive
  text(g, T(i, 'Müller’s muscle (sympathetic)', 'Müller-Muskel (sympathisch)'), rimX + 14, cy - 44, { size: 10, color: th.lidRetraction ? i.colors.abn : i.colors.muted });
  // bars
  const bx = narrow ? 20 : w * 0.58, bw = narrow ? w - 40 : w * 0.38, by = narrow ? cy + 100 : 50;
  const bar = (y: number, label: string, v: number, max: number, cut: number, cutLab: string) => {
    text(g, label, bx, y, { size: 11, color: i.colors.fg, weight: 600 });
    g.fillStyle = i.colors.line; g.fillRect(bx, y + 8, bw, 10);
    g.fillStyle = v >= cut ? i.colors.abn : i.colors.accent; g.fillRect(bx, y + 8, bw * clamp(v / max, 0, 1), 10);
    const xc = bx + bw * cut / max;
    g.strokeStyle = i.colors.fg; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(xc, y + 4); g.lineTo(xc, y + 22); g.stroke(); g.setLineDash([]);
    text(g, cutLab, xc, y + 34, { size: 10, color: i.colors.muted, align: 'center' });
  };
  bar(by, `${T(i, 'Thyroid hormone action', 'Schilddrüsenhormonwirkung')} ×${num(i, b.thyroidEffect, 1)}`, b.thyroidEffect, 4, 1.8, T(i, 'lids retract', 'Lider ziehen sich zurück'));
  bar(by + (narrow ? 50 : 64), `${T(i, 'Orbitopathy (Graves’)', 'Orbitopathie (Basedow)')} ${num(i, b.orbitopathy, 2)}`, b.orbitopathy, 1, 0.4, T(i, 'eye stands forward', 'Auge tritt vor'));
  if (!narrow) text(g, `fT4 ${num(i, b.ft4, 1)} pmol/L · TSH ${num(i, b.tsh, 2)} mU/L`, bx, by + 130, { size: 10, color: i.colors.muted });
}
function arrowHeadLine(g: CanvasRenderingContext2D, i: MechanismInput, x1: number, y1: number, x2: number, y2: number) {
  g.strokeStyle = i.colors.abn; g.fillStyle = i.colors.abn; g.lineWidth = 2;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); arrowHead(g, x1, y1, x2, y2, 7);
}
const n1 = (x: number) => (Math.round(x * 10) / 10).toString();
const de1 = (x: number) => n1(x).replace('.', ',');
