import type { LocalizedText } from '../model/i18n.ts';

/* ---------------------------------------------------------------------------
   The respiratory station's tests, in the order the chest is examined: look,
   feel the trachea and the expansion, then percuss, listen and test vocal
   resonance at each site, front, side and back. Each names the catalog
   manoeuvres it reads; the findings and signs are theirs.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });

export type RespTestId = 'look' | 'trachea' | 'expansion' | 'percussion' | 'auscultation' | 'resonance';
export type SiteKey = 'upper-zone' | 'mid-zone' | 'axilla' | 'upper-back' | 'lung-base';

/** The five sites on each side, where the catalog places them: in front, at the side, behind. */
export const RESP_SITES: Array<{ key: SiteKey; face: 'front' | 'side' | 'back'; label: LocalizedText }> = [
  { key: 'upper-zone', face: 'front', label: L('upper zone', 'Oberfeld') },
  { key: 'mid-zone', face: 'front', label: L('mid zone', 'Mittelfeld') },
  { key: 'axilla', face: 'side', label: L('axilla', 'Axilla') },
  { key: 'upper-back', face: 'back', label: L('upper back', 'oberer Rücken') },
  { key: 'lung-base', face: 'back', label: L('base', 'Basis') },
];

/** The catalog manoeuvre for a site test (the base's manoeuvres are named `…lung-base`, the others `…lung-<site>`). */
export const siteManoeuvre = (test: 'percussion' | 'auscultation' | 'resonance', key: SiteKey): string => {
  const k = key === 'lung-base' ? 'base' : key;
  return test === 'percussion' ? `percuss.lung-${k}` : test === 'auscultation' ? (k === 'base' ? 'auscultate.lung-base' : `auscultate.lung-${k}`) : `resonance.lung-${k}`;
};

export interface RespTest {
  id: RespTestId;
  label: LocalizedText;
  /** what the examiner does, in one line */
  how: LocalizedText;
  manoeuvres: string[];
  /** a test done at each of the sites */
  perSite?: boolean;
}

const site = (t: 'percussion' | 'auscultation' | 'resonance') => RESP_SITES.map((s) => siteManoeuvre(t, s.key));

export const RESP_TESTS: RespTest[] = [
  { id: 'look', label: L('Look', 'Inspektion'), how: L('Colour, the rate counted for 30 s, the pattern and work of breathing, how much the patient can say; the oximeter.', 'Hautfarbe, die über 30 s gezählte Frequenz, Atemmuster und Atemarbeit, wie viel der Patient sagen kann; das Pulsoxymeter.'),
    manoeuvres: ['inspect.general', 'inspect.breathing', 'measure.rr', 'measure.spo2'] },
  { id: 'trachea', label: L('Trachea', 'Trachea'), how: L('A finger in the suprasternal notch: is the trachea central, or nearer one clavicle?', 'Ein Finger in der Drosselgrube: Liegt die Trachea mittig oder näher an einer Klavikula?'),
    manoeuvres: ['palpate.trachea'] },
  { id: 'expansion', label: L('Expansion', 'Thoraxexkursion'), how: L('Hands on the lower ribs, thumbs meeting in the midline; a deep breath in; watch the thumbs move apart.', 'Hände auf die unteren Rippen, die Daumen treffen sich in der Mitte; tief einatmen; die Daumen weichen auseinander.'),
    manoeuvres: ['palpate.chest-expansion'] },
  { id: 'percussion', label: L('Percussion', 'Perkussion'), how: L('The middle finger flat on the chest wall, struck with the other middle finger; compare side with side.', 'Der Mittelfinger flach auf der Brustwand, mit dem anderen Mittelfinger angeschlagen; Seite mit Seite vergleichen.'),
    manoeuvres: site('percussion'), perSite: true },
  { id: 'auscultation', label: L('Breath sounds', 'Atemgeräusch'), how: L('The diaphragm of the stethoscope; the patient breathes in and out through the mouth; compare side with side.', 'Die Membran des Stethoskops; der Patient atmet durch den Mund ein und aus; Seite mit Seite vergleichen.'),
    manoeuvres: site('auscultation'), perSite: true },
  { id: 'resonance', label: L('Vocal resonance', 'Bronchophonie'), how: L('The patient says “ninety-nine” while you listen at each site (or feel it with the hand: tactile fremitus).', 'Der Patient sagt „sechsundsechzig“, während Sie an jeder Stelle hören (oder es mit der Hand fühlen: Stimmfremitus).'),
    manoeuvres: site('resonance'), perSite: true },
];

export const RESP_TEST_BY_ID: Record<RespTestId, RespTest> = Object.fromEntries(RESP_TESTS.map((t) => [t.id, t])) as Record<RespTestId, RespTest>;
