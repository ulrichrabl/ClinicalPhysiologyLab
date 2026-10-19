import { healthyModel, type PatientModel } from '../physiology/state.ts';
import { getPath, setPath } from '../physiology/models.ts';
import type { VariableDef } from '../physiology/types.ts';
import { CATALOG } from '../data/catalog.ts';
import { REGISTRY } from '../registry.ts';
import { observe } from '../engine/observe.ts';
import { FORMATTERS } from '../text/formatters.ts';
import { tr, type LocalizedText } from '../model/i18n.ts';
import { EYE_STATION, stationSettings } from '../stations/station.ts';
import { EYE_PRESETS, EYE_PRESET_GROUPS, EYE_STRUCTURES, applyEyePreset } from '../stations/eye-presets.ts';
import { eyeSignsOf, eyeView, eyeContext } from '../stations/eye-signs.ts';
import { explainEye, EYE_TESTS, EYE_TEST_LABEL, type EyeTest } from '../stations/eye-texts.ts';
import { sceneFindings, type SceneControls, type Scene } from '../render/eye-scene.ts';
import { EyeView } from '../render/eye-view.ts';
import { appearanceOf } from '../render/face-canvas.ts';
import { drawEyeMechanism, eyeMechanismHeight, type TracePoint } from '../render/eye-mechanism.ts';
import { KNOWLEDGE, labelOf } from '../knowledge/index.ts';
import { fmtValue } from './math.ts';
import type { Lang } from './diagrams.ts';
import { patientBanner, type StationHandle, type StationOptions } from './station-ecg.ts';
import type { ExamContext, Gaze, Side } from '../model/types.ts';

/* ---------------------------------------------------------------------------
   The eye station: Explore.

   A healthy adult's face, close up, examined test by test: pupils and lids,
   the swinging light, eye movements and pursuit, the cover test, nystagmus
   behind Frenzel goggles, the head impulse, the visual fields. The eyes are
   the eye view the encounter uses, drawn from the examination model's
   findings; beside them the pathway that test reads, lit by what the
   examiner is doing now. The settings are lesions of the nervous-system
   graph and a peripheral vestibular loss: nothing here decides how the eyes
   look.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });
const T: Record<string, LocalizedText> = {
  eyebrow: L('Station', 'Station'), back: L('Ward', 'Übersicht'),
  settings: L('What changes these eyes', 'Was diese Augen verändert'),
  settingsNote: L('Only the model settings that change this examination.', 'Nur die Modelleinstellungen, die diese Untersuchung verändern.'),
  startFrom: L('Start from', 'Ausgangspunkt'), choose: L('Choose a lesion…', 'Läsion wählen…'), healthy: L('Reset to healthy', 'Auf gesund zurücksetzen'),
  cutByHand: L('Cut a structure', 'Eine Struktur durchtrennen'),
  see: L('What you see', 'Was Sie sehen'), seeNote: L('The patient’s face, close up. The eyes move as the examination model computes them.', 'Das Gesicht des Patienten, aus der Nähe. Die Augen bewegen sich, wie das Untersuchungsmodell sie berechnet.'),
  test: L('Test', 'Test'), found: L('Findings', 'Befunde'),
  signsNow: L('Signs now', 'Zeichen jetzt'), noSigns: L('none: a normal eye examination', 'keine: eine normale Augenuntersuchung'), at: L('found with', 'gefunden mit'), compared: L('comparing tests', 'im Vergleich der Tests'),
  mechanism: L('The pathway this test reads', 'Die Bahn, die dieser Test prüft'),
  light: L('Light', 'Licht'), off: L('Off', 'Aus'), rightEye: L('Right eye', 'Rechtes Auge'), leftEye: L('Left eye', 'Linkes Auge'), alternate: L('Alternate', 'Abwechselnd'),
  room: L('Room light', 'Raumlicht'), dim: L('Dim light', 'Halbdunkel'),
  gaze: L('Gaze', 'Blick'), auto: L('Each in turn', 'Der Reihe nach'), primary: L('Ahead', 'Geradeaus'), left: L('Left', 'Links'), right: L('Right', 'Rechts'), up: L('Up', 'Oben'), down: L('Down', 'Unten'),
  pursuit: L('Follow a moving target', 'Bewegtem Ziel folgen'),
  cover: L('Cover', 'Abdecken'), uncovered: L('None', 'Keines'), coverR: L('Right eye', 'Rechtes Auge'), coverL: L('Left eye', 'Linkes Auge'),
  frenzel: L('Frenzel goggles (no fixation)', 'Frenzel-Brille (ohne Fixation)'), fixating: L('Fixating', 'Mit Fixation'),
  turnL: L('Turn head left', 'Kopf nach links'), turnR: L('Turn head right', 'Kopf nach rechts'),
  swing: L('The light swings from eye to eye every 1.6 s.', 'Das Licht wechselt alle 1,6 s von Auge zu Auge.'),
  fieldsNote: L('Confrontation, eye by eye: the pathway shows what each eye still sees.', 'Fingerperimetrie, Auge für Auge: Die Bahn zeigt, was jedes Auge noch sieht.'),
  face: L('The patient’s eyes, close up', 'Die Augen des Patienten, aus der Nähe'),
  diagram: L('Diagram of the pathway the test reads', 'Diagramm der Bahn, die der Test prüft'),
  complete: L('Complete lesion', 'Komplette Läsion'),
  side: L('Peripheral vestibular loss: side', 'Peripherer Vestibularisausfall: Seite'), none: L('None', 'Keine'),
  lift: L('Hold the lids up', 'Lider anheben'),
};
const SIDE2: Side[] = ['L', 'R'];
const GAZES: Gaze[] = ['primary', 'left', 'right', 'up', 'down'];
const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

interface Controls {
  light: Side | 'none' | 'alt'; ambient: 'room' | 'dim';
  gaze: Gaze | 'auto' | 'pursuit';
  cover: Side | 'none' | 'alt'; coverGaze: Gaze;
  fixation: boolean; nysGaze: Gaze;
  impulse: { to: Side; at: number } | null;
  lift: boolean;
}

export function mountEyeStation(host: HTMLElement, o: StationOptions): StationHandle {
  let lang = o.lang;
  const t = (k: string) => tr(T[k], lang);
  let model: PatientModel = structuredClone(o.patient?.model ?? healthyModel());
  let ev = eyeView(model);
  let test: EyeTest = 'pupils';
  const k: Controls = { light: 'alt', ambient: 'room', gaze: 'auto', cover: 'alt', coverGaze: 'primary', fixation: false, nysGaze: 'primary', impulse: null, lift: false };
  let t0 = performance.now();
  let view: EyeView | null = null;
  let trace: TracePoint[] = [];
  let ctxCache = eyeContext(model);
  let stopped = false;
  const settings = stationSettings(EYE_STATION);
  const open = new Set<string>(['nervous-system/lesions']);
  const signLabel = (x: string) => labelOf(KNOWLEDGE, `sign:${x}`, lang);
  const manoeuvreLabel = (m: string) => tr(CATALOG.manoeuvres[m]?.label ?? L(m, m), lang);

  /* what the examiner is doing now, as the eye view's controls */
  const controls = (now: number): SceneControls => {
    const el = Math.max(0, (now - t0) / 1000);
    const b: SceneControls = { gaze: 'primary', fixation: true, lightOn: 'none', ambient: 'room', cover: null, liftLids: k.lift };
    switch (test) {
      case 'pupils': return { ...b, ambient: k.ambient, lightOn: k.light === 'alt' ? (el % 6 < 2.4 ? 'R' : el % 6 >= 3 && el % 6 < 5.4 ? 'L' : 'none') : k.light };
      case 'swinging': return { ...b, lightOn: Math.floor(el / 1.6) % 2 ? 'L' : 'R' };
      case 'movements':
        if (k.gaze === 'pursuit') return { ...b, pursuit: el };
        return { ...b, gaze: k.gaze === 'auto' ? GAZES[Math.floor(el / 2.5) % 5] : k.gaze };
      case 'cover': return { ...b, gaze: k.coverGaze, cover: k.cover === 'alt' ? (Math.floor(el / 1.6) % 2 ? 'L' : 'R') : k.cover === 'none' ? null : k.cover };
      case 'nystagmus': return { ...b, fixation: k.fixation, gaze: k.nysGaze };
      case 'impulse': {
        /* an impulse every 2.4 s, alternating sides, unless the learner just asked for one */
        if (k.impulse && (now - k.impulse.at) / 1000 < 2.4) return { ...b, impulse: { to: k.impulse.to, t: (now - k.impulse.at) / 1000 } };
        const n = Math.floor(el / 2.4), ph = el % 2.4;
        return { ...b, impulse: ph < 1 ? { to: n % 2 ? 'R' : 'L', t: ph } : undefined };
      }
      case 'fields': return b;
    }
  };

  const head = () => `<div class="st-head">
        <button type="button" class="ghost" data-leave>← ${o.backLabel ? tr(o.backLabel, lang) : t('back')}</button>
        <div class="st-title"><div class="eyebrow">${t('eyebrow')}</div><h1>${esc(tr(EYE_STATION.title, lang))}</h1><p class="lede">${esc(tr(EYE_STATION.summary, lang))}</p></div>
      </div>
      ${patientBanner(o, lang)}`;
  const seg = (attr: string, items: Array<[string, string]>, cur: string, label: string) =>
    `<span class="seg" role="radiogroup" aria-label="${esc(label)}">${items.map(([v, lab]) => `<button type="button" role="radio" aria-checked="${v === cur}" ${attr}="${v}">${esc(lab)}</button>`).join('')}</span>`;
  const liftBox = () => `<label class="st-check st-lift"><input type="checkbox" data-lift ${k.lift ? 'checked' : ''}> ${t('lift')}</label>`;
  const testControls = () => {
    const lift = test === 'pupils' || test === 'movements' || test === 'cover' || test === 'swinging' ? liftBox() : '';
    return lift + testControlsOf();
  };
  const testControlsOf = () => {
    switch (test) {
      case 'pupils': return `${seg('data-light', [['alt', t('alternate')], ['none', t('off')], ['R', t('rightEye')], ['L', t('leftEye')]], k.light, t('light'))}
        ${seg('data-ambient', [['room', t('room')], ['dim', t('dim')]], k.ambient, t('light'))}`;
      case 'swinging': return `<span class="muted small">${t('swing')}</span>`;
      case 'movements': return seg('data-gaze', [['auto', t('auto')], ...GAZES.map((g) => [g, t(g)] as [string, string]), ['pursuit', t('pursuit')]], k.gaze, t('gaze'));
      case 'cover': return `${seg('data-cover', [['alt', t('alternate')], ['none', t('uncovered')], ['R', t('coverR')], ['L', t('coverL')]], k.cover, t('cover'))}
        ${seg('data-cgaze', (['up', 'primary', 'down'] as Gaze[]).map((g) => [g, t(g)] as [string, string]), k.coverGaze, t('gaze'))}`;
      case 'nystagmus': return `${seg('data-fix', [['0', t('frenzel')], ['1', t('fixating')]], k.fixation ? '1' : '0', t('frenzel'))}
        ${seg('data-ngaze', (['left', 'primary', 'right', 'up', 'down'] as Gaze[]).map((g) => [g, t(g)] as [string, string]), k.nysGaze, t('gaze'))}`;
      case 'impulse': return `<span class="st-row-buttons"><button type="button" class="ghost" data-hit="L">${t('turnL')}</button><button type="button" class="ghost" data-hit="R">${t('turnR')}</button></span>`;
      case 'fields': return `<span class="muted small">${t('fieldsNote')}</span>`;
    }
  };

  const render = () => {
    host.innerHTML = `${head()}
      <div class="st-grid">
        <aside class="panel st-settings" aria-labelledby="st-set-h">
          <h2 id="st-set-h">${t('settings')}</h2>
          <p class="layer-note">${t('settingsNote')}</p>
          <label class="st-preset">${t('startFrom')}
            <select data-preset><option value="">${t('choose')}</option>${EYE_PRESET_GROUPS.map((g) => `<optgroup label="${esc(tr(g.group, lang))}">${g.ids.map((id) => EYE_PRESETS.find((p) => p.id === id)!).map((p) => `<option value="${p.id}">${esc(tr(p.label, lang))}</option>`).join('')}</optgroup>`).join('')}</select>
          </label>
          <button type="button" class="ghost small" data-healthy>${t('healthy')}</button>
          <div data-controls></div>
        </aside>
        <div class="st-main">
          <section class="panel st-signal" aria-labelledby="st-see-h">
            <div class="st-row"><div><h2 id="st-see-h">${t('see')}</h2><div class="muted small">${t('seeNote')}</div></div></div>
            <div class="st-tests" role="tablist" aria-label="${t('test')}">${EYE_TESTS.map((x) => `<button type="button" role="tab" class="tog" aria-selected="${x === test}" data-test="${x}">${esc(tr(EYE_TEST_LABEL[x], lang))}</button>`).join('')}</div>
            <div class="st-listen" data-test-controls>${testControls()}</div>
            <div class="eyehost st-eyes" role="img" aria-label="${t('face')}"></div>
            <ul class="st-findings plain small" data-findings aria-live="polite"></ul>
            <div class="st-signs" data-signs aria-live="polite"></div>
          </section>
          <section class="panel st-why st-why-wide" aria-labelledby="st-why-h">
            <div class="st-row"><div><h2>${t('mechanism')}</h2></div></div>
            <canvas class="st-mech" aria-label="${t('diagram')}"></canvas>
            <div class="st-text"><h3 id="st-why-h" data-title></h3><div data-body></div></div>
          </section>
        </div>
      </div>`;
    renderControls();
    wire();
    startView();
    renderFindings();
  };

  /* ---- settings ----------------------------------------------------------------------------------------------------------- */
  const renderControls = () => {
    const box = host.querySelector<HTMLElement>('[data-controls]')!;
    const cut = new Set(model.lesions.nodes);
    const control = (v: VariableDef) => {
      const val = getPath(model, v.key);
      const label = esc(tr(v.label, lang));
      if (v.control === 'lesions') return EYE_STRUCTURES.map((g) => `<fieldset class="st-lesions"><legend>${esc(tr(g.group, lang))}</legend>${g.nodes.map((n) =>
        `<label class="st-var st-check"><input type="checkbox" data-node="${n.id}" ${cut.has(n.id) ? 'checked' : ''}><span>${esc(tr(n.label, lang))}</span></label>`).join('')}</fieldset>`).join('');
      if (v.control === 'toggle') return `<label class="st-var st-check"><input type="checkbox" data-k="${v.key}" ${val ? 'checked' : ''}><span>${label}</span></label>`;
      if (v.control === 'side') return `<label class="st-var"><span>${label}</span><select data-k="${v.key}">${([['none', t('none')], ['L', t('left')], ['R', t('right')]] as const).map(([x, lab]) => `<option value="${x}" ${x === val ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select></label>`;
      return `<label class="st-var"><span>${label} <output data-out="${v.key}">${esc(fmtValue(v, val, lang))} ${esc(v.unit)}</output></span>
        <input type="range" data-k="${v.key}" min="${v.min}" max="${v.max}" step="${v.step}" value="${Number(val)}"></label>`;
    };
    box.innerHTML = settings.map((g) => `<details class="grp" data-sec="${g.id}" ${open.has(g.id) ? 'open' : ''}><summary>${esc(tr(g.label, lang))}</summary>
      ${g.why ? `<p class="muted small">${esc(tr(g.why, lang))}</p>` : ''}${g.vars.map(control).join('')}</details>`).join('');
    box.querySelectorAll<HTMLDetailsElement>('details[data-sec]').forEach((d) => d.addEventListener('toggle', () => { d.open ? open.add(d.dataset.sec!) : open.delete(d.dataset.sec!); }));
    box.querySelectorAll<HTMLInputElement>('[data-node]').forEach((el) => el.addEventListener('change', () => {
      const next = structuredClone(model), id = el.dataset.node!;
      next.lesions.nodes = el.checked ? [...new Set([...next.lesions.nodes, id])] : next.lesions.nodes.filter((x) => x !== id);
      change(next);
    }));
    box.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-k]').forEach((el) => {
      const key = el.dataset.k!;
      const handler = () => {
        let v: unknown;
        if (el instanceof HTMLInputElement && el.type === 'checkbox') v = el.checked;
        else if (el instanceof HTMLInputElement) v = Number(el.value);
        else v = el.value;
        const next = structuredClone(model);
        setPath(next, key, v);
        change(next);
        const out = box.querySelector<HTMLOutputElement>(`[data-out="${CSS.escape(key)}"]`);
        const def = settings.flatMap((g) => g.vars).find((x) => x.key === key);
        if (out && def) out.textContent = `${fmtValue(def, v as number, lang)} ${def.unit}`;
      };
      el.addEventListener(el instanceof HTMLInputElement && el.type === 'range' ? 'input' : 'change', handler);
    });
  };
  const change = (next: PatientModel) => {
    model = next;
    ev = eyeView(model);
    ctxCache = eyeContext(model);
    view?.invalidate();
    renderFindings();
  };

  /* ---- the eyes and the pathway --------------------------------------------------------------------------------------- */
  const css = (n: string) => getComputedStyle(host).getPropertyValue(n).trim() || '#888';
  const startView = () => {
    view?.stop();
    const eh = host.querySelector<HTMLElement>('.st-eyes')!;
    view = new EyeView(eh, appearanceOf(ev.c.patient as any, 7));
    trace = [];
    const canvas = host.querySelector<HTMLCanvasElement>('.st-mech')!;
    const colors = { fg: css('--fg'), muted: css('--muted'), accent: css('--accent'), abn: css('--abn'), line: css('--line'), surface: css('--surface'), light: '#e8a317' };
    view.show((sc) => sceneFindings(CATALOG, REGISTRY, ev.c, ev.view, sc), controls, (sc: Scene, kk: SceneControls, now: number) => {
      if (stopped) return;
      trace.push({ t: now / 1000, h: sc.R.h, v: sc.R.v, head: sc.head, vR: sc.R.v, vL: sc.L.v });
      while (trace.length && trace[0].t < now / 1000 - 8) trace.shift();
      const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth || 600, h = eyeMechanismHeight(test, w);
      if (canvas.style.height !== `${h}px`) canvas.style.height = `${h}px`;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      const g = canvas.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawEyeMechanism(g, w, h, { test, s: ctxCache.s, lesions: new Set(model.lesions.nodes), controls: kk, scene: sc, trace, verticalPD: ctxCache.verticalPD, gain: ctxCache.gain, lang, colors });
    });
  };

  /* what the examiner would write down for this test, as the encounter words it */
  const findingLines = (): string[] => {
    const o = (ref: string, ctx: ExamContext = {}) => {
      const f = observe(CATALOG, REGISTRY.resolvers, ev.c, ev.view, ref, ctx);
      const prop = ref.replace(/\.(L|R)$/, ''), side = /\.(L|R)$/.exec(ref)?.[1] as Side | undefined;
      const text = FORMATTERS[CATALOG.properties[prop]?.formatter ?? prop]?.(f.value, ctx, lang, CATALOG, { property: prop, side } as any) ?? JSON.stringify(f.value);
      return { text, normal: f.normal };
    };
    const side = (S: Side) => (S === 'L' ? t('leftEye') : t('rightEye'));
    const line = (label: string | null, r: { text: string; normal: boolean }) => `${r.normal ? '' : '<b class="abn" aria-label="abnormal">●</b> '}${label ? `<b>${esc(label)}</b>: ` : ''}${esc(r.text)}`;
    const out: string[] = [];
    switch (test) {
      case 'pupils':
        for (const S of ['R', 'L'] as Side[]) out.push(line(null, o(`eye.pupil.${S}`, { lightOn: 'none', ambient: 'room' })));
        for (const S of ['R', 'L'] as Side[]) out.push(line(null, o(`eye.pupil.${S}`, { lightOn: 'none', ambient: 'dim' })));
        for (const lit of ['R', 'L'] as Side[]) for (const S of ['R', 'L'] as Side[]) out.push(line(`${t('light')} → ${side(lit)}`, o(`eye.pupil.${S}`, { lightOn: lit, ambient: 'room' })));
        for (const S of ['R', 'L'] as Side[]) out.push(line(null, o(`eye.lid.${S}`)));
        break;
      case 'swinging': out.push(line(null, o('eyes.swinging-light'))); break;
      case 'movements':
        for (const S of ['R', 'L'] as Side[]) out.push(line(null, o(`eye.motility.${S}`)));
        for (const g of GAZES) out.push(line(null, o('eyes.nystagmus', { gaze: g, fixation: true })));
        out.push(line(null, o('eyes.pursuit')));
        break;
      case 'cover': for (const g of ['up', 'primary', 'down'] as Gaze[]) out.push(line(t(g), o('eyes.alignment', { gaze: g }))); break;
      case 'nystagmus': for (const g of ['left', 'primary', 'right'] as Gaze[]) out.push(line(null, o('eyes.nystagmus', { gaze: g, fixation: false }))); break;
      case 'impulse': for (const S of ['L', 'R'] as Side[]) out.push(line(null, o(`eye.head-impulse.${S}`, { headImpulseTo: S }))); break;
      case 'fields': for (const S of ['R', 'L'] as Side[]) out.push(line(null, o(`eye.field.${S}`))); break;
    }
    return out;
  };
  const renderFindings = () => {
    const box = host.querySelector<HTMLElement>('[data-findings]');
    if (!box) return;
    box.innerHTML = findingLines().map((x) => `<li>${x}</li>`).join('');
    const r = eyeSignsOf(model);
    const sb = host.querySelector<HTMLElement>('[data-signs]')!;
    sb.innerHTML = `<span class="muted small">${t('signsNow')}:</span> ${r.present.size
      ? [...r.present].map((x) => { const w = r.where.get(x) ?? []; return `<span class="sign" title="${esc(`${t('at')}: ${w.length ? w.map(manoeuvreLabel).join('; ') : t('compared')}`)}">${esc(signLabel(x))}</span>`; }).join('')
      : `<span class="muted small">${t('noSigns')}</span>`}`;
    const ex = explainEye(test, ctxCache);
    host.querySelector<HTMLElement>('[data-title]')!.textContent = tr(ex.title, lang);
    host.querySelector<HTMLElement>('[data-body]')!.innerHTML = ex.body.map((p) => `<p>${esc(tr(p, lang))}</p>`).join('');
  };

  const wire = () => {
    host.querySelector<HTMLButtonElement>('[data-leave]')!.onclick = () => { stop(); o.onLeave(); };
    host.querySelector<HTMLSelectElement>('[data-preset]')!.onchange = (e) => {
      const id = (e.target as HTMLSelectElement).value;
      if (!id) return;
      const p = EYE_PRESETS.find((x) => x.id === id);
      change(applyEyePreset(model, id));
      if (p) { test = p.look; t0 = performance.now(); k.lift = SIDE2.some((S) => ctxCache.s.ptosisMm[S] >= 7); }
      render();
      host.querySelector<HTMLSelectElement>('[data-preset]')!.value = id;
    };
    host.querySelector<HTMLButtonElement>('[data-healthy]')!.onclick = () => { change(applyEyePreset(model, '')); render(); };
    host.querySelectorAll<HTMLButtonElement>('[data-test]').forEach((b) => b.onclick = () => { test = b.dataset.test as EyeTest; t0 = performance.now(); render(); });
    wireTestControls();
  };
  const wireTestControls = () => {
    const box = host.querySelector<HTMLElement>('[data-test-controls]')!;
    const on = (attr: string, f: (v: string) => void) => box.querySelectorAll<HTMLButtonElement>(`[${attr}]`).forEach((b) => b.onclick = () => {
      f(b.getAttribute(attr)!); t0 = performance.now();
      box.innerHTML = testControls(); wireTestControls();
    });
    on('data-light', (v) => { k.light = v as Controls['light']; });
    on('data-ambient', (v) => { k.ambient = v as Controls['ambient']; });
    on('data-gaze', (v) => { k.gaze = v as Controls['gaze']; });
    on('data-cover', (v) => { k.cover = v as Controls['cover']; });
    on('data-cgaze', (v) => { k.coverGaze = v as Gaze; });
    on('data-fix', (v) => { k.fixation = v === '1'; });
    on('data-ngaze', (v) => { k.nysGaze = v as Gaze; });
    const lb = box.querySelector<HTMLInputElement>('[data-lift]');
    if (lb) lb.onchange = () => { k.lift = lb.checked; };
    box.querySelectorAll<HTMLButtonElement>('[data-hit]').forEach((b) => b.onclick = () => { k.impulse = { to: b.dataset.hit as Side, at: performance.now() }; });
  };

  const stop = () => { stopped = true; view?.stop(); };
  render();
  return {
    stop,
    setLang(l: Lang) { lang = l; render(); },
  };
}
