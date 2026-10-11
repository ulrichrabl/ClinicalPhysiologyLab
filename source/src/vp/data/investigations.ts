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
  {
    id: 'glucose', label: { en: 'Capillary glucose', de: 'Blutzucker (kapillär)' },
    synonyms: { en: ['glucose', 'bm', 'sugar', 'cbg'], de: ['bz', 'blutzucker', 'glukose'] },
    value: { kind: 'quantity', unit: 'mmol/L', min: 0, max: 50 }, normal: { value: 5.4, range: [4, 7.8] },
    source: 'case', formatter: 'inv.glucose', turnaroundMinutes: 1,
  },
];
