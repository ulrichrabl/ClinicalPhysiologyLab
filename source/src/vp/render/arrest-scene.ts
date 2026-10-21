import { figureSvg, lerpPose, POSES, viewAt, type FigureLook, type Pose } from './patient-figure.ts';

/* ===========================================================================
   The arrest scene (ADR-018 step 5): the patient on the trolley, seen from
   his right, and the people round him doing what the run says they do.

   The patient is the bedside figure itself (patient-figure.ts), posed and
   coloured by the run: sitting up while he talks, slumped where he sat once
   his heart stops, lying flat once someone lowers the bed, grey without a circulation, the bag-mask on his face while he is
   ventilated. Its landmarks (the chest, the neck, the wrist) place
   everything else, so hands land on the lower sternum whatever the body.

   The rescuers stand behind the trolley, facing us. They are drawn simply
   (flat scrubs, no faces) so that they do not compete with the patient:
   the compressor's arms come straight down onto the sternum and move with
   the compression pressure the circulation feels; whoever has the airway
   holds the mask and squeezes the bag as the airway pressure rises; the
   defibrillator stands at the foot end with the rhythm on its screen.

   Coordinates are the figure's (viewBox 0 0 360 380, about 1.77 units per
   cm); the scene widens it to make room for people standing.
=========================================================================== */

export type SceneTask = 'compressions' | 'airway' | 'defibrillator' | 'drugs' | 'calling' | 'idle'
  /** at the head: opening the airway and looking (breathing, the mouth), or taking something out of it */
  | 'look'
  /** at the head end, lowering the backrest */
  | 'bed';

export interface ScenePerson {
  id: string;
  label: string;
  task: SceneTask;
  /** Scrub colour and skin. */
  scrub: string; skin: string; hair: string;
  /** A few words just said, shown in a bubble. */
  says?: string;
  /** The leader (the learner) is outlined. */
  you?: boolean;
}

export interface SceneState {
  pose: Pose;
  look: FigureLook;
  people: ScenePerson[];
  /** 0–1: how far the chest is pressed now. */
  press: number;
  /** 0–1: how far the bag is squeezed now. */
  squeeze: number;
  pads: boolean;
  defibrillator: boolean;
  charged: boolean;
  line: boolean;
  /** The defibrillator's screen: the last seconds of lead II, values in mV. */
  ecg: number[];
}

export const SCENE_VIEWBOX = '-40 -4 450 384';

interface Marks { chest: [number, number, number, number]; neck: [number, number, number, number]; wrist: { x: number; y: number } }
const bbox = (pts: Array<{ x: number; y: number }>): [number, number, number, number] => {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

/** The patient's drawing and where his landmarks are. Cached by the caller: it changes only when he moves or changes colour. */
export function patientLayer(pose: Pose, look: FigureLook): { svg: string; marks: Marks } {
  const got: Record<string, Array<{ x: number; y: number }>> = {};
  const svg = figureSvg(pose, look, viewAt(0), { collect: (k, side, pts) => { (got[k + side] ??= []).push(...pts); } });
  return { svg, marks: { chest: bbox(got.chest ?? [{ x: 100, y: 220 }]), neck: bbox(got.neck ?? [{ x: 80, y: 230 }]), wrist: (got.wristR ?? [{ x: 186, y: 245 }])[0] } };
}

/** Slumped where he sat when his heart stopped: the backrest still up, the chin on the chest, the arms fallen to his sides. */
export const SLUMPED: Pose = { ...POSES['reclined-45'], torso: 136, neck: -56, head: -22, armUpper: [-72, -68], armFore: [-34, -28], hand: [-18, -18] };

/** The pose in the arrest: sitting up as he talks, slumping as he loses consciousness (`slump` 0–1), then laid flat as the
    bed is lowered (`flat` 0–1). He does not lie down by himself. */
export const collapsePose = (slump: number, flat = 0): Pose => {
  const c = (u: number) => Math.max(0, Math.min(1, u));
  return lerpPose(lerpPose(POSES['reclined-45'], SLUMPED, c(slump)), POSES.supine, c(flat));
};

const f = (x: number) => x.toFixed(1);

/** A rescuer standing behind the trolley, facing us: legs, body and head. Arms are drawn separately, over the patient. */
function body(x: number, p: ScenePerson, shoulderY: number): string {
  const hipY = shoulderY + 92, floor = 372, w = 33, waist = 26;
  const out: string[] = [];
  out.push(`<path d="M${f(x - waist + 3)} ${f(hipY - 4)} L${f(x - 19)} ${floor} L${f(x - 5)} ${floor} L${f(x)} ${f(hipY + 18)} L${f(x + 5)} ${floor} L${f(x + 19)} ${floor} L${f(x + waist - 3)} ${f(hipY - 4)} Z" fill="${p.scrub}" filter="brightness(.88)" opacity=".95"/>`);
  out.push(`<path d="M${f(x - w)} ${f(shoulderY + 6)} Q${f(x - w)} ${f(shoulderY - 4)} ${f(x - w + 12)} ${f(shoulderY - 6)} L${f(x + w - 12)} ${f(shoulderY - 6)} Q${f(x + w)} ${f(shoulderY - 4)} ${f(x + w)} ${f(shoulderY + 6)} L${f(x + waist)} ${f(hipY)} L${f(x - waist)} ${f(hipY)} Z" fill="${p.scrub}"/>`);
  out.push(`<path d="M${f(x - 9)} ${f(shoulderY - 6)} L${f(x)} ${f(shoulderY + 10)} L${f(x + 9)} ${f(shoulderY - 6)}" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="1.5"/>`);
  out.push(`<rect x="${f(x - 6)}" y="${f(shoulderY - 18)}" width="12" height="14" rx="4" fill="${p.skin}"/>`);
  out.push(`<circle cx="${f(x)}" cy="${f(shoulderY - 32)}" r="17" fill="${p.skin}"/>`);
  out.push(`<path d="M${f(x - 17)} ${f(shoulderY - 34)} A17 17 0 0 1 ${f(x + 17)} ${f(shoulderY - 34)} Q${f(x)} ${f(shoulderY - 40)} ${f(x - 17)} ${f(shoulderY - 34)} Z" fill="${p.hair}"/>`);
  if (p.you) out.push(`<circle cx="${f(x)}" cy="${f(shoulderY - 32)}" r="20" fill="none" stroke="var(--accent, #1f6f78)" stroke-width="2.5"/>`);
  return out.join('');
}

/** An arm from the shoulder to the hand, bending a little at the elbow, in the scrub sleeve with a bare forearm. */
function arm(sx: number, sy: number, hx: number, hy: number, p: ScenePerson, bend = 1): string {
  const mx = (sx + hx) / 2, my = (sy + hy) / 2, dx = hx - sx, dy = hy - sy, len = Math.hypot(dx, dy) || 1;
  const ex = mx - (dy / len) * 6 * bend, ey = my + (dx / len) * 6 * bend;
  return `<path d="M${f(sx)} ${f(sy)} L${f(ex)} ${f(ey)}" stroke="${p.scrub}" stroke-width="12" stroke-linecap="round"/>`
    + `<path d="M${f(ex)} ${f(ey)} L${f(hx)} ${f(hy)}" stroke="${p.skin}" stroke-width="9" stroke-linecap="round"/>`
    + `<circle cx="${f(hx)}" cy="${f(hy)}" r="5.5" fill="${p.skin}"/>`;
}

function bubble(x0: number, y: number, text: string): string {
  const w = Math.min(170, 12 + text.length * 5.2);
  /* kept inside the scene (viewBox x from -40 to 410); the pointer stays over the speaker */
  const x = Math.max(-40 + w / 2 + 2, Math.min(410 - w / 2 - 2, x0));
  return `<g class="scene-say"><rect x="${f(x - w / 2)}" y="${f(y - 30)}" width="${f(w)}" height="20" rx="10" fill="var(--surface, #fff)" stroke="var(--line, #ccd)"/>`
    + `<path d="M${f(x0 - 4)} ${f(y - 10.5)} L${f(x0)} ${f(y - 4)} L${f(x0 + 4)} ${f(y - 10.5)}" fill="var(--surface, #fff)" stroke="var(--line, #ccd)"/>`
    + `<text x="${f(x)}" y="${f(y - 16)}" text-anchor="middle" font-size="10" fill="var(--fg, #222)">${text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))}</text></g>`;
}

/** The whole scene for one frame. `patient` is the cached patient layer. */
export function sceneSvg(s: SceneState, patient: { svg: string; marks: Marks }): string {
  const m = patient.marks;
  /* the lower half of the sternum: two-thirds of the way from the neck end of the chest, on its upper surface */
  const sternum = { x: m.chest[0] + (m.chest[2] - m.chest[0]) * 0.62, y: m.chest[1] + 2 };
  /* the face, from the neck: lying flat the head lies just beyond the neck, the mouth uppermost */
  const face = { x: m.neck[0] + 10, y: m.neck[1] - 10 };   // the mask's centre, measured on the figure lying flat
  /* Rescuers stand on the floor at adult proportions, whatever the patient does: about 170 cm tall at 1.77 units per cm,
     legs about 85 cm (150 units), trunk to the shoulders about 52 cm (92). Lying flat, the lower sternum is then about 90
     units below the shoulders: straight arms, leaning a little. (Placing them from the patient's chest made their legs
     grow while he sat up.) */
  const SHOULDER = 372 - 150 - 92;
  const press = Math.max(0, Math.min(1, s.press));

  /* where each task stands */
  const slot: Record<SceneTask, number> = { compressions: sternum.x, airway: face.x - 72, look: face.x - 28, bed: Math.max(-6, face.x - 100), defibrillator: 342, drugs: m.wrist.x + 14, calling: 272, idle: 272 };
  const used = new Map<number, number>();
  const placed = s.people.map((p) => {
    let x = slot[p.task];
    const n = used.get(x) ?? 0; used.set(slot[p.task], n + 1);
    if (n > 0) x += n * 72 * (p.task === 'idle' || p.task === 'calling' ? 1 : -1);
    return { p, x };
  });

  const back: string[] = [], front: string[] = [], over: string[] = [];
  placed.forEach(({ p, x }, i) => {
    const sy = p.task === 'compressions' ? SHOULDER + press * 7 : p.task === 'airway' || p.task === 'look' ? SHOULDER + 18 : SHOULDER;
    back.push(body(x, p, sy));
    const lx = x - 27, rx = x + 27, ay = sy + 4;
    if (p.task === 'compressions') {
      /* heel of one hand on the lower sternum, the other on top; elbows locked */
      const hy = sternum.y - 3 + press * 6;
      front.push(arm(lx, ay, sternum.x - 3, hy - 3, p, 0.2), arm(rx, ay, sternum.x + 3, hy - 3, p, -0.2));
    } else if (p.task === 'airway') {
      /* standing at the head: one hand seals the mask on the face, the other squeezes the bag above the head */
      const bx = face.x - 34, by = face.y - 20;
      const rx2 = 18 * (1 - 0.35 * s.squeeze), ry2 = 10 * (1 - 0.15 * s.squeeze);
      front.push(`<path d="M${f(face.x - 2)} ${f(face.y - 6)} L${f(bx + rx2 - 2)} ${f(by + 2)}" stroke="#6f7f8a" stroke-width="4.5" stroke-linecap="round"/>`);
      front.push(`<ellipse cx="${f(bx)}" cy="${f(by)}" rx="${f(rx2)}" ry="${f(ry2)}" fill="#e8b04a" stroke="#a87a26" stroke-width="1.2"/>`);
      front.push(`<ellipse cx="${f(bx - rx2 + 3)}" cy="${f(by)}" rx="4" ry="6" fill="#d6d9dc" stroke="#8a949b" stroke-width="1"/>`);
      front.push(arm(lx, ay, bx - 2, by - ry2 + 3, p, 0.6), arm(rx, ay, face.x + 3, face.y - 4, p, -0.8));
    } else if (p.task === 'look') {
      /* head tilt and chin lift: one hand on the forehead, two fingers under the chin, leaning in to look and listen */
      front.push(arm(lx, ay, face.x - 8, face.y - 8, p, 0.8), arm(rx, ay, face.x + 10, face.y + 4, p, -0.6));
    } else if (p.task === 'bed') {
      /* both hands on the head of the bed, pushing the backrest down */
      front.push(arm(lx, ay, m.neck[0] - 18, m.neck[1] - 6, p, 0.5), arm(rx, ay, m.neck[0] - 6, m.neck[1] - 2, p, -0.5));
    } else if (p.task === 'defibrillator') {
      front.push(arm(lx, ay, 352, 222, p, 1), arm(rx, ay, x + 30, ay + 70, p, -0.3));
    } else if (p.task === 'drugs') {
      front.push(arm(lx, ay, m.wrist.x + 2, m.wrist.y - 4, p, 1), arm(rx, ay, m.wrist.x + 14, m.wrist.y - 10, p, -0.5));
    } else if (p.task === 'calling') {
      front.push(arm(lx, ay, lx + 4, ay + 72, p, 0.3), arm(rx, ay, x + 8, sy - 30, p, -1.4));
      over.push(`<rect x="${f(x + 4)}" y="${f(sy - 44)}" width="7" height="14" rx="2" fill="#333"/>`);
    } else {
      front.push(arm(lx, ay, lx - 2, ay + 78, p, 0.3), arm(rx, ay, rx + 2, ay + 78, p, -0.3));
    }
    over.push(`<text x="${f(x)}" y="${f(sy - 56)}" text-anchor="middle" font-size="11" font-weight="${p.you ? 700 : 500}" fill="var(--fg, #222)">${p.label}</text>`);
    /* neighbours' bubbles alternate in height, so two people speaking at once do not cover each other */
    if (p.says) over.push(bubble(x, sy - 62 - (i % 2) * 24, p.says));
  });

  /* the defibrillator on its trolley at the foot end, its screen showing the rhythm */
  const kit: string[] = [];
  if (s.defibrillator) {
    kit.push(`<rect x="336" y="232" width="62" height="140" rx="4" fill="#9aa6ae"/><rect x="340" y="206" width="54" height="34" rx="4" fill="#d2b23a"/>`);
    kit.push(`<rect x="344" y="210" width="34" height="22" rx="2" fill="#0d1b1e"/>`);
    if (s.ecg.length > 1) {
      const pts = s.ecg.map((v, i) => `${f(345 + (i / (s.ecg.length - 1)) * 32)},${f(221 - Math.max(-1.5, Math.min(1.5, v)) * 6)}`).join(' ');
      kit.push(`<polyline points="${pts}" fill="none" stroke="#5be37d" stroke-width="1"/>`);
    }
    kit.push(`<circle cx="386" cy="216" r="3.5" fill="${s.charged ? '#e74c3c' : '#5a6a70'}"/>`);
    if (s.pads) {
      /* pads: one below the right clavicle (seen), one at the apex (on his left, out of sight); the cable to the machine */
      const px = m.chest[0] + 9, py = m.chest[1] + 1;
      kit.push(`<path d="M${f(px + 6)} ${f(py - 2)} C${f(px + 60)} ${f(py - 60)}, 300 190, 344 226" fill="none" stroke="#333" stroke-width="1.6"/>`);
      over.push(`<rect x="${f(px - 2)}" y="${f(py - 4)}" width="16" height="7" rx="2" fill="#f4f4f4" stroke="#555" stroke-width=".8"/>`);
    }
  }
  if (s.line) {
    over.push(`<rect x="${f(m.wrist.x - 7)}" y="${f(m.wrist.y - 4)}" width="9" height="4" rx="1" fill="#f0a64b"/>`);
    /* a drip on a pole behind the trolley, its line down to the cannula in the forearm */
    const pole = m.wrist.x - 34;
    kit.push(`<path d="M${f(pole)} 372 L${f(pole)} 78 M${f(pole - 10)} 78 L${f(pole + 10)} 78" stroke="#8d989e" stroke-width="2.4"/>`);
    kit.push(`<rect x="${f(pole - 8)}" y="80" width="16" height="26" rx="3" fill="#dceef5" stroke="#9cc5d6"/><path d="M${f(pole)} 106 C${f(pole)} 170, ${f(m.wrist.x - 8)} 200, ${f(m.wrist.x - 3)} ${f(m.wrist.y - 4)}" fill="none" stroke="#9cc5d6" stroke-width="1.4"/>`);
  }
  /* Where a tap lands (transparent, drawn last): the bed, the people (head and trunk, above the trolley), his arm, his
     chest, his head, and the defibrillator. Later ones win where they overlap. */
  const hits: string[] = [];
  const hr = (id: string, x: number, y: number, w: number, h: number) => hits.push(`<rect data-hit="${id}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="transparent"/>`);
  hr('bed', 0, Math.min(m.neck[1], m.chest[1]) - 30, 330, 120);
  placed.forEach(({ p, x }) => { const sy = SHOULDER; hr(`person:${p.id}`, x - 34, sy - 52, 68, 130); });
  hr('arm', m.wrist.x - 22, m.wrist.y - 18, 44, 30);
  hr('chest', m.chest[0] - 4, m.chest[1] - 16, m.chest[2] - m.chest[0] + 8, 34);
  /* the head, from the neck's landmarks: it works sitting up and lying flat */
  hits.push(`<circle data-hit="head" cx="${f((m.neck[0] + m.neck[2]) / 2)}" cy="${f(m.neck[1] - 8)}" r="30" fill="transparent"/>`);
  if (s.defibrillator) hr('defib', 334, 204, 66, 168);
  return `<g class="scene-back">${back.join('')}</g><g class="scene-kit">${kit.join('')}</g><g class="scene-patient">${patient.svg}</g><g class="scene-front">${front.join('')}</g><g class="scene-over">${over.join('')}</g><g class="scene-hit">${hits.join('')}</g>`;
}
