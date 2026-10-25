import type { Side } from '../model/types.ts';
import { FaceCanvas, neutralFace, type Appearance } from './face-canvas.ts';
import type { SpeechLine } from '../text/speech-script.ts';

/* ---------------------------------------------------------------------------
   Face view: animates the facial-movement examination from face.movement
   findings. The patient is asked in turn to raise the eyebrows, screw the
   eyes shut and show the teeth; each half of the face responds with the
   strength its finding gives (normal, weak, absent).

   An upper motor neuron weakness therefore shows a drooping mouth corner and
   a flattened fold with a forehead that still wrinkles. A facial nerve palsy
   shows a smooth forehead that does not rise, an eye that will not close
   while the globe rolls up beneath the lid (Bell's phenomenon), and a smile
   pulled to the healthy side.
--------------------------------------------------------------------------- */

export interface FaceFinding { forehead: string; eyeClosure: string; mouth: string }
/** The mouth examination's findings (IX–XII and the trigeminal motor root), when the mouth is examined too. */
export interface OralFinding { jawTo: 'none' | Side; uvulaTo: 'none' | Side; tongueTo: 'none' | Side; tongueWasting: boolean; tongueFasciculation: boolean;
  /** shrug and head turn, MRC by side (the accessory nerve: trapezius and sternocleidomastoid) */
  shrug?: Record<Side, number> }

const STRENGTH: Record<string, number> = { normal: 1, weak: 0.4, absent: 0 };
const PHASES = ['rest', 'brows', 'eyes', 'smile'] as const;
const ORAL_PHASES = ['rest', 'brows', 'eyes', 'smile', 'ahh', 'tongue', 'jaw', 'shrug', 'turn-l', 'turn-r'] as const;
/** How far a muscle of this MRC grade moves its part against the examiner's hand, 0 … 1 (a placement). */
const MOVE: Record<number, number> = { 0: 0, 1: 0.03, 2: 0.15, 3: 0.35, 4: 0.7, 5: 1 };
const LABEL: Record<string, [string, string]> = {
  ahh: ['“Open wide and say ah”', '„Mund weit auf, Aaa sagen“'], tongue: ['“Put your tongue out”', '„Zunge herausstrecken“'], jaw: ['“Open your mouth” (against resistance)', '„Mund öffnen“ (gegen Widerstand)'],
  shrug: ['“Shrug your shoulders” (against my hands)', '„Schultern hochziehen“ (gegen meine Hände)'],
  'turn-l': ['“Turn your head to the left” (against my hand)', '„Kopf nach links drehen“ (gegen meine Hand)'], 'turn-r': ['“Turn your head to the right” (against my hand)', '„Kopf nach rechts drehen“ (gegen meine Hand)'],
  rest: ['At rest', 'In Ruhe'], brows: ['“Raise your eyebrows”', '„Stirn runzeln“'],
  eyes: ['“Screw your eyes shut”', '„Augen fest zukneifen“'], smile: ['“Show me your teeth”', '„Zähne zeigen“'],
};
const PHASE_S = 2.6;

export class FaceView {
  private raf = 0;
  private face: FaceCanvas;
  private caption: HTMLElement;
  constructor(host: HTMLElement, ap: Appearance) {
    host.innerHTML = '<div class="facecanvas-host"></div><div class="face-caption"></div>';
    this.face = new FaceCanvas(host.querySelector('.facecanvas-host')!, ap);
    this.caption = host.querySelector('.face-caption')!;
  }

  show(f: Record<Side, FaceFinding>, lang: 'en' | 'de', oral?: OralFinding, only?: readonly string[]) {
    const phases: readonly string[] = only ?? (oral ? ORAL_PHASES : PHASES);
    cancelAnimationFrame(this.raf);
    const t0 = performance.now();
    const frame = (now: number) => {
      const el = Math.max(0, (now - t0) / 1000);
      const phase = phases[Math.floor(el / PHASE_S) % phases.length];
      const x = (el % PHASE_S) / PHASE_S;
      // effort rises over 0.6 s, is held, and relaxes at the end of the phase
      const effort = Math.min(1, x * PHASE_S / 0.6) * Math.min(1, (1 - x) * PHASE_S / 0.4);
      const ease = 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, effort)));
      this.caption.textContent = LABEL[phase][lang === 'de' ? 1 : 0];

      const st = neutralFace();
      st.camera = 'face';
      const blink = phase === 'eyes' ? 0 : this.face.blink(el);
      let maxMouth = 0;
      for (const S of ['L', 'R'] as Side[]) {
        const fh = STRENGTH[f[S].forehead] ?? 1, ec = STRENGTH[f[S].eyeClosure] ?? 1, mo = STRENGTH[f[S].mouth] ?? 1;
        maxMouth = Math.max(maxMouth, mo);
        st.brows[S] = phase === 'brows' ? 16 * fh * ease : -3 * (1 - fh);
        st.foreheadLines[S] = phase === 'brows' ? fh * ease : 0;
        const closing = phase === 'eyes' ? ease : 0;
        // the globe rolls up on forced closure; it shows only where the lid fails to cover it
        st.eyes[S] = {
          h: 0, v: 26 * closing, torsion: 0, pupilMm: 3.5, ptosisMm: 0,
          closure: Math.max(blink, closing * (ec >= 1 ? 1 : ec > 0 ? 0.55 : 0.12)),
        };
        // a weak orbicularis lets the lower lid sag and the fissure widen at rest
        if (ec < 1 && phase !== 'eyes') st.eyes[S].ptosisMm = -0.6 * (1 - ec);
        const smiling = phase === 'smile' ? ease : 0;
        st.mouth[S] = { lift: mo * smiling, droop: 1 - mo, pull: mo * smiling };
        st.folds[S] = 0.25 + 0.75 * mo + 0.4 * mo * smiling;
      }
      st.mouthOpen = phase === 'smile' ? 0.85 * ease * maxMouth : 0;
      if (oral && (phase === 'ahh' || phase === 'tongue' || phase === 'jaw')) {
        /* as drawn the patient's right is on the viewer's left (negative x) */
        const toX = (sd: 'none' | Side) => (sd === 'R' ? -1 : sd === 'L' ? 1 : 0);
        /* the palate lifts on the strong side and pulls the uvula toward it; the weak side stays low (a placement in size) */
        const weakPal: Side | null = oral.uvulaTo === 'none' ? null : oral.uvulaTo === 'R' ? 'L' : 'R';
        st.oral = {
          wide: phase === 'tongue' ? 0.25 * ease : ease, jawShift: phase === 'jaw' ? 16 * toX(oral.jawTo) : 0,
          palate: { L: phase === 'ahh' ? ease * (weakPal === 'L' ? 0.1 : 1) : 0, R: phase === 'ahh' ? ease * (weakPal === 'R' ? 0.1 : 1) : 0 },
          uvulaShift: phase === 'ahh' ? 9 * toX(oral.uvulaTo) * ease : 0,
          tongueOut: phase === 'tongue' ? ease : 0, tongueShift: 16 * toX(oral.tongueTo),
          wasted: oral.tongueWasting && oral.tongueTo !== 'none' ? oral.tongueTo : null, fasciculation: oral.tongueFasciculation, t: el,
        };
      }
      if (oral?.shrug && (phase === 'shrug' || phase === 'turn-l' || phase === 'turn-r')) {
        /* the accessory nerve: the trapezius lifts the shoulder, each sternocleidomastoid turns the head to the other side */
        const mv = (S: Side) => MOVE[Math.max(0, Math.min(5, Math.round(oral.shrug![S])))];
        st.camera = 'bust';
        st.neck = { lift: { R: phase === 'shrug' ? ease * mv('R') : 0, L: phase === 'shrug' ? ease * mv('L') : 0 }, droop: { R: 1 - mv('R') > 0.6 ? 1 : 0, L: 1 - mv('L') > 0.6 ? 1 : 0 },
          press: phase === 'shrug', turnHand: phase === 'turn-l' ? 'L' : phase === 'turn-r' ? 'R' : null };
        /* turning left is the right sternocleidomastoid's work */
        if (phase === 'turn-l') st.yaw = -36 * ease * mv('R');
        if (phase === 'turn-r') st.yaw = 36 * ease * mv('L');
      }
      this.face.draw(st);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  /** The patient speaking: the examiner's prompts and the patient's answers appear word by word below the face, the mouth
      moving while a word is said and still in the pauses; a fading voice moves the mouth less and greys its words. */
  talk(script: SpeechLine[], lang: 'en' | 'de', still = false, face?: Record<Side, FaceFinding>) {
    cancelAnimationFrame(this.raf);
    /* the timeline: each word's start and end */
    type Tok = { line: number; word: number; t0: number; t1: number; fade: number };
    const toks: Tok[] = [];
    let t = 0.4;
    script.forEach((ln, i) => {
      ln.words.forEach((_, j) => {
        const fade = ln.fadeFrom !== undefined && j / ln.words.length >= ln.fadeFrom ? (j / ln.words.length - ln.fadeFrom) / (1 - ln.fadeFrom) : 0;
        toks.push({ line: i, word: j, t0: t, t1: t + ln.pace * 0.85, fade }); t += ln.pace + (ln.pauses?.[j] ?? 0);
      });
      t += 0.8;
    });
    const total = t + 2.5;
    const who = (w: SpeechLine['who']) => (w === 'examiner' ? (lang === 'de' ? 'Untersucher' : 'Examiner') : (lang === 'de' ? 'Patient' : 'Patient'));
    const esc = (x: string) => x.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
    let shown = -1;
    const t0 = performance.now();
    const frame = (now: number) => {
      const el = still ? total : ((now - t0) / 1000) % total;
      const said = toks.filter((k) => k.t0 <= el).length;
      if (said !== shown) {
        shown = said;
        const lines = script.map((ln, i) => {
          const ws = toks.filter((k) => k.line === i && k.t0 <= el);
          if (!ws.length) return '';
          return `<div class="talk-line talk-${ln.who}"><b>${who(ln.who)}:</b> ${ws.map((k) => `<span style="opacity:${(1 - 0.75 * k.fade).toFixed(2)};font-size:${(100 - 30 * k.fade).toFixed(0)}%">${esc(ln.words[k.word])}</span>`).join(' ')}</div>`;
        }).join('');
        this.caption.innerHTML = lines;
      }
      const st = neutralFace();
      st.camera = 'face';
      const cur = toks.find((k) => k.t0 <= el && el < k.t1 && script[k.line].who === 'patient');
      /* about four syllables a second, smaller as the voice fades */
      st.mouthOpen = cur && !still ? (0.12 + 0.3 * Math.abs(Math.sin(2 * Math.PI * 2 * (el - cur.t0)))) * (1 - 0.6 * cur.fade) : 0;
      for (const S of ['L', 'R'] as const) {
        st.eyes[S] = { h: 0, v: 0, torsion: 0, pupilMm: 3.5, ptosisMm: 0, closure: this.face.blink(el) };
        /* a weak half of the face stays weak while speaking */
        const mo = STRENGTH[face?.[S]?.mouth ?? 'normal'] ?? 1;
        st.mouth[S] = { lift: 0, droop: 1 - mo, pull: 0 }; st.folds[S] = 0.25 + 0.75 * mo;
      }
      this.face.draw(st);
      if (!still) this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() { cancelAnimationFrame(this.raf); }
}
