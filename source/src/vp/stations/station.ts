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

/* The pulse and neck-vein station: the arterial pulse and the jugular venous pressure, read from the circulation's own
   beats. Its starting points are haemodynamic or rhythms (stations/pulse-presets.ts), so `presets` is empty here. */
export const PULSE_STATION: StationDef = {
  id: 'pulse', test: 'jvp', alsoTests: ['pulse.radial', 'pulse.carotid'],
  title: L('Pulse and neck-vein station', 'Puls- und Halsvenen-Station'),
  summary: L('The pulse under the finger and the jugular vein in the neck, beside the pressures that make them: the aorta’s wave, and the right atrium’s a, x, v and y. Change the valves, the vessels or the rhythm; feel and see the difference.',
    'Der Puls unter dem Finger und die Jugularvene am Hals, neben den Drücken, die sie erzeugen: die Welle der Aorta und a, x, v und y des rechten Vorhofs. Ändern Sie Klappen, Gefäße oder Rhythmus; fühlen und sehen Sie den Unterschied.'),
  drivers: {
    'electrical.HR': L('The rate sets how often the wave comes, and how long the ventricle fills before each.', 'Die Frequenz bestimmt, wie oft die Welle kommt und wie lange der Ventrikel vor jeder füllt.'),
    'electrical.atrial': L('Without atrial contraction (fibrillation) there is no a wave, and the pulse loses its regularity.', 'Ohne Vorhofkontraktion (Flimmern) gibt es keine a-Welle, und der Puls verliert seine Regelmäßigkeit.'),
    'electrical.avBlock': L('When atria and ventricles lose step, the atrium can contract against a shut tricuspid valve: cannon waves.', 'Verlieren Vorhöfe und Kammern den Takt, kann der Vorhof gegen die geschlossene Trikuspidalklappe kontrahieren: Kanonenwellen.'),
    'electrical.ventricular': L('A ventricular rhythm taking over separates the ventricles from the atria.', 'Ein übernehmender Kammerrhythmus trennt die Kammern von den Vorhöfen.'),
  },
  presets: [],
};

/* The neurological station (ADR-017 decision 10): the limb examination and the ladder of the nervous system a lesion sits
   on. Its starting points are lesions (stations/neuro-presets.ts), so `presets` is empty here. */
export const NEURO_STATION: StationDef = {
  id: 'neuro', test: 'arm.drift', alsoTests: ['arm.finger-nose', 'leg.reflexes'],
  title: L('Neurological station', 'Neurologie-Station'),
  summary: L('The whole neurological examination on the bedside figure: tone, power, drift, reflexes and plantars, coordination, Romberg, gait, sensation, cranial nerves and speech, beside the ladder of the nervous system from cortex to muscle. Place a lesion on one rung and watch what changes and why; predict it first, or identify a hidden one.',
    'Die ganze neurologische Untersuchung an der Patientenfigur: Tonus, Kraft, Vorhalteversuch, Reflexe und Fußsohlenreflex, Koordination, Romberg, Gang, Sensibilität, Hirnnerven und Sprache, neben der Leiter des Nervensystems von der Rinde bis zum Muskel. Setzen Sie eine Läsion auf eine Stufe und sehen Sie, was sich ändert und warum; sagen Sie es erst vorher, oder erkennen Sie eine verdeckte.'),
  drivers: {},
  presets: [],
};

/* The respiratory station: the whole chest examination (look, the trachea, expansion, percussion, breath sounds and vocal
   resonance at ten sites, the oximeter), beside the lungs, pleura and airways under the chest wall and the breath on one
   clock. Its settings are the models the chest examination measures; the heart behind the lungs is a driver. */
export const RESP_STATION: StationDef = {
  id: 'resp', test: 'lung.sounds', alsoTests: ['chest.percussion', 'chest.resonance', 'chest.expansion', 'trachea.position', 'breathing.pattern', 'vitals.rr', 'vitals.spo2'],
  title: L('Respiratory station', 'Atmungs-Station'),
  summary: L('The chest examination and what lies beneath it: look, feel the trachea and the expansion, percuss, listen and test vocal resonance at ten sites, beside the lobes, the pleura and the airways under the chest wall, and the breath itself on one clock. Fill a lobe, pour fluid into the pleura, narrow the airways; predict what the hands and ears will find, or identify a hidden chest.',
    'Die Thoraxuntersuchung und was darunter liegt: inspizieren, Trachea und Exkursion tasten, perkutieren, auskultieren und die Bronchophonie an zehn Stellen prüfen, neben den Lappen, der Pleura und den Atemwegen unter der Brustwand und dem Atemzug selbst auf einer Uhr. Füllen Sie einen Lappen, gießen Sie Flüssigkeit in die Pleura, verengen Sie die Atemwege; sagen Sie vorher, was Hände und Ohren finden, oder erkennen Sie einen verdeckten Thorax.'),
  drivers: {
    'haemodynamics.Emax': L('A failing left ventricle raises the pressure in the lung capillaries: water leaves them for the interstitium and then the alveoli (crackles).', 'Ein versagender linker Ventrikel erhöht den Druck in den Lungenkapillaren: Wasser tritt ins Interstitium und dann in die Alveolen über (Rasselgeräusche).'),
  },
  presets: [],
};

/* The EEG station (part 1): how the scalp sees a cortical source. Its model is the head as a volume conductor
   (measurements/eeg-forward.ts), not one of the physiology models, so it offers its own settings and no derived ones. */
export const EEG_STATION: StationDef = {
  id: 'eeg', test: 'eeg',
  title: L('EEG station', 'EEG-Station'),
  summary: L('How the scalp sees a source, and a seizure. A patch of cortex discharges and its field passes through brain, fluid, skull and scalp to the electrodes: see where the maximum and the phase reversal come from. Then the thalamocortical loop: give a stimulus and watch a generalised seizure start, slow, end and leave the EEG suppressed.',
    'Wie die Kopfhaut eine Quelle sieht, und einen Anfall. Ein Areal der Rinde entlädt sich, und sein Feld geht durch Gehirn, Liquor, Schädel und Kopfhaut zu den Elektroden: Sehen Sie, woher Maximum und Phasenumkehr kommen. Dann die thalamokortikale Schleife: Geben Sie einen Reiz und sehen Sie einen generalisierten Anfall beginnen, sich verlangsamen, enden und das EEG supprimiert zurücklassen.'),
  drivers: {},
  presets: [],
};

export const ECT_STATION: StationDef = {
  id: 'ect', test: 'eeg',
  title: L('ECT station', 'EKT-Station'),
  summary: L('An electroconvulsive treatment from start to finish, as the team does it: the psychiatrist at the device, the anaesthetist with the drugs and the airway, the nurse with the skin, the leads and the cuff. Take one role or all of them; the team does the rest. The device is laid out and behaves as the real one’s manual describes; behind it run the lab’s heart and a seizure model of the thalamocortical loop.',
    'Eine Elektrokonvulsionsbehandlung von Anfang bis Ende, wie das Team sie durchführt: die Psychiatrie am Gerät, die Anästhesie mit Medikamenten und Atemweg, die Pflege mit Haut, Ableitungen und Manschette. Übernehmen Sie eine Rolle oder alle; das Team erledigt den Rest. Das Gerät ist aufgebaut und verhält sich, wie das Handbuch des echten es beschreibt; dahinter laufen das Herz des Labors und ein Anfallsmodell der thalamokortikalen Schleife.'),
  drivers: {},
  presets: [],
};

export const STATIONS: StationDef[] = [ECG_STATION, AUSCULTATION_STATION, EYE_STATION, PULSE_STATION, NEURO_STATION, RESP_STATION, EEG_STATION, ECT_STATION];

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
