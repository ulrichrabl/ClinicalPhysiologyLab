import type { CaseDef } from '../model/types.ts';
import { CHEMISTRY_DEFAULTS } from '../../models/chemistry/public-state.ts';
import { ELECTRICAL_DEFAULTS, ELECTRICAL_PRESETS, type ElectricalParams } from './heart/electrical.ts';
import { RESPIRATORY_DEFAULTS, type RespiratoryParams } from './lung/respiratory.ts';
import { BODY_DEFAULTS, type BodyParams } from './body/body.ts';
import { CIRC, BARO, klotzV0, klotzV30 } from '../evidence/circulation.ts';
const r1 = (x: number) => Math.round(x * 10) / 10;

/* ===========================================================================
   The patient's model state: every parameter of every physiological model,
   in one plain object. This is what the Model Lab lists and edits, what a
   case sets (its pathology), and what the models run on. It contains no
   findings: findings are measurements taken of the running models.
=========================================================================== */

/** Circulation parameters, as the closed-loop model names them, with healthy adult values. */
export const CIRCULATION_DEFAULTS: Record<string, number> = {
  /* Left ventricle: linear ESPVR, Klotz's normalised human EDPVR between its zero-pressure volume and its volume at 30 mmHg. */
  Emax: CIRC.lvEes, V0: CIRC.lvV0, edpV0: r1(klotzV0(CIRC.lvEdvRef, CIRC.lvEdpRef)), edpV30: r1(klotzV30(CIRC.lvEdvRef, CIRC.lvEdpRef)),
  EmaxRv: CIRC.rvEes, V0rv: CIRC.rvV0, edpV0rv: r1(klotzV0(CIRC.rvEdvRef, CIRC.rvEdpRef)), edpV30rv: r1(klotzV30(CIRC.rvEdvRef, CIRC.rvEdpRef)),
  ElaMax: CIRC.laEmax, ElaMin: CIRC.laEmin, V0la: CIRC.laV0, EraMax: CIRC.raEmax, EraMin: CIRC.raEmin, V0ra: CIRC.raV0,
  Csa: CIRC.Csa, V0sa: CIRC.V0sa, Csv: CIRC.Csv, V0sv: CIRC.V0sv, Rsys: CIRC.Rsys, Rven: CIRC.Rven,
  Cpa: CIRC.Cpa, V0pa: CIRC.V0pa, Cpv: CIRC.Cpv, V0pv: CIRC.V0pv, Rpul: CIRC.Rpul, Rpv: CIRC.Rpv,
  Rmitral: CIRC.Rmitral, Raortic: CIRC.Raortic, Rtricuspid: CIRC.Rtricuspid, Rpulmonic: CIRC.Rpulmonic,
  regMitral: 0, regAortic: 0, regTricuspid: 0, regPulmonic: 0,
  /* HR is the intrinsic sinus rate; the resting rate is what autonomic tone makes of it. */
  bloodVolume: CIRC.bloodVolume, HR: BARO.intrinsicHr, K: 4,
  pericardialFluid: 0, periV0: CIRC.periV0, septalShift: CIRC.septalShift, septalRef: CIRC.septalRef,
  baroEnabled: 1, Pn: BARO.Pn, tauS: BARO.tauS, tauP: BARO.tauP, gS: BARO.gS, gP: BARO.gP, gR: BARO.gR, gV: BARO.gV, gE: BARO.gE,
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
  /** extent: the share of a structure's fibres the lesion takes, where less than all (default 1) */
  lesions: { nodes: string[]; complete: boolean; extent?: Record<string, number> };
  /** Body water, salt, potassium, acid–base, kidney, fuels: intake, losses, drugs, hormones, and how long the illness has acted. */
  body: BodyParams;
  /** Values clamped by the learner (an experiment) or, for what no model yet produces, by the case. */
  chemistry: Record<string, number>;
  /** The chronic state the patient lived in before this illness, reached as a steady state before the illness starts. */
  chronic?: { days?: number; circulation?: Record<string, number>; respiratory?: Partial<RespiratoryParams>; body?: Partial<BodyParams> };
}

export function healthyModel(): PatientModel {
  return {
    patient: { age: 45, sex: 'M', heightCm: 176, weightKg: 76 },
    circulation: { ...CIRCULATION_DEFAULTS },
    electrical: { ...ELECTRICAL_DEFAULTS },
    respiratory: { ...RESPIRATORY_DEFAULTS },
    vestibular: { side: 'none', severity: 0.8, daysSinceOnset: 1 },
    lesions: { nodes: [], complete: true },
    body: { ...BODY_DEFAULTS },
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
  /* The illness acts on top of the chronic state: what the case sets for the chronic disease holds unless the illness changes it. */
  const ch = c.pathology.chronic;
  m.circulation = { ...CIRCULATION_DEFAULTS, ...(ch?.physiology ?? {}), ...(c.pathology.physiology ?? {}) };
  m.electrical = { ...ELECTRICAL_DEFAULTS, ...((c.pathology.electrical ?? {}) as Partial<ElectricalParams>) };
  m.respiratory = { ...RESPIRATORY_DEFAULTS, ...((ch?.respiratory ?? {}) as Partial<RespiratoryParams>), ...((c.pathology.respiratory ?? {}) as Partial<RespiratoryParams>) };
  m.body = { ...BODY_DEFAULTS, ...((ch?.body ?? {}) as Partial<BodyParams>), ...((c.pathology.body ?? {}) as Partial<BodyParams>) };
  if (ch) m.chronic = { days: ch.days, circulation: ch.physiology, respiratory: ch.respiratory as Partial<RespiratoryParams>, body: ch.body as Partial<BodyParams> };
  const vh = c.pathology.conditions?.find((x) => x.id === 'vestibular-hypofunction');
  if (vh) m.vestibular = { side: (vh.params?.side as 'L' | 'R') ?? 'L', severity: Number(vh.params?.severity ?? 0.8), daysSinceOnset: Number(vh.params?.daysSinceOnset ?? 1) };
  const lesions = c.pathology.lesions ?? [];
  m.lesions = { nodes: [...new Set(lesions.flatMap((l) => l.nodes))], complete: lesions.every((l) => l.complete !== false) };
  for (const l of lesions) if (l.extent !== undefined) for (const n of l.nodes) (m.lesions.extent ??= {})[n] = l.extent;
  m.chemistry = { ...(c.pathology.chemistry ?? {}) };
  if (m.chemistry.potassium != null) m.circulation.K = m.chemistry.potassium;
  return m;
}

/** Write a model back as a case's pathology (only what differs from healthy). */
export function pathologyOf(m: PatientModel): CaseDef['pathology'] {
  /* What the illness changes is written against the chronic state it acts on. */
  const baseC: Record<string, number> = { ...CIRCULATION_DEFAULTS, ...(m.chronic?.circulation ?? {}) };
  const baseR: Record<string, unknown> = { ...RESPIRATORY_DEFAULTS, ...(m.chronic?.respiratory ?? {}) };
  const baseB: Record<string, unknown> = { ...BODY_DEFAULTS, ...(m.chronic?.body ?? {}) };
  const physiology: Record<string, number> = {};
  for (const [k, v] of Object.entries(m.circulation)) if (baseC[k] !== v && !(k === 'K' && m.chemistry.potassium === v)) physiology[k] = v;
  const electrical: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(m.electrical)) if ((ELECTRICAL_DEFAULTS as any)[k] !== v) electrical[k] = v;
  const respiratory: Record<string, number> = {};
  for (const [k, v] of Object.entries(m.respiratory)) if (baseR[k] !== v) respiratory[k] = v;
  const body: Record<string, number> = {};
  for (const [k, v] of Object.entries(m.body)) if (baseB[k] !== v) body[k] = v;
  const p: CaseDef['pathology'] = {};
  if (Object.keys(physiology).length) p.physiology = physiology;
  if (Object.keys(electrical).length) p.electrical = electrical;
  if (Object.keys(respiratory).length) p.respiratory = respiratory;
  if (Object.keys(body).length) p.body = body;
  if (m.chronic) p.chronic = { days: m.chronic.days, physiology: m.chronic.circulation, respiratory: m.chronic.respiratory as Record<string, number>, body: m.chronic.body as Record<string, number> };
  if (m.vestibular.side !== 'none') p.conditions = [{ id: 'vestibular-hypofunction', params: { side: m.vestibular.side, severity: m.vestibular.severity, daysSinceOnset: m.vestibular.daysSinceOnset } }];
  if (m.lesions.nodes.length) {
    /* structures with a partial extent go in a lesion of their own */
    const ex = m.lesions.extent ?? {}, whole = m.lesions.nodes.filter((n) => ex[n] === undefined);
    p.lesions = [...(whole.length ? [{ nodes: whole, complete: m.lesions.complete }] : []),
      ...[...new Set(m.lesions.nodes.filter((n) => ex[n] !== undefined).map((n) => ex[n]))].map((e) => ({ nodes: m.lesions.nodes.filter((n) => ex[n] === e), complete: m.lesions.complete, extent: e }))];
  }
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

export { CHEMISTRY_DEFAULTS, ELECTRICAL_DEFAULTS, RESPIRATORY_DEFAULTS, BODY_DEFAULTS };
