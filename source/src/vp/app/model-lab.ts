import { MODELS, getPath, setPath } from '../physiology/models.ts';
import type { VariableDef } from '../physiology/types.ts';
import { healthyModel, applyPreset, type PatientModel } from '../physiology/state.ts';
import { ELECTRICAL_PRESETS } from '../physiology/heart/electrical.ts';
import { NODES } from '../../domains/neuro/data/anatomy.js';
import { tr } from '../model/i18n.ts';
import type { LivePatient } from '../live/live-patient.ts';
import type { RuntimeView } from '../engine/observe.ts';
import { fmtValue, symbolMathML } from './math.ts';
import { valuesOf } from './physiology-view.ts';
import type { Lang } from './diagrams.ts';

/* ---------------------------------------------------------------------------
   The Model Lab: every variable the patient's models consist of, as a list,
   grouped by model and opened or closed by section. Parameters can be set
   (in the free patient); states are shown as the simulation computes them.
   Starting point is a healthy adult. Playing a case, the list is shown
   only after the diagnosis is committed, and read-only: it is the case.
--------------------------------------------------------------------------- */

const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const T: Record<string, Record<Lang, string>> = {
  free: { en: 'Free patient: change anything and examine what follows. Changes act on the running patient, as they would in life: the reflexes respond over seconds.', de: 'Freier Patient: Ändern Sie, was Sie wollen, und untersuchen Sie die Folgen. Änderungen wirken auf den laufenden Patienten wie im Leben: Die Reflexe antworten über Sekunden.' },
  caseRO: { en: 'This is the case: the parameters it sets, over a healthy adult. Read-only while playing a case; open the free patient to experiment.', de: 'Das ist der Fall: die Parameter, die er setzt, über einem gesunden Erwachsenen. Beim Spielen eines Falls schreibgeschützt; zum Experimentieren den freien Patienten öffnen.' },
  reset: { en: 'Reset to healthy', de: 'Auf gesund zurücksetzen' }, preset: { en: 'Electrical pattern…', de: 'Elektrisches Muster…' },
  changed: { en: 'changed from healthy', de: 'gegenüber gesund verändert' }, computed: { en: 'Computed by the model', de: 'Vom Modell berechnet' },
  restore: { en: 'reset', de: 'zurück' }, none: { en: 'none', de: 'keine' }, left: { en: 'left', de: 'links' }, right: { en: 'right', de: 'rechts' },
  search: { en: 'Search structures (e.g. “L5”, “internal capsule”, “CN VI”)…', de: 'Strukturen suchen (z. B. „L5“, „Capsula interna“, „CN VI“)…' },
};

export interface LabOptions {
  live: LivePatient; view: () => RuntimeView; lang: Lang; editable: boolean;
  onChange: (m: PatientModel) => void;
  open: Set<string>;               // which sections are open, kept between renders
}

const params = (vs: VariableDef[]) => vs.filter((v) => v.kind === 'parameter');

export function renderModelLab(host: HTMLElement, o: LabOptions): { tick(): void } {
  const healthy = healthyModel();
  const m = o.live.model;
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const changedVar = (v: VariableDef) => !same(getPath(m, v.key), getPath(healthy, v.key)) && !(v.key.startsWith('chemistry.') && m.chemistry[v.key.split('.')[1]] === undefined);
  const nChanged = MODELS.flatMap((x) => params(x.variables)).filter(changedVar).length;
  const control = (v: VariableDef): string => {
    const val = getPath(m, v.key);
    const dis = o.editable ? '' : 'disabled';
    switch (v.control) {
      case 'toggle': return `<label><input type="checkbox" data-k="${v.key}" ${val ? 'checked' : ''} ${dis}> ${val ? 'on' : 'off'}</label>`;
      case 'enum': return `<select data-k="${v.key}" ${dis}>${(v.options ?? []).map((op) => `<option value="${esc(op.value)}" ${op.value === val ? 'selected' : ''}>${esc(tr(op.label, o.lang))}</option>`).join('')}</select>`;
      case 'side': return `<select data-k="${v.key}" ${dis}>${[['none', T.none[o.lang]], ['L', T.left[o.lang]], ['R', T.right[o.lang]]].map(([a, b]) => `<option value="${a}" ${a === val ? 'selected' : ''}>${b}</option>`).join('')}</select>`;
      case 'lesions': return '';
      default: {
        const shown = typeof val === 'number' ? val : Number(val);
        return `<input type="range" data-k="${v.key}" min="${v.min}" max="${v.max}" step="${v.step}" value="${shown}" ${dis} aria-label="${esc(tr(v.label, o.lang))}">`;
      }
    }
  };
  const numberBox = (v: VariableDef) => {
    if (v.control && v.control !== 'number') return '<span></span>';
    const val = getPath(m, v.key);
    return `<input type="number" data-k="${v.key}" data-num="1" min="${v.min}" max="${v.max}" step="${v.step}" value="${typeof val === 'number' ? +val.toFixed(v.digits ?? 3) : val}" ${o.editable ? '' : 'disabled'} aria-label="${esc(tr(v.label, o.lang))} (${esc(v.unit)})">`;
  };
  const lesionPicker = () => {
    const on = new Set(m.lesions.nodes);
    return `<div class="lesion-picker">${o.editable ? `<input type="search" data-lesion-q placeholder="${esc(T.search[o.lang])}">` : ''}
      <div class="lesion-chips" data-lesion-on>${[...on].map((id) => `<button type="button" class="on" data-node="${id}" ${o.editable ? '' : 'disabled'}>${esc((NODES as any)[id]?.name ?? id)} ×</button>`).join('') || `<span class="muted">${T.none[o.lang]}</span>`}</div>
      <div class="lesion-chips" data-lesion-hits></div></div>`;
  };
  const row = (v: VariableDef) => {
    if (v.control === 'lesions') return `<div class="var">${lesionPicker()}</div>`;
    return `<div class="var ${changedVar(v) ? 'changed' : ''}"><div class="name">${esc(tr(v.label, o.lang))} <small>${symbolMathML(v.symbol)} ${esc(v.unit)}${changedVar(v) && o.editable ? ` · <button type="button" class="reset" data-reset="${v.key}">${T.restore[o.lang]}</button>` : ''}</small></div>
      <div class="ctl">${control(v)}</div>${numberBox(v)}</div>`;
  };
  host.innerHTML = `<p class="layer-note">${o.editable ? T.free[o.lang] : T.caseRO[o.lang]}</p>
    <div class="lab-head">${o.editable ? `<button type="button" class="ghost" data-reset-all>${T.reset[o.lang]}</button>
      <select data-preset aria-label="${T.preset[o.lang]}"><option value="">${T.preset[o.lang]}</option>${ELECTRICAL_PRESETS.map((p) => `<option value="${p.id}">${esc(tr(p.label, o.lang))}</option>`).join('')}</select>` : ''}
      <span class="changed">${nChanged} ${T.changed[o.lang]}</span></div>
    ${MODELS.map((md) => {
      const ps = params(md.variables), st = md.variables.filter((v) => v.kind === 'state');
      const nc = ps.filter(changedVar).length;
      const groups = md.groups.length ? md.groups : [{ id: '', label: md.title }];
      return `<details class="mdl" data-sec="${md.id}" ${o.open.has(md.id) ? 'open' : ''}><summary><span>${esc(tr(md.title, o.lang))}</span><small>${ps.length} · ${nc ? `${nc} ${T.changed[o.lang]}` : ''}</small></summary>
        ${groups.map((g) => { const vs = ps.filter((v) => (v.group ?? '') === g.id || (!g.id)); return vs.length ? `<details class="grp" data-sec="${md.id}/${g.id}" ${o.open.has(`${md.id}/${g.id}`) || md.groups.length <= 1 ? 'open' : ''}><summary>${esc(tr(g.label, o.lang))}</summary>${vs.map(row).join('')}</details>` : ''; }).join('')}
        ${st.length ? `<details class="grp" data-sec="${md.id}/~state" ${o.open.has(`${md.id}/~state`) ? 'open' : ''}><summary>${T.computed[o.lang]}</summary>${st.map((v) => `<div class="var"><div class="name">${esc(tr(v.label, o.lang))} <small>${symbolMathML(v.symbol)}</small></div><div class="state" data-state="${v.id}"></div></div>`).join('')}</details>` : ''}
      </details>`;
    }).join('')}`;

  // keep sections open across re-renders
  host.querySelectorAll<HTMLDetailsElement>('details[data-sec]').forEach((d) => d.addEventListener('toggle', () => { d.open ? o.open.add(d.dataset.sec!) : o.open.delete(d.dataset.sec!); }));
  if (o.editable) {
    const commit = (key: string, value: unknown) => {
      const next = structuredClone(o.live.model);
      setPath(next, key, value);
      o.onChange(next);
    };
    host.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-k]').forEach((el) => {
      const key = el.dataset.k!;
      const handler = () => {
        let v: unknown;
        if (el instanceof HTMLInputElement && el.type === 'checkbox') { const cur = getPath(o.live.model, key); v = typeof cur === 'boolean' ? el.checked : el.checked ? 1 : 0; }
        else if (el instanceof HTMLInputElement) { v = Number(el.value); if (!Number.isFinite(v as number)) return; }
        else v = el.value;
        // keep the twin control in step without a full re-render
        host.querySelectorAll<HTMLInputElement>(`[data-k="${key}"]`).forEach((x) => { if (x !== el && x.type !== 'checkbox') x.value = String(v); });
        commit(key, v);
      };
      el.addEventListener(el instanceof HTMLInputElement && el.type === 'range' ? 'input' : 'change', handler);
    });
    host.querySelectorAll<HTMLButtonElement>('[data-reset]').forEach((b) => b.onclick = () => {
      const key = b.dataset.reset!;
      if (key.startsWith('chemistry.')) { const next = structuredClone(o.live.model); delete next.chemistry[key.split('.')[1]]; if (key === 'chemistry.potassium') next.circulation.K = 4; o.onChange(next); }
      else commit(key, getPath(healthy, key));
    });
    host.querySelector<HTMLButtonElement>('[data-reset-all]')!.onclick = () => { const h = healthyModel(); h.patient = { ...o.live.model.patient }; o.onChange(h); };
    host.querySelector<HTMLSelectElement>('[data-preset]')!.onchange = (e) => { const id = (e.target as HTMLSelectElement).value; if (id) o.onChange(applyPreset(o.live.model, id)); };
    // lesions
    const q = host.querySelector<HTMLInputElement>('[data-lesion-q]');
    const hits = host.querySelector<HTMLElement>('[data-lesion-hits]');
    if (q && hits) {
      q.addEventListener('input', () => {
        const s = q.value.trim().toLowerCase();
        const on = new Set(o.live.model.lesions.nodes);
        const list = s.length < 2 ? [] : Object.values(NODES as Record<string, { id: string; name: string }>).filter((n) => !on.has(n.id) && (n.name.toLowerCase().includes(s) || n.id.toLowerCase().includes(s))).slice(0, 14);
        hits.innerHTML = list.map((n) => `<button type="button" data-add="${n.id}">+ ${esc(n.name)}</button>`).join('');
        hits.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((b) => b.onclick = () => { const next = structuredClone(o.live.model); next.lesions.nodes.push(b.dataset.add!); o.onChange(next); });
      });
    }
    host.querySelectorAll<HTMLButtonElement>('[data-node]').forEach((b) => b.onclick = () => { const next = structuredClone(o.live.model); next.lesions.nodes = next.lesions.nodes.filter((x) => x !== b.dataset.node); o.onChange(next); });
  }
  const tick = () => {
    for (const md of MODELS) {
      const vals = valuesOf(md, o.live, o.view());
      host.querySelectorAll<HTMLElement>(`[data-state^="${md.id}."]`).forEach((el) => {
        const v = md.variables.find((x) => x.id === el.dataset.state)!;
        if (el.closest('details:not([open])')) return;
        el.textContent = `${fmtValue(v, vals(v), o.lang)} ${v.unit}`;
      });
    }
  };
  tick();
  return { tick };
}
