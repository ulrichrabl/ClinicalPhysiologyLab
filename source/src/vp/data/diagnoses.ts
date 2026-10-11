import type { DiagnosisDef } from '../model/types.ts';

/* Diagnoses a learner can commit to. Synonyms feed the searchable
   differential. Terminology codes (ICD, SNOMED) are mapped by clinicians and
   deliberately left empty here. */
const d = (id: string, en: string, de: string, enSyn: string[] = [], deSyn: string[] = []): DiagnosisDef =>
  ({ id, label: { en, de }, synonyms: { en: enSyn, de: deSyn } });

export const DIAGNOSES: DiagnosisDef[] = [
  // syncope and the heart
  d('aortic-stenosis', 'Aortic stenosis', 'Aortenklappenstenose', ['as', 'aortic valve stenosis'], ['aortenstenose', 'aks']),
  d('hcm', 'Hypertrophic obstructive cardiomyopathy', 'Hypertrophe obstruktive Kardiomyopathie', ['hocm', 'hcm'], ['hocm', 'hcm']),
  d('vasovagal-syncope', 'Vasovagal syncope', 'Vasovagale Synkope', ['reflex syncope', 'faint'], ['reflexsynkope']),
  d('orthostatic-hypotension', 'Orthostatic hypotension', 'Orthostatische Hypotonie', ['postural hypotension'], ['orthostase']),
  d('complete-heart-block', 'Complete heart block', 'AV-Block III. Grades', ['third degree heart block', 'chb'], ['av-block 3', 'totaler av-block']),
  d('ventricular-tachycardia', 'Ventricular tachycardia', 'Ventrikuläre Tachykardie', ['vt'], ['vt']),
  d('pulmonary-embolism', 'Pulmonary embolism', 'Lungenembolie', ['pe'], ['le', 'lungenarterienembolie']),
  d('mitral-regurgitation', 'Mitral regurgitation', 'Mitralklappeninsuffizienz', ['mr'], ['mi']),
  d('aortic-regurgitation', 'Aortic regurgitation', 'Aortenklappeninsuffizienz', ['ar', 'aortic incompetence'], ['ai']),
  // dizziness and the eyes
  d('vestibular-neuritis', 'Vestibular neuritis', 'Neuritis vestibularis', ['vestibular neuronitis', 'acute unilateral vestibulopathy'], ['akute einseitige vestibulopathie', 'neuropathia vestibularis']),
  d('labyrinthitis', 'Labyrinthitis', 'Labyrinthitis', [], []),
  d('bppv', 'Benign paroxysmal positional vertigo', 'Benigner paroxysmaler Lagerungsschwindel', ['bppv'], ['bplsw', 'lagerungsschwindel']),
  d('menieres', "Ménière's disease", 'Morbus Menière', ['menieres', 'meniere'], ['menière', 'meniere']),
  d('vestibular-migraine', 'Vestibular migraine', 'Vestibuläre Migräne', [], []),
  d('cerebellar-stroke', 'Cerebellar stroke', 'Kleinhirninfarkt', ['posterior circulation stroke', 'cerebellar infarct'], ['kleinhirnschlaganfall', 'infarkt hintere strombahn']),
  d('lateral-medullary-syndrome', 'Lateral medullary syndrome (Wallenberg)', 'Wallenberg-Syndrom', ['wallenberg', 'pica stroke'], ['wallenberg', 'dorsolaterales medulla-oblongata-syndrom']),
  d('vestibular-schwannoma', 'Vestibular schwannoma', 'Vestibularisschwannom', ['acoustic neuroma'], ['akustikusneurinom']),
  d('multiple-sclerosis', 'Multiple sclerosis', 'Multiple Sklerose', ['ms'], ['ms']),
  d('third-nerve-palsy', 'Oculomotor nerve palsy', 'Okulomotoriusparese', ['third nerve palsy', 'cn iii palsy'], ['n.-iii-parese']),
  d('sixth-nerve-palsy', 'Abducens nerve palsy', 'Abduzensparese', ['sixth nerve palsy', 'cn vi palsy'], ['n.-vi-parese']),
  d('horner-syndrome', "Horner's syndrome", 'Horner-Syndrom', ['horner'], ['horner']),
];
