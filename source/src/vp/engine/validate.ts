import type { CaseDef, NormalSpec, ValueType, Valued } from '../model/types.ts';
import type { Catalog } from '../data/catalog.ts';
import type { Registry } from '../registry.ts';
import { missingLocales, SUPPORTED_LOCALES, type Locale, type LocalizedText } from '../model/i18n.ts';
import { parseRef } from './observe.ts';
import { NODES } from '../../domains/neuro/data/anatomy.js';
import { ELECTRICAL_DEFAULTS } from '../physiology/heart/electrical.ts';
import { CHEMISTRY_DEFAULTS } from '../../models/chemistry/public-state.ts';
import { VARIABLE_BY_ID } from '../physiology/models.ts';
import type { MeasurementSpec } from '../model/types.ts';

function checkMeasurement(m: MeasurementSpec | undefined, source: string, path: string, out: Issue[]): void {
  if (!m) { if (source !== 'case') out.push({ level: 'warning', path, message: 'model-backed but says nothing about what it measures' }); return; }
  if (!m.measures.length) out.push({ level: 'error', path, message: 'measurement names no model variable' });
  for (const id of m.measures) if (!VARIABLE_BY_ID[id]) out.push({ level: 'error', path, message: `measures unknown model variable ${id}` });
  checkText(m.physics, SUPPORTED_LOCALES, `${path}.measurement.physics`, out, 'warning');
}

/* ---------------------------------------------------------------------------
   Validation: what an authoring platform runs on save and CI runs on every
   case. Errors make a case unusable; warnings are gaps an editor should see.

   Checked: referential integrity (every id resolves), language coverage
   (every learner-facing string exists in every locale the case declares),
   value conformance (every authored value fits its property's type), and
   the model boundary (a case may not author a property only a model may
   produce, so physiology cannot be contradicted by hand).
--------------------------------------------------------------------------- */

export interface Issue { level: 'error' | 'warning'; path: string; message: string }

export function checkValue(t: ValueType, v: unknown, cat: Catalog, partial = false): string | null {
  switch (t.kind) {
    case 'quantity':
      if (typeof v !== 'number' || !Number.isFinite(v)) return `expected a number (${t.unit})`;
      if (t.min != null && v < t.min) return `${v} below minimum ${t.min}`;
      if (t.max != null && v > t.max) return `${v} above maximum ${t.max}`;
      return null;
    case 'ordinal': {
      const sc = cat.scales[t.scale];
      if (!sc) return `unknown scale ${t.scale}`;
      return typeof v === 'number' && Number.isInteger(v) && v >= sc.min && v <= sc.max ? null : `expected ${t.scale} ${sc.min}–${sc.max}`;
    }
    case 'coded': {
      const vs = cat.valueSets[t.valueSet];
      if (!vs) return `unknown value set ${t.valueSet}`;
      return vs.values.some((x) => x.code === v) ? null : `'${String(v)}' is not in value set ${t.valueSet}`;
    }
    case 'boolean': return typeof v === 'boolean' ? null : 'expected true or false';
    case 'text': return typeof v === 'string' ? null : 'expected text';
    case 'list': {
      if (!Array.isArray(v)) return 'expected a list';
      for (const [i, x] of v.entries()) { const e = checkValue(t.of, x, cat); if (e) return `[${i}] ${e}`; }
      return null;
    }
    case 'record': {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return 'expected a record';
      const o = v as Record<string, unknown>;
      for (const k of Object.keys(o)) if (!(k in t.fields)) return `unknown field '${k}'`;
      for (const [k, ft] of Object.entries(t.fields)) {
        if (!(k in o)) { if (!partial && !(t.optional ?? []).includes(k)) return `missing field '${k}'`; continue; }
        const e = checkValue(ft, o[k], cat); if (e) return `${k}: ${e}`;
      }
      return null;
    }
  }
}

function typeRefs(t: ValueType, cat: Catalog, path: string, out: Issue[]) {
  if (t.kind === 'coded' && !cat.valueSets[t.valueSet]) out.push({ level: 'error', path, message: `unknown value set ${t.valueSet}` });
  if (t.kind === 'ordinal' && !cat.scales[t.scale]) out.push({ level: 'error', path, message: `unknown scale ${t.scale}` });
  if (t.kind === 'list') typeRefs(t.of, cat, path, out);
  if (t.kind === 'record') for (const [k, f] of Object.entries(t.fields)) typeRefs(f, cat, `${path}.${k}`, out);
}

function checkNormal(n: NormalSpec, t: ValueType, cat: Catalog, path: string, out: Issue[]) {
  const e = checkValue(t, n.value, cat);
  if (e) out.push({ level: 'error', path: `${path}.normal`, message: e });
  for (const [i, b] of (n.bands ?? []).entries()) {
    const eb = checkValue(t, b.value, cat);
    if (eb) out.push({ level: 'error', path: `${path}.normal.bands[${i}]`, message: eb });
  }
}

function checkText(text: LocalizedText | undefined, locales: readonly Locale[], path: string, out: Issue[], level: Issue['level'] = 'error') {
  const miss = missingLocales(text, locales);
  if (miss.length) out.push({ level, path, message: `missing ${miss.join(', ')}` });
}

export function validateCatalog(cat: Catalog, reg: Registry): Issue[] {
  const out: Issue[] = [];
  const L = SUPPORTED_LOCALES;
  for (const s of Object.values(cat.structures)) {
    if (s.parent && !cat.structures[s.parent]) out.push({ level: 'error', path: `structures.${s.id}`, message: `unknown parent ${s.parent}` });
    checkText(s.label, L, `structures.${s.id}.label`, out, 'warning');
  }
  for (const vs of Object.values(cat.valueSets)) for (const v of vs.values) checkText(v.label, L, `valueSets.${vs.id}.${v.code}`, out, 'warning');
  for (const p of Object.values(cat.properties)) {
    const path = `properties.${p.id}`;
    if (!cat.structures[p.structure]) out.push({ level: 'error', path, message: `unknown structure ${p.structure}` });
    typeRefs(p.value, cat, `${path}.value`, out);
    checkNormal(p.normal, p.value, cat, path, out);
    if (!reg.formatters[p.formatter]) out.push({ level: 'error', path, message: `formatter ${p.formatter} is not registered` });
    if (p.source !== 'case' && (!p.resolver || !reg.resolvers[p.resolver])) out.push({ level: 'error', path, message: `source ${p.source} needs a registered resolver` });
    if (p.source === 'case' && p.resolver) out.push({ level: 'warning', path, message: 'case-only property has a resolver that will never run' });
    if (p.renderer && !reg.renderers.includes(p.renderer)) out.push({ level: 'warning', path, message: `renderer ${p.renderer} is not registered` });
    checkText(p.label, L, `${path}.label`, out, 'warning');
    checkMeasurement(p.measurement, p.source, path, out);
  }
  for (const m of Object.values(cat.manoeuvres)) {
    const path = `manoeuvres.${m.id}`;
    if (!cat.structures[m.target]) out.push({ level: 'error', path, message: `unknown target ${m.target}` });
    for (const r of m.reveals) {
      const p = cat.properties[r.property];
      if (!p) { out.push({ level: 'error', path, message: `reveals unknown property ${r.property}` }); continue; }
      if (r.side && !p.paired) out.push({ level: 'error', path, message: `side given for unpaired property ${r.property}` });
      const site = r.context?.site ?? m.context?.site;
      if (site && !cat.structures[site]) out.push({ level: 'error', path, message: `unknown site ${site}` });
    }
    for (const i of m.requires?.instrument ?? []) if (!cat.instruments[i]) out.push({ level: 'error', path, message: `unknown instrument ${i}` });
    if (m.context?.instrument && !cat.instruments[m.context.instrument]) out.push({ level: 'error', path, message: `unknown instrument ${m.context.instrument}` });
    if (m.sideContext?.length && !m.paired) out.push({ level: 'error', path, message: 'sideContext on an unpaired manoeuvre' });
    checkText(m.label, L, `${path}.label`, out, 'warning');
    for (const l of L) if (!(m.phrases[l]?.length)) out.push({ level: 'warning', path: `${path}.phrases`, message: `no ${l} phrases` });
  }
  for (const inv of Object.values(cat.investigations)) {
    const path = `investigations.${inv.id}`;
    typeRefs(inv.value, cat, path, out);
    checkNormal(inv.normal, inv.value, cat, path, out);
    if (!reg.formatters[inv.formatter]) out.push({ level: 'error', path, message: `formatter ${inv.formatter} is not registered` });
    if (inv.source !== 'case' && (!inv.resolver || !reg.resolvers[inv.resolver])) out.push({ level: 'error', path, message: 'needs a registered resolver' });
    checkMeasurement(inv.measurement, inv.source, path, out);
  }
  for (const t of Object.values(cat.topics)) {
    if (t.parent && !cat.topics[t.parent]) out.push({ level: 'error', path: `topics.${t.id}`, message: `unknown parent ${t.parent}` });
    for (const l of L) if (!(t.intents[l]?.length)) out.push({ level: 'warning', path: `topics.${t.id}`, message: `no ${l} intents` });
    if (t.defaultAnswer) checkText(t.defaultAnswer, L, `topics.${t.id}.defaultAnswer`, out, 'warning');
  }
  for (const d of Object.values(cat.diagnoses)) checkText(d.label, L, `diagnoses.${d.id}.label`, out, 'warning');
  return out;
}

function checkValued(v: Valued, t: ValueType, cat: Catalog, path: string, out: Issue[]) {
  const e = checkValue(t, v.value, cat);
  if (e) out.push({ level: 'error', path, message: e });
  for (const [i, rule] of (v.when ?? []).entries()) {
    const mode = rule.mode ?? 'replace';
    const p = `${path}.when[${i}]`;
    if (mode === 'replace') { const er = checkValue(t, rule.value, cat); if (er) out.push({ level: 'error', path: p, message: er }); }
    if (mode === 'merge') {
      if (t.kind !== 'record') out.push({ level: 'error', path: p, message: 'merge needs a record value' });
      else { const er = checkValue(t, rule.value, cat, true); if (er) out.push({ level: 'error', path: p, message: er }); }
    }
    if (mode === 'scale') {
      if (typeof rule.factor !== 'number') out.push({ level: 'error', path: p, message: 'scale needs a numeric factor' });
      if (t.kind === 'record') for (const f of rule.fields ?? []) {
        if (t.fields[f]?.kind !== 'quantity') out.push({ level: 'error', path: p, message: `cannot scale non-numeric field ${f}` });
      }
    }
  }
}

export function validateCase(c: CaseDef, cat: Catalog, reg: Registry): Issue[] {
  const out: Issue[] = [];
  const L = c.locales;
  if (c.schema !== 'vp.case/1') out.push({ level: 'error', path: 'schema', message: `unsupported schema ${c.schema}` });
  if (!L.includes('en')) out.push({ level: 'error', path: 'locales', message: 'English is required as the fallback' });
  if (!/^\d+\.\d+\.\d+$/.test(c.version)) out.push({ level: 'error', path: 'version', message: 'version must be semver' });
  checkText(c.title, L, 'title', out);
  checkText(c.setting.place, L, 'setting.place', out);
  checkText(c.setting.triage, L, 'setting.triage', out);
  if (c.patient.companion) checkText(c.patient.companion.relation, L, 'patient.companion.relation', out);
  if (!c.authoring.authors.length) out.push({ level: 'warning', path: 'authoring.authors', message: 'no author' });
  if (c.status === 'published' && !c.authoring.reviewers.length) out.push({ level: 'error', path: 'authoring.reviewers', message: 'a published case needs a clinical reviewer' });

  /* pathology */
  for (const k of Object.keys(c.pathology.physiology ?? {})) {
    if (!reg.physiologyKeys.includes(k)) out.push({ level: 'error', path: `pathology.physiology.${k}`, message: 'not a circulation parameter' });
  }
  for (const [k, v] of Object.entries(c.pathology.electrical ?? {})) {
    const def = (ELECTRICAL_DEFAULTS as unknown as Record<string, unknown>)[k];
    if (def === undefined) out.push({ level: 'error', path: `pathology.electrical.${k}`, message: `unknown electrical parameter ${k}` });
    else if (typeof def !== typeof v) out.push({ level: 'error', path: `pathology.electrical.${k}`, message: `expected a ${typeof def}` });
    else if (typeof v === 'string') {
      const variable = VARIABLE_BY_ID[`electrical.${k}`];
      if (variable?.options && !variable.options.some((o) => o.value === v)) out.push({ level: 'error', path: `pathology.electrical.${k}`, message: `unknown value ${v}` });
    }
  }
  for (const k of Object.keys(c.pathology.chemistry ?? {})) {
    if (!(k in CHEMISTRY_DEFAULTS)) out.push({ level: 'error', path: `pathology.chemistry.${k}`, message: 'not a chemistry variable' });
  }
  for (const [i, les] of (c.pathology.lesions ?? []).entries()) {
    for (const n of les.nodes) if (!(n in NODES)) out.push({ level: 'error', path: `pathology.lesions[${i}]`, message: `unknown nervous-system node ${n}` });
  }
  for (const [i, cond] of (c.pathology.conditions ?? []).entries()) {
    const def = reg.conditions[cond.id];
    if (!def) { out.push({ level: 'error', path: `pathology.conditions[${i}]`, message: `no model understands condition ${cond.id}` }); continue; }
    for (const [k, v] of Object.entries(cond.params ?? {})) {
      const kind = def.params[k];
      const p = `pathology.conditions[${i}].params.${k}`;
      if (!kind) out.push({ level: 'error', path: p, message: 'unknown parameter' });
      else if (kind === 'side' && v !== 'L' && v !== 'R') out.push({ level: 'error', path: p, message: 'expected L or R' });
      else if (kind === 'fraction' && !(typeof v === 'number' && v >= 0 && v <= 1)) out.push({ level: 'error', path: p, message: 'expected 0–1' });
      else if (kind === 'number' && typeof v !== 'number') out.push({ level: 'error', path: p, message: 'expected a number' });
    }
  }

  /* case layer */
  const checkLayer = (layer: Record<string, Valued> | undefined, path: string) => {
    for (const [key, v] of Object.entries(layer ?? {})) {
      const r = parseRef(key);
      const def = cat.properties[r.property];
      const p = `${path}.${key}`;
      if (!def) { out.push({ level: 'error', path: p, message: 'unknown property' }); continue; }
      if (def.paired && !r.side) out.push({ level: 'error', path: p, message: 'paired property needs .L or .R' });
      if (!def.paired && r.side) out.push({ level: 'error', path: p, message: 'unpaired property takes no side' });
      if (def.source === 'model') out.push({ level: 'error', path: p, message: 'only a model may produce this property; change the pathology instead' });
      checkValued(v, def.value, cat, p, out);
    }
  };
  checkLayer(c.observables, 'observables');
  for (const ev of c.course ?? []) checkLayer(ev.change.observables, `course@${ev.atMinutes}.observables`);
  for (const [id, v] of Object.entries(c.investigations ?? {})) {
    const inv = cat.investigations[id];
    if (!inv) { out.push({ level: 'error', path: `investigations.${id}`, message: 'unknown investigation' }); continue; }
    if (inv.source === 'model') out.push({ level: 'error', path: `investigations.${id}`, message: 'only a model may produce this result' });
    checkValued(v, inv.value, cat, `investigations.${id}`, out);
  }

  /* history */
  const factIds = new Set<string>();
  for (const f of c.history) {
    const p = `history.${f.id}`;
    if (factIds.has(f.id)) out.push({ level: 'error', path: p, message: 'duplicate fact id' });
    factIds.add(f.id);
    if (!cat.topics[f.topic]) out.push({ level: 'error', path: p, message: `unknown topic ${f.topic}` });
    if (f.speaker === 'companion' && !c.patient.companion) out.push({ level: 'error', path: p, message: 'spoken by a companion, but the case has none' });
    checkText(f.say, L, `${p}.say`, out);
  }

  /* reference and diagnosis */
  for (const e of c.reference.evidence) {
    const p = `reference.evidence.${e.id}`;
    if (e.kind === 'property') {
      const r = parseRef(e.ref); const def = cat.properties[r.property];
      if (!def) out.push({ level: 'error', path: p, message: `unknown property ${e.ref}` });
      else if (def.paired && !r.side) out.push({ level: 'error', path: p, message: 'paired property needs a side' });
    }
    if (e.kind === 'fact' && !factIds.has(e.ref)) out.push({ level: 'error', path: p, message: `unknown fact ${e.ref}` });
    if (e.kind === 'investigation' && !cat.investigations[e.ref]) out.push({ level: 'error', path: p, message: `unknown investigation ${e.ref}` });
    for (const d of e.discriminates ?? []) if (!cat.diagnoses[d]) out.push({ level: 'error', path: p, message: `unknown diagnosis ${d}` });
    checkText(e.why, L, `${p}.why`, out);
  }
  for (const [i, rf] of c.reference.redFlags.entries()) {
    if (rf.kind === 'fact' && !factIds.has(rf.ref)) out.push({ level: 'error', path: `reference.redFlags[${i}]`, message: `unknown fact ${rf.ref}` });
    if (rf.kind === 'property' && !cat.properties[parseRef(rf.ref).property]) out.push({ level: 'error', path: `reference.redFlags[${i}]`, message: `unknown property ${rf.ref}` });
    checkText(rf.why, L, `reference.redFlags[${i}].why`, out);
  }
  checkText(c.reference.summary, L, 'reference.summary', out);
  for (const id of [c.diagnosis.primary, ...c.diagnosis.accepted, ...c.diagnosis.differential]) {
    if (!cat.diagnoses[id]) out.push({ level: 'error', path: 'diagnosis', message: `unknown diagnosis ${id}` });
  }
  for (const ev of c.course ?? []) for (const id of ev.unless ?? []) {
    if (!cat.manoeuvres[id] && !cat.investigations[id]) out.push({ level: 'error', path: `course@${ev.atMinutes}`, message: `unknown action ${id}` });
  }
  return out;
}
