# Evidence grounding: status and what is still missing

Last updated: 13 October 2026, after PRs #13–#20.

Every model constant lives in the registry under `source/src/vp/evidence/`. Each entry records:

- its value, unit and meaning;
- a status: `measured`, `derived`, `assumed` or `ungrounded` (not yet sourced);
- the references it rests on, and the working for derived and assumed values.

References are in `references.ts`, each with its DOI/PMID and how far it was checked (full text, abstract,
secondary or record only).

The test suite (`scripts/vp-model.test.mjs`) does three things:

- **Checks the registry:** every grounded constant cites a reference, every derived or assumed one shows its working, and every registered constant is used.
- **Prints a grounding summary.**
- **Compares the model with measured human data** in the sections "… against human data". Where the model misses the data, the test reports a **known gap** (△) with the numbers instead of being loosened.

## Method (agreed)

1. Ground coefficients in measured human data; set them once.
2. Validate against outcomes that were *not* used for fitting.
3. Report mismatches honestly; do not tune a constant to make an expected answer come out.
4. Do not extrapolate a fitted relation beyond the range it was measured in. This caused the renin overshoot; the hypoxia–CO2 interaction is now clamped to Weil's ±5 mmHg.
5. Before any comparison, settle the circulation for at least 20–30 s after a change.

## Packages done

| Package | PR | What changed in the physiology |
|---|---|---|
| Registry, endocrine | #13 | Registry, chapter tables, validator. Thyroid, adrenal and calcium constants. |
| Water and kidney | #14 | Blood-volume sensing; renin separate from angiotensin II; fits to salt reduction (Graudal) and fluid kinetics (Hahn). |
| Circulation and baroreflex | #15 | Klotz EDPVR for both ventricles; PVR from Kovacs; RV Ees from Kuehne; stressed volume from Maas; intrinsic heart rate (Jose) with vagal/sympathetic gains from atropine data; checked against Johnson's graded haemorrhage. |
| Sepsis and inflammation | #16 | Septic resistance loss recalibrated to the grounded circulation (Suffredini, Parker 1987). Also: CRP clearance (Vigushin), temperature (Mackowiak), albumin time course (Fleck). |
| Kidney, second pass | #17 | Distal K⁺ secretion adapts to the potassium eaten (Rabelink); secretion ceiling 6 → 25 mmol/h; ATN and prerenal indices checked against Miller. |
| Lungs | #18 | Weil's hypoxic drive with its CO2 interaction; Hey's breathing pattern; Tobin normals; CO2 response 2.1 L/min/mmHg; Sorbini PaO2. |
| ECG | #19 | QT follows Framingham (Sagie); intervals checked against Mason's ranges; hyperkalaemia sequence marked as textbook (Montague). |
| Examination | #20 | Capillary refill (Schriger & Baraff), postural pulse (McGee), pallor (Sheth, Kalantri), cyanosis (Lundsgaard, Comroe), icterus (Hung). |

## Grounding by group (after #20)

"Grounded" means measured or derived.

| Group | Grounded / total | Assumed | Not yet sourced |
|---|---|---|---|
| lung | 28 / 57 | 11 | 18 |
| kidney | 25 / 108 | 12 | 71 |
| circulation | 14 / 66 | 17 | 35 |
| thyroid | 11 / 29 | 3 | 15 |
| water | 10 / 47 | 16 | 21 |
| adrenal | 7 / 19 | 1 | 11 |
| baroreflex | 6 / 17 | 5 | 6 |
| exam | 6 / 18 | 8 | 4 |
| ecg | 5 / 37 | 14 | 18 |
| calcium | 4 / 37 | 5 | 28 |
| inflammation | 4 / 41 | 8 | 29 |

## Known gaps (reported by the tests)

1. **Haemorrhage heart rate:** HR rises +3 % against Johnson's +14 %, and CVP falls 2.7 against 4.7 mmHg. The model has no cardiopulmonary (low-pressure) afferent and no pulse-pressure component of the baroreceptor signal. *This is the most physiological of the open items. Fix it first:* add a low-pressure reflex and a rate-sensitive arterial afferent (Ursino), and calibrate against Zoller 1972 and Schobel 1995 (LBNP).
2. **Moderate PE:** mean PA pressure rises only 2.4 mmHg. The embolism-to-resistance mapping is ungrounded (McIntyre & Sasahara 1971: record only).
3. **Massive PE:** the shock is there, but CVP does not exceed 10 and RV ischaemia stays small. The RV perfusion constants are ungrounded.
4. **Lung water:** at a wedge pressure of 20, PaO2 falls only 1.3 kPa. The Starling and lung-water constants are ungrounded beyond the Gaar equation.
5. **Hypothyroidism:** cardiac output falls 25 % (Klein & Danzi: 30–50 %).
6. **Addisonian crisis:** the patient lies at a systolic of 113 (half of real crises are at 110 or below).
7. **Diarrhoea (prerenal):** urine sodium is 32 (Miller: below 20). FENa and osmolality are correct.
8. **Triple-whammy potassium:** 5.8 against the 6.2 or more such patients present with. How far RAAS blockade impairs the kaliuretic adaptation is not grounded.
9. **Healthy gaze holding:** at 30° of lateral gaze a healthy integrator drifts 1.2 °/s, against 0.62 ± 0.53 °/s measured (Ritter 2020). The nystagmus it produces is labelled physiological end-point nystagmus, as it is in most healthy people at 30°, but it is about twice as brisk as average. The integrator time constant (25 s) and the 1 °/s visibility threshold are inline literals, not yet in the registry.
10. **Ejection time at fast rates** (heart sounds, ADR-017 step 3): left ventricular ejection lasts 282 ms at 73/min, within 2 % of Weissler's normal, but 142 ms at 120/min against 209. Ejection shortens far more with rate than in people, so at a tachycardia A2 comes early. The time-varying elastance's activation shape (`actT1`, `actT2`) does not scale with rate as human systole does.
11. **Pre-ejection period:** 55 ms from activation against Weissler's 102 from the start of QRS. The model has no electromechanical delay, and isovolumic contraction is quick. S1 therefore sits at activation (in health the mitral valve has already closed as the atria relaxed).
12. **Respiratory splitting of S2 too small:** in health A2–P2 now widens by 11 ms from late expiration to late inspiration, widest at the end of inspiration as heard; Curtiss 1975 measured 27.2 ms, and Aygen 1970 found 20 ms or more in 98 % of normals. Length-dependent systole (each ventricle's relaxation comes later on a beat it starts fuller than its recent average, `systoleLengthGain`, fitted once to Curtiss's right-ventricular Q–O, +7.7 ms) supplies the ventricles' share. The missing share is Curtiss's O–P2 (+11.9 ms, model −0.6): the pulmonary "hangout", the outflow's inertia keeping blood moving into the low-impedance lung after the pressures cross. The model's hangout is zero. Murgo & Westerhof 1984 found no change in pulmonary impedance with quiet breathing, so a fixed inertance acting on the larger inspiratory stroke is the candidate. *Next:* an inertance on the pulmonary outflow, grounded on measured hangout intervals (Shaver 1974: full text needed; no abstract gives them), validated against the O–P2 change and Aygen.
13. **Tamponade without pulsus paradoxus:** with 500 mL of pericardial fluid the circulation is in tamponade (RA 22 mmHg, systolic 65), but systolic pressure varies only 3.9 mmHg with breathing (1.3 before length-dependent systole, and read over 40 beats instead of 280); more than 10 mmHg is the cardinal sign (Spodick 2003). The ventricles compete too little for the shared pericardial space when the right one fills in inspiration. (Above about 600 mL the model also fails numerically, a separate older problem.)
14. **Oxygen-induced hypercapnia too small:** in the COPD exacerbation case, 100 % oxygen raises PaCO2 by 0.27 kPa. Robinson 2000 measured +0.52 kPa for a whole group of exacerbations (retainers +8.3 ± 5.6 mmHg), Aubier 1980 +23 ± 5 mmHg in acute respiratory failure, and Griffiths 1996 +0.53 kPa on 50 % in stable hypercapnic COPD. The model has the ventilation–perfusion part (released hypoxic vasoconstriction, the Haldane effect), but its ventilation does not fall on oxygen (9.4 → 9.4 L/min), as Robinson's retainers' did (9.0 → 7.2). The test's earlier margin (+0.1 kPa over the Venturi mask) was a judgement; it is replaced by this comparison, and the clinical ordering stays a hard test.
15. **The left ventricle's share of the split:** in inspiration A2 comes 4.2 ms earlier (Q–A2), against Curtiss's 7.6 ± 2.7 ms. This validates length-dependent systole, which was fitted on the right ventricle only, and it falls just outside one SD. How much less the left ventricle fills in inspiration (ventricular interdependence, the pulmonary transit delay) is not grounded.

## Not grounded yet, and why

- **Length-dependent systole** (`systoleLengthGain`, gap 12): fitted to one study, Curtiss 1975 (7 volunteers, abstract only, Q–O +7.7 ± 5.0 ms). Within that spread the gain could lie anywhere from about 0.12 to 0.58. The independent check still to do: does the model's inspiratory change in ventricular size match Lewis, Lewis & Gotsman 1979 (Eur J Cardiol 10:89, PMID 477705, abstract: 8 normals on echo, RV diameter +0.3 ± 0.1 cm, LV −0.3 ± 0.2 cm in inspiration, both linear with Q–P2 and A2–P2)? Comparing diameters with the model's volumes needs a stated shape assumption. If the filling is wrong, the gain is compensating for it, and the left ventricle's shortfall (gap 15) may come from the same place.

- **Kidney:**
  - Acid handling (NH4⁺ production and capacity) and diuretic natriuresis. Sartorius 1949, Lemann 1966 and Wilcox 1983 exist only as scanned full text, which could not be read here.
  - Autoregulation shifts with ACE inhibitors and NSAIDs; the tubular-injury and CKD modifiers.
  - Renal potassium conservation on a poor intake is not modelled at all.
- **Circulation:**
  - Arterial and pulmonary compliances; atrial elastances; valve and pericardial constants; septal mechanics.
  - Heart rate as a function of age: the intrinsic rate falls with age (Jose), but vagal tone is not modelled per age.
- **Inflammation:** cytokine dynamics, white cell and platelet responses, capillary leak, vascular hyporeactivity, myocardial depression size.
- **Lungs:**
  - The disease multipliers of rate and mechanics; hypoxic pulmonary vasoconstriction.
  - The sympathetic share of the chemoreflex. With Weil's stronger drive, hypoxaemic COPD patients now run about 10 /min faster.
- **ECG:** the dipole geometry is fitted, not measured, and stays so on purpose. The electrolyte effect sizes and the AF/flutter/escape timings are not sourced.
- **Examination:** crackle, murmur, apex and neurological-sign thresholds are heuristics. The orthostatic response is still a formula; it should become a simulated stand (600 mL pooled) through the circulation.
- **Not started:**
  - Fuels: glucose, insulin, ketones, lactate.
  - Blood and liver: some sourced, many literals still inline in `body.ts`.
  - The legacy cardio domain worker (`domains/cardio`) keeps its own defaults.

## Suggested order when this work resumes

1. Cardiopulmonary reflex and rate-sensitive baroreceptor afferent (gap 1). Re-check the GI-bleed case.
2. Fuels and the remaining blood and liver literals in `body.ts`.
3. Pulmonary embolism and lung water (gaps 2–4), with the lung chapter.
4. Age-dependent vagal tone, so resting heart rate and baroreflex sensitivity follow age (Monahan).
5. The kidney's acid handling, if the original studies can be obtained.
6. Pulmonary outflow inertance (gap 12, needs Shaver's hangout data; the ventricles' share is in), ventricular interdependence in tamponade (gap 13), then the rate dependence of systole (gaps 10–11): before the auscultation station (ADR-017 step 4).
