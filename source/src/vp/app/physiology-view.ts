import { MODELS, MODEL_BY_ID, VARIABLE_BY_ID, getPath } from '../physiology/models.ts';
import type { ModelDef, VariableDef, LiveContext } from '../physiology/types.ts';
import { CATALOG } from '../data/catalog.ts';
import { tr } from '../model/i18n.ts';
import type { LivePatient } from '../live/live-patient.ts';
import type { RuntimeView } from '../engine/observe.ts';
import { equationMathML, equationVariables, fmtValue, symbolMathML } from './math.ts';
import { runDiagram, type Lang } from './diagrams.ts';

/* ---------------------------------------------------------------------------
   The physiology layer: one chapter per model, opened on this patient.

   A chapter is the model as data, read aloud: what it is, a living
   diagram, the governing equations twice (as symbols, and with this
   patient's values in them, updating as the simulation runs), the full
   system one level down, the examinations and tests through which the
   model is observed (with the physics of each), and where it comes from.
--------------------------------------------------------------------------- */

const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export const CHAPTERS = MODELS.filter((m) => m.diagram);

const T: Record<string, Record<Lang, string>> = {
  equations: { en: 'Governing equations, with this patient’s values', de: 'Grundgleichungen, mit den Werten dieses Patienten' },
  full: { en: 'The full model, one level down', de: 'Das vollständige Modell, eine Ebene tiefer' },
  observed: { en: 'Observed through', de: 'Beobachtet durch' },
  observedHint: { en: 'Nothing in this chapter is seen directly. These examinations and tests measure it, each through its own physics.', de: 'Nichts in diesem Kapitel ist direkt sichtbar. Diese Untersuchungen und Tests messen es, jede mit ihrer eigenen Physik.' },
  sources: { en: 'Sources', de: 'Quellen' },
  examination: { en: 'examination', de: 'Untersuchung' }, test: { en: 'test', de: 'Test' },
};

export function valuesOf(model: ModelDef, live: LivePatient, view: RuntimeView): (v: VariableDef) => number | string | boolean | undefined {
  const cache = new Map<string, Record<string, number | string | boolean>>();
  const ctx: LiveContext = { model: live.model, snap: live.snap, view };
  return (v) => {
    const mid = v.id.split('.')[0];
    const m = MODEL_BY_ID[mid] ?? model;
    if (!cache.has(m.id)) { try { cache.set(m.id, m.values(ctx)); } catch { cache.set(m.id, {}); } }
    const vals = cache.get(m.id)!;
    const key = v.id.slice(mid.length + 1);
    if (vals[key] !== undefined) return vals[key];
    return v.kind === 'parameter' ? getPath(live.model, v.key) : undefined;
  };
}

export interface ChapterHandle { stop(): void; tick(): void }

export function renderChapter(host: HTMLElement, id: string, live: LivePatient, view: () => RuntimeView, lang: Lang, onVariable?: (id: string) => void): ChapterHandle {
  const m = MODEL_BY_ID[id];
  const textbook = m.equations.filter((e) => e.level === 'textbook');
  const full = m.equations.filter((e) => e.level === 'full');
  const eqHtml = (e: typeof m.equations[number]) => {
    const vars = equationVariables(e, m);
    return `<article class="panel eq" data-eq="${e.id}"><h3>${esc(tr(e.label, lang))}</h3>
      <div class="sym">${equationMathML(e, { model: m, values: () => undefined, locale: lang, substitute: false })}</div>
      <div class="live" aria-live="off"></div>
      <p>${esc(tr(e.explanation, lang))}</p>
      <div class="legend">${vars.map((v) => `<span data-legend="${v.id}">${symbolMathML(v.symbol)} ${esc(tr(v.label, lang))} <b class="lv"></b> <span class="u">${esc(v.unit)}</span></span>`).join('')}</div></article>`;
  };
  // the examinations and tests that measure a variable of this model
  const ids = new Set(m.variables.map((v) => v.id));
  const observers = [
    ...Object.values(CATALOG.properties).filter((p) => p.measurement?.measures.some((x) => ids.has(x))).map((p) => ({ kind: 'examination', label: p.label, m: p.measurement! })),
    ...Object.values(CATALOG.investigations).filter((p) => p.measurement?.measures.some((x) => ids.has(x))).map((p) => ({ kind: 'test', label: p.label, m: p.measurement! })),
  ];
  host.innerHTML = `<div class="chapter">
    <header><div class="eyebrow">${lang === 'de' ? 'Physiologie' : 'Physiology'}</div><h1>${esc(tr(m.title, lang))}</h1><p>${esc(tr(m.summary, lang))}</p></header>
    <div class="panel diagram"><canvas aria-label="${esc(tr(m.title, lang))}"></canvas></div>
    ${textbook.length ? `<section><h2>${T.equations[lang]}</h2><div class="eqs">${textbook.map(eqHtml).join('')}</div></section>` : ''}
    ${full.length ? `<details class="full"><summary>${T.full[lang]}</summary><div class="eqs">${full.map(eqHtml).join('')}</div></details>` : ''}
    ${observers.length ? `<section class="observed"><h2>${T.observed[lang]}</h2><p class="layer-note">${T.observedHint[lang]}</p><ul>${observers.map((o) => `<li><b>${esc(tr(o.label, lang))} <span class="muted" style="font-weight:400">· ${T[o.kind][lang]}</span></b><p>${esc(tr(o.m.physics, lang))}</p>
      <div class="measures">${o.m.measures.map((x) => VARIABLE_BY_ID[x]).filter(Boolean).map((v) => `<span>${symbolMathML(v.symbol)} ${esc(tr(v.label, lang))}</span>`).join('')}</div></li>`).join('')}</ul></section>` : ''}
    ${m.sources.length ? `<section class="sources"><h2>${T.sources[lang]}</h2><ul>${m.sources.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></section>` : ''}
  </div>`;
  const stopDiagram = runDiagram(host.querySelector('canvas')!, m.diagram, () => ({ live, view: view(), lang }));
  const tick = () => {
    const vals = valuesOf(m, live, view());
    host.querySelectorAll<HTMLElement>('[data-eq]').forEach((el) => {
      const e = m.equations.find((x) => x.id === el.dataset.eq)!;
      el.querySelector('.live')!.innerHTML = equationMathML(e, { model: m, values: vals, locale: lang, substitute: true });
      el.querySelectorAll<HTMLElement>('[data-legend]').forEach((lg) => {
        const v = VARIABLE_BY_ID[lg.dataset.legend!];
        if (v) lg.querySelector('.lv')!.textContent = `= ${fmtValue(v, vals(v), lang)}`;
      });
    });
  };
  tick();
  const timer = window.setInterval(tick, 250);
  if (onVariable) host.addEventListener('click', (ev) => { const el = (ev.target as Element).closest('[data-var]') as HTMLElement | null; if (el) onVariable(el.dataset.var!); });
  return { stop: () => { stopDiagram(); clearInterval(timer); }, tick };
}
