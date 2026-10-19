import type { LocalizedText } from '../model/i18n.ts';
import type { VariableDef } from '../physiology/types.ts';
import { MODEL_BY_ID, VARIABLE_BY_ID } from '../physiology/models.ts';
import { CATALOG } from '../data/catalog.ts';
import { ELECTRICAL_PRESETS } from '../physiology/heart/electrical.ts';

/* ---------------------------------------------------------------------------
   Stations (ADR-017): one test and the mechanism that writes it, on one
   clock.

   A station is derived from its test. The settings it offers are the
   parameters of every model whose variables the test measures (the
   catalog's measurement spec), grouped as the Model Lab groups them, plus
   the few parameters of other models that a measured variable depends on,
   each listed with the reason. Nothing in a station decides what the
   signal looks like.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });

export interface StationDef {
  id: string;
  /** the investigation or examination the station is about */
  test: string;
  /** the other observables of the same examination, when it reads several (the eye examination: pupils, movements, fields…) */
  alsoTests?: string[];
  /** groups of a measured model that none of the station's observables depend on, with why they are left out */
  leaveOut?: Record<string, LocalizedText>;
  title: LocalizedText;
  summary: LocalizedText;
  /** parameters of other models that a measured variable depends on: variable id → why */
  drivers: Record<string, LocalizedText>;
  /** named starting points, grouped */
  presets: Array<{ group: LocalizedText; ids: string[] }>;
}

export const ECG_STATION: StationDef = {
  id: 'ecg', test: 'ecg-12',
  title: L('ECG station', 'EKG-Station'),
  summary: L('One test and the physiology that writes it, on one clock. Change what moves the ECG; follow the cursor through the beat.',
    'Ein Test und die Physiologie, die ihn schreibt, auf einer Uhr. Ändern Sie, was das EKG bewegt; folgen Sie dem Cursor durch den Herzschlag.'),
  drivers: {
    'fluids.clamp-potassium': L('The ECG measures the potassium equilibrium potential, which plasma potassium sets.', 'Das EKG misst das Kalium-Gleichgewichtspotential, das das Plasmakalium bestimmt.'),
  },
  presets: [
    { group: L('Rhythm', 'Rhythmus'), ids: ['normal', 'af', 'flutter', 'vt', 'vf'] },
    { group: L('AV conduction', 'AV-Überleitung'), ids: ['avb1', 'wenckebach', 'mobitz2', 'chb'] },
    { group: L('Ventricular conduction', 'Kammerleitung'), ids: ['rbbb', 'lbbb', 'wpw'] },
    { group: L('Chambers', 'Herzhöhlen'), ids: ['lvh', 'rvh', 'p-mitrale', 'p-pulmonale'] },
    { group: L('Ischaemia', 'Ischämie'), ids: ['stemi-anterior', 'stemi-inferior', 'stemi-lateral', 'nstemi', 'wellens'] },
    { group: L('Repolarisation', 'Repolarisation'), ids: ['pericarditis', 'early-repol', 'brugada', 'long-qt', 'digoxin'] },
    { group: L('Potassium', 'Kalium'), ids: ['hyperkalaemia', 'hypokalaemia'] },
  ],
};

/* The auscultation station (ADR-017 step 4): the stethoscope, and the mechanics that make each sound. Its starting points
   are haemodynamic (stations/auscultation-presets.ts), so `presets` is empty here. */
export const AUSCULTATION_STATION: StationDef = {
  id: 'auscultation', test: 'heart.sounds',
  title: L('Auscultation station', 'Auskultations-Station'),
  summary: L('The heart sounds and the mechanics that make them, on one clock. Change the valves and the ventricle; follow the cursor through the beat and hear each sound where its valve moves.',
    'Die Herztöne und die Mechanik, die sie erzeugt, auf einer Uhr. Ändern Sie Klappen und Kammer; folgen Sie dem Cursor durch den Herzschlag und hören Sie jeden Ton dort, wo sich seine Klappe bewegt.'),
  drivers: {
    'electrical.HR': L('The rate sets how long each phase lasts: diastole shortens most as it rises.', 'Die Frequenz bestimmt, wie lange jede Phase dauert: Steigt sie, verkürzt sich vor allem die Diastole.'),
    'electrical.atrial': L('Without atrial contraction (fibrillation) there is no atrial kick and no fourth heart sound.', 'Ohne Vorhofkontraktion (Flimmern) gibt es keinen Vorhofstoß und keinen vierten Herzton.'),
  },
  presets: [],
};

/* The eye station: the whole eye examination, neurological and vestibular, and the pathway each test reads. Its starting
   points are lesions (stations/eye-presets.ts), so `presets` is empty here. */
export const EYE_STATION: StationDef = {
  id: 'eyes', test: 'eyes.nystagmus',
  alsoTests: ['eye.pupil', 'eyes.swinging-light', 'eye.lid', 'eye.motility', 'eyes.alignment', 'eye.head-impulse', 'eyes.pursuit', 'eye.field',
    'eyes.sclera', 'eyes.conjunctiva', 'eyes.thyroid'],
  leaveOut: { 'endocrine/calcium': L('Calcium and bone do not reach the eye examination.', 'Calcium und Knochen erreichen die Augenuntersuchung nicht.') },
  title: L('Eye station', 'Augen-Station'),
  summary: L('The eye examination and what it reads: pupils, movements, alignment, nystagmus, the head impulse and the fields; and the body in the eye: bilirubin in the sclera, haemoglobin in the conjunctiva, thyroid hormone in the lids. Cut a nerve or change the body; watch the eyes and the mechanism side by side.',
    'Die Augenuntersuchung und was sie prüft: Pupillen, Motorik, Stellung, Nystagmus, Kopfimpuls und Gesichtsfeld; und der Körper im Auge: Bilirubin in der Sklera, Hämoglobin in der Konjunktiva, Schilddrüsenhormon in den Lidern. Durchtrennen Sie einen Nerv oder verändern Sie den Körper; sehen Sie Augen und Mechanismus nebeneinander.'),
  drivers: {
    'water.courseHours': L('Bilirubin, haemoglobin and thyroid hormone change over days to weeks: how long the illness has acted decides how far they have come.', 'Bilirubin, Hämoglobin und Schilddrüsenhormon ändern sich über Tage bis Wochen: Wie lange die Erkrankung wirkt, entscheidet, wie weit sie gekommen sind.'),
  },
  presets: [],
};

export const STATIONS: StationDef[] = [ECG_STATION, AUSCULTATION_STATION, EYE_STATION];

export interface SettingGroup { id: string; label: LocalizedText; vars: VariableDef[]; why?: LocalizedText }

/** The settings a station offers: derived from what its test measures. */
export function stationSettings(def: StationDef): SettingGroup[] {
  const measures = [def.test, ...(def.alsoTests ?? [])].flatMap((id) => (CATALOG.investigations[id] ?? CATALOG.properties[id])?.measurement?.measures ?? []);
  const models = [...new Set(measures.map((id) => id.split('.')[0]))].map((id) => MODEL_BY_ID[id]).filter(Boolean);
  const out: SettingGroup[] = [];
  for (const m of models) {
    const params = m.variables.filter((v) => v.kind === 'parameter');
    const groups = m.groups.length ? m.groups : [{ id: '', label: m.title }];
    for (const g of groups) {
      const vars = params.filter((v) => (v.group ?? '') === g.id || !g.id);
      if (def.leaveOut?.[`${m.id}/${g.id}`]) continue;
      if (vars.length) out.push({ id: `${m.id}/${g.id}`, label: g.label, vars });
    }
  }
  for (const [id, why] of Object.entries(def.drivers)) {
    const v = VARIABLE_BY_ID[id];
    /* the group is named by the variable, without the explanation its label may carry in brackets (the reason says why) */
    if (v) out.push({ id: `driver/${id}`, label: { en: v.label.en.split(' (')[0], de: v.label.de.split(' (')[0] }, vars: [v], why });
  }
  return out;
}

/** The presets a station offers, with their labels, in its groups (only those the model has). */
export function stationPresets(def: StationDef) {
  return def.presets.map((g) => ({ group: g.group, presets: g.ids.map((id) => ELECTRICAL_PRESETS.find((p) => p.id === id)).filter((p): p is typeof ELECTRICAL_PRESETS[number] => !!p) }));
}
