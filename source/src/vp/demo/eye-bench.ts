/* Eye exam bench: the vestibular/ocular-motor model drawn and animated.
   Bundled into a standalone page by scripts/build-vp-demo.mjs. */
import { CATALOG } from '../data/catalog.ts';
import { REGISTRY } from '../registry.ts';
import { CASES } from '../index.ts';
import { buildView } from '../engine/view.ts';
import { observe } from '../engine/observe.ts';
import type { CaseDef, ExamContext, Gaze, Side } from '../model/types.ts';
import { scene, sceneFindings, type SceneControls, type SceneFindings, type Scene } from '../render/eye-scene.ts';

type Lang = 'en' | 'de';

const BASE = CASES.find((c) => c.id === 'vestibular-neuritis-left')!;
const variant = (patch: (c: CaseDef) => void): CaseDef => { const c = JSON.parse(JSON.stringify(BASE)); patch(c); return c; };
const lesion = (nodes: string[]) => variant((c) => { delete c.pathology.conditions; c.pathology.lesions = [{ nodes }]; });

const PATIENTS: Array<{ id: string; label: Record<Lang, string>; note: Record<Lang, string>; c: CaseDef }> = [
  { id: 'neuritis', label: { en: 'Left vestibular neuritis', de: 'Neuritis vestibularis links' },
    note: { en: 'Peripheral: left labyrinth and nerve at 20%, day 1.', de: 'Peripher: linkes Labyrinth und Nerv bei 20 %, Tag 1.' }, c: BASE },
  { id: 'neuritis-day10', label: { en: 'Same, day 10', de: 'Dieselbe, Tag 10' },
    note: { en: 'Central compensation has damped the nystagmus; the head impulse stays abnormal.', de: 'Die zentrale Kompensation hat den Nystagmus gedämpft; der Kopfimpulstest bleibt pathologisch.' },
    c: variant((c) => { c.pathology.conditions![0].params!.daysSinceOnset = 10; }) },
  { id: 'wallenberg', label: { en: 'Left lateral medulla', de: 'Laterale Medulla links' },
    note: { en: 'Wallenberg: the nodes of the graph’s lateral medullary syndrome.', de: 'Wallenberg: die Knoten des lateralen Medulla-Syndroms im Graphen.' },
    c: lesion(['L_cn5_sens', 'L_lat_bs', 'L_icp', 'L_cn9_nuc', 'L_cn10_nuc', 'L_stt_asc']) },
  { id: 'cerebellum', label: { en: 'Left cerebellum', de: 'Kleinhirn links' },
    note: { en: 'Leaky gaze holding: the integrator time constant falls from 25 s to 3 s.', de: 'Gestörtes Blickhalten: die Zeitkonstante des Integrators fällt von 25 s auf 3 s.' }, c: lesion(['L_cerebellum']) },
  { id: 'cn3', label: { en: 'Left CN III', de: 'N. oculomotorius links' }, note: { en: 'Complete oculomotor palsy.', de: 'Komplette Okulomotoriusparese.' }, c: lesion(['L_cn3']) },
  { id: 'cn6', label: { en: 'Left CN VI', de: 'N. abducens links' }, note: { en: 'Complete abducens palsy.', de: 'Komplette Abduzensparese.' }, c: lesion(['L_cn6']) },
  { id: 'cn2', label: { en: 'Left optic nerve', de: 'N. opticus links' }, note: { en: 'Afferent defect: try the light in each eye.', de: 'Afferenzstörung: Licht abwechselnd in beide Augen.' }, c: lesion(['L_cn2']) },
  { id: 'healthy', label: { en: 'Healthy', de: 'Gesund' }, note: { en: 'No lesion.', de: 'Keine Läsion.' }, c: variant((c) => { delete c.pathology.conditions; }) },
];

const T: Record<string, Record<Lang, string>> = {
  patient: { en: 'Patient', de: 'Patient' }, gaze: { en: 'Gaze', de: 'Blickrichtung' }, light: { en: 'Pen torch', de: 'Pupillenleuchte' },
  off: { en: 'Off', de: 'Aus' }, leftEye: { en: 'Left eye', de: 'Linkes Auge' }, rightEye: { en: 'Right eye', de: 'Rechtes Auge' },
  frenzel: { en: 'Frenzel lenses', de: 'Frenzel-Brille' }, dim: { en: 'Dim the room', de: 'Raum abdunkeln' },
  hit: { en: 'Head impulse', de: 'Kopfimpuls' }, toLeft: { en: 'To the left', de: 'Nach links' }, toRight: { en: 'To the right', de: 'Nach rechts' },
  cover: { en: 'Alternate cover', de: 'Alternierend abdecken' }, findings: { en: 'Findings', de: 'Befund' },
  trace: { en: 'Eye position, horizontal (VNG)', de: 'Augenposition horizontal (VNG)' },
  torsion: { en: 'torsion', de: 'Torsion' }, basis: { en: 'Model basis', de: 'Modellgrundlage' },
  examining: { en: 'Examining', de: 'Untersuchung' },
};

export function mount(root: HTMLElement) {
  let lang: Lang = (navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';
  let patient = PATIENTS[0];
  let view = buildView(patient.c);
  const k: SceneControls = { gaze: 'primary', fixation: true, lightOn: 'none', ambient: 'room', cover: null };
  let findings: SceneFindings = sceneFindings(CATALOG, REGISTRY, patient.c, view, k);
  let impulseStart = -1, impulseTo: Side = 'L', lastImpulse: Side | null = null;
  let coverOn = false, coverStart = 0;
  const $ = (sel: string) => root.querySelector(sel) as HTMLElement;

  const refresh = () => { findings = sceneFindings(CATALOG, REGISTRY, patient.c, view, k); renderText(); };

  /* ---- controls ------------------------------------------------------------ */
  const chips = $('#patients');
  const buildChips = () => {
    chips.innerHTML = '';
    for (const p of PATIENTS) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = p.label[lang];
      b.setAttribute('aria-pressed', String(p === patient));
      b.onclick = () => { patient = p; view = buildView(p.c); lastImpulse = null; buildChips(); refresh(); };
      chips.appendChild(b);
    }
    $('#patient-note').textContent = patient.note[lang];
  };
  const press = (sel: string, on: boolean) => $(sel)?.setAttribute('aria-pressed', String(on));
  const syncControls = () => {
    for (const g of ['primary', 'left', 'right', 'up', 'down']) press(`[data-gaze="${g}"]`, k.gaze === g);
    for (const l of ['none', 'L', 'R']) press(`[data-light="${l}"]`, k.lightOn === l);
    press('#frenzel', !k.fixation); press('#dim', k.ambient === 'dim'); press('#cover', coverOn);
    root.classList.toggle('is-frenzel', !k.fixation);
    root.classList.toggle('is-dim', k.ambient === 'dim');
  };
  root.querySelectorAll<HTMLElement>('[data-gaze]').forEach((b) => b.onclick = () => { k.gaze = b.dataset.gaze as Gaze; syncControls(); refresh(); });
  root.querySelectorAll<HTMLElement>('[data-light]').forEach((b) => b.onclick = () => { k.lightOn = b.dataset.light as Side | 'none'; syncControls(); refresh(); });
  $('#frenzel').onclick = () => { k.fixation = !k.fixation; syncControls(); refresh(); };
  $('#dim').onclick = () => { k.ambient = k.ambient === 'dim' ? 'room' : 'dim'; syncControls(); refresh(); };
  $('#cover').onclick = () => { coverOn = !coverOn; coverStart = performance.now(); if (!coverOn) k.cover = null; syncControls(); refresh(); };
  root.querySelectorAll<HTMLElement>('[data-hit]').forEach((b) => b.onclick = () => {
    impulseTo = b.dataset.hit as Side; impulseStart = performance.now(); lastImpulse = impulseTo; renderText();
  });
  $('#lang').onclick = () => { lang = lang === 'en' ? 'de' : 'en'; applyLang(); };

  const applyLang = () => {
    document.documentElement.lang = lang;
    $('#lang').textContent = lang === 'en' ? 'Deutsch' : 'English';
    root.querySelectorAll<HTMLElement>('[data-t]').forEach((el) => { el.textContent = T[el.dataset.t!][lang]; });
    root.querySelectorAll<HTMLElement>('[data-gaze]').forEach((el) => {
      const g = el.dataset.gaze!;
      el.setAttribute('aria-label', ({ primary: ['Look straight ahead', 'Geradeaus'], left: ['Look left', 'Nach links'], right: ['Look right', 'Nach rechts'], up: ['Look up', 'Nach oben'], down: ['Look down', 'Nach unten'] } as any)[g][lang === 'en' ? 0 : 1]);
    });
    buildChips(); renderText();
  };

  /* ---- findings as text, through the same formatters as the notes ------------ */
  const say = (ref: string, ctx: ExamContext = {}) => {
    const f = observe(CATALOG, REGISTRY.resolvers, patient.c, view, ref, ctx);
    const m = /^(.*)\.(L|R)$/.exec(ref);
    const prop = m ? m[1] : ref;
    const text = REGISTRY.formatters[CATALOG.properties[prop].formatter](f.value, ctx, lang, CATALOG, { property: prop, side: m?.[2] as Side });
    return { text, normal: f.normal, basis: f.basis };
  };
  const renderText = () => {
    const rows: Array<{ text: string; normal: boolean }> = [];
    const nys = say('eyes.nystagmus', { gaze: k.gaze, fixation: k.fixation });
    rows.push(nys);
    const light: ExamContext = { lightOn: k.lightOn, ambient: k.ambient };
    rows.push(say('eye.pupil.R', light), say('eye.pupil.L', light));
    for (const S of ['R', 'L'] as Side[]) { const l = say(`eye.lid.${S}`); if (!l.normal) rows.push(l); }
    for (const S of ['R', 'L'] as Side[]) { const m = say(`eye.motility.${S}`); if (!m.normal) rows.push(m); }
    if (coverOn) rows.push(say('eyes.alignment', { coverEye: k.cover ?? 'none' }));
    if (lastImpulse) rows.push(say(`eye.head-impulse.${lastImpulse}`, { headImpulseTo: lastImpulse }));
    const list = $('#findings');
    list.innerHTML = '';
    for (const r of rows) {
      const li = document.createElement('li');
      li.textContent = r.text;
      if (!r.normal) li.className = 'abn';
      list.appendChild(li);
    }
    const basis = [nys.basis, lastImpulse ? say(`eye.head-impulse.${lastImpulse}`).basis : ''].filter(Boolean).join(' · ');
    $('#basis').textContent = basis || '—';
  };

  /* ---- drawing ------------------------------------------------------------------ */
  const svg = $('#stage');
  const face = svg.querySelector('#face') as SVGGElement;
  const eyes: Record<Side, { iris: SVGGElement; pupil: SVGCircleElement; lid: SVGPathElement; occluder: SVGRectElement; glow: SVGCircleElement }> = {} as any;
  for (const S of ['L', 'R'] as Side[]) {
    eyes[S] = {
      iris: svg.querySelector(`#iris-${S}`) as SVGGElement,
      pupil: svg.querySelector(`#pupil-${S}`) as SVGCircleElement,
      lid: svg.querySelector(`#lid-${S}`) as SVGPathElement,
      occluder: svg.querySelector(`#occ-${S}`) as SVGRectElement,
      glow: svg.querySelector(`#glow-${S}`) as SVGCircleElement,
    };
  }
  // Patient's right eye is on the viewer's left.
  const CX: Record<Side, number> = { R: 150, L: 290 };
  const CY = 110, PX_PER_DEG = 0.95, PX_PER_MM = 3.4, IRIS_R = 24;
  const pupilShown: Record<Side, number> = { L: 4, R: 4 };

  const canvas = $('#trace') as unknown as HTMLCanvasElement;
  const ctx2d = canvas.getContext('2d')!;
  const WINDOW_S = 4;
  const samples: Array<{ t: number; L: number; R: number; tor: number }> = [];

  const draw = (now: number) => {
    const t = now / 1000;
    if (coverOn) k.cover = Math.floor((now - coverStart) / 1600) % 2 === 0 ? 'R' : 'L';
    k.impulse = impulseStart >= 0 && now - impulseStart < 1000 ? { to: impulseTo, t: (now - impulseStart) / 1000 } : undefined;
    const sc: Scene = scene(findings, k, t);

    face.setAttribute('transform', `translate(${(-sc.head * 2.4).toFixed(2)} 0)`);
    for (const S of ['L', 'R'] as Side[]) {
      const e = sc[S], el = eyes[S];
      const inOrbit = e.h - sc.head;
      const x = CX[S] - inOrbit * PX_PER_DEG, y = CY - e.v * PX_PER_DEG;
      el.iris.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(-e.torsion).toFixed(2)})`);
      pupilShown[S] += (e.pupilMm - pupilShown[S]) * 0.12;   // pupils move in ~0.3 s, not instantly
      el.pupil.setAttribute('r', (pupilShown[S] / 2 * PX_PER_MM).toFixed(2));
      const drop = Math.min(e.ptosisMm, 9) * PX_PER_MM;
      el.lid.setAttribute('transform', `translate(0 ${drop.toFixed(2)})`);
      el.occluder.style.opacity = sc.covered === S ? '0.92' : '0';
      el.glow.style.opacity = k.lightOn === S ? '1' : '0';
    }

    samples.push({ t, L: sc.L.h - sc.head, R: sc.R.h - sc.head, tor: sc.R.torsion });
    while (samples.length && samples[0].t < t - WINDOW_S) samples.shift();
    drawTrace(t);
    requestAnimationFrame(draw);
  };

  const css = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();
  const drawTrace = (t: number) => {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2d.clearRect(0, 0, w, h);
    const lanes = { pos: { top: 8, h: h * 0.68 - 8, range: 40 }, tor: { top: h * 0.72, h: h * 0.28 - 8, range: 6 } };
    const xOf = (ts: number) => w - (t - ts) / WINDOW_S * w;
    ctx2d.lineWidth = 1;
    ctx2d.strokeStyle = css('--grid');
    ctx2d.font = `11px ${css('--font-mono')}`;
    ctx2d.fillStyle = css('--muted');
    for (let s = Math.ceil(t - WINDOW_S); s <= t; s++) { const x = xOf(s); ctx2d.beginPath(); ctx2d.moveTo(x, 0); ctx2d.lineTo(x, h); ctx2d.stroke(); }
    for (const deg of [-30, -20, -10, 0, 10, 20, 30]) {
      const y = lanes.pos.top + lanes.pos.h / 2 - deg / lanes.pos.range * lanes.pos.h / 2;
      ctx2d.strokeStyle = deg === 0 ? css('--grid-strong') : css('--grid');
      ctx2d.beginPath(); ctx2d.moveTo(0, y); ctx2d.lineTo(w, y); ctx2d.stroke();
      if (deg !== 0 && deg % 20 === 0) ctx2d.fillText(`${deg > 0 ? 'R' : 'L'} ${Math.abs(deg)}°`, 4, y - 3);
    }
    const torMid = lanes.tor.top + lanes.tor.h / 2;
    ctx2d.strokeStyle = css('--grid-strong'); ctx2d.beginPath(); ctx2d.moveTo(0, torMid); ctx2d.lineTo(w, torMid); ctx2d.stroke();
    ctx2d.fillText(T.torsion[lang], 4, lanes.tor.top + 10);
    const line = (key: 'L' | 'R' | 'tor', color: string, lane: { top: number; h: number; range: number }, dash: number[] = []) => {
      ctx2d.strokeStyle = color; ctx2d.lineWidth = 1.6; ctx2d.setLineDash(dash); ctx2d.beginPath();
      samples.forEach((p, i) => {
        const y = lane.top + lane.h / 2 - Math.max(-lane.range, Math.min(lane.range, p[key])) / lane.range * lane.h / 2;
        if (i) ctx2d.lineTo(xOf(p.t), y); else ctx2d.moveTo(xOf(p.t), y);
      });
      ctx2d.stroke(); ctx2d.setLineDash([]);
    };
    line('R', css('--right-eye'), lanes.pos);
    line('L', css('--left-eye'), lanes.pos, [5, 3]);
    line('tor', css('--muted'), lanes.tor);
  };

  syncControls(); applyLang();
  requestAnimationFrame(draw);
}

const el = document.getElementById('bench');
if (el) mount(el);
