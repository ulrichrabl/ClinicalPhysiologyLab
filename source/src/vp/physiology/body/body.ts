/* ===========================================================================
   The internal milieu: body water, salt, potassium, acid–base, the kidney,
   and the fuels (glucose, insulin, ketones, lactate).

   Everything here is an amount the body holds (mmol, litres, grams) and the
   rates at which it gains and loses it. Concentrations, the laboratory's
   numbers, are amounts divided by the volume they are dissolved in. Nothing
   is a fixed laboratory value: a sodium of 121 is too much water for the
   sodium held, and the model has to arrive at it.

   Time runs in hours. A case gives the causes (a thiazide, four days of
   diarrhoea, no insulin since yesterday) and how long they have acted; the
   body is integrated from a healthy steady state over that course, coupled
   to the circulation (which the kidney needs for its perfusion and which
   the body's blood volume fills) and to the lungs (which set the CO₂ that
   acid–base answers to).

   Compartments
     Water: intracellular (ICF) and extracellular (ECF), in osmotic
     equilibrium at every instant; the ECF splits into plasma and interstitial
     fluid by a Starling balance that settles over about half an hour.
     Sodium and chloride: the ECF. Potassium: the whole body, shared between
     cells and ECF by the Na⁺/K⁺ pump (insulin, catecholamines, pH, tonicity).
     Base (bicarbonate): an apparent space about twice the ECF, because cells
     and bone buffer about half of any acid load.
     Organic anions (lactate, ketoacids): about 1.2 × the ECF.
     Urea and creatinine: total body water.

   Acid–base is kept as a balance of base: every acid made (sulfuric acid
   from protein, ketoacids, lactic acid) consumes base; every one removed
   (oxidised, or excreted as ammonium by the kidney) returns it. Vomiting
   loses acid (gains base); diarrhoea loses bicarbonate. The urine is
   electroneutral, so the chloride it carries is what is left after its
   cations and other anions are counted; that is how the kidney's acid
   excretion, and a vomiting patient's paradoxical aciduria, act on the
   plasma chloride.

   Sources for the constants are in the chapters (models.ts).
=========================================================================== */

export interface BodyParams {
  /** How long the present illness has acted, hours. */
  courseHours: number;
  /* intake */
  fluidIntake: number;         // L/day drunk, before thirst
  foodIntake: number;          // fraction of a normal diet eaten
  saltIntake: number;          // mmol Na/day on a full diet
  potassiumIntake: number;     // mmol K/day on a full diet
  toxicAcid: number;           // an acid with an unmeasured anion (methanol, ethylene glycol, salicylate), mmol/h
  proteinIntake: number;       // g/day on a full diet
  carbIntake: number;          // g/day on a full diet
  canDrink: number;            // 1 = thirst can be acted on
  /* losses */
  vomiting: number;            // L/day
  diarrhoea: number;           // L/day
  /* kidney */
  nephronMass: number;         // fraction of nephrons working (chronic kidney disease)
  tubularInjury: number;       // acute tubular necrosis, 0–1
  obstruction: number;         // outflow obstruction, 0–1
  /* drugs */
  aceInhibitor: number;        // ACE inhibitor or angiotensin receptor blocker, 0–1
  nsaid: number;               // 0–1
  loopDiuretic: number;        // 0–1
  thiazide: number;            // 0–1
  spironolactone: number;      // 0–1
  /* hormones */
  siadh: number;               // ADH secreted regardless of tonicity, pg/mL
  /* fuels */
  betaCell: number;            // insulin secretory capacity, × normal (0 = type 1 diabetes)
  insulinSensitivity: number;  // × normal
  insulinDose: number;         // injected insulin, units/day
  stress: number;              // counter-regulatory hormones: 0 rest, 1 severe illness
  /* infection */
  infection: number;           // bacterial infection: 0 none, 0.3 local, 0.6 systemic, 0.9 overwhelming
  urinarySource: number;       // 1 = the infection is in the urinary tract
  /* blood */
  redCellMass: number;         // the red cell mass the marrow aims for, × normal (polycythaemia)
  marrow: number;              // marrow capacity, × normal (aplasia, infiltration, chemotherapy)
  ironAbsorption: number;      // dietary iron absorbed, × normal (poor diet, coeliac disease, gastrectomy)
  b12Deficiency: number;       // 0–1: megaloblastic, ineffective erythropoiesis
  haemolysis: number;          // extra red cell destruction, × normal destruction
  upperGIBleed: number;        // mL/h into the stomach or duodenum (digested: urea and ammonia rise)
  lowerGIBleed: number;        // mL/h from the colon (occult, or fresh)
  /* liver */
  liverFunction: number;       // hepatocyte mass, × normal (cirrhosis, acute failure)
  portalHypertension: number;  // 0–1
  hepatitis: number;           // hepatocyte necrosis, 0–1
  cholestasis: number;         // bile outflow blocked, 0–1
  alcohol: number;             // heavy drinking, 0–1
  anticoagulant: number;       // vitamin K antagonist effect, 0–1
  /* endocrine */
  thyroidGland: number;        // thyroid tissue able to make hormone, × normal (Hashimoto, thyroidectomy, radioiodine)
  thyroidStimulation: number;  // TSH-receptor antibodies driving the gland regardless of TSH (Graves), 0–1
  orbitopathy: number;         // thyroid eye disease (Graves' orbitopathy), 0–1
  thyroxineDose: number;       // levothyroxine, µg/day
  antithyroid: number;         // carbimazole or thiamazole: synthesis blocked, 0–1
  pituitary: number;           // anterior pituitary reserve, × normal (TSH and ACTH)
  adrenalFunction: number;     // adrenal cortex, × normal (Addison's disease destroys cortisol and aldosterone production)
  hydrocortisoneDose: number;  // mg/day (20 replaces normal secretion)
  fludrocortisone: number;     // mg/day (0.1 replaces aldosterone)
  pthAutonomy: number;         // parathyroid adenoma: PTH that calcium cannot suppress, 0–1
  pthrp: number;               // PTH-related peptide from a tumour, 0–1
  vitaminD: number;            // vitamin D status, × normal
  boneResorption: number;      // osteolysis from bone metastases or myeloma, 0–1
  bisphosphonate: number;      // osteoclasts blocked, 0–1
}

export const BODY_DEFAULTS: BodyParams = {
  courseHours: 24,
  fluidIntake: 2.0, foodIntake: 1, saltIntake: 150, potassiumIntake: 70, toxicAcid: 0, proteinIntake: 70, carbIntake: 250, canDrink: 1,
  vomiting: 0, diarrhoea: 0,
  nephronMass: 1, tubularInjury: 0, obstruction: 0,
  aceInhibitor: 0, nsaid: 0, loopDiuretic: 0, thiazide: 0, spironolactone: 0,
  siadh: 0,
  betaCell: 1, insulinSensitivity: 1, insulinDose: 0, stress: 0,
  infection: 0, urinarySource: 0,
  redCellMass: 1, marrow: 1, ironAbsorption: 1, b12Deficiency: 0, haemolysis: 0, upperGIBleed: 0, lowerGIBleed: 0,
  liverFunction: 1, portalHypertension: 0, hepatitis: 0, cholestasis: 0, alcohol: 0, anticoagulant: 0,
  thyroidGland: 1, thyroidStimulation: 0, orbitopathy: 0, thyroxineDose: 0, antithyroid: 0, pituitary: 1,
  adrenalFunction: 1, hydrocortisoneDose: 0, fludrocortisone: 0,
  pthAutonomy: 0, pthrp: 0, vitaminD: 1, boneResorption: 0, bisphosphonate: 0,
};

/** What the body reads from the circulation and the lungs. */
export interface BodyInputs {
  MAP: number; CO: number; CVP: number; sympathetic: number;
  PaCO2: number; DO2: number; VO2: number; SaO2?: number;
  tempC: number;
}

export interface BodyPerson { age: number; sex: 'F' | 'M'; heightCm: number; weightKg: number }

/* Composition of losses, mmol/L. Gastric juice is HCl with some NaCl and KCl; stool water in diarrhoea carries bicarbonate. */
const VOMIT = { Na: 60, K: 12, Cl: 130, H: 60 };
const STOOL = { Na: 80, K: 35, Cl: 75, HCO3: 40 };

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const relax = (x: number, target: number, dt: number, tau: number) => x + (target - x) * (1 - Math.exp(-dt / tau));

/** Henderson–Hasselbalch, PaCO2 in kPa. */
export const pHof = (hco3: number, paco2: number) => 6.1 + Math.log10(Math.max(0.5, hco3) / (0.23 * Math.max(0.5, paco2)));

export interface BodyState {
  /* amounts */
  TBW: number;      // L
  Vp: number;       // plasma volume, L
  Na: number; K: number; B: number;      // mmol (B: base, bicarbonate equivalents in its apparent space)
  G: number;        // glucose in ECF, mmol
  Ket: number; Lac: number; UA: number; P: number;    // ketoanions, lactate, sulfate and other fixed anions, phosphate (mmol)
  Urea: number; Cr: number;                          // mmol
  Alb: number;      // plasma albumin, g
  RCV: number;      // red cell volume, L
  RCVlost: number;  // unused (kept for saved states)
  Fe: number;       // storage iron, mg
  MCV: number; EPO: number;
  BilU: number; BilC: number;     // unconjugated and conjugated bilirubin in the ECF, µmol
  ALT: number; ALP: number; GGT: number; INR: number; NH3: number;
  Asc: number;      // ascites, L (part of the interstitial fluid)
  /* fast hormones */
  I: number;        // plasma insulin, mU/L
  Idep: number;     // injected insulin still being absorbed: the plasma level it supplies, mU/L
  AngII: number; Ald: number; ADH: number;          // AngII and aldosterone × normal, ADH pg/mL
  GFRad: number;    // the filtration the tubules have adapted to over days (L/h)
  /* inflammation */
  IL: number;       // circulating inflammatory signal (cytokines), × the response to a systemic infection
  T: number;        // core temperature, °C
  CRP: number; WCC: number; Plt: number;
  /* endocrine */
  T4: number; TSH: number;        // free thyroxine pmol/L, TSH mU/L
  Cort: number; ACTH: number;     // cortisol and ACTH × a normal morning level
  Ca: number; PTH: number;        // albumin-adjusted calcium mmol/L, PTH pmol/L
  /* bookkeeping */
  urineL: number; hours: number;
}

export interface BodySnapshot {
  /* concentrations */
  sodium: number; potassium: number; chloride: number; standardBicarbonate: number; glucose: number;
  urea: number; creatinine: number; lactate: number; ketones: number; betaHydroxybutyrate: number; phosphate: number;
  albumin: number; haemoglobin: number; haematocrit: number; osmolality: number; tonicity: number;
  /* volumes, L */
  TBW: number; ICF: number; ECF: number; plasma: number; ISF: number; bloodVolume: number;
  dECF: number; dISF: number; dPlasma: number; dICF: number; bloodVolumeDelta: number;
  /* kidney */
  GFR: number; urineMlPerH: number; urineOsm: number; urineNa: number; urineK: number; urineCl: number;
  FENa: number; NH4: number; bicarbonaturia: number; glucosuria: number; ketonuria: number; uNaRate: number; uKRate: number;
  autoregulation: number;
  /** The lower limit of autoregulation (mmHg perfusion pressure) and the filtration it would allow above it (mL/min). */
  Plow: number; gfrMax: number; perfusion: number;
  /* hormones */
  insulin: number; angII: number; aldosterone: number; adh: number;
  /* blood and liver */
  mcv: number; reticulocytes: number; ferritin: number; ironStores: number; b12: number; epo: number; ldh: number; haptoglobin: number;
  bilirubin: number; bilirubinConjugated: number; alt: number; alp: number; ggt: number; inr: number; ammonia: number; ascites: number; encephalopathy: number;
  /* inflammation */
  inflammation: number; temperature: number; crp: number; whiteCellCount: number; platelets: number; sepsis: number; vasoplegia: number;
  /* endocrine */
  tsh: number; ft4: number; ft3: number; thyroidEffect: number; cortisol: number; acth: number; renin: number; aldosteronePmol: number;
  calcium: number; calciumTotal: number; ionisedCalcium: number; pth: number; vitaminD25: number; cortisolEffect: number; cortisolDeficit: number; metabolicMult: number; hrMult: number;
  /* fluxes, mmol/h or L/h */
  hgo: number; glucoseUptake: number; ketogenesis: number; ketoneOxidation: number; lactateProduction: number; lactateClearance: number;
  waterIn: number; waterOut: number;
  /* circulation effects */
  RsysMult: number; V0svMult: number;
  hours: number;
  /** K⁺ ratio inside:outside the cells, for the chapter. */
  kRatio: number; Kbody: number;
  /** Parameters and inputs, for the chapters. */
  params: BodyParams; inputs: BodyInputs;
}

/* ---- the model -------------------------------------------------------------------------------------- */
export class Body {
  p: BodyParams;
  person: BodyPerson;
  s!: BodyState;
  inp: BodyInputs = { MAP: 93, CO: 5.2, CVP: 3.5, sympathetic: 0.47, PaCO2: 5.33, DO2: 1000, VO2: 250, tempC: 37 };
  /** Normal values for this person: the reference the controllers defend. */
  ref!: { TBW: number; ICF: number; ECF: number; Vp: number; ISF: number; RCV: number; Oi: number; GFR: number; BW: number; Alb: number; creatProd: number; Vorg0: number };
  private kGuess = 4;
  /** Last flux evaluation, for the snapshot. */
  private f: Record<string, number> = {};

  constructor(p: Partial<BodyParams>, person: BodyPerson) {
    this.p = { ...BODY_DEFAULTS, ...p };
    this.person = person;
    this.reset();
  }

  setParams(p: Partial<BodyParams>, person?: BodyPerson) {
    this.p = { ...BODY_DEFAULTS, ...p };
    if (person && (person.weightKg !== this.person.weightKg || person.sex !== this.person.sex || person.age !== this.person.age || person.heightCm !== this.person.heightCm)) {
      this.person = person; this.reset();
    }
  }
  setInputs(x: Partial<BodyInputs>) { Object.assign(this.inp, x); }
  /** Blood volume when the circulation was last read. Between readings (a long step of the course) the
      haemodynamics are extrapolated from it: pressures and output fall with the volume lost since. */
  private bvAnchor = NaN;
  anchor() { this.bvAnchor = this.bloodVolume(); }
  private haemo() {
    const i = this.inp;
    const d = Number.isFinite(this.bvAnchor) ? this.bloodVolume() - this.bvAnchor : 0;
    return {
      MAP: clamp(i.MAP + 0.02 * d, 20, 200), CO: clamp(i.CO * (1 + 0.0004 * d), 0.3, 15), CVP: clamp(i.CVP + 0.003 * d, -3, 30),
      DO2: Math.max(50, i.DO2 * (1 + 0.0004 * d)),
    };
  }

  /** A healthy person's amounts (close to, not exactly at, steady state: a few days on a normal diet finish that). */
  reset(bloodVolume = 5000) {
    const { weightKg: BW, sex, age, heightCm } = this.person;
    const tbwFrac = (sex === 'F' ? 0.5 : 0.6) - (age > 60 ? 0.05 : 0);
    const TBW = BW * tbwFrac;
    const ECF = TBW / 3, ICF = TBW - ECF;
    const hct = sex === 'F' ? 0.41 : 0.45;
    const Vp = (bloodVolume / 1000) * (1 - hct), RCV = (bloodVolume / 1000) * hct;
    const bsa = Math.sqrt(heightCm * BW / 3600);
    const GFR = 0.125 * 60 * (bsa / 1.73) * (age > 40 ? 1 - 0.008 * (age - 40) : 1) * (sex === 'F' ? 0.92 : 1);   // L/h
    const creatProd = BW * (sex === 'F' ? 0.16 : 0.21) * (age > 50 ? 1 - 0.006 * (age - 50) : 1) / 24;           // mmol/h
    this.ref = { TBW, ICF, ECF, Vp, ISF: ECF - Vp, RCV, Oi: 285.2 * ICF, GFR, BW, Alb: 42 * Vp, creatProd, Vorg0: 1.2 * ECF };
    this.s = {
      TBW, Vp, Na: 140 * ECF, K: 4.0 * (ECF + 35 * ICF), B: 24 * 2 * ECF,
      G: 5.2 * ECF, Ket: 0.08 * 1.2 * ECF, Lac: 0.9 * 1.2 * ECF, UA: 0.45 * ECF, P: 1.0 * ECF,
      Urea: 5.0 * TBW, Cr: 0.075 * TBW, Alb: 42 * Vp, RCV, RCVlost: 0,
      Fe: sex === 'F' ? 400 : 900, MCV: 90, EPO: 1, BilU: 8 * ECF, BilC: 2 * ECF, ALT: 25, ALP: 80, GGT: 30, INR: 1.0, NH3: 30, Asc: 0,
      I: 9, Idep: 0, GFRad: GFR, IL: 0, T: 36.9, CRP: 3, WCC: 7, Plt: 250, AngII: 1, Ald: 1, ADH: 1.5, urineL: 0, hours: 0,
      T4: 16, TSH: 2, Cort: 1, ACTH: 1, Ca: 2.35, PTH: 4,
    };
  }

  /* ---- derived quantities ---- */
  private volumes() {
    const s = this.s, r = this.ref;
    // Osmotic equilibrium: cell osmoles are fixed; ECF effective osmoles are sodium salts and glucose.
    const Oe = 2 * s.Na + s.G;
    const posm = (r.Oi + Oe) / s.TBW;
    const ICF = r.Oi / posm;
    const ECF = s.TBW - ICF;
    return { ICF, ECF, posm };
  }

  /** The current concentrations and everything computed from them. */
  conc() {
    const s = this.s, r = this.ref;
    const { ICF, ECF, posm } = this.volumes();
    const Vorg = 1.2 * ECF;
    const Na = s.Na / ECF, G = s.G / ECF;
    const alb = s.Alb / s.Vp;
    // Low albumin removes weak acid: bicarbonate rises (and the anion gap falls) by about a quarter of the deficit.
    const SBC = s.B / (2 * ECF) + 0.12 * (42 - alb);
    const HCO3 = SBC + 0.75 * (this.inp.PaCO2 - 5.33);
    const pH = pHof(HCO3, this.inp.PaCO2);
    const urea = s.Urea / s.TBW;
    /* Potassium: the cells hold about 140 mmol/L, the ECF about 4. The pump keeps the cells' share; it rises a little as
       the plasma level rises (cells take up part of a load) and is moved by insulin and adrenaline (in), acidaemia and
       hypertonicity (out). Solved for the plasma level: each mmol/L is about 300 mmol of body potassium. */
    /* The cells' K⁺ concentration moves with tonicity (their K⁺ amount is what they hold; their water follows osmolality). */
    const f = (posm / 290) * (0.92 + 0.107 * s.I / (s.I + 3)) * Math.exp(0.18 * (pH - 7.4)) * Math.exp(-0.0015 * Math.max(0, posm - 290)) * (1 + 0.02 * this.stressEff());
    let K = this.kGuess;
    for (let it = 0; it < 8; it++) {
      const ki = 140 * f * Math.pow(Math.max(0.3, K) / 4, 0.3);
      const g = K * ECF + ki * ICF - s.K;
      const dg = ECF + 0.3 * ki * ICF / Math.max(0.3, K);
      const next = clamp(K - g / dg, 0.5, 15);
      if (Math.abs(next - K) < 1e-6) { K = next; break; }
      K = next;
    }
    this.kGuess = K;
    const ratio = 140 * f * Math.pow(K / 4, 0.3) / K;
    const Lac = s.Lac / Vorg, Ket = s.Ket / Vorg, UA = s.UA / ECF, Pi = s.P / ECF;
    /* Chloride is what electroneutrality leaves: the cations (Na⁺, K⁺, and Ca²⁺ and Mg²⁺ at about 3.5 mEq/L)
       less bicarbonate, albumin and phosphate (their charge at pH 7.4), lactate, ketoanions, sulfate and the
       rest of the unmeasured anions (about 6.5 mEq/L). Gaining or losing chloride is therefore always gaining
       or losing a cation, or giving up bicarbonate. */
    const Cl = Na + K + 3.5 - SBC - 0.28 * alb - 1.8 * Pi - Lac - Ket - UA - 6.5;
    const Hct = s.RCV / (s.RCV + s.Vp);
    return {
      ICF, ECF, posm, Vorg, Na, G, K, ratio, SBC, HCO3, pH, alb, urea,
      Cr: s.Cr / s.TBW, Lac, Ket, UA, Pi, Cl,
      Hct, Hb: 333 * Hct, ISF: ECF - s.Vp,
      tonicity: 2 * Na + G, osm: 2 * Na + G + urea,
      BV: (s.Vp + s.RCV) * 1000,
    };
  }

  /* ---- the rates ---- */
  private rates(dt: number) {
    const s = this.s, p = this.p, r = this.ref, i = { ...this.inp, ...this.haemo() };
    const c = this.conc();
    const food = clamp(p.foodIntake, 0, 2);
    const BW = r.BW;
    /* Ascites is extracellular fluid the circulation cannot use: the kidney senses the rest. */
    const ve = (c.ECF - s.Asc) / r.ECF;
    /* The volume the body senses (atrial and arterial stretch) is the plasma it holds in its vessels: losing red cells alone
       (anaemia) is not sensed as hypovolaemia once plasma has refilled, losing whole blood is. */
    const bvRel = s.Vp / r.Vp;
    const hypo = Math.max(0, 1 - bvRel) / 0.1;           // tenths of blood volume lost

    /* -- infection and inflammation: cytokines, fever, the acute-phase response, and what severe sepsis does -- */
    const ilTarget = 2.2 * Math.max(0, p.infection) ** 1.5;
    s.IL = relax(s.IL, ilTarget, dt, 4);
    const sev = clamp((s.IL - 0.8) / 1.2, 0, 1);                       // organ dysfunction: sepsis
    const Tset = 36.9 + 2.6 * s.IL / (s.IL + 0.6) - 2.2 * sev * sev * clamp((65 - i.MAP) / 20, 0, 1) + clamp(0.25 * (this.thyroidEffect() - 1), -1, 1.2);
    s.T = relax(s.T, Tset, dt, 1.5);
    s.CRP += (0.11 + 8 * s.IL - 0.0365 * s.CRP) * dt;
    s.WCC = relax(s.WCC, (7 + 13 * s.IL / (s.IL + 0.5) - 12 * Math.max(0, sev - 0.7)) * Math.min(1, clamp(p.marrow, 0, 2)) * (1 - 0.3 * clamp(p.portalHypertension, 0, 1)), dt, 8);
    s.Plt = relax(s.Plt, 250 * (1 - 0.5 * sev) * (1 - 0.55 * clamp(p.portalHypertension, 0, 1)) * (1 - 0.25 * clamp(p.alcohol, 0, 1)) * Math.min(1, clamp(p.marrow, 0, 2)), dt, 24);
    s.Alb = relax(s.Alb, r.Alb * (1 - 0.45 * sev - 0.1 * Math.min(1, s.IL)) * clamp(p.liverFunction, 0.05, 1.2) ** 0.5, dt, sev > 0.05 ? 30 : 240);   // synthesis by the liver, half-life ~20 days   // leak into the tissues, less synthesis
    const st = this.stressEff();

    /* -- thyroid: TSH drives the gland; thyroxine suppresses TSH (a log-linear relation: TSH changes about 100-fold for
       a 2-fold change in free T4). Antibodies against the TSH receptor drive the gland on their own (Graves);
       thyroxine has a half-life of about a week. Severe illness lowers TSH (the sick euthyroid state). -- */
    const pit = clamp(p.pituitary, 0, 1.5);
    s.TSH ??= 2; s.T4 ??= 16; s.Cort ??= 1; s.ACTH ??= 1; s.Ca ??= 2.35; s.PTH ??= 4;
    s.TSH = relax(s.TSH, clamp(2 * pit * (16 / Math.max(1, s.T4)) ** 4 * (1 - 0.5 * sev), 0.005, 150), dt, 12);
    const gland = clamp(p.thyroidGland, 0, 3) * (1 - 0.9 * clamp(p.antithyroid, 0, 1));
    const t4Target = 16 * gland * Math.min(3, Math.sqrt(s.TSH / 2)) + 45 * clamp(p.thyroidStimulation, 0, 1.5) * gland + 16 * Math.max(0, p.thyroxineDose) / (1.6 * BW);
    s.T4 = relax(s.T4, clamp(t4Target, 0.5, 120), dt, 160);
    const thy = this.thyroidEffect();

    /* -- adrenal cortex: ACTH from the pituitary, driven by stress, suppressed by cortisol; cortisol from the gland under
       ACTH (half-life about 90 minutes), plus any hydrocortisone given. -- */
    const cortExo = Math.max(0, p.hydrocortisoneDose) / 20;
    s.ACTH = relax(s.ACTH, clamp(pit * (1 + 4 * st) * Math.max(0.05, s.Cort) ** -1.5, 0.02, 30), dt, 1);
    s.Cort = relax(s.Cort, clamp(p.adrenalFunction, 0, 3) * Math.min(6, s.ACTH) ** 0.8 + cortExo, dt, 1.5);
    const cortDef = this.cortisolDeficit();

    /* -- calcium: absorbed from the gut (calcitriol, made under PTH), exchanged with bone (resorption under PTH, PTHrP and
       metastases), excreted by the kidney (filtered, then reabsorbed under PTH; a high calcium itself blocks reabsorption
       in the loop of Henle, as do loop diuretics; thiazides increase it). PTH answers to ionised calcium within minutes. -- */
    const nmCa = clamp(p.nephronMass, 0.01, 1.2);
    const iCa = s.Ca * 0.5 * (1 + 0.16 * (7.4 - c.pH)) * (1 + 0.004 * (c.alb - 42));
    const pthTarget = 4 * Math.exp(-12 * (iCa - 1.175)) * (1 + 0.6 * clamp(1 - p.vitaminD, 0, 1)) * Math.max(0.6, c.Pi) ** 0.7 * (1 + 1.5 * (1 - Math.min(1, nmCa)))
      + 12 * clamp(p.pthAutonomy, 0, 3);
    s.PTH = relax(s.PTH, clamp(pthTarget, 0.2, 300), dt, 0.3);
    const pthEff = s.PTH + 40 * clamp(p.pthrp, 0, 2);
    const vitDEff = clamp(p.vitaminD, 0, 3) * clamp(s.PTH / 4, 0.2, 4) ** 0.3 * nmCa ** 0.7;
    const caGut = 0.21 * vitDEff * clamp(food, 0, 2);
    const caBone = (0.4 * clamp(pthEff / 4, 0.05, 40) ** 0.6 + 1.5 * clamp(p.boneResorption, 0, 2) + 0.04 * (thy - 1)) * (1 - 0.8 * clamp(p.bisphosphonate, 0, 1)) - 0.4;

    /* -- blood: red cells made under erythropoietin, from iron, destroyed after 120 days, lost by bleeding -- */
    const lf = clamp(p.liverFunction, 0.05, 1.2), ph = clamp(p.portalHypertension, 0, 1);
    const Hb0 = (this.person.sex === 'F' ? 0.41 : 0.45) * 333;
    const sat = clamp(i.SaO2 ?? 0.97, 0.4, 1);
    const epoTarget = clamp(p.nephronMass, 0.03, 1.2) ** 0.8 * Math.exp(4 * (1 - (c.Hb / (Hb0 * clamp(p.redCellMass, 0.3, 2))) * (sat / 0.97))) * (1 - 0.3 * Math.min(1, s.IL));
    s.EPO = relax(s.EPO, clamp(epoTarget, 0.02, 40), dt, 12);
    const P0 = r.RCV / (120 * 24);                                           // L of red cells a day… per hour
    const ironAvail = (s.Fe / (s.Fe + 60)) / (900 / 960);
    const hepcidin = 1 + 2 * Math.min(1, s.IL);                              // inflammation locks iron away
    const prodRBC = P0 * Math.min(clamp(p.marrow, 0, 2) * 6, s.EPO) * Math.min(1.2, ironAvail / Math.sqrt(hepcidin)) * (1 - 0.6 * clamp(p.b12Deficiency, 0, 1));
    const destrRBC = (s.RCV / (120 * 24)) * (1 + 4 * Math.max(0, p.haemolysis) + 0.6 * clamp(p.b12Deficiency, 0, 1) + 0.3 * ph);
    const ironAbs = (1 + 2.5 * clamp(1 - s.Fe / 300, 0, 1)) * clamp(p.ironAbsorption, 0, 3) / hepcidin / 24;   // mg/h, more when stores are low
    const bleed = (Math.max(0, p.upperGIBleed) + Math.max(0, p.lowerGIBleed)) / 1000;   // L/h whole blood
    const mcvNew = 90 - 28 * clamp(1 - ironAvail, 0, 1) + 30 * clamp(p.b12Deficiency, 0, 1) + 8 * clamp(p.alcohol, 0, 1) + 3 * clamp(s.EPO - 1, 0, 3) / 3;

    /* -- liver: bilirubin, enzymes, clotting factors, ammonia -- */
    const bilProd = (500 / 24) * destrRBC / P0 * (P0 > 0 ? 1 : 0);              // µmol/h of haem turned to bilirubin
    const conj = 0.175 * lf ** 1.5 * s.BilU;
    const bileOut = 0.7 * (1 - clamp(p.cholestasis, 0, 1)) ** 2 * Math.min(1, lf) * s.BilC;
    const bilUrine = 0.004 * s.BilC;                                          // conjugated bilirubin spills into the urine
    s.ALT = relax(s.ALT, 25 + 2500 * clamp(p.hepatitis, 0, 1) + 15 * clamp(p.alcohol, 0, 1) + 20 * (1 - Math.min(1, lf)), dt, 30);
    s.ALP = relax(s.ALP, 80 + 450 * clamp(p.cholestasis, 0, 1) + 40 * ph + 40 * clamp(this.thyroidEffect() - 1.3, 0, 2) + 25 * Math.max(0, Math.log((s.PTH ?? 4) / 4)) + 150 * clamp(p.boneResorption, 0, 2), dt, 48);   // bone ALP: turnover
    s.GGT = relax(s.GGT, 30 + 400 * clamp(p.cholestasis, 0, 1) + 250 * clamp(p.alcohol, 0, 1), dt, 72);
    s.INR = relax(s.INR, 1 + 2.4 * clamp(1 - lf, 0, 1) ** 1.3 + 0.5 * clamp(p.cholestasis, 0, 1) + 2 * clamp(p.anticoagulant, 0, 1) + 0.4 * this.sepsis(), dt, 12);
    const nh3Load = (p.proteinIntake * clamp(p.foodIntake, 0, 2) / 70 + 0.6 * Math.max(0, p.upperGIBleed) / 100) * (1 + 0.3 * clamp(4 - c.K, 0, 2));
    const nh3Clear = lf * (1 - 0.6 * ph) + 0.12;
    s.NH3 = relax(s.NH3, clamp(30 * (nh3Load + 0.2) / 1.2 / Math.pow(nh3Clear / 1.12, 1.2), 5, 400), dt, 3);

    /* -- hormones -- */
    const sym = Math.max(0, i.sympathetic - 0.47);
    const angTarget = clamp(Math.exp(-0.035 * (i.MAP - 93)) * Math.exp(-5 * (ve - 1)) * (1 + 1.5 * sym), 0.05, 30) * (1 - 0.85 * clamp(p.aceInhibitor, 0, 1));
    s.AngII = relax(s.AngII, angTarget, dt, 0.4);
    /* Aldosterone follows angiotensin II and potassium; on an ACE inhibitor it partly escapes ('breakthrough'). */
    /* The zona glomerulosa needs ACTH only permissively: pituitary failure spares aldosterone, adrenal failure does not. */
    const aldTarget = clamp((0.3 + 0.7 * Math.max(0.05, s.AngII)) ** 1.3 * (c.K / 4) ** 2, 0.03, 15) * clamp(p.adrenalFunction, 0, 2) ** 1.3;
    s.Ald = relax(s.Ald, Math.max(0.002, aldTarget), dt, 1.0);
    /* Mineralocorticoid effect: aldosterone, fludrocortisone, and the spill-over of large doses of hydrocortisone. */
    const aldEff = (s.Ald + Math.max(0, p.fludrocortisone) / 0.1 + 0.08 * cortExo) * (1 - 0.9 * clamp(p.spironolactone, 0, 1));
    // ADH: tonicity above a threshold that falls with hypovolaemia, a steep non-osmotic limb, nausea, and any inappropriate secretion.
    const nausea = clamp(p.vomiting / 1.5, 0, 1);
    const hypoA = Math.min(hypo, 1.6);
    const adhTarget = Math.max(0, 0.38 * (c.tonicity - (284 - 4 * hypoA))) + 1.2 * hypoA * hypoA * clamp((c.tonicity - 250) / 25, 0.25, 1) + 6 * nausea + 2 * st + p.siadh + 0.4
      + (3 * cortDef + 1.2 * Math.max(0, 1 - thy)) * clamp((c.tonicity - 245) / 30, 0.1, 1);   // cortisol restrains ADH (and CRH co-releases it); hypothyroidism lowers free water clearance
    s.ADH = relax(s.ADH, adhTarget, dt, 0.25);

    /* -- kidney: filtration -- */
    const rpp = i.MAP - Math.max(0, i.CVP);
    /* The lower limit of autoregulation rises when the defences against a falling perfusion are blocked, the more so the drier the patient. */
    const dry = hypo + 8 * Math.max(0, 1 - ve);
    const Plow = 72 + 22 * clamp(p.aceInhibitor, 0, 1) * (1 + dry) + 18 * clamp(p.nsaid, 0, 1) * (1 + dry);
    const auto = clamp((rpp - 35) / (Plow - 35), 0, 1) ** 0.8;
    const caHigh = Math.max(0, s.Ca - 2.6);                                  // hypercalcaemia: afferent constriction, nephrogenic diabetes insipidus
    const GFR = r.GFR * clamp(p.nephronMass, 0.01, 1.2) * clamp(thy, 0.3, 2.5) ** 0.15 * (1 - 0.35 * Math.min(1, caHigh)) * (1 - 0.9 * clamp(p.tubularInjury, 0, 1)) * (1 - clamp(p.obstruction, 0, 1))
      * auto * (1 - 0.06 * clamp(p.aceInhibitor, 0, 1)) * (1 - 0.3 * clamp(sym, 0, 0.5) * 2) * (1 - 0.012 * Math.max(0, i.CVP - 10))
      * (1 - 0.3 * Math.min(1, hypo / 2.5)) * (1 - 0.3 * sev) * (1 - 0.35 * ph * clamp(1 - lf, 0, 1) ** 1.5);   // hepatorenal                                  // septic kidney injury                                                    // renal sympathetic and afferent constriction in hypovolaemia
    const tub = 1 - 0.85 * clamp(p.tubularInjury, 0, 1);
    const nm = clamp(p.nephronMass, 0.01, 1.2);

    /* -- glucose and insulin -- */
    const g = Math.max(0.5, c.G);
    const hill = g ** 4 / (g ** 4 + 8 ** 4);
    const Iendo = clamp(p.betaCell, 0, 2) * 55 * hill / Math.sqrt(clamp(p.insulinSensitivity, 0.15, 2));
    /* Injected insulin: about 0.55 U/kg/day replaces normal secretion, but it arrives from the skin, not the portal vein,
       so the liver (which sees two to three times the peripheral level of secreted insulin) is less suppressed. */
    /* The subcutaneous depot (basal insulin) runs down over most of a day once doses stop. */
    s.Idep = relax(s.Idep, 9 * Math.max(0, p.insulinDose) / (0.55 * BW), dt, s.Idep > 9 * p.insulinDose / (0.55 * BW) ? 8 : 2);
    const Iexo = s.Idep;
    s.I = relax(s.I, Iendo + Iexo, dt, 0.15);
    const Ieff = s.I * clamp(p.insulinSensitivity, 0.05, 2);
    const IhepEff = Math.max(0, s.I - Iexo * 0.5) * clamp(p.insulinSensitivity, 0.05, 2);
    const carbIn = p.carbIntake * 5.55 * food / 24 * (1 - clamp(p.vomiting / 2, 0, 0.9));
    const H0 = 0.67 * BW;
    const hgo = H0 * (2 * 8 / (IhepEff + 8)) * (1 + 0.5 * st) * Math.min(1, lf + 0.15) * (1 - 0.5 * cortDef) * clamp(thy, 0.3, 3) ** 0.2;   // cortisol keeps gluconeogenesis going   // a failing liver cannot make glucose
    const uBrain = 0.33 * BW * (g / (g + 1)) / (5.2 / 6.2);
    const uIns = 0.2 * BW * Ieff * g / (g + 5);
    const uMass = 0.1 * BW * g / (g + 10);                                            // insulin-independent tissue uptake
    const glucU = GFR * Math.max(0, g - 10) * 0.9;

    /* -- ketones -- */
    const fasting = 1 - clamp(food, 0, 1);
    const ketoProd = 0.3 * BW * (9 / (s.I * s.I * clamp(p.insulinSensitivity, 0.2, 2) + 9)) * (1 + st) * (0.4 + 1.6 * fasting);
    const ketoOx = 0.6 * BW * c.Ket / (c.Ket + 1.2);
    const ketoU = GFR * Math.max(0, c.Ket - 0.3) * 0.5;

    /* -- lactate -- */
    const ER = i.VO2 / Math.max(50, i.DO2);
    /* Anaerobic glycolysis once oxygen extraction nears its limit; tissues also turn their demand down, so production saturates. */
    const lacProd = 0.75 * BW + 2.2 * BW * Math.tanh(Math.max(0, ER - 0.45) ** 1.5 / 0.25) + 20 * st + 0.5 * BW * sev;   // and in sepsis, from adrenaline and the microcirculation
    const hepatic = clamp(i.CO / 5.2, 0.15, 1.3) ** 0.5 * clamp((i.MAP - 25) / 45, 0.2, 1);
    const lacClear = (0.75 * BW / 0.9) * hepatic * Math.min(1, lf + 0.1) ** 0.7 * c.Lac / (1 + c.Lac / 12);

    /* -- urea, creatinine, phosphate, fixed acid -- */
    const proteinIn = p.proteinIntake * food;
    const ureaProd = ((proteinIn * 5.7 + 160 * st + 250 * fasting) / 24) * Math.min(1, lf + 0.3) + 1000 * Math.max(0, p.upperGIBleed) / 1000 * 0.9;   // digested blood: ~0.9 mmol urea per mL
    const flowSlow = clamp((s.ADH - 2) / 8, 0, 1);
    const ureaU = GFR * c.urea * Math.max(0.15, 0.47 - 0.15 * flowSlow - 0.06 * Math.min(2, hypo));
    const crU = GFR * c.Cr * 1.15;
    const uaProd = (proteinIn * 1.1 + 25 * fasting + 40 * st) / 24 + Math.max(0, p.toxicAcid);           // sulfuric (and other fixed) acid: H⁺ with an anion
    const uaU = GFR * c.UA * 0.9;
    const pIn = (30 * food * 0.7 + 8 + 15 * st) / 24 * (0.5 + 0.5 * vitDEff) + 0.25 * Math.max(0, caBone);   // bone resorbed releases phosphate with its calcium                          // gut, and bone and cell turnover
    const pU = GFR * Math.max(0, c.Pi - 0.72) * 0.55 * (1 + 2 * (1 - nm)) * clamp(pthEff / 4 / (1 + 1.5 * (1 - Math.min(1, nm))), 0.2, 40) ** 0.3;   // PTH (and PTHrP) block phosphate reabsorption (the CKD rise is already in the adaptation)

    /* -- sodium -- */
    const FL = GFR * c.Na;
    /* Pressure and volume natriuresis, opposed by aldosterone and angiotensin. A diuretic blocks a fraction of tubular
       reabsorption, but the volume it removes switches the opposing hormones on: the 'braking' that limits its effect. */
    /* Cirrhosis: splanchnic vasodilatation and the hepatorenal reflex hold sodium. */
    const natri = (1 + 1.5 * caHigh) * (1 - 0.6 * ph * clamp(1 - lf, 0, 1)) * Math.exp(18 * (ve - 1)) * Math.exp(0.015 * (i.MAP - 93)) * Math.max(0.25, aldEff) ** -0.4 * Math.max(0.05, s.AngII) ** -0.2;
    let naU = (150 / 24) * natri * (1 + 0.8 * clamp(p.loopDiuretic, 0, 1) + 0.25 * clamp(p.thiazide, 0, 1));
    naU += 0.08 * glucU + 0.35 * ketoU;
    naU = clamp(naU, FL * (0.0005 + 0.04 * clamp(p.tubularInjury, 0, 1)), FL * 0.3);

    /* -- potassium -- */
    const distal = (naU / (150 / 24)) ** 0.45;
    /* Surviving nephrons adapt over a week or two to secrete more each; an acute fall in filtration (and in distal flow) is what stops secretion. */
    s.GFRad = relax(s.GFRad ?? GFR, GFR, dt, 240);
    const kTub = (1 - 0.8 * clamp(p.tubularInjury, 0, 1)) * (0.25 + 0.75 * Math.min(1, nm * 4)) * Math.min(1, GFR / Math.max(0.05, s.GFRad));
    const kU = (70 / 24) * (c.K / 4) ** 2 * Math.max(0.03, aldEff) ** 0.3 * distal * kTub * (1 + 0.5 * clamp(p.loopDiuretic, 0, 1) + 0.4 * clamp(p.thiazide, 0, 1));

    /* -- acid: ammonium and bicarbonaturia -- */
    const NH4max = (320 / 24) * nm ** 0.7 * (1 - 0.85 * clamp(p.tubularInjury, 0, 1)) * Math.exp(-0.15 * (c.K - 4));
    const drive = (28 / 24) * Math.exp(6 * (7.4 - c.pH) + 0.1 * (24 - c.SBC)) * Math.exp(-0.15 * (c.K - 4));
    const nh4U = drive * NH4max / (drive + NH4max) * 1.09 * (GFR > 0.05 ? 1 : 0.2);
    const Tm = 25.5 + 2.6 * Math.max(0, i.PaCO2 - 5.33) + 2 * Math.min(2, hypo) + 10 * Math.max(0, 1 - ve) + 1 * Math.max(0, 4 - c.K) + 0.1 * Math.max(0, 100 - c.Cl);
    const hco3U = GFR * Math.max(0, c.HCO3 - Tm) * 0.6;

    /* -- chloride: what electroneutral urine has left to carry -- */
    /* Poorly reabsorbable anions in the distal tubule (bicarbonate, ketoanions) pull K⁺ out with them; secretion saturates at about 6 mmol/h. */
    const kU2 = Math.min(6, kU * (1 + 0.3 * (hco3U + ketoU) / (naU + 1)));
    let clU = naU + kU2 + nh4U - uaU - hco3U - ketoU;
    clU = Math.max(0.05 * naU, clU);

    /* -- calcium excretion: about 2 % of the filtered (ultrafilterable) calcium escapes; PTH lowers that, sodium excretion and
       loop diuretics raise it, thiazides lower it, and a high calcium switches its own reabsorption off. -- */
    const feCa = 0.02 * clamp(4 / pthEff, 0.05, 20) ** 0.5 * Math.exp(4 * (s.Ca - 2.35)) * clamp(naU / (150 / 24), 0.2, 6) ** 0.5
      * (1 + 1.5 * clamp(p.loopDiuretic, 0, 1)) * (1 - 0.4 * clamp(p.thiazide, 0, 1));
    const caU = GFR * 0.6 * s.Ca * clamp(feCa, 0.001, 0.6);

    /* -- water -- */
    const ageConc = this.person.age > 30 ? 1 - 0.004 * (this.person.age - 30) : 1;
    const Umax = 1200 * ageConc * (1 - 0.7 * clamp(p.tubularInjury, 0, 1)) * (0.3 + 0.7 * nm ** 1.5) * (1 - 0.5 * clamp(p.loopDiuretic, 0, 1)) / (1 + 2.5 * caHigh);
    const Umin = 50 + 2 * Math.max(0, this.person.age - 50) + 120 * clamp(p.thiazide, 0, 1) + 220 * (1 - nm) ** 2 + 150 * clamp(p.tubularInjury, 0, 1);
    const osmU = 2 * (naU + kU2) + ureaU + glucU + 2.5;
    /* A large solute load (glucose, urea) washes out the medulla: an osmotic diuresis is never very concentrated. */
    const UmaxEff = 300 + (Umax - 300) / (1 + Math.max(0, osmU - 40) / 80);
    const uOsm = clamp(50 + 300 * Math.max(0, s.ADH - 0.4), Umin, Math.max(Umin + 10, UmaxEff));
    const obstructed = 1 - clamp(p.obstruction, 0, 1);
    const waterU = osmU / uOsm * obstructed;
    /* Thirst: tonicity, and volume — but a hypotonic plasma switches volume thirst off. */
    const thirst = p.canDrink > 0 ? (Math.max(0, c.tonicity - 290) * 0.06 + 0.04 * Math.min(3, hypo) * clamp((c.tonicity - 268) / 18, 0, 1)) * (1 - 0.5 * nausea) : 0;
    const insensible = (0.8 / 24) * (1 + 0.13 * Math.max(0, s.T - 37) * 1.5) * Math.max(0.5, BW / 70) * clamp(thy, 0.7, 2.5) ** 0.5;   // fever and sweating
    const metabolicWater = 0.3 / 24;
    const waterIn = p.fluidIntake / 24 * (1 - 0.4 * nausea) + thirst + metabolicWater;
    const vomit = Math.max(0, p.vomiting) / 24, stool = Math.max(0, p.diarrhoea) / 24;

    /* -- distribution between plasma and interstitium (Starling; settles in about half an hour) -- */
    const veShape = ve >= 1 ? 1 + 0.35 * (ve - 1) : ve ** 0.75;
    /* Fewer red cells: the plasma expands to keep the blood volume (anaemia is not hypovolaemia). */
    const anaemiaFill = 1 + 0.7 * Math.max(0, r.RCV - s.RCV) / r.Vp;
    const VpTarget = r.Vp * veShape * anaemiaFill * clamp(c.alb / 42, 0.3, 1.5) ** 0.25 * (1 - 0.01 * Math.max(0, i.CVP - 8)) * (1 - 0.22 * sev) * clamp(thy, 0.5, 3) ** 0.1;   // capillary leak

    return {
      c, GFR, auto, Plow, gfrMax: auto > 1e-3 ? GFR / auto : GFR, rpp, naU, kU: kU2, clU, nh4U, hco3U, ureaU, crU, uaU, uaProd, pIn, pU, glucU, ketoU, ketoProd, ketoOx, hgo, uBrain, uIns, uMass, carbIn,
      prodRBC, destrRBC, ironAbs, bleed, caGut, caBone, caU, mcvNew, bilProd, conj, bileOut, bilUrine, ph, lf,
      lacProd, lacClear, ureaProd, waterU, waterIn, insensible, vomit, stool, VpTarget, uOsm, food, obstructed,
    };
  }

  /** Advance the body by `hours` (any length: internally in steps of three minutes or less). */
  integrate(hours: number) {
    let left = hours;
    while (left > 1e-9) {
      const dt = Math.min(0.05, left);
      left -= dt;
      this.step(dt);
    }
  }

  private step(dt: number) {
    const s = this.s, p = this.p;
    const f = this.rates(dt);
    const o = f.obstructed;
    const food = f.food;
    const naIn = p.saltIntake * food / 24 * (1 - clamp(p.vomiting / 2, 0, 0.9));
    const kIn = p.potassiumIntake * food / 24 * (1 - clamp(p.vomiting / 2, 0, 0.9));

    s.TBW += (f.waterIn - f.waterU - f.insensible - f.vomit - f.stool) * dt;
    s.Na += (naIn - f.naU * o - VOMIT.Na * f.vomit - STOOL.Na * f.stool) * dt;
    s.K += (kIn - f.kU * o - VOMIT.K * f.vomit - STOOL.K * f.stool) * dt;
    s.B += (0.7 * kIn - f.uaProd - f.ketoProd + f.ketoOx - f.lacProd + f.lacClear + f.nh4U * o - f.hco3U * o
      + VOMIT.H * f.vomit - STOOL.HCO3 * f.stool) * dt;
    s.G += (f.carbIn + f.hgo - f.uBrain - f.uIns - f.uMass - f.glucU * o) * dt;
    s.Ket += (f.ketoProd - f.ketoOx - f.ketoU * o) * dt;
    s.Lac += (f.lacProd - f.lacClear) * dt;
    s.UA += (f.uaProd - f.uaU * o) * dt;
    s.P += (f.pIn - f.pU * o) * dt;
    /* Calcium: the exchangeable pool is about three times what the ECF holds (bone surface buffers it). */
    s.Ca = clamp(s.Ca + (f.caGut + f.caBone - f.caU * o) / (3 * f.c.ECF) * dt, 1.0, 5);
    s.Urea += (f.ureaProd - f.ureaU * o) * dt;
    s.Cr += (this.ref.creatProd - f.crU * o) * dt;
    s.Vp = relax(s.Vp, f.VpTarget, dt, f.VpTarget > s.Vp ? 2 : 0.5);
    s.RCV = Math.max(0.15, s.RCV + (f.prodRBC - f.destrRBC) * dt);
    s.Fe = Math.max(0, s.Fe + (1100 * (f.destrRBC - f.prodRBC) + f.ironAbs - 1 / 24) * dt);   // 1.1 mg iron per mL of red cells; recycled when destroyed
    if (f.prodRBC > 1e-9) s.MCV += (f.mcvNew - s.MCV) * Math.min(1, f.prodRBC * dt / s.RCV);
    /* Ascites: with portal hypertension, much of any interstitial fluid gained collects in the peritoneum. */
    { const c1 = f.c; s.Asc = Math.min(relax(s.Asc, 8 * f.ph ** 2 * clamp(1 - f.lf, 0, 1) * clamp(42 / c1.alb, 0.8, 2.5) ** 0.5, dt, 120), Math.max(0, c1.ISF - 2)); }
    s.BilU = Math.max(0, s.BilU + (f.bilProd - f.conj) * dt);
    s.BilC = Math.max(0, s.BilC + (f.conj - f.bileOut - f.bilUrine) * dt);
    if (f.bleed > 0) this.addBlood(-f.bleed * dt * 1000);   // the iron goes with the red cells; the stores then pay for their replacement
    s.urineL += f.waterU * dt;
    s.hours += dt;
    for (const k of ['Na', 'K', 'G', 'Ket', 'Lac', 'UA', 'P', 'Urea', 'Cr'] as const) s[k] = Math.max(1e-3, s[k]);
    s.TBW = Math.max(0.45 * this.ref.TBW, s.TBW);
    s.B = clamp(s.B, 2 * 2 * this.ref.ECF * 0.3, 2 * 60 * this.ref.ECF);
    if (!Number.isFinite(s.TBW + s.Na + s.K + s.B + s.G + s.Ket + s.Lac)) throw new Error('body model diverged');
    this.f = {
      GFR: f.GFR, auto: f.auto, Plow: f.Plow, gfrMax: f.gfrMax, rpp: f.rpp, naU: f.naU * o, kU: f.kU * o, clU: f.clU * o, nh4U: f.nh4U * o, hco3U: f.hco3U * o, glucU: f.glucU * o, ketoU: f.ketoU * o,
      prodRBC: f.prodRBC / (this.ref.RCV / 2880), waterU: f.waterU, uOsm: f.uOsm, hgo: f.hgo, gU: f.uBrain + f.uIns + f.uMass, ketoProd: f.ketoProd, ketoOx: f.ketoOx,
      lacProd: f.lacProd, lacClear: f.lacClear, waterIn: f.waterIn, waterOut: f.waterU + f.insensible + f.vomit + f.stool, FL: f.GFR * f.c.Na,
    };
  }

  /** Change in blood volume from normal (mL). */
  bloodVolumeDelta(): number {
    return (this.s.Vp - this.ref.Vp + this.s.RCV - this.ref.RCV) * 1000;
  }
  /** The circulating blood volume, mL: what the circulation holds. */
  bloodVolume(): number { return (this.s.Vp + this.s.RCV) * 1000; }

  /** Whole blood lost (negative) or given (positive), mL: plasma with its solutes, and red cells. */
  addBlood(mL: number) {
    if (!mL) return;
    const s = this.s, c = this.conc();
    const dV = mL / 1000;
    const dP = dV * (1 - c.Hct), dR = dV * c.Hct;
    const frac = dP / c.ECF;
    s.Vp = Math.max(0.3, s.Vp + dP);
    s.TBW += dP;
    s.Na += c.Na * dP; s.B += c.SBC * dP; s.G += c.G * dP; s.UA += c.UA * dP; s.P += c.Pi * dP;
    s.Lac += c.Lac * dP; s.Ket += c.Ket * dP; s.Urea += c.urea * dP; s.Cr += c.Cr * dP;
    s.K += c.K * dP + 100 * dR;
    s.Alb += c.alb * dP;
    s.RCV = Math.max(0.15, s.RCV + dR);
    void frac;
  }

  /** Counter-regulatory hormones: what the case sets, or what an infection raises. */
  stressEff(): number { return Math.max(this.p.stress, Math.min(1, 0.6 * this.s.IL)); }
  /** Severity of sepsis (organ dysfunction), 0–1. */
  sepsis(): number { return clamp((this.s.IL - 0.8) / 1.2, 0, 1); }
  /** Adrenaline from the adrenal medulla: illness, fever, hypoglycaemia, severe acidaemia. Drives rate and contractility (0–1). */
  adrenergic(): number {
    const c = this.conc();
    return clamp(0.8 * this.stressEff() + 0.12 * Math.max(0, this.s.T - 37.2) + Math.max(0, 3.5 - c.G) / 1.5 + Math.max(0, 7.3 - c.pH) * 4, 0, 1.4);
  }
  /** Thyroid hormone action, × normal (free T4 stands in for T3, the active hormone). */
  thyroidEffect(): number { return clamp((this.s.T4 ?? 16) / 16, 0.1, 5); }
  /** Cortisol missing for what the illness demands, 0–1 (severe illness needs two to three times the resting level): vessels lose their response to catecholamines, the liver its gluconeogenesis. */
  cortisolDeficit(): number { return clamp(1 - (this.s.Cort ?? 1) / (1 + 0.75 * this.stressEff()), 0, 1); }
  /** Oxygen consumption, × normal: thyroid hormone sets the basal metabolic rate. */
  metabolicMult(): number { const t = this.thyroidEffect(); return t >= 1 ? t ** 0.45 : t ** 0.35; }
  /** The sinus rate, × normal: thyroid hormone acts on the node directly. */
  hrMult(): number { const t = this.thyroidEffect(); return t >= 1 ? Math.min(1.8, t ** 0.4) : t ** 0.25; }
  /** Vascular response to sympathetic drive, × normal: cortisol is permissive for catecholamines. */
  adrenergicResponse(): number { return 1 - 0.7 * this.cortisolDeficit() ** 1.2; }
  /** Sepsis: nitric oxide dilates arterioles and veins, and the myocardium is depressed. */
  vasoplegia(): number { return this.sepsis() ** 1.3; }
  contractility(): number { return (1 - 0.2 * this.sepsis()) * clamp(this.thyroidEffect(), 0.3, 3) ** 0.45 * (1 - 0.15 * this.cortisolDeficit()); }
  /** Cytokines and fever drive breathing: the tachypnoea of sepsis comes before any acidosis. */
  ventilatoryDrive(): number { return 1.0 * this.sepsis() + 0.25 * Math.min(1, this.s.IL) + 0.08 * Math.max(0, this.s.T - 37.5); }
  /** Angiotensin II and vasopressin constrict arterioles and veins. */
  rsysMult(): number { return clamp(Math.max(0.05, this.s.AngII) ** 0.12 * Math.max(0.3, this.s.ADH / 1.5) ** 0.04, 0.6, 1.8) * (1 - 0.6 * this.vasoplegia()) * (1 - 0.3 * clamp(this.p.portalHypertension, 0, 1) * clamp(1 - this.p.liverFunction, 0, 1))
      * clamp(this.thyroidEffect(), 0.3, 3) ** -0.4 * (1 - 0.5 * this.cortisolDeficit() ** 1.5); }
  v0svMult(): number { return clamp(1 - 0.05 * Math.log(Math.max(0.05, this.s.AngII)) - 0.02 * Math.log(Math.max(0.3, this.s.ADH / 1.5)), 0.8, 1.15) * (1 + 0.2 * this.vasoplegia()) * (1 + 0.15 * this.cortisolDeficit()); }

  snapshot(): BodySnapshot {
    const c = this.conc(), s = this.s, r = this.ref, f = this.f;
    if (f.GFR == null) this.rates(0);
    const wU = Math.max(1e-4, f.waterU ?? 0.06);
    return {
      sodium: c.Na, potassium: c.K, chloride: c.Cl, standardBicarbonate: c.SBC, glucose: c.G,
      urea: c.urea, creatinine: c.Cr * 1000, lactate: c.Lac, ketones: c.Ket, betaHydroxybutyrate: 0.78 * c.Ket, phosphate: c.Pi,
      albumin: c.alb, haemoglobin: c.Hb, haematocrit: c.Hct, osmolality: c.osm + 0, tonicity: c.tonicity,
      TBW: s.TBW, ICF: c.ICF, ECF: c.ECF, plasma: s.Vp, ISF: c.ISF, bloodVolume: c.BV,
      dECF: c.ECF - r.ECF, dISF: c.ISF - r.ISF, dPlasma: s.Vp - r.Vp, dICF: c.ICF - r.ICF, bloodVolumeDelta: this.bloodVolumeDelta(),
      GFR: (f.GFR ?? r.GFR) / 0.06, urineMlPerH: wU * 1000, urineOsm: f.uOsm ?? 600,
      urineNa: (f.naU ?? 6) / wU, urineK: (f.kU ?? 3) / wU, urineCl: (f.clU ?? 7) / wU,
      FENa: (f.naU ?? 6) / Math.max(1e-3, f.FL ?? 1000) * 100, NH4: (f.nh4U ?? 1.2) * 24, bicarbonaturia: (f.hco3U ?? 0) * 24,
      glucosuria: (f.glucU ?? 0) / wU, ketonuria: (f.ketoU ?? 0) / wU, uNaRate: (f.naU ?? 6) * 24, uKRate: (f.kU ?? 3) * 24,
      autoregulation: f.auto ?? 1, Plow: f.Plow ?? 72, gfrMax: (f.gfrMax ?? r.GFR) / 0.06, perfusion: f.rpp ?? 90,
      insulin: s.I, angII: s.AngII, aldosterone: s.Ald, adh: s.ADH,
      mcv: s.MCV, reticulocytes: 1.0 * (this.f.prodRBC ?? 1) * (this.p.b12Deficiency > 0.3 ? 0.5 : 1), ferritin: (s.Fe / 9) * (1 + 3 * Math.min(1, s.IL)) + 8 * (1 - this.p.liverFunction) ** 2 * 50,
      ironStores: s.Fe, b12: 320 * (1 - 0.85 * clamp(this.p.b12Deficiency, 0, 1)), epo: 10 * s.EPO,
      ldh: 180 + 600 * Math.max(0, this.p.haemolysis) + 500 * clamp(this.p.b12Deficiency, 0, 1) + 0.5 * Math.max(0, s.ALT - 25), haptoglobin: Math.max(0.05, 1.2 / (1 + 3 * Math.max(0, this.p.haemolysis)) * (1 - 0.5 * (1 - this.p.liverFunction)) * (1 + 0.8 * Math.min(1, s.IL))),
      bilirubin: (s.BilU + s.BilC) / c.ECF, bilirubinConjugated: s.BilC / c.ECF, alt: s.ALT, alp: s.ALP, ggt: s.GGT, inr: s.INR, ammonia: s.NH3, ascites: s.Asc,
      encephalopathy: clamp((s.NH3 - 50) / 40 + 0.8 * Math.max(0, s.Ca - 3.0) + 0.6 * this.cortisolDeficit() ** 2 + 0.6 * Math.max(0, 0.4 - this.thyroidEffect()) / 0.4 + 0.5 * Math.min(1, s.IL) * (this.p.liverFunction < 0.6 ? 1 : 0.2) + 0.8 * this.sepsis() + 0.3 * Math.max(0, 3.2 - c.K) + 0.04 * Math.max(0, 128 - c.Na), 0, 4),
      tsh: s.TSH, ft4: s.T4, ft3: 4.8 * this.thyroidEffect() ** 1.1, thyroidEffect: this.thyroidEffect(),
      cortisol: 400 * s.Cort, acth: 25 * s.ACTH, renin: 1.5 * Math.max(0.05, s.AngII) / (1 - 0.85 * clamp(this.p.aceInhibitor, 0, 1)), aldosteronePmol: 300 * s.Ald,
      calcium: s.Ca, calciumTotal: s.Ca - 0.02 * (40 - c.alb), ionisedCalcium: s.Ca * 0.5 * (1 + 0.16 * (7.4 - c.pH)), pth: s.PTH,
      vitaminD25: 75 * clamp(this.p.vitaminD, 0, 3), cortisolEffect: s.Cort, cortisolDeficit: this.cortisolDeficit(), metabolicMult: this.metabolicMult(), hrMult: this.hrMult(),
      inflammation: s.IL, temperature: s.T, crp: s.CRP, whiteCellCount: s.WCC, platelets: s.Plt, sepsis: this.sepsis(), vasoplegia: this.vasoplegia(),
      hgo: f.hgo ?? 0, glucoseUptake: f.gU ?? 0, ketogenesis: f.ketoProd ?? 0, ketoneOxidation: f.ketoOx ?? 0, lactateProduction: f.lacProd ?? 0, lactateClearance: f.lacClear ?? 0,
      waterIn: (f.waterIn ?? 0) * 24, waterOut: (f.waterOut ?? 0) * 24,
      RsysMult: this.rsysMult(), V0svMult: this.v0svMult(),
      hours: s.hours, kRatio: c.ratio, Kbody: s.K,
      params: { ...this.p }, inputs: { ...this.inp },
    };
  }

  serialize() { return { s: { ...this.s }, inp: { ...this.inp }, ref: { ...this.ref } }; }
  restore(x: { s: BodyState; inp: BodyInputs; ref: Body['ref'] }) { this.s = { ...x.s }; this.inp = { ...x.inp }; this.ref = { ...x.ref }; }
}
