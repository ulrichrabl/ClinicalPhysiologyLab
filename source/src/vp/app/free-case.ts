import type { CaseDef } from '../model/types.ts';

/* ---- the free patient: a healthy adult, no story ----------------------------------- */
export const FREE_CASE: CaseDef = {
  schema: 'vp.case/1', id: 'free-patient', version: '0.1.0', status: 'draft', locales: ['en', 'de'],
  title: { en: 'Free patient', de: 'Freier Patient' }, tags: ['physiology'], difficulty: 1,
  authoring: { authors: ['Clinical Physiology Lab'], reviewers: [], updated: '2026-10-11', sources: [] },
  patient: { name: 'Alex Berger', age: 45, sex: 'M', heightCm: 176, weightKg: 76, appearance: { skinTone: 3, hair: 'brown, short', build: 'average', eyes: 'blue' }, speaks: ['en', 'de'] },
  setting: { place: { en: 'Physiology lab', de: 'Physiologielabor' }, triage: { en: 'A healthy volunteer. Change anything in the Model layer, then examine what follows.', de: 'Ein gesunder Proband. Ändern Sie etwas in der Modellebene und untersuchen Sie die Folgen.' } },
  pathology: {},
  initialState: { position: 'reclined-45', avpu: 'A', orientation: 'oriented', cooperation: 'full', exposure: [] },
  history: [
    { id: 'f-pc', topic: 'pc', volunteered: true, say: { en: 'I’m here for the study. I feel fine.', de: 'Ich bin für die Studie hier. Mir geht es gut.' } },
  ],
  reference: { evidence: [], redFlags: [], timeBudgetMinutes: 30, summary: { en: '', de: '' } },
  diagnosis: { primary: '', accepted: [], differential: [] },
} as unknown as CaseDef;
