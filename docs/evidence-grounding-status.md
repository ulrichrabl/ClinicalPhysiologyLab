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
3. **Massive PE:** the shock is there (systolic 88, output 2.4 L/min), but the CVP rises only 2.6 mmHg (7.4), not 3 or more, and does not exceed 10; RV ischaemia stays small. The RV perfusion constants are ungrounded. The CVP rise was just above 3 before the organs were fed the breath-averaged circulation (see 19).
4. **Lung water:** at a wedge pressure of 20, PaO2 falls only 1.3 kPa. The Starling and lung-water constants are ungrounded beyond the Gaar equation.
5. **Hypothyroidism:** cardiac output falls 25 % (Klein & Danzi: 30–50 %), and the pulse, read over a breath, is 58 (60–80). Read from one beat it had passed; the test's lower bound had been eased to 59.5 at some point, and is back at 60.
6. **Addisonian crisis:** the patient lies at a systolic of 113 (half of real crises are at 110 or below).
7. **Diarrhoea (prerenal):** urine sodium is 32 (Miller: below 20). FENa and osmolality are correct.
8. **Triple-whammy potassium:** 5.8 against the 6.2 or more such patients present with. How far RAAS blockade impairs the kaliuretic adaptation is not grounded.
9. **Healthy gaze holding:** at 30° of lateral gaze a healthy integrator drifts 1.2 °/s, against 0.62 ± 0.53 °/s measured (Ritter 2020). The nystagmus it produces is labelled physiological end-point nystagmus, as it is in most healthy people at 30°, but it is about twice as brisk as average. The integrator time constant (25 s) and the 1 °/s visibility threshold are inline literals, not yet in the registry.
10. **Ejection time at fast rates** (heart sounds, ADR-017 step 3): left ventricular ejection lasts 282 ms at 73/min, within 2 % of Weissler's normal, but 142 ms at 120/min against 209. Ejection shortens far more with rate than in people, so at a tachycardia A2 comes early. The time-varying elastance's activation shape (`actT1`, `actT2`) does not scale with rate as human systole does.
11. **Pre-ejection period:** 55 ms from activation against Weissler's 102 from the start of QRS. The model has no electromechanical delay, and isovolumic contraction is quick. S1 therefore sits at activation (in health the mitral valve has already closed as the atria relaxed).
12. **Respiratory splitting of S2 too small:** in health A2–P2 now widens by 9 ms from late expiration to late inspiration, and with so small a widening its timing through the breath no longer comes out as heard (widest late in inspiration): 19, 26, 27, 17 ms through inspiration, end-inspiration, expiration, end-expiration. Both follow gap 16; Curtiss 1975 measured 27.2 ms, and Aygen 1970 found 20 ms or more in 98 % of normals. Length-dependent systole (each ventricle's relaxation comes later on a beat it starts fuller than its recent average, `systoleLengthGain`, fitted once to Curtiss's right-ventricular Q–O, +7.7 ms) supplies the ventricles' share. The missing share is Curtiss's O–P2 (+11.9 ms, model −0.6): the pulmonary "hangout", the outflow's inertia keeping blood moving into the low-impedance lung after the pressures cross. The model's hangout is zero. Murgo & Westerhof 1984 found no change in pulmonary impedance with quiet breathing, so a fixed inertance acting on the larger inspiratory stroke is the candidate. *Next:* an inertance on the pulmonary outflow, grounded on measured hangout intervals (Shaver 1974: full text needed; no abstract gives them), validated against the O–P2 change and Aygen.
13. **Tamponade without pulsus paradoxus:** with 500 mL of pericardial fluid the circulation is in tamponade (RA 22 mmHg, systolic 65), but systolic pressure varies only 3.9 mmHg with breathing (1.3 before length-dependent systole, and read over 40 beats instead of 280); more than 10 mmHg is the cardinal sign (Spodick 2003). The ventricles compete too little for the shared pericardial space when the right one fills in inspiration. (Above about 600 mL the model also fails numerically, a separate older problem.)
14. **Oxygen-induced hypercapnia too small:** in the COPD exacerbation case, 100 % oxygen raises PaCO2 by 0.27 kPa. Robinson 2000 measured +0.52 kPa for a whole group of exacerbations (retainers +8.3 ± 5.6 mmHg), Aubier 1980 +23 ± 5 mmHg in acute respiratory failure, and Griffiths 1996 +0.53 kPa on 50 % in stable hypercapnic COPD. The model has the ventilation–perfusion part (released hypoxic vasoconstriction, the Haldane effect), but its ventilation does not fall on oxygen (9.4 → 9.4 L/min), as Robinson's retainers' did (9.0 → 7.2). The test's earlier margin (+0.1 kPa over the Venturi mask) was a judgement; it is replaced by this comparison, and the clinical ordering stays a hard test.
15. **The left ventricle's share of the split:** in inspiration A2 comes 4.2 ms earlier (Q–A2), against Curtiss's 7.6 ± 2.7 ms. This validates length-dependent systole, which was fitted on the right ventricle only, and it falls just outside one SD. How much less the left ventricle fills in inspiration (ventricular interdependence, the pulmonary transit delay) is not grounded.
16. **The respiratory pump fills the right ventricle too little:** in inspiration RV end-diastolic volume rises 5.2 % and LV falls 4.3 % (late inspiration against late expiration). Real-time cardiac MRI in healthy people shows RV EDV +18 ± 8 % and RV stroke volume +21 ± 10 % (Claessen 2014; Röwer 2021: +24 %; Lewis 1979's echo diameters agree). The pleural swing is in the measured range (2–4 cmH2O). What has been found:
    - (a) *The breath's shape (fixed).* The lung model's inspiratory muscle pressure was a half-sine peaking mid-inspiration, so air flowed in for only 0.26 of the breath (Tobin: 0.42) and pleural pressure was lowest at 40 % of inspiration. It now rises through inspiration and decays in expiration (Albanese 2016's waveform): inflow 0.42, pleural pressure lowest at end-inspiration. On its own this barely changes RV filling.
    - (b) *Venous return.* Measured as Körperich 2015 did (the breath in four segments, flow against its mean), the model's venous return rises 9.4 % in inspiration and falls 12.6 % in expiration. Körperich's healthy children: IVC +22.5 / −13.2 %, SVC +10.5 / −11.6 %. The fall is right; the rise is about half the mixed caval one (about +18 %). (The earlier figure of 19 % compared whole inspiration with whole expiration.)
    - (c) *The abdominal pump, lumped (tried, not adopted).* Abdominal pressure rising by half the pleural fall (Miller 2005: gastric pressure rises by under a third of the oesophageal fall in rib-cage breaths, over five sixths in diaphragmatic ones) and squeezing a share of the one venous pool's compliance (Takata 1990's zone 3) deepens the expiratory fall as much as it raises the rise: share 0.35 gives +11.2 / −14.9 % and RV EDV +6.1 %; share 1.0, +14.3 / −19.0 % and +7.9 %. In people the rise is the larger, because the legs' return, held back in inspiration (Willeput 1984: femoral flow to 65 %), surges in expiration and refills the abdomen (Miller 2005). That needs the abdominal and leg veins as separate pools, with Takata's zone 2 (the cava collapsing under abdominal pressure in hypovolaemia).
    - (d) Of the extra return that does come, the right atrium takes more than the ventricle (RA volume +10 mL through inspiration, RV about +6). The right heart's diastolic stiffness and the atrium's compliance are not grounded.
  This is upstream of gaps 12, 13 and 15, and of `systoleLengthGain`, which was fitted under the old breath shape and no longer gives Curtiss's Q–O (2.1 ms against 7.7). Refitting it now would need a gain far outside Curtiss's spread to make up for the missing filling; it waits.
  Sources for (c): Willeput R et al., J Appl Physiol 1984 ([doi](https://doi.org/10.1152/jappl.1984.57.4.971)); Miller JD et al., J Physiol 2005 ([doi](https://doi.org/10.1113/jphysiol.2004.076422)); Takata M et al., J Appl Physiol 1990 ([doi](https://doi.org/10.1152/jappl.1990.69.6.1961)).

17. **Moderate mitral stenosis was silent (closed):** the examination model heard mitral stenosis only above a valve resistance of 0.05 mmHg·s/mL. It now hears it by what the valve does to the flow: the circulation records each beat's mean diastolic gradient (`mitralMeanGradient`), and a narrowed valve is heard once that passes `EXAM.msAudibleGradient` (3 mmHg, assumed), with the rumble graded by Bonow 2006 (moderate from 5, severe above 10, derived). Moderate stenosis (7.6 mmHg) now has its opening snap and rumble; a gradient from flow alone through a normal valve (regurgitation) is not heard as stenosis. What remains weak: no study of audibility against the gradient was found, so the 3 mmHg threshold is a placement; the model's healthy valve gives a mean gradient of 1.75 mmHg, likely higher than in people (not checked against a measurement); the valve is always pliable (no calcification to silence the snap).
19. **Lactate in septic shock:** untreated, the septic shock case has lactate 1.8 mmol/L; Sepsis-3 requires more than 2. Before, the lungs and the body were fed the last beat's cardiac output and pressures. With the respiratory pump the beats differ through each breath, so this sampled the breath at random, and lactate production, which is convex in oxygen extraction, rose with the scatter. They now read the beats averaged over about a breath (the mixed venous blood reaching the lungs is pooled over many beats). Lactate in massive PE stays above 2 (3.0). The lactate constants in `body.ts` are not grounded (see "Not started").
18. **Tricuspid regurgitation too small at the neck:** at its largest orifice the model's tricuspid valve leaks about 50 mL/s in systole. The v wave grows only a little (it overtakes the a wave, so `large-v-waves` is found), and the x descent stays. Severe regurgitation fills in the x descent with a systolic wave and can make the earlobe move. The station test reports it. Neither the leak's size nor the right atrium's compliance is grounded.

20. **Aortic relaxation pressure in CPR too high** (ADR-018 step 2): on a mechanical compressor at 60/min the model gives 59/29 mmHg; Ornato 1988 measured 59/23 (systolic fitted, diastolic a validation). The model's vessels keep the maximal reflex tone of a fresh arrest (sympathetic drive 1.0), so the arteries drain slowly between compressions; Ornato's patients were prehospital arrests of long duration, whose vessels have lost tone. Manual compressions' coronary perfusion pressure (about 16 mmHg) does fall among Paradis's patients. *Next:* how vascular tone fails during arrest (time course of ischaemic vasoplegia, the catecholamine surge), with the heart in arrest (ADR-018 step 3).
21. **Systolic pressure and the compression rate** (ADR-018 step 2): on the same machine Ornato's systolic fell from 59 to 46 mmHg between 60 and 140/min; the model's stays at 59. Not a clean comparison: the Thumper held its force, and on a manikin the same force gave less sternal displacement and pressure at higher rates. The model holds the intrathoracic pressure constant. A comparison needs the applied pressure at each rate. Since step 2b (the cardiac pump refitted 0.10 → 0.11 when the lungs stopped breathing in an arrest) the diastolic pressure also rises with rate, 30.0 → 35.2 mmHg from 60 to 140/min, where Ornato's stayed at about 23; it had passed within 5 mmHg by under a millimetre.

22. **The first minute of apnoea** (ADR-018 step 2b): PaCO2 rises 8.6 mmHg in the first minute of apnoea, against Stock 1989's 12 (after it, 3.4 mmHg/min, the fit). The model's lungs hold 3.4 L of gas, an awake upright adult's FRC; anaesthesia and lying supine shrink it to about 2–2.5 L, and a smaller lung fills with CO2 faster. *Next:* FRC with posture and anaesthesia, grounded on measured values (needed for the anaesthesia ADR anyway).
23. **Positive airway pressure and the filling pressure** (ADR-018 step 2b): 15 cmH2O at the airway raises right atrial pressure and lowers stroke volume as in Jellinek 2000, but the mean systemic filling pressure rises only 1.0 mmHg against 2.5, so the gradient for venous return narrows where in people it held. In people the inflated lungs push the diaphragm down onto the abdominal veins, and reflexes tighten them; the model has one systemic venous pool. This joins the abdominal and leg pools of the heart–lung chain (gap 16).
24. **End-tidal CO2 late in a long arrest** (ADR-018 step 2b): after 20 minutes of CPR without a return of circulation the model's end-tidal CO2 is 26 mmHg, against 4.4 ± 2.9 in Levine 1997's non-survivors. Nothing deteriorates during a long arrest (compressions keep their flow, vessels their tone, gap 20), and lung that is ventilated but not perfused at the low pulmonary pressures of CPR (alveolar dead space, West zone 1) is not modelled. Falk's and Ornato's early values are met.
25. **Moderate PE, pulmonary arterial pressure** (moved): with the CO2 store (ADR-018 step 2b), the rise of mean PA pressure in moderate PE went from just over 3 mmHg to 3.0 (12.4 → 15.4), and the comparison, ungrounded on its PE side, is now reported as a gap (see gap 2, which said 2.4 before the breath-averaged changes).

26. **No persistent PEA** (ADR-018 step 3): after a long arrest an organised rhythm in the model always perfuses itself back within minutes (its own coronary perfusion restores the myocardium), so pulseless electrical activity is only ever transient; in people it persists, and is common late (Levine 1997's patients). What keeps it (acidosis, the stunned myocardium, vasoplegia) is not modelled; adrenaline comes with step 4.
27. **Coronary perfusion pressure and a return of circulation** (ADR-018 step 3): with weak compressions (coronary perfusion pressure about 8 mmHg for 10 min) an organised rhythm after a shock still perfuses, where Paradis 1990 saw no return of circulation below a maximal 15 mmHg. The myocardium gains from any perfusion above 0 (Paradis's other finding: none from an initial pressure below 0). A coronary zero-flow pressure above 0 in an arrest is plausible but not grounded.
28. **VF too fine** (ADR-018 step 3): the model's VF is about 0.36 mV peak to peak on lead II when fresh and 0.22 mV after 5 min, against Weaver 1985's 0.55 ± 0.25 mV at the crew's arrival. The size of the VF dipole is an inline, ungrounded constant of the ECG model; it falls with the myocardium's state as it should.

## Not grounded yet, and why

- **Length-dependent systole** (`systoleLengthGain`, gap 12): fitted to one study, Curtiss 1975 (7 volunteers, abstract only, Q–O +7.7 ± 5.0 ms). Within that spread the gain could lie anywhere from about 0.12 to 0.58. The independent cross-check has been done, and it fails upstream: the model's ventricles fill in inspiration about a third as much as on real-time MRI (gap 16). The gain was fitted under the old half-sine breath; with the corrected breath it gives Q–O +2.1 ms, and the fit is now a known gap. Refit it once gap 16 is fixed. (The registry says 0.35, its derivation text 0.48: check which was fitted.)

- **Pulse and neck veins (the pulse station):** the waves are the circulation's own, but how they are read is placed, not measured:
  - irregularity from 10 % beat-to-beat variation (`EXAM.pulseIrregularCv`);
  - cannon a when an atrial wave against a shut valve is taller than the v wave;
  - large v when the v wave is taller than the a wave (in health a is the taller, standard teaching).
  The normal waves come out of the model unprompted: a > v, with x and y descents, no a in AF, cannon waves in complete heart block, VT and Wenckebach. The c wave needs the valve ring to move, which the model lacks.

- **Eye examination (the eye station):**
  - Comitance: a vertical deviation counts as a skew deviation when it stays within 5 prism dioptres looking up and down (assumed). Brodsky 2006 calls skew "relatively comitant" and describes incomitant variants, so some real skews would be named a vertical tropia here.
  - A fixed dilated pupil needs 5.5 mm or more in room light (assumed; a third-nerve pupil is typically 6–7 mm).
  - Saccadic pursuit follows with a gain of 0.5 and catches up every 300 ms (assumed, for the drawing; the sign itself is the model's `pursuit` state).
  - The body's signs are graded from the existing thresholds (icterus 40 and 85 µmol/L; pallor 100 and 70 g/L; lid retraction at thyroid hormone action ×1.8; exophthalmos at orbitopathy 0.4). How strongly they are drawn (scleral yellow, conjunctival colour, 2 mm of lid retraction, 3 mm of lid lag at full downgaze, 4 mm of proptosis) is illustration, not measurement. The lid-sign and orbitopathy cut-offs are inline in `models/body-exam.ts`, not in the registry.
  - Noticed, not changed: hepatitis (`hepatitis` 0.7 for ten days) leaves bilirubin normal in the model, though acute hepatitis is often icteric.
  - The afferent pupillary pathway is on or off, so a partial optic nerve lesion gives the same defect as a complete one; the field model has a temporal and a nasal half per eye only; the fundus has no model.

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
6. The heart–lung interaction, as one topic, in this order. Parked by the owner (2026-10-19) to build the auscultation station first.
   1. The breath waveform: done (merged with this topic's first PR). Its side effects, each looked at on its own: baroreflex sensitivity and haemorrhage were read from one beat, and pass read over a breath; the hypothyroid pulse is 58 over a breath (gap 5); central cyanosis sat at the threshold and flipped with the sampled beat, so the lungs and body now read the breath-averaged circulation (gap 19); the COPD case's cyanosis exception is removed (deoxygenated haemoglobin 40 g/L, at the threshold).
   2. The abdominal pump (gap 16): a lumped version was tried and is not adopted (gap 16c). Next: split the systemic veins into abdominal and leg (and upper-body) pools, with abdominal pressure acting on the abdominal one and Takata's zone 2; check the venous return's four segments against Körperich, then RV volumes against Claessen.
   3. Refit `systoleLengthGain` (gap 12) once the filling is right, and recheck gaps 12, 13 and 15.
   4. Then pulmonary outflow inertance (gap 12, needs Shaver's hangout data), ventricular interdependence in tamponade (gap 13), and the rate dependence of systole (gaps 10–11).
