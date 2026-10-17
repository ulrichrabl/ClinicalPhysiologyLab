import type { Catalog } from '../data/catalog.ts';
import { SUPPORTED_LOCALES } from '../model/i18n.ts';
import type { ValueType } from '../model/types.ts';
import type { Issue } from '../engine/validate.ts';
import schema from '../../../knowledge/schema.json';
import { NAMED } from './predicates.ts';
import type { Clause, EntityKind, KnowledgeTables, RelationRow, SignDefinition } from './types.ts';

/* ===========================================================================
   Validating the knowledge tables (ADR-016).

   1. Shape: every row against source/knowledge/schema.json, the contract an
      editing backend will share. A small validator for the subset of JSON
      Schema the file uses, so nothing is added to the vendored dependencies.
   2. Meaning: links resolve and fit their relation; definitions name real
      observables, fields, codes and context dimensions; named predicates
      exist; every sign and syndrome has a label in every supported language.
=========================================================================== */

/* ---- 1. shape --------------------------------------------------------------------- */

type Schema = Record<string, any>;
const ROOT = schema as Schema;

function resolve(s: Schema): Schema {
  return s.$ref ? resolve(ROOT.$defs[s.$ref.replace('#/$defs/', '')]) : s;
}

function typeOk(t: string, v: unknown): boolean {
  switch (t) {
    case 'object': return typeof v === 'object' && v !== null && !Array.isArray(v);
    case 'array': return Array.isArray(v);
    case 'string': return typeof v === 'string';
    case 'number': return typeof v === 'number';
    case 'boolean': return typeof v === 'boolean';
    case 'null': return v === null;
    default: return true;
  }
}

/** Errors of `v` against `s` (empty when it fits). */
export function shapeErrors(sIn: Schema, v: unknown, path: string): string[] {
  const s = resolve(sIn);
  if (s.anyOf) {
    const tries = s.anyOf.map((x: Schema) => shapeErrors(x, v, path));
    return tries.some((e: string[]) => e.length === 0) ? [] : [`${path}: matches none of the allowed forms (${tries.map((e: string[]) => e[0]).join(' | ')})`];
  }
  if (s.enum && !s.enum.includes(v)) return [`${path}: ${JSON.stringify(v)} is not one of ${s.enum.join(', ')}`];
  if (s.type && !typeOk(s.type, v)) return [`${path}: expected ${s.type}`];
  const out: string[] = [];
  if (typeof v === 'string') {
    if (s.minLength && v.length < s.minLength) out.push(`${path}: empty`);
    if (s.pattern && !new RegExp(s.pattern).test(v)) out.push(`${path}: "${v}" does not match ${s.pattern}`);
  }
  if (Array.isArray(v)) {
    if (s.minItems && v.length < s.minItems) out.push(`${path}: needs at least ${s.minItems} item(s)`);
    if (s.items) v.forEach((x, i) => out.push(...shapeErrors(s.items, x, `${path}[${i}]`)));
  }
  if (typeOk('object', v) && (s.properties || s.required)) {
    const o = v as Record<string, unknown>;
    for (const k of s.required ?? []) if (!(k in o)) out.push(`${path}: missing ${k}`);
    for (const [k, x] of Object.entries(o)) {
      if (s.properties?.[k]) out.push(...shapeErrors(s.properties[k], x, `${path}.${k}`));
      else if (s.additionalProperties === false) out.push(`${path}: unknown field ${k}`);
    }
  }
  return out;
}

/* ---- 2. meaning ------------------------------------------------------------------- */

/** The value type at a dotted path inside a value type, or undefined when the path does not exist. */
export function typeAt(t: ValueType, path?: string): ValueType | undefined {
  if (!path) return t;
  let cur: ValueType | undefined = t;
  for (const k of path.split('.')) {
    if (!cur || cur.kind !== 'record') return undefined;
    cur = cur.fields[k];
  }
  return cur;
}

function codesOf(t: ValueType, cat: Catalog): string[] | undefined {
  return t.kind === 'coded' ? cat.valueSets[t.valueSet]?.values.map((v) => v.code) : undefined;
}

/** Whether `v` is a valid value of type `t` (codes from the value set, numbers for quantities). */
function valueOk(t: ValueType, v: unknown, cat: Catalog): boolean {
  switch (t.kind) {
    case 'coded': return typeof v === 'string' && (codesOf(t, cat) ?? []).includes(v);
    case 'quantity': case 'ordinal': return typeof v === 'number';
    case 'boolean': return typeof v === 'boolean';
    case 'text': return typeof v === 'string';
    default: return false;
  }
}

function checkClause(c: Clause, cat: Catalog, path: string, out: Issue[]) {
  const pd = cat.properties[c.obs];
  if (!pd) { out.push({ level: 'error', path, message: `unknown observable ${c.obs}` }); return; }
  const t = typeAt(pd.value, c.path);
  if (!t) { out.push({ level: 'error', path, message: `${c.obs} has no field ${c.path}` }); return; }
  const bad = (m: string) => out.push({ level: 'error', path, message: `${c.obs}${c.path ? '.' + c.path : ''}: ${m}` });
  switch (c.op) {
    case 'abnormal': break;
    case 'eq': case 'ne': if (!valueOk(t, c.value, cat)) bad(`${JSON.stringify(c.value)} is not a valid ${t.kind} value`); break;
    case 'in': if (!Array.isArray(c.value) || !c.value.every((v) => valueOk(t, v, cat))) bad(`${JSON.stringify(c.value)} is not a list of valid values`); break;
    case 'gt': case 'ge': case 'lt': case 'le':
      if (t.kind !== 'quantity' && t.kind !== 'ordinal') bad(`${c.op} needs a number field, not ${t.kind}`);
      else if (typeof c.value !== 'number') bad(`${c.op} needs a number`);
      break;
    case 'has': if (t.kind !== 'list' || !valueOk(t.of, c.value, cat)) bad(`has needs a list of codes containing ${JSON.stringify(c.value)}`); break;
    case 'hasWhere': {
      const item = t.kind === 'list' ? t.of : undefined;
      if (!item || item.kind !== 'record') { bad('hasWhere needs a list of records'); break; }
      for (const [k, v] of Object.entries((c.value ?? {}) as Record<string, unknown>)) {
        const ft = item.fields[k];
        if (!ft || !valueOk(ft, v, cat)) bad(`hasWhere: ${k} = ${JSON.stringify(v)} is not valid`);
      }
      break;
    }
  }
  /* A context key must be one the property varies with, or one a test sets when revealing it. */
  const testKeys = new Set(Object.values(cat.manoeuvres).flatMap((m) => (m.reveals ?? []).filter((r) => r.property === c.obs)
    .flatMap((r) => [...Object.keys(m.context ?? {}), ...Object.keys(r.context ?? {}), ...(m.sideContext ?? [])])));
  for (const k of Object.keys(c.ctx ?? {})) {
    if (!(pd.contextDims ?? []).includes(k as never) && !testKeys.has(k)) bad(`context ${k} does not change this observable and no test sets it`);
  }
  if (c.side && c.side !== 'any') {
    const sided = pd.paired || Object.values(cat.manoeuvres).some((m) => m.paired && (m.reveals ?? []).some((r) => r.property === c.obs));
    if (!sided) bad(`side "${c.side}" on an observable without sides`);
  }
}

function checkDefinition(d: SignDefinition, cat: Catalog, path: string, out: Issue[]) {
  if ('all' in d) d.all.forEach((x, i) => checkDefinition(x, cat, `${path}.all[${i}]`, out));
  else if ('any' in d) d.any.forEach((x, i) => checkDefinition(x, cat, `${path}.any[${i}]`, out));
  else if ('not' in d) checkDefinition(d.not, cat, `${path}.not`, out);
  else if ('fn' in d) {
    const p = NAMED[d.fn];
    if (!p) { out.push({ level: 'error', path, message: `unknown named predicate ${d.fn}` }); return; }
    for (const o of p.uses(d.args ?? {})) if (!cat.properties[o]) out.push({ level: 'error', path, message: `${d.fn} reads unknown observable ${o}` });
    const a = (d.args ?? {}) as Record<string, any>;
    if (a.obs && cat.properties[a.obs] && a.path && !typeAt(cat.properties[a.obs].value, a.path)) out.push({ level: 'error', path, message: `${a.obs} has no field ${a.path}` });
  } else checkClause(d, cat, path, out);
}

const ALLOWED: Record<RelationRow['rel'], { from: EntityKind[]; to: EntityKind[] }> = {
  'variant-of': { from: ['sign'], to: ['sign'] },
  'part-of': { from: ['sign'], to: ['syndrome'] },
  suggests: { from: ['sign', 'syndrome'], to: ['condition'] },
  'localises-to': { from: ['sign', 'syndrome'], to: ['structure'] },
  'is-a': { from: ['condition'], to: ['condition'] },
};

export interface KnowledgeContext {
  catalog: Catalog;
  references: Record<string, unknown>;
  /** Case ids, to check relation exceptions. */
  cases?: string[];
}

export function validateKnowledge(t: KnowledgeTables, ctx: KnowledgeContext): Issue[] {
  const out: Issue[] = [];
  const { catalog: cat, references } = ctx;

  for (const [table, rows] of Object.entries(t)) {
    for (const e of shapeErrors(ROOT.properties[table], rows, table)) out.push({ level: 'error', path: table, message: e });
  }
  if (out.length) return out;   // meaning checks assume the shape

  const dup = (kind: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) { if (seen.has(id)) out.push({ level: 'error', path: kind, message: `duplicate id ${id}` }); seen.add(id); }
  };
  dup('signs', t.signs.map((s) => s.id));
  dup('syndromes', t.syndromes.map((s) => s.id));
  const signs = new Set(t.signs.map((s) => s.id)), syndromes = new Set(t.syndromes.map((s) => s.id));
  const exists = (ref: string): boolean => {
    const [kind, id] = [ref.slice(0, ref.indexOf(':')), ref.slice(ref.indexOf(':') + 1)];
    return kind === 'sign' ? signs.has(id) : kind === 'syndrome' ? syndromes.has(id) : kind === 'condition' ? !!cat.diagnoses[id] : kind === 'structure' ? !!cat.structures[id] : false;
  };
  const checkRefs = (refs: string[] | undefined, path: string) => {
    for (const r of refs ?? []) if (!references[r]) out.push({ level: 'error', path, message: `unknown reference ${r}` });
  };

  for (const s of t.signs) {
    const p = `signs.${s.id}`;
    if (s.definition) checkDefinition(s.definition, cat, `${p}.definition`, out);
    checkRefs(s.refs, p); checkRefs(s.threshold?.refs, `${p}.threshold`);
    if (s.replacedBy && !signs.has(s.replacedBy)) out.push({ level: 'error', path: p, message: `replacedBy ${s.replacedBy} does not exist` });
  }
  for (const s of t.syndromes) {
    checkRefs(s.refs, `syndromes.${s.id}`);
    if (!t.relations.some((r) => r.rel === 'part-of' && r.to === `syndrome:${s.id}`)) out.push({ level: 'error', path: `syndromes.${s.id}`, message: 'has no member signs' });
  }

  const relKeys = new Set<string>();
  t.relations.forEach((r, i) => {
    const p = `relations[${i}] ${r.from} ${r.rel} ${r.to}`;
    const k = `${r.from}|${r.rel}|${r.to}`;
    if (relKeys.has(k)) out.push({ level: 'error', path: p, message: 'duplicate relation' });
    relKeys.add(k);
    const fk = r.from.slice(0, r.from.indexOf(':')) as EntityKind, tk = r.to.slice(0, r.to.indexOf(':')) as EntityKind;
    if (!ALLOWED[r.rel].from.includes(fk) || !ALLOWED[r.rel].to.includes(tk)) out.push({ level: 'error', path: p, message: `${r.rel} links ${ALLOWED[r.rel].from.join('/')} to ${ALLOWED[r.rel].to.join('/')}` });
    for (const e of [r.from, r.to]) if (!exists(e)) out.push({ level: 'error', path: p, message: `${e} does not exist` });
    if (r.rel === 'part-of' && !r.role) out.push({ level: 'error', path: p, message: 'part-of needs a role' });
    if (r.rel !== 'part-of' && r.role) out.push({ level: 'error', path: p, message: 'only part-of takes a role' });
    if (r.rel !== 'suggests' && r.exceptions) out.push({ level: 'error', path: p, message: 'only suggests takes case exceptions' });
    for (const x of r.exceptions ?? []) if (ctx.cases && !ctx.cases.includes(x.case)) out.push({ level: 'error', path: p, message: `exception for unknown case ${x.case}` });
    checkRefs(r.refs, p);
  });
  for (const rel of ['variant-of', 'is-a'] as const) {
    const next = (from: string) => t.relations.filter((r) => r.rel === rel && r.from === from).map((r) => r.to);
    for (const r of t.relations.filter((x) => x.rel === rel)) {
      const seen = new Set<string>([r.from]);
      for (let q = [r.to]; q.length;) {
        const n = q.shift()!;
        if (seen.has(n)) { out.push({ level: 'error', path: `relations ${rel}`, message: `cycle through ${n}` }); break; }
        seen.add(n); q.push(...next(n));
      }
    }
  }

  const textKeys = new Set<string>();
  t.texts.forEach((x, i) => {
    const k = `${x.entity}|${x.field}|${x.locale}`;
    if (textKeys.has(k)) out.push({ level: 'error', path: `texts[${i}]`, message: `duplicate text ${k}` });
    textKeys.add(k);
    if (!exists(x.entity)) out.push({ level: 'error', path: `texts[${i}]`, message: `${x.entity} does not exist` });
  });
  for (const ref of [...t.signs.map((s) => `sign:${s.id}`), ...t.syndromes.map((s) => `syndrome:${s.id}`)]) {
    for (const l of SUPPORTED_LOCALES) if (!textKeys.has(`${ref}|label|${l}`)) out.push({ level: 'error', path: 'texts', message: `${ref} has no label in ${l}` });
  }
  return out;
}
