import type { Catalog } from '../data/catalog.ts';
import type { ValueType } from '../model/types.ts';

/* The observables the models produce, as a read-only table for editors (ADR-016 §2). Generated from the catalog
   into source/knowledge/observables.json by scripts/export-observables.mjs; the tests fail when it is stale. */

function expand(t: ValueType, cat: Catalog): unknown {
  switch (t.kind) {
    case 'coded': return { kind: 'coded', codes: cat.valueSets[t.valueSet]?.values.map((v) => v.code) ?? [] };
    case 'ordinal': { const s = cat.scales[t.scale]; return { kind: 'ordinal', scale: t.scale, min: s?.min, max: s?.max }; }
    case 'record': return { kind: 'record', fields: Object.fromEntries(Object.entries(t.fields).map(([k, v]) => [k, expand(v, cat)])), ...(t.optional ? { optional: t.optional } : {}) };
    case 'list': return { kind: 'list', of: expand(t.of, cat) };
    default: return t;
  }
}

export function exportObservables(cat: Catalog): string {
  const rows = Object.values(cat.properties).map((p) => ({
    id: p.id, label: p.label, structure: p.structure, paired: !!p.paired, source: p.source,
    value: expand(p.value, cat), normal: p.normal.value, contextDims: p.contextDims ?? [],
  }));
  return '[\n' + rows.map((r) => JSON.stringify(r)).join(',\n') + '\n]\n';
}
