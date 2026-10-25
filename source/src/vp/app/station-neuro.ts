import { healthyModel, type PatientModel } from '../physiology/state.ts';
import { CATALOG } from '../data/catalog.ts';
import { FORMATTERS } from '../text/formatters.ts';
import { tr, type LocalizedText } from '../model/i18n.ts';
import { NEURO_STATION } from '../stations/station.ts';
import { NEURO_PRESETS, NEURO_PRESET_GROUPS, NEURO_STRUCTURES, applyNeuroPreset } from '../stations/neuro-presets.ts';
import { neuroObserve, neuroSignsOf, NEURO_TESTS, NEURO_TEST_MANOEUVRE, type NeuroTest } from '../stations/neuro-signs.ts';
import { explainNeuro, NEURO_TEST_LABEL, rungOf, type NeuroContext } from '../stations/neuro-texts.ts';
import { neuroLadderSvg } from '../render/neuro-mechanism.ts';
import { figureLookFor } from '../render/patient-figure.ts';
import { FREE_CASE } from './free-case.ts';
import { neuroFrame, type NeuroMotion } from './neuro-motion-view.ts';
import { KNOWLEDGE, labelOf } from '../knowledge/index.ts';
import type { Lang } from './diagrams.ts';
import { patientBanner, type StationHandle, type StationOptions } from './station-ecg.ts';
import type { ExamContext, Side } from '../model/types.ts';
import type { ReflexGrade } from '../render/neuro-motion.ts';

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

  const context = (): NeuroContext => {
    const fn = (S: Side, closed: boolean) => val(`arm.finger-nose.${S}`, { eyesClosed: closed }) as any;
    const basis = new Set<string>();
    for (const S of SIDES) for (const r of [`arm.drift.${S}`, `arm.finger-nose.${S}`, `leg.reflexes.${S}`]) { const b = neuroObserve(model, r).basis; if (b) basis.add(b); }
    return {
      drift: { R: !!val('arm.drift.R').drift, L: !!val('arm.drift.L').drift },
      fingerNose: { R: fn('R', false), L: fn('L', false) }, fingerNoseClosed: { R: fn('R', true), L: fn('L', true) },
      reflexes: { R: val('leg.reflexes.R') as any, L: val('leg.reflexes.L') as any },
      basis: [...basis], rungs: new Set(model.lesions.nodes.map(rungOf).filter((x): x is NonNullable<typeof x> => !!x)),
    };
  };
  const motion = (): NeuroMotion => {
    const c = context();
    if (test === 'drift') return { kind: 'drift', finding: { drift: [c.drift.R, c.drift.L] } };
    if (test === 'finger-nose') return { kind: 'finger-nose', side: side as 'L' | 'R', finding: (eyesClosed ? c.fingerNoseClosed : c.fingerNose)[side], eyesClosed };
    return { kind: 'knee-jerk', side: side as 'L' | 'R', grade: Math.max(0, Math.min(4, c.reflexes[side].knee)) as ReflexGrade };
  };
  /** The side to look at first: the abnormal one. */
  const abnormalSide = (): Side => {
    const c = context();
    const bad = (S: Side) => test === 'finger-nose' ? c.fingerNose[S].dysmetria !== 'none' || c.fingerNoseClosed[S].dysmetria !== 'none' || !!c.fingerNose[S].limitedByWeakness
      : test === 'knee-jerk' ? c.reflexes[S].knee !== 2 || c.reflexes[S].ankle !== 2 || c.reflexes[S].plantar !== 'flexor' : c.drift[S];
    return bad('R') ? 'R' : bad('L') ? 'L' : side;
  };

  const seg = (attr: string, items: Array<[string, string]>, cur: string, label: string) =>
    `<span class="seg" role="radiogroup" aria-label="${esc(label)}">${items.map(([v, lab]) => `<button type="button" role="radio" aria-checked="${v === cur}" ${attr}="${v}">${esc(lab)}</button>`).join('')}</span>`;
  const testControls = () => {
    if (test === 'drift') return '';
    const s = seg('data-side', [['R', t('right')], ['L', t('left')]], side, t('side'));
    if (test === 'finger-nose') return s + seg('data-eyes', [['open', t('open')], ['closed', t('closed')]], eyesClosed ? 'closed' : 'open', t('eyes'));
    return s + `<span class="muted small">${t('later')}</span>`;
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
            <div class="st-tests" role="tablist" aria-label="${t('test')}">${NEURO_TESTS.map((x) => `<button type="button" role="tab" class="tog" aria-selected="${x === test}" data-test="${x}">${esc(tr(NEURO_TEST_LABEL[x], lang))}</button>`).join('')}</div>
            <div class="st-listen" data-test-controls>${testControls()}</div>
            <div class="neurohost"><svg class="neuro-motion" viewBox="0 0 360 380" role="img" aria-label="${t('figure')}"></svg></div>
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
  const findingLines = (): string[] => {
    const line = (ref: string, ctx: ExamContext = {}, label = '') => {
      const f = neuroObserve(model, ref, ctx);
      const prop = ref.replace(/\.(L|R)$/, ''), S = /\.(L|R)$/.exec(ref)?.[1] as Side | undefined;
      const text = FORMATTERS[CATALOG.properties[prop]?.formatter ?? prop]?.(f.value, ctx, lang, CATALOG, { property: prop, side: S } as any) ?? JSON.stringify(f.value);
      return `${f.normal ? '' : '<b class="abn" aria-label="abnormal">●</b> '}${label ? `<b>${esc(label)}</b>: ` : ''}${esc(text)}`;
    };
    if (test === 'drift') return SIDES.map((S) => line(`arm.drift.${S}`, { eyesClosed: true }));
    if (test === 'finger-nose') return SIDES.flatMap((S) => [line(`arm.finger-nose.${S}`, { eyesClosed: false }, t('open')), line(`arm.finger-nose.${S}`, { eyesClosed: true }, t('closed'))]);
    return SIDES.map((S) => line(`leg.reflexes.${S}`));
  };
  const refresh = () => {
    const box = host.querySelector<HTMLElement>('[data-findings]');
    if (!box) return;
    box.innerHTML = findingLines().map((x) => `<li>${x}</li>`).join('');
    const r = neuroSignsOf(model);
    host.querySelector<HTMLElement>('[data-signs]')!.innerHTML = `<span class="muted small">${t('signsNow')}:</span> ${r.present.size
      ? [...r.present].map((x) => `<span class="sign" title="${esc(`${t('at')}: ${(r.where.get(x) ?? []).map((m) => tr(CATALOG.manoeuvres[NEURO_TEST_MANOEUVRE[m]]?.label ?? NEURO_TEST_LABEL[m], lang)).join('; ')}`)}">${esc(signLabel(x))}${[...(r.sides.get(x) ?? [])].length === 1 ? ` (${t([...r.sides.get(x)!][0] === 'R' ? 'right' : 'left').toLowerCase()})` : ''}</span>`).join('')
      : `<span class="muted small">${t('noSigns')}</span>`}`;
    const c = context();
    const ex = explainNeuro(test, c);
    host.querySelector<HTMLElement>('[data-title]')!.textContent = tr(ex.title, lang);
    host.querySelector<HTMLElement>('[data-body]')!.innerHTML = ex.body.map((p) => `<p>${esc(tr(p, lang))}</p>`).join('')
      + (c.basis.length ? `<p class="muted small"><b>${t('basis')}:</b> ${esc(c.basis.join('; '))}</p>` : '');
    host.querySelector<HTMLElement>('[data-ladder]')!.innerHTML = neuroLadderSvg(test, model.lesions.nodes, lang, { fg: css('--fg'), muted: css('--muted'), accent: css('--accent'), abn: css('--abn'), line: css('--line') }, model.lesions.extent ?? {});
    current = motion();
  };
  let current: NeuroMotion = motion();
  const STILL: Record<NeuroTest, number> = { drift: 12, 'finger-nose': 1.0, 'knee-jerk': 0.75 };
  const start = () => {
    cancelAnimationFrame(raf);
    const svg = host.querySelector<SVGSVGElement>('svg.neuro-motion');
    if (!svg) return;
    if (reduce) { svg.innerHTML = neuroFrame(current, look, STILL[test]); return; }
    const step = (now: number) => {
      if (stopped) return;
      if (now - last >= 33) { last = now; svg.innerHTML = neuroFrame(current, look, (now - t0) / 1000); }
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
