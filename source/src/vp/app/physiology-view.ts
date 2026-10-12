import { MODELS, MODEL_BY_ID, VARIABLE_BY_ID, getPath } from '../physiology/models.ts';
import type { ModelDef, VariableDef, LiveContext } from '../physiology/types.ts';
import { CATALOG } from '../data/catalog.ts';
import { tr } from '../model/i18n.ts';
import type { LivePatient } from '../live/live-patient.ts';
import type { RuntimeView } from '../engine/observe.ts';
import { equationMathML, equationVariables, fmtValue, symbolMathML } from './math.ts';
import { runDiagram, type Lang } from './diagrams.ts';
import { CONSTANTS, type ConstantStatus } from '../evidence/constants.ts';
import { REFERENCES, type Reference } from '../evidence/references.ts';
import '../evidence/endocrine.ts';
import '../evidence/renal.ts';

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
  constants: { en: 'Constants and their evidence', de: 'Konstanten und ihre Evidenz' },
  constantsHint: { en: 'Every number the model uses, what it rests on, and how far that source has been checked. Ungrounded constants are not yet sourced.', de: 'Jede Zahl, die das Modell verwendet, worauf sie beruht und wie weit die Quelle geprüft ist. Ungeprüfte Konstanten sind noch nicht belegt.' },
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

const STATUS: Record<ConstantStatus, Record<Lang, string>> = {
  measured: { en: 'measured', de: 'gemessen' }, derived: { en: 'derived', de: 'abgeleitet' },
  assumed: { en: 'assumed', de: 'angenommen' }, ungrounded: { en: 'not yet sourced', de: 'noch unbelegt' },
};
const VERIFIED: Record<Reference['verified'], Record<Lang, string>> = {
  'full-text': { en: 'checked in the full text', de: 'im Volltext geprüft' }, abstract: { en: 'checked in the abstract', de: 'im Abstract geprüft' },
  secondary: { en: 'taken from a summary', de: 'aus einer Zusammenfassung' }, record: { en: 'record only; figure not yet read', de: 'nur Eintrag; Zahl noch nicht gelesen' },
  unverified: { en: 'unverified', de: 'ungeprüft' },
};
let refLang: Lang = 'en';
const refHtml = (r: Reference) => {
  const link = r.doi ? `https://doi.org/${r.doi}` : r.url;
  const cite = `${esc(r.authors)}. ${esc(r.title)}. <i>${esc(r.journal)}</i> ${r.year}${r.volume ? `;${esc(r.volume)}` : ''}${r.pages ? `:${esc(r.pages)}` : ''}.`;
  return `${cite} ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${r.doi ? `doi:${esc(r.doi)}` : 'link'}</a>` : ''} <span class="muted">(${VERIFIED[r.verified][refLang]})</span>`;
};
function citedBy(groups: string[]): Reference[] {
  const ids = new Set(Object.values(CONSTANTS).filter((c) => groups.includes(c.group)).flatMap((c) => c.refs ?? []));
  return [...ids].map((id) => REFERENCES[id]).filter(Boolean);
}
function constantsHtml(groups: string[], lang: Lang): string {
  refLang = lang;
  const list = Object.values(CONSTANTS).filter((c) => groups.includes(c.group));
  if (!list.length) return '';
  const n = (s: ConstantStatus) => list.filter((c) => c.status === s).length;
  const tally = (['measured', 'derived', 'assumed', 'ungrounded'] as ConstantStatus[]).map((s) => `${n(s)} ${STATUS[s][lang]}`).join(' · ');
  const short = (id: string) => { const r = REFERENCES[id]; return r ? `<a href="#ref-${r.id}">${esc(r.authors.split(',')[0].split(' ')[0])} ${r.year}</a>` : esc(id); };
  return `<section class="constants"><h2>${T.constants[lang]}</h2><p class="layer-note">${T.constantsHint[lang]} ${tally}.</p>
    <table class="const-table"><thead><tr><th></th><th>${lang === 'de' ? 'Wert' : 'Value'}</th><th>${lang === 'de' ? 'Status' : 'Status'}</th><th>${lang === 'de' ? 'Quelle' : 'Source'}</th></tr></thead><tbody>
    ${list.map((c) => `<tr class="st-${c.status}"><td>${esc(c.means)}${c.derivation ? `<details><summary>${lang === 'de' ? 'Herleitung' : 'How'}</summary>${esc(c.derivation)}</details>` : ''}</td>
      <td class="num">${c.value} ${esc(c.unit)}</td><td><span class="st">${STATUS[c.status][lang]}</span></td><td>${(c.refs ?? []).map(short).join(', ')}</td></tr>`).join('')}
    </tbody></table></section>`;
}

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
    ${constantsHtml(m.constants ?? [], lang)}
    ${(() => { const refs = citedBy(m.constants ?? []); return m.sources.length || refs.length ? `<section class="sources"><h2>${T.sources[lang]}</h2><ul>${refs.map((r) => `<li id="ref-${r.id}">${refHtml(r)}</li>`).join('')}${m.sources.filter((s) => !refs.some((r) => s.includes(r.title.slice(0, 40)))).map((s) => `<li>${esc(s)}</li>`).join('')}</ul></section>` : ''; })()}
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
