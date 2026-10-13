import type {
  DiagnosisDef, ExamSystemDef, HistoryTopicDef, InstrumentDef, InvestigationDef, ManoeuvreDef, PropertyDef, ScaleDef, StructureDef, ValueSetDef,
} from '../model/types.ts';
import { INSTRUMENTS, SCALES, STRUCTURES, VALUE_SETS } from './ontology.ts';
import { PROPERTIES } from './properties.ts';
import { MANOEUVRES } from './manoeuvres.ts';
import { HISTORY_TOPICS } from './history.ts';
import { DIAGNOSES } from './diagnoses.ts';
import { INVESTIGATIONS } from './investigations.ts';
import { MEASUREMENTS } from './measurements.ts';
import { EXAM_SYSTEMS } from './exam-structure.ts';
import { TEACHING } from './teaching.ts';

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
  /** How the examination is organised, in clinical order (data/exam-structure.ts). */
  examSystems: ExamSystemDef[];
}

export interface CatalogParts {
  version: string;
  structures: StructureDef[]; scales: ScaleDef[]; valueSets: ValueSetDef[]; instruments: InstrumentDef[];
  properties: PropertyDef[]; manoeuvres: ManoeuvreDef[]; investigations: InvestigationDef[];
  topics: HistoryTopicDef[]; diagnoses: DiagnosisDef[];
  examSystems?: ExamSystemDef[];
}

function index<T extends { id: string }>(kind: string, items: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const it of items) {
    if (out[it.id]) throw new Error(`duplicate ${kind} id ${it.id}`);
    out[it.id] = it;
  }
  return out;
}

/** Give each manoeuvre its section and its place in the clinical sequence, from the exam structure. */
function placeManoeuvres(manoeuvres: ManoeuvreDef[], systems: ExamSystemDef[]): ManoeuvreDef[] {
  const place = new Map<string, { section: string; order: number }>();
  let n = 0;
  for (const sys of systems) for (const sec of sys.sections) for (const id of sec.manoeuvres) {
    if (place.has(id)) throw new Error(`manoeuvre ${id} is in two exam sections`);
    place.set(id, { section: sec.id, order: n++ });
  }
  return manoeuvres.map((m) => (place.has(m.id) ? { ...m, ...place.get(m.id) } : m));
}

export function buildCatalog(p: CatalogParts): Catalog {
  const examSystems = p.examSystems ?? [];
  return {
    version: p.version,
    structures: index('structure', p.structures),
    scales: index('scale', p.scales),
    valueSets: index('value set', p.valueSets),
    instruments: index('instrument', p.instruments),
    properties: index('property', p.properties),
    manoeuvres: index('manoeuvre', placeManoeuvres(p.manoeuvres, examSystems)),
    investigations: index('investigation', p.investigations),
    topics: index('topic', p.topics),
    diagnoses: index('diagnosis', p.diagnoses),
    examSystems,
  };
}

export const CATALOG_PARTS: CatalogParts = {
  version: '0.1.0',
  structures: STRUCTURES, scales: SCALES, valueSets: VALUE_SETS, instruments: INSTRUMENTS,
  /* What each finding and test measures in the models, and the physics of how. */
  properties: PROPERTIES.map((p) => (MEASUREMENTS[p.id] ? { ...p, measurement: MEASUREMENTS[p.id] } : p)),
  /* Each with its teaching card, where one is written. */
  manoeuvres: MANOEUVRES.map((m) => (TEACHING[m.id] ? { ...m, teaching: TEACHING[m.id] } : m)),
  investigations: INVESTIGATIONS.map((x) => (MEASUREMENTS[x.id] ? { ...x, measurement: MEASUREMENTS[x.id] } : x)),
  topics: HISTORY_TOPICS, diagnoses: DIAGNOSES,
  examSystems: EXAM_SYSTEMS,
};

export const CATALOG: Catalog = buildCatalog(CATALOG_PARTS);

/** The catalog as JSON, for an authoring platform or a content repository. */
export function exportCatalog(c: CatalogParts = CATALOG_PARTS): string {
  return JSON.stringify({ schema: 'vp.catalog/1', ...c }, null, 2);
}
