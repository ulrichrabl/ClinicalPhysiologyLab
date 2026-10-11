/* Virtual patient encounter: the data model and engine, playable.
   Bundled into a standalone page by scripts/build-vp-demo.mjs. */
import { CATALOG } from '../data/catalog.ts';
import { REGISTRY } from '../registry.ts';
import { CASES } from '../index.ts';
import { buildView } from '../engine/view.ts';
import { startEncounter, perform, order, advanceCourse, observeIn, type Session } from '../engine/encounter.ts';
import { ask, opening, interpret, normalise } from '../engine/language.ts';
import { autoNote, describe } from '../engine/notes.ts';
import { commit, type Commit, type DebriefResult } from '../engine/debrief.ts';
import { tr, list, type LocalizedText } from '../model/i18n.ts';
import type { CaseDef, Finding, ManoeuvreDef, Side } from '../model/types.ts';
import { sceneFindings, type SceneControls } from '../render/eye-scene.ts';
import { EyeView } from '../render/eye-view.ts';
import { cycle, phonoSample, murmurEnvelope, type Cycle } from '../render/phono.ts';

type Lang = 'en' | 'de';
declare const __CIRCULATION__: Record<string, Record<string, any>>;

/* ---- interface text ------------------------------------------------------------ */
const UI: Record<string, Record<Lang, string>> = {
  ward: { en: 'Emergency department', de: 'Notaufnahme' },
  wardLede: { en: 'Two patients are waiting. You know what triage wrote, nothing more. Take a history, examine, order what you need, then commit to a diagnosis.', de: 'Zwei Patienten warten. Sie wissen, was die Triage notiert hat, nicht mehr. Anamnese, Untersuchung, Diagnostik nach Bedarf, dann legen Sie sich auf eine Diagnose fest.' },
  see: { en: 'See patient', de: 'Patient ansehen' },
  placeholder: { en: 'Ask or examine…', de: 'Fragen oder untersuchen…' },
  send: { en: 'Go', de: 'Los' },
  feed: { en: 'Encounter', de: 'Verlauf' }, notes: { en: 'Notes', de: 'Notizen' }, mine: { en: 'My notes', de: 'Meine Notizen' }, results: { en: 'Results', de: 'Befunde' },
  wait: { en: 'Wait 10 min', de: '10 min warten' }, commit: { en: 'Commit diagnosis', de: 'Diagnose festlegen' }, leave: { en: 'Ward', de: 'Übersicht' },
  whole: { en: 'Whole patient', de: 'Ganzer Patient' }, tapHint: { en: 'Tap the patient to examine a part of the body, or type.', de: 'Tippen Sie auf den Patienten, um eine Körperregion zu untersuchen, oder schreiben Sie.' },
  left: { en: 'Left', de: 'Links' }, right: { en: 'Right', de: 'Rechts' }, which: { en: 'Which side?', de: 'Welche Seite?' },
  unknown: { en: "Not understood. Rephrase it as a question to the patient or as an examination step.", de: 'Nicht verstanden. Formulieren Sie eine Frage an den Patienten oder einen Untersuchungsschritt.' },
  ordered: { en: 'Ordered', de: 'Angefordert' }, resultIn: { en: 'result in', de: 'Ergebnis in' }, result: { en: 'Result', de: 'Ergebnis' },
  noResults: { en: 'Nothing ordered yet.', de: 'Noch nichts angefordert.' }, noNotes: { en: 'Notes are written as you go.', de: 'Notizen entstehen während der Untersuchung.' },
  myNotesHint: { en: 'Write your own notes. After you commit, they are shown next to the automatic ones.', de: 'Schreiben Sie eigene Notizen. Nach der Festlegung werden sie neben den automatischen gezeigt.' },
  listen: { en: 'Listen', de: 'Anhören' }, stop: { en: 'Stop', de: 'Stopp' },
  position: { en: 'Position', de: 'Lagerung' }, exposed: { en: 'Exposed', de: 'Freigemacht' }, nothing: { en: 'nothing', de: 'nichts' },
  commitTitle: { en: 'Your differential', de: 'Ihre Differentialdiagnose' }, search: { en: 'Search diagnoses', de: 'Diagnosen suchen' },
  commitHint: { en: 'Add diagnoses in order of likelihood. The first is your working diagnosis.', de: 'Diagnosen nach Wahrscheinlichkeit ordnen. Die erste ist Ihre Arbeitsdiagnose.' },
  submit: { en: 'Commit', de: 'Festlegen' }, cancel: { en: 'Back to the patient', de: 'Zurück zum Patienten' },
  certain: { en: 'certain', de: 'sicher' }, likely: { en: 'likely', de: 'wahrscheinlich' }, possible: { en: 'possible', de: 'möglich' },
  debrief: { en: 'Debrief', de: 'Nachbesprechung' }, correct: { en: 'Working diagnosis correct', de: 'Arbeitsdiagnose richtig' },
  incorrect: { en: 'Working diagnosis not correct', de: 'Arbeitsdiagnose nicht richtig' }, diagnosisWas: { en: 'Diagnosis', de: 'Diagnose' },
  expert: { en: 'Expert assessment', de: 'Einschätzung der Expertin' }, evidence: { en: 'The evidence that decides this case', de: 'Die entscheidenden Befunde' },
  elicited: { en: 'found', de: 'erhoben' }, missed: { en: 'not elicited', de: 'nicht erhoben' }, redFlags: { en: 'Red flags', de: 'Warnzeichen' },
  covered: { en: 'asked', de: 'erfragt' }, uncovered: { en: 'not asked', de: 'nicht erfragt' }, hazards: { en: 'Safety', de: 'Sicherheit' }, noHazards: { en: 'Nothing unsafe was done.', de: 'Nichts Unsicheres getan.' },
  time: { en: 'Time', de: 'Zeit' }, budget: { en: 'expert budget', de: 'Expertenbudget' }, ddxConsidered: { en: 'Differential you considered', de: 'Bedachte Differentialdiagnosen' },
  ddxMissed: { en: 'Worth considering too', de: 'Ebenfalls zu bedenken' }, compare: { en: 'Your notes and the automatic notes', de: 'Ihre und die automatischen Notizen' },
  how: { en: 'How the model produced what you found', de: 'Wie das Modell Ihre Befunde erzeugt hat' }, again: { en: 'Back to the ward', de: 'Zurück zur Übersicht' },
  essential: { en: 'essential', de: 'wesentlich' }, discriminating: { en: 'discriminating', de: 'unterscheidend' }, supporting: { en: 'supporting', de: 'unterstützend' },
  min: { en: 'min', de: 'min' }, you: { en: 'You', de: 'Sie' }, onAdmission: { en: 'On arrival', de: 'Bei Ankunft' },
};
const POSITION: Record<string, Record<Lang, string>> = {
  supine: { en: 'lying flat', de: 'flach liegend' }, 'reclined-45': { en: 'sitting at 45°', de: 'Oberkörper 45° hoch' },
  sitting: { en: 'sitting up', de: 'sitzend' }, 'sitting-forward': { en: 'sitting forward', de: 'vorgebeugt sitzend' },
  standing: { en: 'standing', de: 'stehend' }, 'left-lateral': { en: 'on the left side', de: 'in Linksseitenlage' },
  prone: { en: 'prone', de: 'in Bauchlage' }, 'head-hanging-left': { en: 'head hanging, turned left', de: 'Kopfhängelage links' }, 'head-hanging-right': { en: 'head hanging, turned right', de: 'Kopfhängelage rechts' },
};
const SKIN = ['#f3d6c2', '#e8c2a4', '#d1a07a', '#a8714d', '#7a4b2f', '#4f2f1e'];
const SHADE = ['#d9b39a', '#d3a585', '#b4835f', '#8a5a3c', '#5f3a24', '#3a2216'];

/* ---- feed ------------------------------------------------------------------------ */
type FeedItem =
  | { k: 'scene'; text: LocalizedText }
  | { k: 'you'; text: string }
  | { k: 'patient'; facts: string[]; topics: string[]; text: string; locale: Lang }
  | { k: 'act'; manoeuvre: string; side?: Side }
  | { k: 'blocked'; reason: string }
  | { k: 'finding'; finding: Finding }
  | { k: 'order'; inv: string }
  | { k: 'result'; inv: string; value: unknown }
  | { k: 'system'; text: LocalizedText }
  | { k: 'side'; manoeuvre: string };

type Visual =
  | { kind: 'eyes'; controls: (now: number) => SceneControls }
  | { kind: 'phono'; finding: Finding; hr: number }
  | { kind: 'pulse'; finding: Finding; beat: Array<{ t: number; Pa: number }>; dur: number }
  | null;

/* ---- regions of the body for touch ---------------------------------------------- */
function regionOf(structure: string): string {
  let id: string | undefined = structure;
  while (id) {
    if (['head', 'neck', 'chest', 'abdomen', 'arm', 'legs'].includes(id)) return id;
    if (id === 'eye' || id === 'eyes' || id === 'ear') return 'head';
    if (id === 'hands') return 'arm';
    id = CATALOG.structures[id]?.parent;
  }
  return 'body';
}
const REGION_LABEL: Record<string, Record<Lang, string>> = {
  head: { en: 'Head, eyes and ears', de: 'Kopf, Augen und Ohren' }, neck: { en: 'Neck', de: 'Hals' }, chest: { en: 'Chest', de: 'Thorax' },
  abdomen: { en: 'Abdomen', de: 'Abdomen' }, arm: { en: 'Arm and hand', de: 'Arm und Hand' }, legs: { en: 'Legs', de: 'Beine' }, body: { en: 'Whole patient', de: 'Ganzer Patient' },
};

export function mount(root: HTMLElement) {
  let lang: Lang = (navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';
  let s: Session | null = null;
  let feed: FeedItem[] = [];
  let shownResults = new Set<string>();
  let visual: Visual = null;
  let tab: 'feed' | 'notes' | 'mine' | 'results' = 'feed';
  let myNotes = '';
  let ddx: Commit[] = [];
  let debrief: DebriefResult | null = null;
  let region: { id: string; side?: Side } | null = null;
  let eyeView: EyeView | null = null;
  let audio: { ctx: AudioContext; stop: () => void } | null = null;
  let phonoRaf = 0;

  const t = (k: string) => UI[k]?.[lang] ?? k;
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const minutes = () => (s ? Math.round(s.t / 60000) : 0);

  /* ---- screens ------------------------------------------------------------------- */
  const show = (id: 'ward' | 'encounter' | 'debrief') => {
    for (const x of ['ward', 'encounter', 'debrief']) ($(`#${x}`)).hidden = x !== id;
    window.scrollTo(0, 0);
  };

  const renderWard = () => {
    $('#ward-title').textContent = t('ward');
    $('#ward-lede').textContent = t('wardLede');
    const list = $('#ward-list');
    list.innerHTML = '';
    for (const c of CASES) {
      const card = document.createElement('article');
      card.className = 'bedcard';
      card.innerHTML = `<div class="bed-place">${esc(tr(c.setting.place, lang))}</div>
        <h2>${esc(c.patient.name)}</h2>
        <div class="bed-meta">${c.patient.age} · ${c.patient.sex === 'F' ? (lang === 'de' ? 'weiblich' : 'female') : (lang === 'de' ? 'männlich' : 'male')}</div>
        <p class="bed-triage">${esc(tr(c.setting.triage, lang))}</p>
        <button type="button" class="primary">${t('see')}</button>`;
      card.querySelector('button')!.onclick = () => start(c);
      list.appendChild(card);
    }
  };

  /* ---- start -------------------------------------------------------------------- */
  const start = (c: CaseDef) => {
    const circ = typeof __CIRCULATION__ !== 'undefined' ? __CIRCULATION__[c.id] : undefined;
    s = startEncounter(CATALOG, REGISTRY, c, buildView(c, { circulation: circ }), { locale: lang });
    feed = [{ k: 'scene', text: { en: `${tr(c.setting.place, 'en')}. ${tr(c.setting.triage, 'en')}`, de: `${tr(c.setting.place, 'de')}. ${tr(c.setting.triage, 'de')}` } }];
    const open = c.history.filter((f) => f.volunteered);
    if (open.length) feed.push({ k: 'patient', facts: open.map((f) => f.id), topics: [], text: opening(s), locale: lang });
    s.encounter.events.push({ t: 0, kind: 'utterance', from: 'patient', locale: lang, text: opening(s), facts: open.map((f) => f.id) });
    shownResults = new Set(); visual = null; tab = 'feed'; myNotes = ''; ddx = []; debrief = null; region = null;
    ($('#mynotes') as HTMLTextAreaElement).value = '';
    setVisual(null);
    show('encounter');
    renderEncounter();
    $('#cmd').focus();
  };

  /* ---- performing ------------------------------------------------------------------ */
  const afterTime = (before: number) => {
    if (!s) return;
    const applied = s.appliedCourse.size;
    advanceCourse(s);
    if (s.appliedCourse.size > applied) {
      (s.caseDef.course ?? []).forEach((ev, i) => {
        if (s!.appliedCourse.has(i) && ev.atMinutes * 60000 > before && ev.note && !ev.unless?.some((u) => s!.done.has(u))) feed.push({ k: 'system', text: ev.note });
      });
    }
    for (const e of s.encounter.events) {
      if (e.kind === 'result' && e.t <= s.t && !shownResults.has(e.test)) { shownResults.add(e.test); feed.push({ k: 'result', inv: e.test, value: e.value }); }
    }
  };

  const doAction = (id: string, side?: Side) => {
    if (!s) return;
    const m = CATALOG.manoeuvres[id];
    if (m.paired && !side) { feed.push({ k: 'side', manoeuvre: id }); renderEncounter(); return; }
    const before = s.t;
    feed.push({ k: 'act', manoeuvre: id, side });
    const r = perform(s, id, side);
    if (r.outcome === 'blocked') feed.push({ k: 'blocked', reason: r.reason! });
    for (const f of r.findings) feed.push({ k: 'finding', finding: f });
    if (r.outcome === 'performed') visualFor(m, side, r.findings);
    afterTime(before);
    renderEncounter();
  };

  const submit = (text: string) => {
    if (!s || !text.trim()) return;
    feed.push({ k: 'you', text });
    const i = interpret(CATALOG, text, lang);
    if (i.kind === 'ask') {
      const before = s.t;
      const r = ask(s, text, lang);
      feed.push({ k: 'patient', facts: r.facts.map((f) => f.id), topics: r.topics, text: r.text, locale: lang });
      afterTime(before);
      renderEncounter();
    } else if (i.kind === 'act') { feed.pop(); feed.push({ k: 'you', text }); doAction(i.manoeuvre, i.side); }
    else if (i.kind === 'order') { doOrder(i.investigation); }
    else { feed.push({ k: 'system', text: UI.unknown as LocalizedText }); renderEncounter(); }
  };

  const doOrder = (inv: string) => {
    if (!s) return;
    order(s, inv);
    feed.push({ k: 'order', inv });
    afterTime(s.t);
    renderEncounter();
  };

  /* ---- what the examiner sees and hears ------------------------------------------- */
  const visualFor = (m: ManoeuvreDef, side: Side | undefined, findings: Finding[]) => {
    if (!s) return;
    const eyeIds = ['inspect.eyes', 'inspect.eyes.dim', 'test.pupils.light', 'test.swinging-light', 'test.eye-movements', 'test.frenzel', 'test.head-impulse', 'test.cover'];
    if (eyeIds.includes(m.id)) {
      const base: SceneControls = { gaze: 'primary', fixation: true, lightOn: 'none', ambient: m.id === 'inspect.eyes.dim' ? 'dim' : 'room', cover: null };
      const gazes = ['primary', 'left', 'right', 'up', 'down'] as const;
      const t0 = performance.now();
      const controls = (now: number): SceneControls => {
        const el = (now - t0) / 1000;
        switch (m.id) {
          case 'test.pupils.light': return { ...base, lightOn: el % 4 < 2.5 ? side! : 'none' };
          case 'test.swinging-light': return { ...base, lightOn: Math.floor(el / 1.6) % 2 ? 'L' : 'R' };
          case 'test.eye-movements': return { ...base, gaze: gazes[Math.floor(el / 2.5) % 5] };
          case 'test.frenzel': return { ...base, fixation: false, gaze: gazes[Math.floor(el / 3) % 5] };
          case 'test.head-impulse': return { ...base, impulse: el % 2.4 < 1 ? { to: side!, t: el % 2.4 } : undefined };
          case 'test.cover': return { ...base, cover: Math.floor(el / 1.6) % 2 ? 'L' : 'R' };
          default: return base;
        }
      };
      setVisual({ kind: 'eyes', controls });
      return;
    }
    const heart = findings.find((f) => f.property === 'heart.sounds');
    if (heart) {
      const hr = (s.view.circulation?.metrics?.HRbeat as number | undefined) ?? (observeIn(s, 'vitals.hr', {}).value as number) ?? 72;
      setVisual({ kind: 'phono', finding: heart, hr });
      return;
    }
    const pulse = findings.find((f) => f.property.startsWith('pulse.'));
    const beat = s.view.circulation?.beat;
    if (pulse && beat?.samples?.length) { setVisual({ kind: 'pulse', finding: pulse, beat: beat.samples, dur: beat.dur }); return; }
    if (m.verb !== 'position' && m.verb !== 'expose') setVisual(null);
  };

  const setVisual = (v: Visual) => {
    visual = v;
    eyeView?.stop();
    cancelAnimationFrame(phonoRaf);
    stopAudio();
    const host = $('#visual');
    host.hidden = !v;
    if (!v || !s) return;
    const c = s.caseDef;
    if (v.kind === 'eyes') {
      host.innerHTML = '<div class="eyehost"></div>';
      eyeView = new EyeView(host.querySelector('.eyehost')!, SKIN[c.patient.appearance.skinTone - 1], SHADE[c.patient.appearance.skinTone - 1]);
      const view = s.view;
      eyeView.show((k) => sceneFindings(CATALOG, REGISTRY, c, view, k), v.controls);
      return;
    }
    host.innerHTML = `<div class="trace-head"><span class="trace-label"></span><button type="button" class="ghost small" id="listen" hidden></button></div><canvas class="phono"></canvas>`;
    const canvas = host.querySelector('canvas')!;
    if (v.kind === 'phono') {
      const cyc = cycle(v.finding.value, v.hr);
      const btn = host.querySelector('#listen') as HTMLButtonElement;
      btn.hidden = false;
      btn.textContent = t('listen');
      btn.onclick = () => { if (audio) { stopAudio(); btn.textContent = t('listen'); } else { playCycle(cyc); btn.textContent = t('stop'); } };
      (host.querySelector('.trace-label') as HTMLElement).textContent = lang === 'de' ? 'Phonokardiogramm' : 'Phonocardiogram';
      drawLoop(canvas, (x) => phonoSample(cyc, x), cyc.periodS * 2.2, 1.6, cyc);
    } else {
      const samples = v.beat;
      const dur = v.dur / 1000;
      const lo = Math.min(...samples.map((p) => p.Pa)), hi = Math.max(...samples.map((p) => p.Pa));
      (host.querySelector('.trace-label') as HTMLElement).textContent = lang === 'de' ? 'Pulskurve (arterieller Druck aus dem Kreislaufmodell)' : 'Pulse wave (arterial pressure from the circulation model)';
      const at = (x: number) => {
        const tm = ((x % dur) + dur) % dur * 1000;
        let i = 0; while (i < samples.length - 1 && samples[i + 1].t < tm) i++;
        return ((samples[i].Pa - lo) / Math.max(1, hi - lo)) * 2 - 1;
      };
      drawLoop(canvas, at, dur * 2.5, 0.9);
    }
  };

  const drawLoop = (canvas: HTMLCanvasElement, f: (t: number) => number, windowS: number, gain: number, cyc?: Cycle) => {
    const ctx = canvas.getContext('2d')!;
    const css = (n: string) => getComputedStyle(root).getPropertyValue(n).trim();
    const t0 = performance.now();
    const frame = (now: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const tNow = (now - t0) / 1000;
      ctx.strokeStyle = css('--grid'); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
      if (cyc) {   // shade systole
        ctx.fillStyle = css('--systole');
        for (let k = Math.floor((tNow - windowS) / cyc.periodS); k <= Math.ceil(tNow / cyc.periodS); k++) {
          const a = k * cyc.periodS, b = a + cyc.systoleS;
          const xa = w - (tNow - a) / windowS * w, xb = w - (tNow - b) / windowS * w;
          ctx.fillRect(xa, 0, xb - xa, h);
        }
      }
      ctx.strokeStyle = css('--trace'); ctx.lineWidth = 1.4; ctx.beginPath();
      const n = Math.max(200, Math.round(w * 2));
      for (let i = 0; i <= n; i++) {
        const x = i / n * w, tt = tNow - windowS + i / n * windowS;
        const y = h / 2 - f(tt) * gain * h * 0.3;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
      phonoRaf = requestAnimationFrame(frame);
    };
    phonoRaf = requestAnimationFrame(frame);
  };

  /* Audio: heart sounds as damped low-frequency bursts, murmurs as band-passed noise shaped by their envelope. */
  const playCycle = (cyc: Cycle) => {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ac: AudioContext = new AC();
    const sr = ac.sampleRate;
    const len = Math.round(cyc.periodS * sr);
    const buf = ac.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    let seed = 1;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
    for (const snd of cyc.sounds) {
      const f = snd.freqHz * 1.6;   // shifted up an octave-ish so laptop speakers can render it
      const start = Math.round(snd.t * sr), n = Math.round(snd.durS * sr);
      for (let i = 0; i < n && start + i < len; i++) {
        const x = i / sr;
        d[start + i] += snd.amp * 0.8 * Math.sin(2 * Math.PI * f * x) * Math.exp(-x / (snd.durS / 3)) * (1 - Math.exp(-x * 400));
      }
    }
    // Murmurs: white noise through a resonant filter, done in the time domain.
    for (const m of cyc.murmurs) {
      let y1 = 0, y2 = 0;
      const w0 = 2 * Math.PI * m.centreHz / sr, r = 0.985;
      const a1 = 2 * r * Math.cos(w0), a2 = -r * r;
      for (let i = 0; i < len; i++) {
        const tc = i / sr;
        const e = murmurEnvelope(m, tc);
        const y = (e > 0 ? rnd() * e : 0) * (1 - r) * 6 + a1 * y1 + a2 * y2;
        y2 = y1; y1 = y;
        d[i] += y * m.amp * 0.9;
      }
    }
    const src = ac.createBufferSource();
    src.buffer = buf; src.loop = true;
    const g = ac.createGain(); g.gain.value = 0.9;
    src.connect(g).connect(ac.destination);
    src.start();
    audio = { ctx: ac, stop: () => { try { src.stop(); ac.close(); } catch { /* already stopped */ } } };
  };
  const stopAudio = () => { audio?.stop(); audio = null; };

  /* ---- rendering the encounter ---------------------------------------------------- */
  const blockedText = (reason: string): string => {
    const [kind, rest] = reason.split(':');
    const items = (rest ?? '').split('|');
    if (kind === 'position') return lang === 'de'
      ? `Zuerst lagern: ${items.map((p) => POSITION[p]?.de ?? p).join(' oder ')}.`
      : `First position the patient: ${items.map((p) => POSITION[p]?.en ?? p).join(' or ')}.`;
    if (kind === 'exposure') return lang === 'de'
      ? `${items.map((x) => tr(CATALOG.structures[x]?.label, 'de')).join(', ')}: noch bedeckt.`
      : `The ${items.map((x) => tr(CATALOG.structures[x]?.label, 'en').toLowerCase()).join(', ')} ${items.length > 1 ? 'are' : 'is'} still covered.`;
    const first = s?.caseDef.patient.name.split(' ')[0] ?? '';
    if (kind === 'ability') return lang === 'de' ? `Das kann ${first} gerade nicht.` : `${first} can't do that right now.`;
    return lang === 'de' ? 'Dafür fehlt das Instrument.' : 'You need a different instrument for that.';
  };

  const sideWord = (sd?: Side) => (sd ? ` (${sd === 'L' ? t('left').toLowerCase() : t('right').toLowerCase()})` : '');

  const feedHtml = () => feed.map((it, idx) => {
    switch (it.k) {
      case 'scene': return `<div class="f-scene">${esc(tr(it.text, lang))}</div>`;
      case 'you': return `<div class="f-you"><span class="spk">${t('you')}</span>${esc(it.text)}</div>`;
      case 'patient': {
        const text = it.facts.length && s ? it.facts.map((id) => tr(s!.caseDef.history.find((f) => f.id === id)!.say, lang)).join(' ') : it.text;
        return `<div class="f-patient"><span class="spk">${esc(s?.caseDef.patient.name.split(' ')[0] ?? '')}</span>${esc(text)}</div>`;
      }
      case 'act': return `<div class="f-act">${esc(tr(CATALOG.manoeuvres[it.manoeuvre].label, lang))}${sideWord(it.side)}</div>`;
      case 'blocked': return `<div class="f-blocked">${esc(blockedText(it.reason))}</div>`;
      case 'finding': return `<div class="f-finding${it.finding.normal ? '' : ' abn'}">${esc(describe(s!, it.finding, lang))}</div>`;
      case 'order': return `<div class="f-act">${t('ordered')}: ${esc(tr(CATALOG.investigations[it.inv].label, lang))} · ${t('resultIn')} ${CATALOG.investigations[it.inv].turnaroundMinutes} ${t('min')}</div>`;
      case 'result': { const inv = CATALOG.investigations[it.inv]; return `<div class="f-finding result">${esc(REGISTRY.formatters[inv.formatter](it.value, {}, lang, CATALOG, { property: inv.id }))}</div>`; }
      case 'system': return `<div class="f-system">${esc(tr(it.text, lang))}</div>`;
      case 'side': {
        const last = idx === feed.length - 1;
        return `<div class="f-side">${esc(tr(CATALOG.manoeuvres[it.manoeuvre].label, lang))}: ${t('which')} ${last ? `<button type="button" class="tog" data-side-act="${it.manoeuvre}" data-side="L">${t('left')}</button> <button type="button" class="tog" data-side-act="${it.manoeuvre}" data-side="R">${t('right')}</button>` : ''}</div>`;
      }
    }
  }).join('');

  const notesHtml = (md: string) => md ? md.split('\n').map((l) => l.startsWith('## ') ? `<h3>${esc(l.slice(3))}</h3>` : l.startsWith('- ') ? `<p>${esc(l.slice(2))}</p>` : '').join('') : `<p class="muted">${t('noNotes')}</p>`;

  const renderEncounter = () => {
    if (!s) return;
    const c = s.caseDef;
    $('#pt-name').textContent = c.patient.name;
    $('#pt-meta').textContent = `${c.patient.age} · ${tr(c.setting.place, lang)}`;
    $('#clock').textContent = `${minutes()} ${t('min')}`;
    $('#wait').textContent = t('wait'); $('#to-commit').textContent = t('commit'); $('#leave').textContent = t('leave');
    ($('#cmd') as HTMLInputElement).placeholder = t('placeholder'); $('#send').textContent = t('send');
    $('#touch-hint').textContent = t('tapHint'); $('#whole').textContent = t('whole');
    for (const k of ['feed', 'notes', 'mine', 'results'] as const) {
      const b = $(`[data-tab="${k}"]`); b.textContent = t(k); b.setAttribute('aria-selected', String(tab === k));
      $(`#tab-${k}`).hidden = tab !== k;
    }
    $('#tab-feed').innerHTML = feedHtml();
    $('#tab-notes').innerHTML = notesHtml(autoNote(s, lang));
    ($('#mynotes') as HTMLTextAreaElement).placeholder = t('myNotesHint');
    const res = s.encounter.events.filter((e) => e.kind === 'result' && e.t <= s!.t);
    const pending = s.encounter.events.filter((e) => e.kind === 'result' && e.t > s!.t);
    $('#tab-results').innerHTML = (res.length || pending.length) ? [...res.map((e) => {
      if (e.kind !== 'result') return '';
      const inv = CATALOG.investigations[e.test];
      return `<p>${esc(REGISTRY.formatters[inv.formatter](e.value, {}, lang, CATALOG, { property: inv.id }))}</p>`;
    }), ...pending.map((e) => e.kind === 'result' ? `<p class="muted">${esc(tr(CATALOG.investigations[e.test].label, lang))} · ${t('resultIn')} ${Math.ceil((e.t - s!.t) / 60000)} ${t('min')}</p>` : '')].join('') : `<p class="muted">${t('noResults')}</p>`;
    root.querySelectorAll<HTMLButtonElement>('[data-side-act]').forEach((b) => b.onclick = () => { feed.pop(); doAction(b.dataset.sideAct!, b.dataset.side as Side); });
    const fe = $('#tab-feed'); fe.scrollTop = fe.scrollHeight;
    renderFigure();
    renderRegion();
  };

  /* ---- the patient figure ---------------------------------------------------------- */
  const renderFigure = () => {
    if (!s) return;
    const c = s.caseDef, st = s.state;
    const skin = SKIN[c.patient.appearance.skinTone - 1], shade = SHADE[c.patient.appearance.skinTone - 1];
    const fig = $('#figure');
    fig.style.setProperty('--skin', skin); fig.style.setProperty('--skin-shade', shade);
    const torso = ({ supine: -90, 'left-lateral': -90, prone: -90, 'reclined-45': -45, sitting: 0, 'sitting-forward': 12, standing: 0 } as Record<string, number>)[st.position] ?? 0;
    const inBed = st.position !== 'standing';
    ($('#fig-body') as unknown as SVGGElement).setAttribute('transform', `rotate(${torso} 180 226)`);
    ($('#fig-legs') as unknown as SVGGElement).setAttribute('transform', inBed ? 'rotate(-90 180 226)' : '');
    ($('#bed') as unknown as SVGGElement).style.opacity = inBed ? '1' : '0';
    const exposed = new Set(st.exposure ?? []);
    ($('#gown') as unknown as SVGElement).style.opacity = exposed.has('chest') ? '0' : '1';
    ($('#gown-low') as unknown as SVGElement).style.opacity = exposed.has('abdomen') ? '0' : '1';
    ($('#hair') as unknown as SVGElement).setAttribute('fill', /grey|gray/.test(c.patient.appearance.hair) ? '#b9b6b0' : /brown/.test(c.patient.appearance.hair) ? '#6b4a33' : '#3a2a20');
    $('#state-line').textContent = `${t('position')}: ${POSITION[st.position]?.[lang] ?? st.position} · ${t('exposed')}: ${exposed.size ? [...exposed].map((x) => tr(CATALOG.structures[x]?.label, lang)).join(', ') : t('nothing')}`;
  };

  const renderRegion = () => {
    const box = $('#region');
    if (!region || !s) { box.hidden = true; return; }
    box.hidden = false;
    const items = Object.values(CATALOG.manoeuvres).filter((m) => regionOf(m.target) === region!.id);
    const side = region.side;
    box.innerHTML = `<div class="region-head"><b>${esc(REGION_LABEL[region.id][lang])}${side ? sideWord(side) : ''}</b><button type="button" class="ghost small" id="region-close" aria-label="Close">×</button></div>
      <div class="region-list">${items.map((m) => {
        const label = esc(tr(m.label, lang));
        if (!m.paired || side) return `<button type="button" class="act" data-act="${m.id}" ${side ? `data-side="${side}"` : ''}>${label}</button>`;
        return `<div class="act-pair"><span>${label}</span><button type="button" class="tog small" data-act="${m.id}" data-side="R">${t('right')}</button><button type="button" class="tog small" data-act="${m.id}" data-side="L">${t('left')}</button></div>`;
      }).join('')}</div>`;
    box.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => b.onclick = () => doAction(b.dataset.act!, (b.dataset.side as Side) || undefined));
    $('#region-close').onclick = () => { region = null; renderRegion(); };
  };

  root.querySelectorAll<SVGElement>('[data-region]').forEach((el) => el.addEventListener('click', () => {
    region = { id: el.dataset.region!, side: (el.dataset.side as Side) || undefined };
    renderRegion();
  }));
  $('#whole').onclick = () => { region = { id: 'body' }; renderRegion(); };

  /* ---- commit and debrief ----------------------------------------------------------- */
  const renderCommit = () => {
    const box = $('#commit');
    box.hidden = false;
    $('#commit-title').textContent = t('commitTitle');
    $('#commit-hint').textContent = t('commitHint');
    ($('#ddx-q') as HTMLInputElement).placeholder = t('search');
    $('#commit-go').textContent = t('submit'); $('#commit-cancel').textContent = t('cancel');
    ($('#commit-go') as HTMLButtonElement).disabled = ddx.length === 0;
    const q = normalise(($('#ddx-q') as HTMLInputElement).value);
    const hits = q.length < 2 ? [] : Object.values(CATALOG.diagnoses).filter((d) => !ddx.some((x) => x.diagnosis === d.id)
      && [tr(d.label, 'en'), tr(d.label, 'de'), ...list(d.synonyms, 'en'), ...list(d.synonyms, 'de')].some((x) => normalise(x).includes(q))).slice(0, 8);
    $('#ddx-hits').innerHTML = hits.map((d) => `<button type="button" class="hit" data-dx="${d.id}">${esc(tr(d.label, lang))}</button>`).join('');
    root.querySelectorAll<HTMLButtonElement>('[data-dx]').forEach((b) => b.onclick = () => {
      ddx.push({ diagnosis: b.dataset.dx!, confidence: ddx.length ? 'possible' : 'likely' });
      ($('#ddx-q') as HTMLInputElement).value = ''; renderCommit(); ($('#ddx-q') as HTMLInputElement).focus();
    });
    $('#ddx-list').innerHTML = ddx.map((d, i) => `<li><span class="rank">${i + 1}</span><span class="dx">${esc(tr(CATALOG.diagnoses[d.diagnosis].label, lang))}</span>
      <select data-conf="${i}" aria-label="Confidence">${(['certain', 'likely', 'possible'] as const).map((c) => `<option value="${c}" ${d.confidence === c ? 'selected' : ''}>${t(c)}</option>`).join('')}</select>
      <button type="button" class="ghost small" data-up="${i}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button type="button" class="ghost small" data-rm="${i}" aria-label="Remove">×</button></li>`).join('');
    root.querySelectorAll<HTMLSelectElement>('[data-conf]').forEach((sel) => sel.onchange = () => { ddx[+sel.dataset.conf!].confidence = sel.value as Commit['confidence']; });
    root.querySelectorAll<HTMLButtonElement>('[data-rm]').forEach((b) => b.onclick = () => { ddx.splice(+b.dataset.rm!, 1); renderCommit(); });
    root.querySelectorAll<HTMLButtonElement>('[data-up]').forEach((b) => b.onclick = () => { const i = +b.dataset.up!; [ddx[i - 1], ddx[i]] = [ddx[i], ddx[i - 1]]; renderCommit(); });
  };

  const evidenceDetail = (e: DebriefResult['evidence'][number]): string => {
    if (!s || !e.elicited) return '';
    if (e.finding) return `<p class="finding">${esc(describe(s, e.finding, lang))}</p>`;
    if (e.item.kind === 'fact') { const f = s.caseDef.history.find((x) => x.id === e.item.ref); return f ? `<p class="finding">“${esc(tr(f.say, lang))}”</p>` : ''; }
    const r = s.encounter.events.find((x) => x.kind === 'result' && x.test === e.item.ref);
    if (r && r.kind === 'result') { const inv = CATALOG.investigations[r.test]; return `<p class="finding">${esc(REGISTRY.formatters[inv.formatter](r.value, {}, lang, CATALOG, { property: inv.id }))}${r.t > s.t ? (lang === 'de' ? ' (lag bei der Festlegung noch nicht vor)' : ' (not back when you committed)') : ''}</p>`; }
    return '';
  };

  const renderDebrief = () => {
    if (!s || !debrief) return;
    const d = debrief, c = s.caseDef;
    const dxName = (id: string) => esc(tr(CATALOG.diagnoses[id].label, lang));
    const weight = (w: string) => `<span class="pill ${w}">${t(w)}</span>`;
    const modelFindings = s.encounter.events.filter((e) => e.kind === 'finding' && e.finding.provenance === 'model' && e.finding.basis && !e.finding.normal);
    const seen = new Set<string>();
    $('#debrief').innerHTML = `
      <header class="db-head"><div><div class="eyebrow">${t('debrief')} · ${esc(c.patient.name)}</div><h1>${esc(tr(c.title, lang))}</h1></div>
        <button type="button" class="ghost" id="db-back">${t('again')}</button></header>
      <section class="verdict ${d.diagnosis.correct ? 'ok' : 'no'}">
        <b>${d.diagnosis.correct ? t('correct') : t('incorrect')}.</b> ${t('diagnosisWas')}: ${dxName(d.diagnosis.primary)}.
        ${d.diagnosis.rank && d.diagnosis.rank > 1 ? (lang === 'de' ? `Bei Ihnen auf Platz ${d.diagnosis.rank}.` : `You ranked it ${d.diagnosis.rank}.`) : ''}
        <div class="db-time">${t('time')}: ${d.minutes} ${t('min')} · ${t('budget')} ${d.budgetMinutes} ${t('min')}</div>
      </section>
      <section><h2>${t('expert')}</h2><p class="summary">${esc(tr(c.reference.summary, lang))}</p></section>
      <section><h2>${t('evidence')}</h2><ul class="evidence">${d.evidence.map((e) => `
        <li class="${e.elicited ? 'got' : 'miss'}"><div class="ev-top"><span class="mark">${e.elicited ? '✓' : '○'}</span>${weight(e.item.weight)}<span class="state">${e.elicited ? t('elicited') : t('missed')}</span></div>
        <p>${esc(tr(e.item.why, lang))}</p>${evidenceDetail(e)}</li>`).join('')}</ul></section>
      <section class="two"><div><h2>${t('redFlags')}</h2><ul class="plain">${d.redFlags.map((r) => `<li><span class="mark">${r.covered ? '✓' : '○'}</span> ${esc(tr(r.why, lang))} <span class="muted">(${r.covered ? t('covered') : t('uncovered')})</span></li>`).join('')}</ul></div>
        <div><h2>${t('hazards')}</h2>${d.hazards.length ? `<ul class="plain">${d.hazards.map((h) => `<li>${esc(tr(CATALOG.manoeuvres[h.manoeuvre]?.hazards?.find((x) => x.code === h.code)?.why ?? { en: h.code === 'no-consent' ? 'Examined without asking for consent first.' : h.code, de: h.code === 'no-consent' ? 'Ohne vorherige Einwilligung untersucht.' : h.code }, lang))}</li>`).join('')}</ul>` : `<p class="muted">${t('noHazards')}</p>`}</div></section>
      <section class="two"><div><h2>${t('ddxConsidered')}</h2><p>${d.diagnosis.differentialConsidered.map(dxName).join(', ') || '—'}</p></div>
        <div><h2>${t('ddxMissed')}</h2><p>${d.diagnosis.differentialMissed.map(dxName).join(', ') || '—'}</p></div></section>
      <section><h2>${t('how')}</h2><ul class="plain mono">${modelFindings.map((e) => {
        if (e.kind !== 'finding' || seen.has(e.finding.property)) return '';
        seen.add(e.finding.property);
        return `<li><b>${esc(tr(CATALOG.properties[e.finding.property.replace(/\.(L|R)$/, '')].label, lang))}</b> — ${esc(e.finding.basis!)}</li>`;
      }).join('') || '<li class="muted">—</li>'}</ul></section>
      <section><h2>${t('compare')}</h2><div class="two notes-compare"><div class="mine">${myNotes.trim() ? esc(myNotes).replace(/\n/g, '<br>') : '<span class="muted">—</span>'}</div><div class="auto">${notesHtml(autoNote(s, lang))}</div></div></section>`;
    $('#db-back').onclick = () => { renderWard(); show('ward'); };
  };

  /* ---- wiring ------------------------------------------------------------------------ */
  $('#cmdform').addEventListener('submit', (e) => { e.preventDefault(); const i = $('#cmd') as HTMLInputElement; const v = i.value; i.value = ''; submit(v); tab = 'feed'; renderEncounter(); });
  root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.onclick = () => { tab = b.dataset.tab as typeof tab; renderEncounter(); });
  ($('#mynotes') as HTMLTextAreaElement).addEventListener('input', (e) => { myNotes = (e.target as HTMLTextAreaElement).value; });
  $('#wait').onclick = () => { if (!s) return; const before = s.t; s.t += 10 * 60000; afterTime(before); renderEncounter(); };
  $('#leave').onclick = () => { setVisual(null); renderWard(); show('ward'); };
  $('#to-commit').onclick = () => { renderCommit(); ($('#ddx-q') as HTMLInputElement).focus(); };
  $('#ddx-q').addEventListener('input', renderCommit);
  $('#commit-cancel').onclick = () => { $('#commit').hidden = true; };
  $('#commit-go').onclick = () => {
    if (!s || !ddx.length) return;
    debrief = commit(s, ddx);
    $('#commit').hidden = true;
    setVisual(null);
    renderDebrief();
    show('debrief');
  };
  const setLang = () => {
    document.documentElement.lang = lang;
    root.querySelectorAll<HTMLButtonElement>('.langbtn').forEach((b) => b.textContent = lang === 'en' ? 'Deutsch' : 'English');
    renderWard();
    if (s) { s.encounter.locale = lang; renderEncounter(); if (visual) setVisual(visual); }
    if (debrief) renderDebrief();
    if (!$('#commit').hidden) renderCommit();
  };
  root.querySelectorAll<HTMLButtonElement>('.langbtn').forEach((b) => b.onclick = () => { lang = lang === 'en' ? 'de' : 'en'; setLang(); });

  setLang();
  show('ward');
}

const el = document.getElementById('vp');
if (el) mount(el);
