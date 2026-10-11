import type { InvestigationDef, ValueType } from '../model/types.ts';

const Q = (unit: string): ValueType => ({ kind: 'quantity', unit });

/* Investigations: measurements of the models. Echo measures the circulation, the
   ECG the cardiac electrical model, the laboratory panels the chemistry model.
   Imaging still comes from the case layer until an anatomy model exists. */
export const INVESTIGATIONS: InvestigationDef[] = [
  {
    id: 'echo', label: { en: 'Transthoracic echocardiogram', de: 'Transthorakale Echokardiographie' },
    synonyms: { en: ['echo', 'tte', 'echocardiogram', 'cardiac ultrasound'], de: ['echo', 'tte', 'herzecho', 'herzultraschall'] },
    value: { kind: 'record', fields: {
      ef: { kind: 'quantity', unit: '%' },
      aorticPeakGradient: { kind: 'quantity', unit: 'mm[Hg]' },
      aorticRegurgitation: { kind: 'coded', valueSet: 'severity' },
      mitralRegurgitation: { kind: 'coded', valueSet: 'severity' },
    } },
    normal: { value: { ef: 60, aorticPeakGradient: 4, aorticRegurgitation: 'none', mitralRegurgitation: 'none' },
      range: { ef: [52, 75], aorticPeakGradient: [0, 15] } },
    source: 'model-or-case', resolver: 'circulation.echo', formatter: 'inv.echo', turnaroundMinutes: 30,
  },
  {
    id: 'ecg-12', label: { en: '12-lead ECG', de: '12-Kanal-EKG' },
    synonyms: { en: ['ecg', 'ekg', '12 lead', 'electrocardiogram'], de: ['ekg', '12-kanal', 'elektrokardiogramm'] },
    /* The machine's measurements. The tracing itself is shown with the result; reading it is the learner's job. */
    value: { kind: 'record', fields: {
      rate: { kind: 'quantity', unit: '/min' }, pr: { kind: 'quantity', unit: 'ms' }, qrs: { kind: 'quantity', unit: 'ms' },
      qtc: { kind: 'quantity', unit: 'ms' }, axis: { kind: 'quantity', unit: 'deg', min: -180, max: 180 },
    } },
    normal: { value: { rate: 72, pr: 160, qrs: 90, qtc: 410, axis: 40 }, range: { rate: [60, 100], pr: [120, 200], qrs: [70, 110], qtc: [350, 450], axis: [-30, 90] } },
    source: 'model', resolver: 'electrical.ecg', formatter: 'inv.ecg', turnaroundMinutes: 5,
  },
  {
    id: 'electrolytes', label: { en: 'Urea and electrolytes', de: 'Elektrolyte und Nierenwerte' },
    synonyms: { en: ['u&e', 'u and e', 'electrolytes', 'renal function', 'potassium', 'sodium', 'creatinine'], de: ['elektrolyte', 'nierenwerte', 'kalium', 'natrium', 'kreatinin', 'harnstoff'] },
    value: { kind: 'record', fields: { sodium: Q('mmol/L'), potassium: Q('mmol/L'), chloride: Q('mmol/L'), bicarbonate: Q('mmol/L'), urea: Q('mmol/L'), creatinine: Q('umol/L') } },
    normal: { value: { sodium: 140, potassium: 4, chloride: 102, bicarbonate: 24, urea: 5, creatinine: 80 },
      range: { sodium: [135, 145], potassium: [3.5, 5.1], chloride: [98, 107], bicarbonate: [22, 29], urea: [2.5, 7.8], creatinine: [45, 110] } },
    source: 'model', resolver: 'chemistry.panel', formatter: 'inv.panel', turnaroundMinutes: 45,
  },
  {
    id: 'blood-gas', label: { en: 'Arterial blood gas', de: 'Arterielle Blutgasanalyse' },
    synonyms: { en: ['abg', 'blood gas', 'arterial gas', 'lactate', 'ph'], de: ['bga', 'blutgas', 'blutgasanalyse', 'laktat'] },
    value: { kind: 'record', fields: { arterialPH: Q('[pH]'), paCO2: Q('kPa'), paO2: Q('kPa'), bicarbonate: Q('mmol/L'), lactate: Q('mmol/L'), potassium: Q('mmol/L') } },
    normal: { value: { arterialPH: 7.4, paCO2: 5.3, paO2: 12, bicarbonate: 24, lactate: 1, potassium: 4 },
      range: { arterialPH: [7.35, 7.45], paCO2: [4.7, 6.0], paO2: [10, 13.3], bicarbonate: [22, 29], lactate: [0.5, 2], potassium: [3.5, 5.1] } },
    source: 'model', resolver: 'chemistry.panel', formatter: 'inv.panel', turnaroundMinutes: 5,
  },
  {
    id: 'fbc', label: { en: 'Full blood count', de: 'Blutbild' },
    synonyms: { en: ['fbc', 'cbc', 'blood count', 'haemoglobin', 'hb'], de: ['blutbild', 'kleines blutbild', 'hämoglobin', 'hb'] },
    value: { kind: 'record', fields: { haemoglobin: Q('g/L'), whiteCellCount: Q('10*9/L'), platelets: Q('10*9/L'), mcv: Q('fL') } },
    normal: { value: { haemoglobin: 150, whiteCellCount: 7, platelets: 250, mcv: 90 },
      range: { haemoglobin: [130, 175], whiteCellCount: [4, 11], platelets: [150, 400], mcv: [80, 100] } },
    source: 'model', resolver: 'chemistry.panel', formatter: 'inv.panel', turnaroundMinutes: 30,
  },
  {
    id: 'cardiac-markers', label: { en: 'Troponin and BNP', de: 'Troponin und BNP' },
    synonyms: { en: ['troponin', 'bnp', 'cardiac enzymes', 'nt-probnp'], de: ['troponin', 'bnp', 'herzenzyme'] },
    value: { kind: 'record', fields: { troponin: Q('ng/L'), bnp: Q('ng/L') } },
    normal: { value: { troponin: 5, bnp: 40 }, range: { troponin: [0, 14], bnp: [0, 100] } },
    source: 'model', resolver: 'chemistry.panel', formatter: 'inv.panel', turnaroundMinutes: 60,
  },
  ...([
    ['ct-head', 'CT head (non-contrast)', 'CCT nativ', ['ct head', 'ct brain', 'head ct', 'cct'], ['cct', 'ct kopf', 'schädel-ct'], 20],
    ['ct-angiography', 'CT angiography, aortic arch to vertex', 'CT-Angiographie der hirnversorgenden Gefäße', ['cta', 'ct angiogram', 'ct angio'], ['cta', 'ct-angio', 'angio-ct'], 25],
    ['mri-lumbar', 'MRI lumbar spine', 'MRT Lendenwirbelsäule', ['mri spine', 'lumbar mri', 'mri back'], ['mrt lws', 'mrt wirbelsäule', 'lws-mrt'], 180],
  ] as const).map(([id, en, de, sEn, sDe, minutes]): InvestigationDef => ({
    id, label: { en, de }, synonyms: { en: [...sEn], de: [...sDe] },
    value: { kind: 'record', fields: { findings: { kind: 'list', of: { kind: 'coded', valueSet: 'imaging' } } } },
    normal: { value: { findings: ['normal'] } }, source: 'case', formatter: 'inv.imaging', turnaroundMinutes: minutes,
  })),
  {
    id: 'glucose', label: { en: 'Capillary glucose', de: 'Blutzucker (kapillär)' },
    synonyms: { en: ['glucose', 'bm', 'sugar', 'cbg'], de: ['bz', 'blutzucker', 'glukose'] },
    value: { kind: 'quantity', unit: 'mmol/L', min: 0, max: 50 }, normal: { value: 5.4, range: [4, 7.8] },
    source: 'model', resolver: 'chemistry.glucose', formatter: 'inv.glucose', turnaroundMinutes: 1,
  },
];
