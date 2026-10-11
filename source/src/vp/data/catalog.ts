import type {
  DiagnosisDef, HistoryTopicDef, InstrumentDef, InvestigationDef, ManoeuvreDef, PropertyDef, ScaleDef, StructureDef, ValueSetDef,
} from '../model/types.ts';
import { INSTRUMENTS, SCALES, STRUCTURES, VALUE_SETS } from './ontology.ts';
import { PROPERTIES } from './properties.ts';
import { MANOEUVRES } from './manoeuvres.ts';
import { HISTORY_TOPICS } from './history.ts';
import { DIAGNOSES } from './diagnoses.ts';
import { INVESTIGATIONS } from './investigations.ts';

/* ---------------------------------------------------------------------------
   The catalog: every shared vocabulary item, indexed by id. Cases refer into
   it; nothing in it belongs to any one case. It is plain data and can be
   exported to JSON for an authoring platform (see exportCatalog).
--------------------------------------------------------------------------- */

export interface Catalog {
  version: string;
  structures: Record<string, StructureDef>;
  scales: Record<string, ScaleDef>;
  valueSets: Record<string, ValueSetDef>;
  instruments: Record<string, InstrumentDef>;
  properties: Record<string, PropertyDef>;
  manoeuvres: Record<string, ManoeuvreDef>;
  investigations: Record<string, InvestigationDef>;
  topics: Record<string, HistoryTopicDef>;
  diagnoses: Record<string, DiagnosisDef>;
}

export interface CatalogParts {
  version: string;
  structures: StructureDef[]; scales: ScaleDef[]; valueSets: ValueSetDef[]; instruments: InstrumentDef[];
  properties: PropertyDef[]; manoeuvres: ManoeuvreDef[]; investigations: InvestigationDef[];
  topics: HistoryTopicDef[]; diagnoses: DiagnosisDef[];
}

function index<T extends { id: string }>(kind: string, items: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const it of items) {
    if (out[it.id]) throw new Error(`duplicate ${kind} id ${it.id}`);
    out[it.id] = it;
  }
  return out;
}

export function buildCatalog(p: CatalogParts): Catalog {
  return {
    version: p.version,
    structures: index('structure', p.structures),
    scales: index('scale', p.scales),
    valueSets: index('value set', p.valueSets),
    instruments: index('instrument', p.instruments),
    properties: index('property', p.properties),
    manoeuvres: index('manoeuvre', p.manoeuvres),
    investigations: index('investigation', p.investigations),
    topics: index('topic', p.topics),
    diagnoses: index('diagnosis', p.diagnoses),
  };
}

export const CATALOG_PARTS: CatalogParts = {
  version: '0.1.0',
  structures: STRUCTURES, scales: SCALES, valueSets: VALUE_SETS, instruments: INSTRUMENTS,
  properties: PROPERTIES, manoeuvres: MANOEUVRES, investigations: INVESTIGATIONS,
  topics: HISTORY_TOPICS, diagnoses: DIAGNOSES,
};

export const CATALOG: Catalog = buildCatalog(CATALOG_PARTS);

/** The catalog as JSON, for an authoring platform or a content repository. */
export function exportCatalog(c: CatalogParts = CATALOG_PARTS): string {
  return JSON.stringify({ schema: 'vp.catalog/1', ...c }, null, 2);
}
