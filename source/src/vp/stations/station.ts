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

export const STATIONS: StationDef[] = [ECG_STATION];

export interface SettingGroup { id: string; label: LocalizedText; vars: VariableDef[]; why?: LocalizedText }

/** The settings a station offers: derived from what its test measures. */
export function stationSettings(def: StationDef): SettingGroup[] {
  const test = CATALOG.investigations[def.test] ?? CATALOG.properties[def.test];
  const measures = test?.measurement?.measures ?? [];
  const models = [...new Set(measures.map((id) => id.split('.')[0]))].map((id) => MODEL_BY_ID[id]).filter(Boolean);
  const out: SettingGroup[] = [];
  for (const m of models) {
    const params = m.variables.filter((v) => v.kind === 'parameter');
    const groups = m.groups.length ? m.groups : [{ id: '', label: m.title }];
    for (const g of groups) {
      const vars = params.filter((v) => (v.group ?? '') === g.id || !g.id);
      if (vars.length) out.push({ id: `${m.id}/${g.id}`, label: g.label, vars });
    }
  }
  for (const [id, why] of Object.entries(def.drivers)) {
    const v = VARIABLE_BY_ID[id];
    if (v) out.push({ id: `driver/${id}`, label: v.label, vars: [v], why });
  }
  return out;
}

/** The presets a station offers, with their labels, in its groups (only those the model has). */
export function stationPresets(def: StationDef) {
  return def.presets.map((g) => ({ group: g.group, presets: g.ids.map((id) => ELECTRICAL_PRESETS.find((p) => p.id === id)).filter((p): p is typeof ELECTRICAL_PRESETS[number] => !!p) }));
}
