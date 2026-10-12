/* ===========================================================================
   References: the evidence every model constant rests on.

   Each entry is a source as it was checked. `verified` says how far: the
   bibliographic record confirmed (PubMed), the abstract read, the full text
   read, or the figure taken from someone else's summary of it. A constant's
   status (constants.ts) says what it took from the source.
=========================================================================== */

export type Verification =
  | 'full-text'      // the number was read in the paper itself
  | 'abstract'       // the number is in the abstract, read against the PubMed record
  | 'secondary'      // the number was taken from a review or summary citing this source
  | 'record'         // only the bibliographic record is confirmed
  | 'unverified';

export interface Reference {
  id: string;
  authors: string;          // "Bellissant E, Annane D"
  title: string;
  journal: string;
  year: number;
  volume?: string; pages?: string;
  doi?: string; pmid?: string; url?: string;
  verified: Verification;
  /** What was taken from it and where (table, figure, abstract), and any caveat about applying it here. */
  note?: string;
}

const R = (r: Reference) => r;

export const REFERENCES: Record<string, Reference> = Object.fromEntries([
  R({ id: 'bellissant2000', authors: 'Bellissant E, Annane D', title: 'Effect of hydrocortisone on phenylephrine–mean arterial pressure dose-response relationship in septic shock',
    journal: 'Clin Pharmacol Ther', year: 2000, volume: '68', pages: '293–303', doi: '10.1067/mcp.2000.109354', pmid: '11014411', verified: 'abstract',
    note: 'Abstract: Emax 39 → 77 mmHg in septic patients and 84 → 106 mmHg in controls 1 h after 50 mg hydrocortisone, ED50 unchanged; E0 rose 58 → 64 and 73 → 82 mmHg. The patients had septic shock with relative adrenal insufficiency, not Addison’s disease.' }),
  R({ id: 'annane1998', authors: 'Annane D, Bellissant E, Sebille V, et al.', title: 'Impaired pressor sensitivity to noradrenaline in septic shock patients with and without impaired adrenal function reserve',
    journal: 'Br J Clin Pharmacol', year: 1998, volume: '46', pages: '589–97', doi: '10.1046/j.1365-2125.1998.00833.x', pmid: '9862249', verified: 'abstract',
    note: 'Abstract: impaired adrenal reserve goes with lower pressor sensitivity to noradrenaline; hydrocortisone improves it within 60 min.' }),
  R({ id: 'srlf2002', authors: 'Réanimation (SRLF)', title: 'Impact des corticoïdes sur la réponse vasomotrice', journal: 'Réanimation', year: 2002, volume: '11', pages: '111–6',
    url: 'https://www.srlf.org/wp-content/uploads/2015/11/0203-Reanimation-Vol11-N2-p111_116.pdf', verified: 'secondary',
    note: 'Review. Source used for: glucocorticoid-receptor blockade (RU 486) in normal rats lowers MAP about 20 mmHg through resistance, cardiac output unchanged. Primary rat study not yet located; authors not yet confirmed.' }),
  R({ id: 'rushworth2020', authors: 'Rushworth RL, Goubar T, Ostman C, McGrath S, Torpy DJ', title: 'Interaction between hypotension and age on adrenal crisis diagnosis',
    journal: 'Endocrinol Diabetes Metab', year: 2020, volume: '4', pages: 'e00205', doi: '10.1002/edm2.205', pmid: '33855208', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8029553', verified: 'full-text',
    note: '152 admissions with primary adrenal insufficiency; 46 diagnosed crises, of which 21 had systolic ≤100 on arrival. Crisis definition: hypotension resolving within 1 h of parenteral hydrocortisone.' }),
  R({ id: 'fazio2004', authors: 'Fazio S, Palmieri EA, Lombardi G, Biondi B', title: 'Effects of thyroid hormone on the cardiovascular system',
    journal: 'Recent Prog Horm Res', year: 2004, volume: '59', pages: '31–50', doi: '10.1210/rp.59.1.31', pmid: '14749496',
    url: 'https://www.endocrine.org/~/media/endosociety/files/ep/rphr/59/rphr_vol_59_ch_03_effects_of_thyroid_hormone.pdf', verified: 'full-text',
    note: 'Table I, overt dysfunction (normal / hyper / hypo): heart rate 72–84 / 88–130 / 60–80; SVR 1500–1700 / 700–1200 / 2100–2700 dyn·s/cm⁵; cardiac output 4–6 / ≥7.0 / ≤4.5 L/min; blood volume 100 / 105.5 / 84.5 %. The table does not give the thyroid hormone levels.' }),
  R({ id: 'hayashi2020', authors: 'Hayashi A, Takano K, Kawakami Y, et al.', title: 'Short-term change in resting energy expenditure and body compositions in therapeutic process for Graves’ disease',
    journal: 'Intern Med', year: 2020, volume: '59', pages: '1827–33', doi: '10.2169/internalmedicine.4462-20', pmid: '32741892', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7474983', verified: 'full-text',
    note: '20 patients: REE/BEE 1.58 at diagnosis (free T4 5.45 ng/dL), 1.34 at 1 month (2.14), 1.06 at 3 months (0.91), 1.01 at 6 months (1.15).' }),
  R({ id: 'karmisholt2011', authors: 'Karmisholt J, Andersen S, Laurberg P', title: 'Weight loss after therapy of hypothyroidism is mainly caused by excretion of excess body water associated with myxoedema',
    journal: 'J Clin Endocrinol Metab', year: 2011, volume: '96', pages: 'E99–103', doi: '10.1210/jc.2010-1521', pmid: '20926526', verified: 'secondary',
    note: 'Abstract: free T4 4.5 → 18 pmol/L after a year of levothyroxine (untreated about 0.25× treated). The REE rise of 11.6 % (21.8 % per lean mass) is from the Clinical Thyroidology summary, not yet read in the paper.' }),
  R({ id: 'ramirez1993', authors: 'Ramirez JA, Goodman WG, Gornbein J, et al.', title: 'Direct in vivo comparison of calcium-regulated parathyroid hormone secretion in normal volunteers and patients with secondary hyperparathyroidism',
    journal: 'J Clin Endocrinol Metab', year: 1993, volume: '76', pages: '1489–94', doi: '10.1210/jcem.76.6.8501155', pmid: '8501155', verified: 'abstract',
    note: 'Abstract, 20 normal volunteers: set point 1.21 mmol/L ionised calcium; maximum PTH 396 % of baseline (ionised calcium −0.21 mmol/L); PTH 24 % of baseline 30 min into a calcium infusion.' }),
  R({ id: 'brown1983', authors: 'Brown EM', title: 'Four-parameter model of the sigmoidal relationship between parathyroid hormone release and extracellular calcium concentration in normal and abnormal parathyroid tissue',
    journal: 'J Clin Endocrinol Metab', year: 1983, volume: '56', pages: '572–81', doi: '10.1210/jcem-56-3-572', pmid: '6822654', verified: 'abstract',
    note: 'The functional form: maximum, minimum, set point, slope.' }),
  R({ id: 'spencer1990', authors: 'Spencer CA, LoPresti JS, Patel A, et al.', title: 'Applications of a new chemiluminometric thyrotropin assay to subnormal measurement',
    journal: 'J Clin Endocrinol Metab', year: 1990, volume: '70', pages: '453–60', doi: '10.1210/jcem-70-2-453', pmid: '2105333', verified: 'abstract',
    note: 'Abstract: at steady state log TSH = 2.56 − 0.022 × FT4I (r = 0.84); normal TSH 0.39–4.6 mU/L; 96 % of hyperthyroid patients had TSH < 0.005 mU/L.' }),
  R({ id: 'colucci2013', authors: 'Colucci P, Yue CS, Ducharme M, Benvenga S', title: 'A review of the pharmacokinetics of levothyroxine for the treatment of hypothyroidism',
    journal: 'Eur Endocrinol', year: 2013, volume: '9', pages: '40–7', doi: '10.17925/EE.2013.09.01.40', pmid: '30349610', verified: 'record',
    note: 'Cited for the plasma half-life of thyroxine (about 7 days); the figure has not yet been read in the paper.' }),
  R({ id: 'jonklaas2014', authors: 'Jonklaas J, Bianco AC, Bauer AJ, et al.', title: 'Guidelines for the treatment of hypothyroidism: prepared by the American Thyroid Association task force on thyroid hormone replacement',
    journal: 'Thyroid', year: 2014, volume: '24', pages: '1670–751', doi: '10.1089/thy.2014.0028', pmid: '25266247', verified: 'record',
    note: 'Cited for full replacement levothyroxine of 1.6 µg/kg/day; the figure has not yet been read in the guideline.' }),
  R({ id: 'bornstein2016', authors: 'Bornstein SR, Allolio B, Arlt W, et al.', title: 'Diagnosis and treatment of primary adrenal insufficiency: an Endocrine Society clinical practice guideline',
    journal: 'J Clin Endocrinol Metab', year: 2016, volume: '101', pages: '364–89', doi: '10.1210/jc.2015-1710', pmid: '26760044', verified: 'abstract',
    note: 'Abstract: hydrocortisone 15–25 mg/day and fludrocortisone median 0.1 mg/day replace adult secretion.' }),
  R({ id: 'hamitouche2017', authors: 'Hamitouche N, Comets E, Ribot M, Alvarez JC, Bellissant E, Laviolle B', title: 'Population pharmacokinetic-pharmacodynamic model of oral fludrocortisone and intravenous hydrocortisone in healthy volunteers',
    journal: 'AAPS J', year: 2017, volume: '19', pages: '727–35', doi: '10.1208/s12248-016-0041-9', pmid: '28083797', verified: 'abstract',
    note: 'Abstract: plasma half-life of intravenous hydrocortisone 2.10 h (95 % CI 1.78–2.40) in 12 healthy men.' }),
].map((r) => [r.id, r]));
