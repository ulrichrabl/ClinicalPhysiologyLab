import { defineConstants } from './constants.ts';

/* Constants of the respiratory system (physiology/lung/respiratory.ts). The reference subject is the
   healthy model: a man of 45, 176 cm, 76 kg, at rest, breathing air at sea level.

   The ECSC/ERS prediction equations for lung volumes and flows (Quanjer 1993) stay as written in
   predicted(), with their source; they are regression coefficients of one published table. */

export const LUNG = defineConstants('lung', {
  /* --- gas and blood chemistry ------------------------------------------- */
  waterVapour: { value: 6.27, unit: 'kPa', status: 'measured', refs: ['nunn2005'], means: 'Saturated water vapour pressure at 37 °C (47 mmHg).',
    derivation: 'A physical constant: 47 mmHg at 37 °C.' },
  normalPaco2: { value: 5.33, unit: 'kPa', status: 'assumed', means: 'Arterial CO2 the respiratory centre defends (40 mmHg).', derivation: 'The conventional normal, 40 mmHg.' },
  acuteBuffering: { value: 0.75, unit: 'mmol/L per kPa', status: 'derived', refs: ['brackett1965'], means: 'Rise in plasma bicarbonate per kPa of acute CO2 retention (non-bicarbonate buffering).',
    derivation: 'Brackett’s in vivo CO2 titration of normal man: about 0.1 mmol/L per mmHg acutely, 0.75 per kPa.' },
  hufner: { value: 1.34, unit: 'mL O2/g Hb', status: 'measured', refs: ['nunn2005'], means: 'Oxygen bound per gram of fully saturated haemoglobin (Hüfner’s constant as used clinically).',
    derivation: 'The clinical value; the theoretical 1.39 is not reached in vivo because of dyshaemoglobins.' },
  o2Solubility: { value: 0.0225, unit: 'mL/dL per kPa', status: 'measured', refs: ['nunn2005'], means: 'Dissolved oxygen in blood per kPa of PO2.', derivation: '0.003 mL/dL per mmHg = 0.0225 per kPa.' },
  sevA: { value: 23400, unit: 'mmHg³', status: 'measured', refs: ['severinghaus1979'], means: 'Severinghaus’s O2 dissociation equation: S = 1/(1 + 23400/(P³ + 150·P)).',
    derivation: 'Severinghaus’s fit to the standard human curve, within ±0.0055 saturation.' },
  sevB: { value: 150, unit: 'mmHg²', status: 'measured', refs: ['severinghaus1979'], means: 'Second constant of Severinghaus’s O2 dissociation equation.', derivation: 'As above.' },
  bohr: { value: 0.40, unit: 'log₁₀ PO2 per pH unit', status: 'derived', refs: ['severinghaus1979'], means: 'Shift of the dissociation curve with pH (the Bohr effect), CO2’s own effect apart.',
    derivation: 'Severinghaus’s Bohr coefficient, Δln PO2/ΔpH ≈ −1.1 in the mid-range (0.48 in log₁₀ including CO2), split into 0.40 for pH and 0.06 per log unit of PCO2.' },
  co2Effect: { value: 0.06, unit: 'log₁₀ PO2 per log₁₀ PCO2', status: 'derived', refs: ['severinghaus1979'], means: 'Direct effect of CO2 on the dissociation curve (carbamino).', derivation: 'The remainder of the standard Bohr shift (see above).' },
  tempEffect: { value: 0.024, unit: 'log₁₀ PO2 per °C', status: 'derived', refs: ['severinghaus1979'], means: 'Shift of the dissociation curve with temperature.',
    derivation: 'Severinghaus’s temperature coefficient, Δln PO2/ΔT ≈ 0.058/(…)+0.013, about 0.055 per °C in the mid-range: 0.024 in log₁₀.' },
  haldane: { value: 4, unit: 'mL/dL', status: 'assumed', means: 'Extra CO2 carried by fully deoxygenated blood (the Haldane effect).', derivation: 'The textbook difference between the oxygenated and deoxygenated CO2 dissociation curves at a normal PCO2.' },
  /* --- dead space, metabolism, cost of breathing --------------------------- */
  deadSpacePerKg: { value: 0.0022, unit: 'L/kg ideal weight', status: 'derived', refs: ['radford1955'], means: 'Anatomical dead space per kilogram of ideal body weight.',
    derivation: 'Radford’s rule, about 1 mL per pound of ideal weight: 2.2 mL/kg.' },
  deadSpaceEmphysema: { value: 0.25, unit: 'fraction', status: 'ungrounded', means: 'Rise in anatomical dead space in severe emphysema.' },
  vo2Coef: { value: 9.7, unit: 'mL/min per kg^0.75', status: 'assumed', means: 'Resting O2 consumption scaled to metabolic body size: VO2 = k·W^0.75.',
    derivation: 'Gives 249 mL/min at 76 kg, the textbook resting value of about 250 mL/min; the ¾-power scaling is Kleiber’s.' },
  vo2Temp: { value: 0.1, unit: 'per °C', status: 'assumed', means: 'Rise in metabolic rate per °C of body temperature.', derivation: 'The commonly quoted 10–13 % per °C of fever.' },
  breathingCost: { value: 1.0, unit: 'mL O2 per L of ventilation', status: 'assumed', means: 'O2 cost of breathing in health.', derivation: 'The textbook 0.5–1 mL O2 per litre of ventilation at rest.' },
  /* --- mechanics ------------------------------------------------------------ */
  restingPleural: { value: -5, unit: 'cmH2O', status: 'assumed', means: 'Pleural pressure at the end of a quiet expiration (at FRC): the lung’s recoil, held by the chest wall.',
    derivation: 'The textbook value at FRC, about −5 cmH2O at mid-lung height. The circulation takes the swing of pleural pressure about its mean as the respiratory pump on the heart and lung vessels (ADR-017 step 3b).' },
  lungCompliance: { value: 0.2, unit: 'L/cmH2O', status: 'measured', refs: ['nunn2005'], means: 'Compliance of normal lungs (scaled to predicted TLC).', derivation: 'The normal static lung compliance of an adult, about 200 mL/cmH2O.' },
  chestWallCompliance: { value: 0.2, unit: 'L/cmH2O', status: 'measured', refs: ['nunn2005'], means: 'Compliance of the normal chest wall.', derivation: 'About 200 mL/cmH2O, so the respiratory system together is about 100.' },
  /* Maximal expiratory flow V̇max(x) = k·FVC·xⁿ (x the fraction of the vital capacity still to be exhaled): narrowed
     airways lower k (the peak) and raise n (scoop the curve, so FEV1 falls with the peak). The three constants were
     fitted together, holding the model's FEV1 at each degree of bronchoconstriction as it was, so that peak flow follows
     FEV1 as in people: in 6,167 patients with airflow obstruction PEF and FEV1 (% predicted) agreed on average (mean
     difference 0.7 %, wide limits; Aggarwal 2006), and in 129 asthma admissions they correlated with ρ 0.77 (Arnold
     2007). Before, the model's peak flow fell far ahead of FEV1 (23 % against 40 %), which made an attack look
     "life-threatening" by peak flow while the patient looked moderate (known gap 56). Fit (healthy = 100 %): FEV1/PEF
     84/88, 57/56, 38/34, 25/21, 17/13; residual within 4 points. Not reached: FEV1/FVC in the most severe obstruction is
     about 43 % against Roca 1988's 34 % (10 patients, acute severe asthma on admission). */
  forcedFlowFall: { value: 4, unit: '', status: 'derived', refs: ['aggarwal2006', 'arnold2007'], means: 'How far narrowed airways lower the maximal expiratory flow: k = k₀ / (1 + c·b^p).',
    derivation: 'Fitted with the power and the scoop (grid search) so that PEF % predicted follows FEV1 % predicted (Aggarwal 2006: parity on average; Arnold 2007: ρ 0.77), holding FEV1 at each bronchoconstriction as before.' },
  forcedFlowPower: { value: 1.7, unit: '', status: 'derived', refs: ['aggarwal2006'], means: 'The power of bronchoconstriction in that fall.', derivation: 'Fitted with the fall and the scoop, as above.' },
  forcedFlowScoop: { value: 4, unit: '', status: 'derived', refs: ['aggarwal2006'], means: 'How much narrowed airways scoop the flow–volume curve: n = 1.25 + s·b (+ 1.2·e for emphysema, not refitted).', derivation: 'Fitted with the fall and the power, as above.' },
  airwayResistance: { value: 2.0, unit: 'cmH2O·s/L', status: 'measured', refs: ['nunn2005'], means: 'Normal airway resistance.', derivation: 'The normal adult value, 1–2 cmH2O·s/L at quiet breathing; the upper end, as resistance by mouthpiece includes the larynx.' },
  /* --- control of breathing --------------------------------------------------- */
  restingVentilation: { value: 6.4, unit: 'L/min at VCO2 200 mL/min', status: 'derived', refs: ['tobin1983'], means: 'Minute ventilation of the reference subject at rest.',
    derivation: 'Tobin’s normal subjects breathed 383 mL at 16.6 /min (about 6.4 L/min) on inductance plethysmography, without a mouthpiece.' },
  restingRate: { value: 16.6, unit: '/min', status: 'derived', refs: ['tobin1983'], means: 'Breathing rate of the reference subject at rest.',
    derivation: 'Tobin: 16.6 ± 2.8 /min in normal subjects, unaffected by age.' },
  rateExponent: { value: 0.2, unit: '', status: 'derived', refs: ['hey1966'], means: 'How much of a rise in chemically driven ventilation comes from rate: RR ∝ VE^k (the rest is depth).',
    derivation: 'Hey: under CO2, hypoxia, acidosis and exercise, tidal volume rises nearly linearly with ventilation while the rate changes little, until the tidal volume reaches about half the vital capacity (only the record has been checked). Quadrupling ventilation by depth to three times the tidal volume leaves a rate rise of about a third: ln(1.33)/ln(4) ≈ 0.2.' },
  tidalCeiling: { value: 0.5, unit: 'fraction of vital capacity', status: 'derived', refs: ['hey1966'], means: 'Tidal volume beyond which further ventilation comes from rate.', derivation: 'Hey: about half the vital capacity.' },
  diseaseRateScale: { value: 13.5, unit: '/min', status: 'ungrounded', means: 'Scale of the rise in breathing rate that illness adds (stiff lungs, lung receptors, cytokines, load, weakness).' },
  tidalShallow: { value: 3.5, unit: 'mL/kg ideal weight', status: 'derived', refs: ['tobin1983'], means: 'Tidal volume below which breathing looks shallow.',
    derivation: 'Tobin’s normal tidal volume, 383 ± 91 mL (about 5.4 mL/kg ideal weight), less 1.5 SD: 246 mL, 3.5 mL/kg.' },
  tidalDeep: { value: 7.3, unit: 'mL/kg ideal weight', status: 'derived', refs: ['tobin1983'], means: 'Tidal volume above which breathing looks deep.',
    derivation: 'Tobin’s normal tidal volume plus 1.5 SD: 520 mL, 7.3 mL/kg ideal weight. The old thresholds (5.5 and 8.5) would have called Tobin’s average subject shallow.' },
  dutyCycle: { value: 0.42, unit: 'Ti/Ttot', status: 'derived', refs: ['tobin1983'], means: 'Fraction of each breath spent in inspiration.', derivation: 'Tobin: 0.42 ± 0.03.' },
  pmusDecay: { value: 0.2, unit: 'fraction of Te', status: 'assumed', refs: ['albanese2016'],
    means: 'Time constant of the inspiratory muscles\u2019 relaxation in expiration, as a fraction of the expiratory time.',
    derivation: 'Albanese et al.\u2019s waveform for the respiratory muscle pressure (a parabolic rise to its peak at the end of inspiration, then an exponential decay with a time constant of Te/5), as commonly reproduced; not re-read in the paper. The shape is what matters: inspiratory flow must last the whole of Ti, so that the fraction of the breath spent breathing in is Tobin\u2019s duty cycle.' },
  co2Gain: { value: 2.5, unit: 'per kPa', status: 'derived', refs: ['westerman1983', 'bendov2009'], means: 'Central chemoreceptor gain: fractional rise in ventilation per kPa of CO2 above the set point (the pH term adds to it).',
    derivation: 'Calibrated so that the whole controller (this term and the peripheral [H⁺] term) gives a CO2 response of about 2.1 L/min/mmHg at a normal PaO2: Westerman’s controls 2.13 ± 0.17 (SE), Ben-Dov’s 2.46 ± 0.3, both by Read’s rebreathing method. The old value of 1.6 gave 1.46.' },
  hydrogenGain: { value: 0.04, unit: 'per nmol/L', status: 'ungrounded', means: 'Peripheral chemoreceptor gain on arterial [H⁺].' },
  co2DogLeg: { value: 0.3, unit: 'fraction', status: 'ungrounded', means: 'Flattening of the CO2 response below the set point (the dog-leg).' },
  csfBicarbonateShare: { value: 0.5, unit: 'fraction', status: 'assumed', means: 'Share of a chronic change in blood bicarbonate that reaches the CSF (and resets the CO2 the centre defends).',
    derivation: 'The CSF follows the blood partly over days; half is an assumption.' },
  weilA: { value: 180, unit: 'L/min·mmHg', status: 'measured', refs: ['weil1970'], means: 'Shape constant of the isocapnic hypoxic ventilatory response: VE = V0 + A/(PaO2 − C).',
    derivation: 'Weil: A = 180.2 ± 14.5 (SEM) in 10 normal men at their resting PACO2.' },
  weilC: { value: 32, unit: 'mmHg', status: 'measured', refs: ['weil1970'], means: 'PO2 at which the hypoxic response becomes vertical.', derivation: 'Weil fitted C at about 32 mmHg; the curve steepens below 50–60 and approaches the vertical at 30–40.' },
  hypoxiaCo2Up: { value: 0.185, unit: 'per mmHg', status: 'derived', refs: ['weil1970'], means: 'Rise in the hypoxic response per mmHg of CO2 above normal (hypoxic–hypercapnic interaction): A·e^(k·ΔPCO2).',
    derivation: 'Weil: A = 453 at PACO2 5 mmHg above control against 180: ln(453/180)/5 = 0.185.' },
  hypoxiaCo2Down: { value: 0.357, unit: 'per mmHg', status: 'derived', refs: ['weil1970'], means: 'Fall in the hypoxic response per mmHg of CO2 below normal.',
    derivation: 'Weil: A = 30.2 at 5 mmHg below control: ln(180/30.2)/5 = 0.357. Hypocapnia all but abolishes the hypoxic drive.' },
  hyperoxiaFloor: { value: -0.06, unit: '× resting ventilation', status: 'ungrounded', means: 'Most the carotid bodies’ resting discharge can be withdrawn by hyperoxia.' },
  hypoxiaCap: { value: 3, unit: '× resting ventilation', status: 'ungrounded', means: 'Most ventilation the hypoxic drive alone adds.' },
  sustainableShare: { value: 0.45, unit: 'fraction of MVV', status: 'assumed', means: 'Share of maximal voluntary ventilation that can be sustained.', derivation: 'Sustainable ventilation is commonly put at half or less of MVV.' },
  mvvPerFev1: { value: 37, unit: 'L/min per L', status: 'assumed', means: 'Maximal voluntary ventilation per litre of FEV1.', derivation: 'MVV is conventionally estimated as 35–40 × FEV1.' },
  /* --- gas exchange ------------------------------------------------------------- */
  baseShunt: { value: 0.02, unit: 'fraction of output', status: 'assumed', refs: ['nunn2005'], means: 'Blood that bypasses the alveoli in health (bronchial and Thebesian veins).', derivation: 'The normal physiological shunt of 2–3 %.' },
  vqSpread: { value: 0.22, unit: 'ln-SD of ventilation across equal-perfusion units', status: 'derived', refs: ['sorbini1968', 'wagner1974'], means: 'Spread of ventilation–perfusion ratios within a lobe in health.',
    derivation: 'Set so that the reference man of 45 has a PaO2 of about 90 mmHg (Sorbini: 109 − 0.43 × age) and an A–a gradient of about 11 mmHg. Wagner’s inert-gas log SDs (perfusion 0.43 young, 0.76 at 39–60) describe a different construction and give too wide a gradient here (0.6 → A–a 22 mmHg); they are not used directly.' },
  /* Acute asthma's mismatch: in an attack, airways closed by mucus and oedema of the wall leave units ventilated far
     less than they are perfused (low VA/Q, without shunt), and the inequality comes with a knee: little change until
     FEV1 is about 40 % predicted, then, with little more obstruction, PaO2 falls to about 50 mmHg (Wagner 1996).
     Measured: FEV1 41 %, log SD Q 1.18, 10.5 % of blood flow to low VA/Q units, no shunt (Ballester 1989); FEV1/FVC
     34 %, PaO2 50.5, PaCO2 37.1, AaPO2 53.7 mmHg, shunt 1 % (Roca 1988). Added to the linear spread of bronchoconstriction
     as a smooth step between the two degrees below (b; FEV1 57 % and 25 % predicted in the model) up to the maximum
     (ln-SD units of this model's construction, not MIGET's), fitted to those outcomes: at FEV1 38 % A–a about 42 mmHg,
     PaO2 about 62; at FEV1 25 % A–a about 54, PaO2 about 50, PaCO2 about 40. */
  vqAttackFrom: { value: 0.3, unit: 'bronchoconstriction (0–1)', status: 'derived', refs: ['wagner1996'], means: 'Bronchoconstriction at which an attack’s low-VA/Q units begin to appear (FEV1 about 57 % predicted).',
    derivation: 'Wagner 1996: gas exchange essentially unchanged until FEV1 about 40 %; the step starts above it so that it is well under way there (Ballester 1989, FEV1 41 %: log SD Q already 1.18).' },
  vqAttackTo: { value: 0.68, unit: 'bronchoconstriction (0–1)', status: 'derived', refs: ['roca1988'], means: 'Bronchoconstriction at which the attack’s VA/Q inequality is complete (FEV1 about 25 % predicted).',
    derivation: 'Roca 1988: acute severe asthma on admission (FEV1/FVC 34 %, taken as FEV1 about a quarter of predicted).' },
  vqAttackMax: { value: 1.15, unit: 'ln-SD (this model)', status: 'derived', refs: ['roca1988', 'ballester1989'], means: 'The extra spread of VA/Q ratios in a severe attack.',
    derivation: 'Fitted so that at the step’s end the model gives Roca 1988’s AaPO2 (53.7 mmHg) and PaO2 (50.5 mmHg) with a normal PaCO2 and no shunt.' },
  diffusionReserve: { value: 4, unit: '', status: 'assumed', means: 'Diffusion capacity relative to what transit time needs (end-capillary PO2 gap e^(−k·DL/(Q/Q₀))).',
    derivation: 'At rest equilibrium is reached in about a third of the capillary transit time, so a normal lung has about a threefold reserve; 4 is an assumption.' },
  hpvCentre: { value: 7, unit: 'kPa', status: 'ungrounded', means: 'Alveolar PO2 at which hypoxic pulmonary vasoconstriction is half maximal.' },
  hpvWidth: { value: 1.2, unit: 'kPa', status: 'ungrounded', means: 'Steepness of hypoxic pulmonary vasoconstriction.' },
  /* --- lung water (Starling) ---------------------------------------------------- */
  capillaryPressureShare: { value: 0.4, unit: '', status: 'derived', refs: ['gaar1967'], means: 'Pulmonary capillary pressure: Pla + k·(Ppa − Pla).',
    derivation: 'Gaar’s isolated-lung measurement (the "Gaar equation"); only the record has been checked.' },
  plasmaOncotic: { value: 25, unit: 'mmHg', status: 'measured', refs: ['nunn2005'], means: 'Plasma oncotic pressure at a normal albumin.', derivation: 'The textbook 25 mmHg.' },
  interstitialOncotic: { value: 14, unit: 'mmHg', status: 'ungrounded', means: 'Lung interstitial oncotic pressure at a normal albumin.' },
  reflection: { value: 0.8, unit: '', status: 'ungrounded', means: 'Reflection coefficient of the pulmonary capillary to protein.' },
  oedemaThreshold: { value: 15, unit: 'relative filtration', status: 'ungrounded', means: 'Filtration beyond which the alveoli begin to flood.' },
  embolismResistance: { value: 0.8, unit: 'per unit obstructed perfusion', status: 'ungrounded', means: 'Extra pulmonary vasoconstriction an embolus provokes, beyond the vessels it blocks.' },
  sympatheticHypoxia: { value: 0.6, unit: 'drive per unit carotid-body stimulus', status: 'ungrounded', means: 'Sympathetic drive to the heart and vessels from the carotid bodies (per resting ventilation the hypoxic drive adds).' },
  sympatheticCo2: { value: 0.3, unit: 'drive per kPa', status: 'ungrounded', means: 'Sympathetic drive from hypercapnia.' },
  sympatheticCo2Onset: { value: 6.5, unit: 'kPa', status: 'ungrounded', means: 'PaCO2 above which hypercapnia adds sympathetic drive.' },
  sympatheticAfferent: { value: 0.25, unit: 'drive per unit', status: 'ungrounded', means: 'Sympathetic drive from breathlessness (the lung’s own receptors).' },
  /* --- time constants ---------------------------------------------------------- */
  pao2Tau: { value: 8, unit: 's', status: 'ungrounded', means: 'Time constant of arterial O2 after a change in ventilation.' },
  co2StorePerKg: { value: 4.9, unit: 'mL CO2 per kPa per kg', status: 'derived', refs: ['stock1989', 'nunn2005'],
    means: 'Capacity of the body\u2019s quickly exchanging CO2 store (tissues and venous blood), per kilogram: how fast tissue and mixed venous PCO2 rise when CO2 is produced faster than the lungs receive it.',
    derivation: 'Stock 1989: in 14 anaesthetised, apnoeic adults with the tube clamped, PaCO2 rose 12 mmHg in the first minute and 3.4 mmHg/min thereafter. After the first minute the lungs have come into equilibrium with the venous blood and the rise is the store filling: capacity = CO2 production / rate. Production under anaesthesia is taken as 85 % of the model\u2019s awake 200 mL/min (anaesthesia lowers metabolic rate by about a sixth: an assumption), 170 mL/min: 170/3.4 = 50 mL/mmHg = 375 mL/kPa, for a 76 kg adult (the patients\u2019 weights are not in the abstract) = 4.9 mL/kPa/kg. The first-minute rise is a validation (scripts/arrest.test.mjs). Replaces the ungrounded 50 s time constant of arterial CO2.' },
  /* --- breathing when the brain is not perfused (ADR-018 step 2b) -------------------- */
  centrePerfusionFull: { value: 25, unit: 'mmHg', status: 'assumed',
    means: 'Brain perfusion pressure (aortic minus right atrial) above which the respiratory centre works fully.',
    derivation: 'A placement. People faint when cerebral perfusion falls, but the medulla outlasts the cortex, and breathing persists in shock at perfusion pressures well below the 50\u201360 mmHg of autoregulation. Set below the circulations of every living patient in the model\u2019s cases and tests (no existing result moved through the centre when it was added), so that only an arrest, or CPR\u2019s low flow, reaches it. No human measurement found.' },
  centrePerfusionZero: { value: 10, unit: 'mmHg', status: 'assumed',
    means: 'Brain perfusion pressure below which the respiratory centre fails entirely (apnoea, or gasping).',
    derivation: 'A placement; between this and centrePerfusionFull the centre\u2019s function rises smoothly. No human measurement found.' },
  centreFailTau: { value: 8, unit: 's', status: 'assumed',
    means: 'Time constant with which the respiratory centre fails once the brain is not perfused.',
    derivation: 'A placement, matched to how quickly consciousness is lost when the cerebral circulation stops (several seconds, then gone within 10\u201320 s). Breathing in people may continue as gasping, which is separate (gaspChanceVf).' },
  centreRecoverTau: { value: 60, unit: 's', status: 'assumed',
    means: 'Time constant with which the respiratory centre recovers once the brain is perfused again.',
    derivation: 'A placement: slower than its failure, since the brainstem recovers from ischaemia over tens of seconds to minutes. After ROSC (ADR-018 step 3) this matters, and it should then be grounded on the return of spontaneous breathing after resuscitation.' },
  gaspChanceVf: { value: 0.56, unit: 'probability', status: 'measured', refs: ['clark1992'],
    means: 'Chance that a patient whose heart arrests in ventricular fibrillation gasps.',
    derivation: 'Clark 1992: agonal respirations in 56 % of out-of-hospital arrests in VF (34 % in other rhythms, 40 % of all 445).' },
  gaspMeanSeconds: { value: 510, unit: 's', status: 'derived', refs: ['bobrow2008'],
    means: 'Mean duration of gasping after an arrest, drawn for each patient who gasps from an exponential distribution.',
    derivation: 'Bobrow 2008, 1,218 witnessed arrests: gasping in 33 % of those who arrested in front of the crew, 20 % when the crew arrived in under 7 min, 14 % at 7\u20139 min, 7 % after 9 min. Taking the first as time 0 and the others at about 4.5, 8 and 11 min, the share still gasping falls as e^(\u2212t/\u03c4) with \u03c4 = 8.8, 9.2 and 7.1 min: about 8.5 min, 510 s.' },
  gaspRate: { value: 6, unit: '/min', status: 'assumed', means: 'Rate of agonal gasps.',
    derivation: 'A placement: gasps are slow and irregular; no human rate was found.' },
  gaspVolume: { value: 0.5, unit: 'L', status: 'assumed', means: 'Volume of an agonal gasp.',
    derivation: 'A placement, about a resting tidal volume. Gasps are brief and can move useful volumes (Manole 2006, mostly animal data).' },
  /* --- breaths given at the airway (ADR-018 step 2b) ------------------------------- */
  tensionTransmission: { value: 1, unit: 'fraction', status: 'assumed', refs: ['roberts2015'],
    means: 'Share of a tension pneumothorax’s pressure that reaches the heart and the great veins in the chest.',
    derivation: 'A placement: the mediastinum is mobile, and the trapped air pushes it over until the other side and the heart are compressed too, so the whole pressure is taken to act around the heart. No human measurement of the pressure in a tension pneumothorax, or of how much of it reaches the heart, was found; animal models define tension from a pleural pressure of +1 mmHg with falls of 20–30 % in output. Roberts 2015 (183 human cases) reports what it does, not its pressure.' },
  trachealShiftTension: { value: 5, unit: 'mmHg', status: 'assumed',
    means: 'Pressure of trapped pleural air at which the trachea is felt displaced away from it.',
    derivation: 'A placement. The mediastinum is moved by a pressure difference, so a simple pneumothorax, at atmospheric pressure, leaves the trachea central, and only air under tension pushes it away (as taught; tracheal deviation is a late and unreliable sign of tension). No human measurement relates the pressure to a palpable shift; 5 mmHg is the breathless stage of the tension scenarios.' },
  bagVolume: { value: 0.5, unit: 'L', status: 'assumed', means: 'Volume a rescuer squeezes from a self-inflating bag for one breath.',
    derivation: 'Resuscitation guidelines teach a breath that makes the chest rise visibly, about 500\u2013600 mL for an adult; the lower end. Not measured on rescuers.' },
  bagInspiration: { value: 1, unit: 's', status: 'assumed', means: 'Duration of a given breath.', derivation: 'The guidelines\u2019 \u201ceach breath over about 1 second\u201d.' },
  maskLeak: { value: 0.3, unit: 'fraction', status: 'assumed', means: 'Share of a bag-mask breath lost round the mask.',
    derivation: 'A placement: leak with a face mask is large and varies with the operator; with one rescuer it is commonly a third or more. Not sourced.' },
  supraglotticLeak: { value: 0.1, unit: 'fraction', status: 'assumed', means: 'Share of a breath lost round a supraglottic airway.',
    derivation: 'A placement: supraglottic airways seal better than a mask but less well than a cuffed tube. Not sourced.' },
  givenVentilationWindow: { value: 30, unit: 's', status: 'assumed', means: 'Window over which the gas exchange counts given breaths and gasps as ventilation.',
    derivation: 'Gas exchange is solved for the breathing of the last half minute (about three given breaths at 10/min); shorter windows make alveolar gas jump with each breath. A modelling choice, not physiology.' },
  driveTau: { value: 4, unit: 's', status: 'assumed', refs: ['weil1970'], means: 'Time constant of the ventilatory drive.', derivation: 'Weil: ventilation adjusts to a step in alveolar O2 within 18–23 s, about four to five time constants.' },
});
