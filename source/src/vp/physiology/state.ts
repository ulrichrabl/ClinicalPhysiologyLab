import type { CaseDef } from '../model/types.ts';
import { CHEMISTRY_DEFAULTS } from '../../models/chemistry/public-state.ts';
import { ELECTRICAL_DEFAULTS, ELECTRICAL_PRESETS, type ElectricalParams } from './heart/electrical.ts';
import { RESPIRATORY_DEFAULTS, type RespiratoryParams } from './lung/respiratory.ts';

/* ===========================================================================
   The patient's model state: every parameter of every physiological model,
   in one plain object. This is what the Model Lab lists and edits, what a
   case sets (its pathology), and what the models run on. It contains no
   findings: findings are measurements taken of the running models.
=========================================================================== */

/** Circulation parameters, as the closed-loop model names them, with healthy adult values. */
export const CIRCULATION_DEFAULTS: Record<string, number> = {
  Emax: 2.7, Emin: 0.06, V0: 12, edpA: 0.5, edpB: 0.022,
  EmaxRv: 0.62, V0rv: 22, edpArv: 0.42, edpBrv: 0.020,
  ElaMax: 0.25, ElaMin: 0.13, V0la: 16, EraMax: 0.20, EraMin: 0.10, V0ra: 18,
  Csa: 1.2, V0sa: 620, Csv: 62, V0sv: 3200, Rsys: 1.05, Rven: 0.023,
  Cpa: 4.2, V0pa: 92, Cpv: 8.5, V0pv: 212, Rpul: 0.075, Rpv: 0.011,
  Rmitral: 0.01, Raortic: 0.02, Rtricuspid: 0.009, Rpulmonic: 0.02,
  regMitral: 0, regAortic: 0, regTricuspid: 0, regPulmonic: 0,
  bloodVolume: 5000, HR: 72, K: 4,
  baroEnabled: 1, Pn: 95, tauS: 2.5, tauP: 0.3, gS: 0.5, gP: 0.4, gR: 0.6, gV: 0.26, gE: 0.45,
};

export interface PatientModel {
  patient: { age: number; sex: 'F' | 'M'; heightCm: number; weightKg: number };
  /** Closed-loop circulation and baroreflex parameters. */
  circulation: Record<string, number>;
  /** The heart's electrical substrate: rhythm, conduction, mass, ischaemia. */
  electrical: ElectricalParams;
  /** Lungs, pleura, airways, inspired gas, the control of breathing. */
  respiratory: RespiratoryParams;
  /** Peripheral vestibular function. */
  vestibular: { side: 'none' | 'L' | 'R'; severity: number; daysSinceOnset: number };
  /** Lesioned nodes of the nervous-system graph. */
  lesions: { nodes: string[]; complete: boolean };
  /** Chemistry values pinned by the case or the learner; the rest follow the circulation. */
  chemistry: Record<string, number>;
}

export function healthyModel(): PatientModel {
  return {
    patient: { age: 45, sex: 'M', heightCm: 176, weightKg: 76 },
    circulation: { ...CIRCULATION_DEFAULTS },
    electrical: { ...ELECTRICAL_DEFAULTS },
    respiratory: { ...RESPIRATORY_DEFAULTS },
    vestibular: { side: 'none', severity: 0.8, daysSinceOnset: 1 },
    lesions: { nodes: [], complete: true },
    chemistry: {},
  };
}

/** Apply a named electrical pattern (and any chemistry it implies) over the current model. */
export function applyPreset(m: PatientModel, id: string): PatientModel {
  const pr = ELECTRICAL_PRESETS.find((x) => x.id === id);
  if (!pr) return m;
  const chemistry = { ...m.chemistry };
  if (id === 'normal') delete chemistry.potassium;
  Object.assign(chemistry, pr.chemistry ?? {});
  return { ...m, electrical: { ...ELECTRICAL_DEFAULTS, ...pr.params }, chemistry, circulation: { ...m.circulation, ...(pr.circulation ?? {}), K: chemistry.potassium ?? CIRCULATION_DEFAULTS.K } };
}

/** The model a case describes: its pathology laid over a healthy patient. */
export function modelFromCase(c: CaseDef): PatientModel {
  const m = healthyModel();
  m.patient = { age: c.patient.age, sex: c.patient.sex, heightCm: c.patient.heightCm ?? 170, weightKg: c.patient.weightKg ?? 72 };
  m.circulation = { ...CIRCULATION_DEFAULTS, ...(c.pathology.physiology ?? {}) };
  m.electrical = { ...ELECTRICAL_DEFAULTS, ...((c.pathology.electrical ?? {}) as Partial<ElectricalParams>) };
  m.respiratory = { ...RESPIRATORY_DEFAULTS, ...((c.pathology.respiratory ?? {}) as Partial<RespiratoryParams>) };
  const vh = c.pathology.conditions?.find((x) => x.id === 'vestibular-hypofunction');
  if (vh) m.vestibular = { side: (vh.params?.side as 'L' | 'R') ?? 'L', severity: Number(vh.params?.severity ?? 0.8), daysSinceOnset: Number(vh.params?.daysSinceOnset ?? 1) };
  const lesions = c.pathology.lesions ?? [];
  m.lesions = { nodes: [...new Set(lesions.flatMap((l) => l.nodes))], complete: lesions.every((l) => l.complete !== false) };
  m.chemistry = { ...(c.pathology.chemistry ?? {}) };
  if (m.chemistry.potassium != null) m.circulation.K = m.chemistry.potassium;
  return m;
}

/** Write a model back as a case's pathology (only what differs from healthy). */
export function pathologyOf(m: PatientModel): CaseDef['pathology'] {
  const physiology: Record<string, number> = {};
  for (const [k, v] of Object.entries(m.circulation)) if (CIRCULATION_DEFAULTS[k] !== v && !(k === 'K' && m.chemistry.potassium === v)) physiology[k] = v;
  const electrical: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(m.electrical)) if ((ELECTRICAL_DEFAULTS as any)[k] !== v) electrical[k] = v;
  const respiratory: Record<string, number> = {};
  for (const [k, v] of Object.entries(m.respiratory)) if ((RESPIRATORY_DEFAULTS as any)[k] !== v) respiratory[k] = v;
  const p: CaseDef['pathology'] = {};
  if (Object.keys(physiology).length) p.physiology = physiology;
  if (Object.keys(electrical).length) p.electrical = electrical;
  if (Object.keys(respiratory).length) p.respiratory = respiratory;
  if (m.vestibular.side !== 'none') p.conditions = [{ id: 'vestibular-hypofunction', params: { side: m.vestibular.side, severity: m.vestibular.severity, daysSinceOnset: m.vestibular.daysSinceOnset } }];
  if (m.lesions.nodes.length) p.lesions = [{ nodes: [...m.lesions.nodes], complete: m.lesions.complete }];
  if (Object.keys(m.chemistry).length) p.chemistry = { ...m.chemistry };
  return p;
}

/** A case carrying this model, for the examination engine. */
export function caseWithModel(base: CaseDef, m: PatientModel): CaseDef {
  return {
    ...base,
    patient: { ...base.patient, age: m.patient.age, sex: m.patient.sex, heightCm: m.patient.heightCm, weightKg: m.patient.weightKg },
    pathology: pathologyOf(m),
  };
}

export { CHEMISTRY_DEFAULTS, ELECTRICAL_DEFAULTS, RESPIRATORY_DEFAULTS };
