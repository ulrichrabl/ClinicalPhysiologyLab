import type { InvestigationDef } from '../model/types.ts';

/* Investigations. Echo is derived from the circulation model; the rest come
   from the case layer until a model covers them. */
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
    value: { kind: 'record', fields: {
      rhythm: { kind: 'coded', valueSet: 'rhythm' },
      rate: { kind: 'quantity', unit: '/min' },
      findings: { kind: 'list', of: { kind: 'coded', valueSet: 'ecg-finding' } },
    } },
    normal: { value: { rhythm: 'regular', rate: 72, findings: ['normal'] }, range: { rate: [60, 100] } },
    source: 'case', formatter: 'inv.ecg', turnaroundMinutes: 5,
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
    source: 'case', formatter: 'inv.glucose', turnaroundMinutes: 1,
  },
];
