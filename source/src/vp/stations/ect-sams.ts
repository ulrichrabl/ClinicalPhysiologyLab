import type { LocalizedText } from '../model/i18n.ts';

/* ===========================================================================
   The seizure adequacy markers score (SAMS), as the owner's hospital uses it
   (its in-house procedure, after Minelli 2016, references.ts minelli2016):
   one point each for an EEG seizure over 25 s, a postictal suppression index
   over 80 %, a maximum sustained coherence over 90 %, a midictal amplitude
   over 180 µV and a peak heart rate over 120/min. 4–5: a good seizure, no
   restimulation; 2–3: adjust the dose at the next treatment; 0–1: a
   restimulation may follow, agreed with anaesthesia. A systolic pressure
   over 165 mmHg supports an autonomic response but scores no point. Older
   patients have shorter seizures and smaller autonomic responses: restimulate
   conservatively.
=========================================================================== */

const L = (en: string, de: string): LocalizedText => ({ en, de });

export interface SamsInput { eegEndpoint: number | null; psi: number | null; coherence: number | null; midictal: number | null; peakHr: number }
export interface SamsItem { label: LocalizedText; value: string; point: boolean }
export interface Sams { points: number; items: SamsItem[]; band: 'good' | 'medium' | 'poor'; advice: LocalizedText }

export const SAMS_LIMITS = { eegEndpoint: 25, psi: 80, coherence: 90, midictal: 180, peakHr: 120 } as const;

export function sams(r: SamsInput): Sams {
  const f = (x: number | null, d: number, u: string) => (x == null ? '—' : `${x.toFixed(d)} ${u}`);
  const items: SamsItem[] = [
    { label: L('EEG seizure over 25 s', 'EEG-Anfall über 25 s'), value: f(r.eegEndpoint, 0, 's'), point: r.eegEndpoint != null && r.eegEndpoint > SAMS_LIMITS.eegEndpoint },
    { label: L('Postictal suppression over 80 %', 'Postiktale Suppression über 80 %'), value: f(r.psi, 0, '%'), point: r.psi != null && r.psi > SAMS_LIMITS.psi },
    { label: L('Max. sustained coherence over 90 %', 'Max. Kohärenz über 90 %'), value: f(r.coherence, 0, '%'), point: r.coherence != null && r.coherence > SAMS_LIMITS.coherence },
    { label: L('Midictal amplitude over 180 µV (strip)', 'Midiktale Amplitude über 180 µV (Streifen)'), value: f(r.midictal, 0, 'µV'), point: r.midictal != null && r.midictal > SAMS_LIMITS.midictal },
    { label: L('Peak heart rate over 120/min', 'Maximale Herzfrequenz über 120/min'), value: `${r.peakHr.toFixed(0)} /min`, point: r.peakHr > SAMS_LIMITS.peakHr },
  ];
  const points = items.filter((x) => x.point).length;
  const band = points >= 4 ? 'good' : points >= 2 ? 'medium' : 'poor';
  const advice = band === 'good' ? L('Good seizure: no restimulation. Next time 5/5: the same dose; 4/5: by the clinical course (raise it if the response is poor, not if memory complaints).', 'Gute Anfallsqualität: keine Re-Stimulation. Nächstes Mal 5/5: gleiche Dosis; 4/5: nach klinischem Verlauf (bei schlechtem Ansprechen steigern, bei Gedächtnisklagen eher nicht).')
    : band === 'medium' ? L('Medium: no restimulation; raise the dose next time (3/5: by 10–20 %, under 3: by at least 20 %).', 'Mittel: keine Re-Stimulation; Dosis nächstes Mal erhöhen (3/5: um 10–20 %, unter 3: um mindestens 20 %).')
    : L('Poor: a restimulation may follow. Agree it with anaesthesia (heart? blood pressure?); 1.5 times the dose, 120–180 s after the first stimulus; not from 140 %.', 'Schlecht: Re-Stimulation möglich. Mit der Anästhesie absprechen (Herz? Blutdruck?); 1,5-fache Dosis, 120–180 s nach dem ersten Reiz; nicht ab 140 %.');
  return { points, items, band, advice };
}

export const SAMS_NOTE = L('A systolic pressure over 165 mmHg supports an autonomic response but scores no point. Older patients have shorter seizures and smaller responses: restimulate conservatively.',
  'Ein systolischer Druck über 165 mmHg spricht für eine vegetative Reaktion, zählt aber nicht als Punkt. Ältere haben kürzere Anfälle und schwächere Reaktionen: zurückhaltend re-stimulieren.');
