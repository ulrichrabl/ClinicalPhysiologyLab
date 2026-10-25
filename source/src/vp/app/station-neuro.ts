import { healthyModel, type PatientModel } from '../physiology/state.ts';
import { CATALOG } from '../data/catalog.ts';
import { FORMATTERS } from '../text/formatters.ts';
import { tr, type LocalizedText } from '../model/i18n.ts';
import { NEURO_STATION } from '../stations/station.ts';
import { NEURO_PRESETS, NEURO_PRESET_GROUPS, NEURO_STRUCTURES, applyNeuroPreset } from '../stations/neuro-presets.ts';
import { neuroObserve, neuroSignsOf } from '../stations/neuro-signs.ts';
import { NEURO_TESTS, NEURO_TEST_BY_ID, NEURO_GROUP_LABEL, NEURO_TEST_LABEL, type NeuroTest } from '../stations/neuro-tests.ts';
import { explainNeuro } from '../stations/neuro-texts.ts';
import { neuroChartFor, neuroMotionFor } from './neuro-visual.ts';
import { neuroLadderSvg } from '../render/neuro-mechanism.ts';
import { figureLookFor } from '../render/patient-figure.ts';
import { FREE_CASE } from './free-case.ts';
import { neuroFrame, neuroViewBox, type NeuroMotion } from './neuro-motion-view.ts';
import { KNOWLEDGE, labelOf } from '../knowledge/index.ts';
import type { Lang } from './diagrams.ts';
import { patientBanner, type StationHandle, type StationOptions } from './station-ecg.ts';
import type { ExamContext, Side } from '../model/types.ts';

/* ---------------------------------------------------------------------------
   The neurological station (ADR-017 decision 10, step 8a): Explore.

   A healthy adult sitting on the edge of the bed does pronator drift,
   finger–nose and the knee jerk on the bedside figure, moved by the
   examination model's finding; beside it the ladder of the nervous system
   with the lesion on it, and why. The settings are lesions of the
   nervous-system graph: nothing here decides what the limbs do. Predict
   and Identify come with step 8c.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });
const T: Record<string, LocalizedText> = {
  eyebrow: L('Station', 'Station'), back: L('Ward', 'Übersicht'),
  settings: L('What changes this examination', 'Was diese Untersuchung verändert'),
  settingsNote: L('A lesion on one rung of the nervous system. The examination model derives the rest.', 'Eine Läsion auf einer Stufe des Nervensystems. Das Untersuchungsmodell leitet den Rest ab.'),
  startFrom: L('Start from', 'Ausgangspunkt'), choose: L('Choose a lesion…', 'Läsion wählen…'), healthy: L('Reset to healthy', 'Auf gesund zurücksetzen'),
  complete: L('Complete lesion', 'Komplette Läsion'),
  completeNote: L('A partial lesion of the corticospinal tract leaves the arm strong enough to hold up, and drifting.', 'Eine partielle Läsion der Pyramidenbahn lässt den Arm kräftig genug, ihn zu halten, und er driftet.'),
  see: L('What you see', 'Was Sie sehen'), seeNote: L('The patient on the edge of the bed. The limbs move as the examination model’s finding says.', 'Der Patient auf der Bettkante. Die Glieder bewegen sich, wie es der Befund des Untersuchungsmodells sagt.'),
  test: L('Test', 'Test'), side: L('Side', 'Seite'), right: L('Right', 'Rechts'), left: L('Left', 'Links'),
  eyes: L('Eyes', 'Augen'), open: L('Open', 'Offen'), closed: L('Closed', 'Geschlossen'),
  signsNow: L('Signs now', 'Zeichen jetzt'), noSigns: L('none: a normal examination of these tests', 'keine: eine normale Untersuchung dieser Tests'), at: L('found with', 'gefunden mit'),
  mechanism: L('Where the lesion is', 'Wo die Läsion liegt'), diagram: L('The nervous system as a ladder, with the lesion on it', 'Das Nervensystem als Leiter, mit der Läsion darauf'),
  figure: L('The patient doing the test', 'Der Patient beim Test'),
  basis: L('The model’s reason', 'Die Begründung des Modells'),
  later: L('Drawn so far: the knee jerk. The ankle jerk and the plantar response are in the findings.', 'Bisher gezeichnet: der Patellarsehnenreflex. Achillessehnenreflex und Fußsohlenreflex stehen in den Befunden.'),
};
const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const SIDES: Side[] = ['R', 'L'];

export function mountNeuroStation(host: HTMLElement, o: StationOptions): StationHandle {
  let lang = o.lang;
  const t = (k: string) => tr(T[k], lang);
  let model: PatientModel = structuredClone(o.patient?.model ?? healthyModel());
  let test: NeuroTest = 'drift';
  let side: Side = 'R';
  let eyesClosed = false;
  let stopped = false, raf = 0, t0 = performance.now(), last = -1e9;
  const look = figureLookFor(FREE_CASE.patient, { exposure: [] } as any, 7, {});
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const signLabel = (x: string) => labelOf(KNOWLEDGE, `sign:${x}`, lang);
  const val = (ref: string, ctx: ExamContext = {}) => neuroObserve(model, ref, ctx).value as Record<string, any>;

  /** the basis the model gives for this test's observations */
  const basisOf = () => { const b = new Set<string>(); for (const l of NEURO_TEST_BY_ID[test].lines()) { const x = neuroObserve(model, l.ref, l.ctx).basis; if (x) b.add(x); } return [...b]; };
  const motion = (): NeuroMotion | null => neuroMotionFor(test, val, side, eyesClosed);
  /** The side to look at first: the abnormal one. */
  const abnormalSide = (): Side => {
    const bad = (S: Side) => NEURO_TEST_BY_ID[test].lines().some((l) => l.ref.endsWith(`.${S}`) && !neuroObserve(model, l.ref, l.ctx).normal);
    return bad('R') ? 'R' : bad('L') ? 'L' : side;
  };

  const seg = (attr: string, items: Array<[string, string]>, cur: string, label: string) =>
    `<span class="seg" role="radiogroup" aria-label="${esc(label)}">${items.map(([v, lab]) => `<button type="button" role="radio" aria-checked="${v === cur}" ${attr}="${v}">${esc(lab)}</button>`).join('')}</span>`;
  const testControls = () => {
    const d = NEURO_TEST_BY_ID[test];
    const sd = d.sided ? seg('data-side', [['R', t('right')], ['L', t('left')]], side, t('side')) : '';
    const ey = d.eyes ? seg('data-eyes', [['open', t('open')], ['closed', t('closed')]], eyesClosed ? 'closed' : 'open', t('eyes')) : '';
    return sd + ey;
  };

  const render = () => {
    const cut = new Set(model.lesions.nodes);
    host.innerHTML = `<div class="st-head">
        <button type="button" class="ghost" data-leave>← ${o.backLabel ? tr(o.backLabel, lang) : t('back')}</button>
        <div class="st-title"><div class="eyebrow">${t('eyebrow')}</div><h1>${esc(tr(NEURO_STATION.title, lang))}</h1><p class="lede">${esc(tr(NEURO_STATION.summary, lang))}</p></div>
      </div>
      ${patientBanner(o, lang)}
      <div class="st-grid">
        <aside class="panel st-settings" aria-labelledby="st-set-h">
          <h2 id="st-set-h">${t('settings')}</h2>
          <p class="layer-note">${t('settingsNote')}</p>
          <label class="st-preset">${t('startFrom')}
            <select data-preset><option value="">${t('choose')}</option>${NEURO_PRESET_GROUPS.map((g) => `<optgroup label="${esc(tr(g.group, lang))}">${g.ids.map((id) => NEURO_PRESETS.find((p) => p.id === id)!).map((p) => `<option value="${p.id}">${esc(tr(p.label, lang))}</option>`).join('')}</optgroup>`).join('')}</select>
          </label>
          <button type="button" class="ghost small" data-healthy>${t('healthy')}</button>
          <label class="st-var st-check"><input type="checkbox" data-complete ${model.lesions.complete ? 'checked' : ''}><span>${t('complete')}</span></label>
          <p class="muted small">${t('completeNote')}</p>
          ${NEURO_STRUCTURES.map((g) => `<fieldset class="st-lesions"><legend>${esc(tr(g.group, lang))}</legend>${g.nodes.map((n) =>
            `<label class="st-var st-check"><input type="checkbox" data-node="${n.id}" ${cut.has(n.id) ? 'checked' : ''}><span>${esc(tr(n.label, lang))}</span></label>`).join('')}</fieldset>`).join('')}
        </aside>
        <div class="st-main">
          <section class="panel st-signal" aria-labelledby="st-see-h">
            <div class="st-row"><div><h2 id="st-see-h">${t('see')}</h2><div class="muted small">${t('seeNote')}</div></div></div>
            <div class="st-test-groups">${(Object.keys(NEURO_GROUP_LABEL) as Array<keyof typeof NEURO_GROUP_LABEL>).map((g) => `<div class="st-test-group"><div class="muted small">${esc(tr(NEURO_GROUP_LABEL[g], lang))}</div><div class="st-tests" role="tablist" aria-label="${esc(tr(NEURO_GROUP_LABEL[g], lang))}">${NEURO_TESTS.filter((x) => x.group === g).map((x) => `<button type="button" role="tab" class="tog" aria-selected="${x.id === test}" data-test="${x.id}">${esc(tr(x.label, lang))}</button>`).join('')}</div></div>`).join('')}</div>
            <div class="st-listen" data-test-controls>${testControls()}</div>
            <div class="neurohost" data-visual></div>
            <ul class="st-findings plain small" data-findings aria-live="polite"></ul>
            <div class="st-signs" data-signs aria-live="polite"></div>
          </section>
          <section class="panel st-why st-why-wide" aria-labelledby="st-why-h">
            <div class="st-row"><div><h2>${t('mechanism')}</h2></div></div>
            <div data-ladder aria-label="${t('diagram')}"></div>
            <div class="st-text"><h3 id="st-why-h" data-title></h3><div data-body></div></div>
          </section>
        </div>
      </div>`;
    wire();
    refresh();
    start();
  };

  const css = (n: string) => getComputedStyle(host).getPropertyValue(n).trim() || '#888';
  const findingLines = (): string[] => NEURO_TEST_BY_ID[test].lines().map((l) => {
    const f = neuroObserve(model, l.ref, l.ctx ?? {});
    const prop = l.ref.replace(/\.(L|R)$/, ''), S = /\.(L|R)$/.exec(l.ref)?.[1] as Side | undefined;
    const text = FORMATTERS[CATALOG.properties[prop]?.formatter ?? prop]?.(f.value, l.ctx ?? {}, lang, CATALOG, { property: prop, side: S } as any) ?? JSON.stringify(f.value);
    return `${f.normal ? '' : '<b class="abn" aria-label="abnormal">●</b> '}${l.label ? `<b>${esc(tr(l.label, lang))}</b>: ` : ''}${esc(text)}`;
  });
  const colors = () => ({ fg: css('--fg'), muted: css('--muted'), accent: css('--accent'), abn: css('--abn'), line: css('--line'), surface: css('--surface') });
  const refresh = () => {
    const box = host.querySelector<HTMLElement>('[data-findings]');
    if (!box) return;
    box.innerHTML = findingLines().map((x) => `<li>${x}</li>`).join('');
    const r = neuroSignsOf(model);
    host.querySelector<HTMLElement>('[data-signs]')!.innerHTML = `<span class="muted small">${t('signsNow')}:</span> ${r.present.size
      ? [...r.present].map((x) => `<span class="sign" title="${esc(`${t('at')}: ${(r.where.get(x) ?? []).map((m) => tr(NEURO_TEST_LABEL[m], lang)).join('; ')}`)}">${esc(signLabel(x))}${[...(r.sides.get(x) ?? [])].length === 1 ? ` (${t([...r.sides.get(x)!][0] === 'R' ? 'right' : 'left').toLowerCase()})` : ''}</span>`).join('')
      : `<span class="muted small">${t('noSigns')}</span>`}`;
    const ex = explainNeuro(test, val);
    const basis = basisOf();
    host.querySelector<HTMLElement>('[data-title]')!.textContent = tr(ex.title, lang);
    host.querySelector<HTMLElement>('[data-body]')!.innerHTML = ex.body.map((p) => `<p>${esc(tr(p, lang))}</p>`).join('')
      + (basis.length ? `<p class="muted small"><b>${t('basis')}:</b> ${esc(basis.join('; '))}</p>` : '');
    host.querySelector<HTMLElement>('[data-ladder]')!.innerHTML = neuroLadderSvg(test, model.lesions.nodes, lang, colors(), model.lesions.extent ?? {});
    current = motion();
    const vis = host.querySelector<HTMLElement>('[data-visual]')!;
    const chart = current ? null : neuroChartFor(test, val, lang, colors());
    vis.innerHTML = current ? `<svg class="neuro-motion" viewBox="${neuroViewBox(current)}" role="img" aria-label="${t('figure')}"></svg>` : chart ?? '';
    vis.hidden = !current && !chart;
  };
  let current: NeuroMotion | null = null;
  const STILL: Partial<Record<NeuroMotion['kind'], number>> = { drift: 12, 'finger-nose': 1.0, 'knee-jerk': 0.75, 'heel-shin': 2, 'rapid-alternating': 0.3, romberg: 10, gait: 0.8, tone: 1.5, 'arm-reflexes': 0.7, 'leg-reflexes': 0.75 };
  const start = () => {
    cancelAnimationFrame(raf);
    const svg = host.querySelector<SVGSVGElement>('svg.neuro-motion');
    if (!svg || !current) return;
    const m = current;
    if (reduce) { svg.innerHTML = neuroFrame(m, look, STILL[m.kind] ?? 1); return; }
    const step = (now: number) => {
      if (stopped || current !== m) return;
      if (now - last >= 33) { last = now; svg.innerHTML = neuroFrame(m, look, (now - t0) / 1000); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  const change = (next: PatientModel) => { model = next; side = abnormalSide(); t0 = performance.now(); render(); };
  const wire = () => {
    host.querySelector<HTMLButtonElement>('[data-leave]')!.onclick = () => { stop(); o.onLeave(); };
    const sel = host.querySelector<HTMLSelectElement>('[data-preset]')!;
    sel.onchange = () => {
      const pid = sel.value;
      if (!pid) return;
      const p = NEURO_PRESETS.find((x) => x.id === pid)!;
      test = p.look;
      change(applyNeuroPreset(model, pid));
      host.querySelector<HTMLSelectElement>('[data-preset]')!.value = pid;
    };
    host.querySelector<HTMLButtonElement>('[data-healthy]')!.onclick = () => change(applyNeuroPreset(model, ''));
    host.querySelector<HTMLInputElement>('[data-complete]')!.onchange = (e) => { const next = structuredClone(model); next.lesions.complete = (e.target as HTMLInputElement).checked; change(next); };
    host.querySelectorAll<HTMLInputElement>('[data-node]').forEach((el) => el.onchange = () => {
      const next = structuredClone(model), id = el.dataset.node!;
      next.lesions.nodes = el.checked ? [...new Set([...next.lesions.nodes, id])] : next.lesions.nodes.filter((x) => x !== id);
      change(next);
    });
    host.querySelectorAll<HTMLButtonElement>('[data-test]').forEach((b) => b.onclick = () => { test = b.dataset.test as NeuroTest; side = abnormalSide(); t0 = performance.now(); render(); });
    wireTestControls();
  };
  const wireTestControls = () => {
    const box = host.querySelector<HTMLElement>('[data-test-controls]')!;
    const on = (attr: string, f: (v: string) => void) => box.querySelectorAll<HTMLButtonElement>(`[${attr}]`).forEach((b) => b.onclick = () => {
      f(b.getAttribute(attr)!); t0 = performance.now();
      box.innerHTML = testControls(); wireTestControls(); refresh(); start();
    });
    on('data-side', (v) => { side = v as Side; });
    on('data-eyes', (v) => { eyesClosed = v === 'closed'; });
  };

  const stop = () => { stopped = true; cancelAnimationFrame(raf); };
  side = abnormalSide();
  render();
  return { stop, setLang(l: Lang) { lang = l; render(); } };
}
