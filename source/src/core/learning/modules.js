/* ---------------------------------------------------------------------------
   CME / CPD modules.

   A module is a structured activity built from the simulation's own cases and
   guided experiments:

     overview → pre-test → activities → post-test → reflection & evaluation
     → certificate → 30-day follow-up on the learner's commitment to change

   Each objective has two questions, form "a" and form "b". The pre-test uses
   form a without feedback; the post-test uses form b with full explanations,
   so improvement is measured on parallel items rather than on questions the
   learner has just been shown the answers to.

   `review.status` is honest about provenance. Content marked "draft" has not
   yet been through independent expert review, and the interface says so. An
   accrediting provider fills in `accreditation` and the reviewer fields; the
   certificate then carries them.
--------------------------------------------------------------------------- */

const DRAFT = {
  status: 'draft',
  note: 'Draft for expert peer review. Check against current local guidance before relying on it in practice.',
  reviewers: [],
  reviewed: '2026-09',
  nextReview: '2028-09',
};

const q = (id, objective, form, stem, options, answer, explanation) =>
  ({ id, objective, form, stem, options: options.map((text, i) => ({ id: String.fromCharCode(97 + i), text })), answer, explanation });

export const MODULES = [
  /* ======================================================================= */
  {
    id: 'st-elevation',
    title: 'ST elevation: infarction or imitator?',
    blurb: 'Regional versus diffuse elevation, reciprocal change, Wellens and the posterior infarct nobody sees.',
    levels: ['student', 'resident', 'physician'],
    specialty: 'Cardiology · Emergency medicine',
    minutes: 45, maxHours: 0.75, passMark: 0.75,
    accent: 'aortic',
    objectives: [
      'Separate STEMI from pericarditis using territory, reciprocal change and PR-segment shifts.',
      'Recognise benign early repolarisation and the features that argue against infarction.',
      'Identify the Wellens pattern as a marker of critical proximal LAD stenosis, and act on it.',
      'Recognise posterior infarction and the very-high-risk NSTE-ACS patient who needs immediate angiography.',
    ],
    activities: [
      { ref: 'cardio/case/stemi_ant' },
      { ref: 'cardio/case/pericarditis' },
      { ref: 'cardio/case/early_repol' },
      { ref: 'cardio/case/wellens' },
      { ref: 'cardio/case/nstemi' },
    ],
    questions: [
      q('st1a', 0, 'a', 'A 61-year-old man has 90 minutes of central chest pain. The ECG shows 3 mm ST elevation in II, III and aVF with 1.5 mm ST depression in I and aVL. What is the most likely diagnosis?',
        ['Acute inferior STEMI', 'Acute pericarditis', 'Benign early repolarisation', 'Old inferior infarction with aneurysm'], 'a',
        'Regional elevation confined to one territory with reciprocal depression on the opposite side (aVL is the mirror of III) is infarction until proven otherwise. Pericarditis does not respect a coronary territory and has no reciprocal ST depression outside aVR and V1.'),
      q('st1b', 0, 'b', 'A 28-year-old woman has sharp chest pain that eases when she sits forward. The ECG shows concave ST elevation across I, II, aVL, aVF and V2–V6. Which additional finding most strongly favours pericarditis over STEMI?',
        ['PR-segment depression with PR elevation in aVR, and no reciprocal ST depression elsewhere', 'ST elevation in two contiguous leads', 'T-wave inversion developing while the ST segments are still elevated', 'New Q waves in the inferior leads'], 'a',
        'PR depression reflects atrial injury, and diffuse elevation without reciprocal change is the pericardial pattern. T inversion while ST is still elevated and new Q waves both point towards infarction; in pericarditis the T waves usually invert only after the ST segments return to baseline.'),
      q('st2a', 1, 'a', 'Which feature favours benign early repolarisation over anterior STEMI?',
        ['Concave ST elevation with J-point notching that is unchanged on serial ECGs', 'Convex ("tombstone") ST elevation with loss of R-wave height', 'Reciprocal ST depression in the inferior leads', 'ST elevation that increases between two ECGs 20 minutes apart'], 'a',
        'Early repolarisation is concave, often notched at the J point, stable over time and has no reciprocal change. Evolution between serial tracings, convexity, loss of R wave and reciprocal depression all suggest infarction.'),
      q('st2b', 1, 'b', 'An asymptomatic 20-year-old footballer has 1.5 mm concave ST elevation in V2–V4 with J-point notching on a screening ECG. What is the most appropriate next step?',
        ['Compare with any previous ECG and assess clinically; no emergency treatment if he is well and the trace is stable', 'Activate the catheter laboratory', 'Start aspirin and colchicine for pericarditis', 'Give thrombolysis if angiography is not available'], 'a',
        'In a young, asymptomatic athlete this pattern is common and benign. The decision rests on the clinical picture and stability, not the ST segment alone. Reperfusion therapy for a non-infarct is a serious harm.'),
      q('st3a', 2, 'a', 'A 55-year-old man had chest pain yesterday and is now pain-free. The ECG shows deep, symmetrical T-wave inversion in V2–V3 with preserved R waves and no Q waves. Which management is most appropriate?',
        ['Avoid exercise stress testing and arrange early invasive coronary angiography', 'Exercise treadmill test to provoke ischaemia', 'Discharge with outpatient follow-up because he is pain-free', 'Immediate thrombolysis'], 'a',
        'This is the Wellens pattern, a marker of critical proximal LAD stenosis. Stress testing can precipitate an extensive anterior infarction. The pattern appears in the pain-free interval, which is exactly why it is missed.'),
      q('st3b', 2, 'b', 'The Wellens pattern (biphasic or deeply inverted T waves in V2–V3 after an episode of chest pain) points to a critical stenosis in which artery?',
        ['Proximal left anterior descending artery', 'Right coronary artery', 'Left circumflex artery', 'Posterior descending artery'], 'a',
        'Wellens and colleagues described the pattern in patients with high-grade proximal LAD stenosis; many went on to anterior infarction within weeks if untreated.'),
      q('st4a', 3, 'a', 'A 70-year-old woman has ongoing chest pain. The ECG shows 2 mm horizontal ST depression in V1–V3 with a dominant R wave in V2 and upright T waves. What should you do next?',
        ['Record posterior leads V7–V9 and treat as STEMI if they show ST elevation', 'Treat as NSTEMI with angiography within 72 hours', 'Diagnose right bundle branch block', 'Attribute it to digoxin effect'], 'a',
        'Isolated ST depression in V1–V3 can be the mirror image of posterior infarction. ESC guidance treats posterior STEMI as a STEMI equivalent. The posterior leads make it visible.'),
      q('st4b', 3, 'b', 'In suspected NSTE-ACS, which situation calls for an immediate invasive strategy (angiography within 2 hours) under the 2023 ESC guidelines?',
        ['Ongoing chest pain refractory to medical treatment, or haemodynamic instability', 'A single troponin above the 99th percentile in a pain-free patient', 'Age over 75 years alone', 'Diabetes with normal troponins'], 'a',
        'Very-high-risk features include haemodynamic instability or cardiogenic shock, recurrent or refractory pain despite medical treatment, life-threatening arrhythmias, mechanical complications and acute heart failure clearly related to ACS. A confirmed NSTEMI diagnosis alone places a patient in the high-risk group (early invasive, within 24 hours).'),
    ],
    references: [
      'Byrne RA, Rossello X, Coughlan JJ, et al. 2023 ESC Guidelines for the management of acute coronary syndromes. Eur Heart J. 2023;44(38):3720–3826.',
      'Thygesen K, Alpert JS, Jaffe AS, et al. Fourth universal definition of myocardial infarction (2018). Eur Heart J. 2019;40(3):237–269.',
      'Schulz-Menger J, Collini V, Gröschel J, et al. 2025 ESC Guidelines for the management of myocarditis and pericarditis. Eur Heart J. 2025;46(40):3952–4041.',
      'de Zwaan C, Bär FW, Wellens HJJ. Characteristic electrocardiographic pattern indicating a critical stenosis high in left anterior descending coronary artery in patients admitted because of impending myocardial infarction. Am Heart J. 1982;103(4 Pt 2):730–736.',
    ],
    review: DRAFT,
    accreditation: null,
  },

  /* ======================================================================= */
  {
    id: 'wide-and-slow',
    title: 'Wide complexes and slow hearts',
    blurb: 'Regular broad-complex tachycardia, pre-excitation, and where in the conduction system a block sits.',
    levels: ['student', 'resident', 'physician'],
    specialty: 'Cardiology · Emergency · Acute medicine',
    minutes: 45, maxHours: 0.75, passMark: 0.75,
    accent: 'lv',
    objectives: [
      'Treat regular broad-complex tachycardia as VT until proven otherwise, and name the features that confirm it.',
      'Recognise pre-excitation and the danger of AV-nodal blockade in pre-excited atrial fibrillation.',
      'Localise second-degree AV block to the node or below it, and predict the consequences.',
      'Recognise complete heart block and judge the reliability of its escape rhythm.',
    ],
    activities: [
      { ref: 'cardio/case/vt' },
      { ref: 'cardio/case/lbbb' },
      { ref: 'cardio/case/wpw_a' },
      { ref: 'cardio/case/wenckebach' },
      { ref: 'cardio/case/chb' },
      { ref: 'cardio/lesson/blocks' },
    ],
    questions: [
      q('ws1a', 0, 'a', 'A 67-year-old man with a previous anterior infarct has a regular broad-complex tachycardia at 170/min. His blood pressure is 118/76 mmHg and he is alert. Which finding most strongly supports ventricular tachycardia?',
        ['AV dissociation with capture or fusion beats', 'A rate above 150/min', 'Right bundle branch block morphology', 'His stable blood pressure'], 'a',
        'AV dissociation, and the capture and fusion beats it produces, is close to diagnostic of VT. Haemodynamic stability does not argue against VT; many patients with VT are initially well. A history of structural heart disease makes VT the most likely diagnosis.'),
      q('ws1b', 0, 'b', 'In a regular broad-complex tachycardia of uncertain mechanism, which action carries the greatest risk?',
        ['Intravenous verapamil', 'Synchronised DC cardioversion under sedation', 'Recording a 12-lead ECG before treatment', 'Intravenous amiodarone'], 'a',
        'Verapamil given for presumed SVT with aberrancy can cause profound hypotension and cardiac arrest if the rhythm is VT. When in doubt, treat as VT.'),
      q('ws2a', 1, 'a', 'A 24-year-old has palpitations. In sinus rhythm the PR interval is 100 ms, the QRS is 125 ms with a slurred upstroke, and there are secondary ST–T changes. What is the diagnosis?',
        ['Wolff–Parkinson–White pattern (ventricular pre-excitation)', 'Left bundle branch block', 'Hyperkalaemia', 'Brugada pattern'], 'a',
        'A short PR interval, a delta wave and a broad QRS reflect early activation of the ventricle through an accessory pathway that bypasses the AV node.'),
      q('ws2b', 1, 'b', 'A 30-year-old with known pre-excitation has an irregular broad-complex tachycardia at up to 250/min, with QRS width varying from beat to beat. Which treatment should be avoided?',
        ['AV-nodal blocking drugs such as adenosine, verapamil or digoxin', 'Synchronised cardioversion if he becomes unstable', 'Intravenous procainamide or ibutilide if he is stable', 'Expert referral for catheter ablation'], 'a',
        'This is pre-excited atrial fibrillation. Blocking the AV node leaves the accessory pathway as the only route and can accelerate conduction into ventricular fibrillation.'),
      q('ws3a', 2, 'a', 'The PR interval lengthens progressively until a P wave is not conducted, then the cycle repeats. The QRS is narrow. Where is the block?',
        ['The AV node', 'Below the His bundle', 'The sinoatrial node', 'Both bundle branches'], 'a',
        'Wenckebach periodicity with a narrow QRS is almost always nodal. It is often vagal, frequently benign, and usually responds to atropine.'),
      q('ws3b', 2, 'b', 'Mobitz type II block with right bundle branch block is found in a patient with syncope. Why is pacing indicated?',
        ['The block is infranodal and may progress suddenly to complete heart block with an unreliable escape rhythm', 'It is usually vagal and resolves with atropine', 'It indicates digoxin toxicity', 'The PR interval is too long for safe conduction'], 'a',
        'Constant PR intervals with dropped beats, especially alongside bundle branch disease, place the block in the His–Purkinje system. Atropine speeds the sinus rate but does not help, and may worsen, infranodal block.'),
      q('ws4a', 3, 'a', 'Which finding defines complete (third-degree) heart block?',
        ['P waves and QRS complexes are independent, with the atrial rate faster than the ventricular rate', 'Every second P wave is not conducted', 'The PR interval is longer than 300 ms', 'An occasional non-conducted P wave'], 'a',
        'In complete heart block no atrial impulse reaches the ventricles. The atria and ventricles each keep their own rhythm, so the PR intervals vary at random.'),
      q('ws4b', 3, 'b', 'In complete heart block the escape rhythm is broad at 32/min. What does this imply?',
        ['A ventricular escape focus, which is slow and unreliable, so pacing is urgent', 'A junctional escape, which is usually stable', 'That the block is at the AV node', 'That atropine will reliably restore conduction'], 'a',
        'Narrow escape rhythms at 40–60/min usually arise from the junction. Broad, slow escapes originate lower down, are prone to pauses and asystole, and signal infranodal disease.'),
    ],
    references: [
      'Zeppenfeld K, Tfelt-Hansen J, de Riva M, et al. 2022 ESC Guidelines for the management of patients with ventricular arrhythmias and the prevention of sudden cardiac death. Eur Heart J. 2022;43(40):3997–4126.',
      'Glikson M, Nielsen JC, Kronborg MB, et al. 2021 ESC Guidelines on cardiac pacing and cardiac resynchronization therapy. Eur Heart J. 2021;42(35):3427–3520.',
      'Kusumoto FM, Schoenfeld MH, Barrett C, et al. 2018 ACC/AHA/HRS guideline on the evaluation and management of patients with bradycardia and cardiac conduction delay. Circulation. 2019;140(8):e382–e482.',
      'Brugada P, Brugada J, Mont L, Smeets J, Andries EW. A new approach to the differential diagnosis of a regular tachycardia with a wide QRS complex. Circulation. 1991;83(5):1649–1659.',
    ],
    review: DRAFT,
    accreditation: null,
  },

  /* ======================================================================= */
  {
    id: 'chemistry-ecg',
    title: 'Acid–base, potassium and the ECG',
    blurb: 'The blood gas worked one step at a time, and the ECG read as a chemistry report.',
    levels: ['student', 'resident', 'physician'],
    specialty: 'Acute medicine · Nephrology · Intensive care',
    minutes: 50, maxHours: 0.75, passMark: 0.75,
    accent: 'la',
    objectives: [
      'Recognise the ECG progression of hyperkalaemia and give membrane stabilisation first.',
      'Interpret a metabolic acidosis systematically: expected compensation and the albumin-corrected anion gap.',
      'Detect mixed acid–base disorders using expected compensation and the delta ratio.',
      'Distinguish digoxin effect from digoxin toxicity and know what potentiates toxicity.',
    ],
    activities: [
      { ref: 'cardio/case/hyperk_mod' },
      { ref: 'cardio/case/digitalis' },
      { ref: 'cardio/lesson/potassium' },
      { ref: 'labs/case/dka' },
      { ref: 'labs/case/copd' },
      { ref: 'labs/case/shock' },
      { ref: 'labs/lesson/gap' },
    ],
    questions: [
      q('ch1a', 0, 'a', 'A dialysis patient who missed two sessions has K⁺ 7.4 mmol/L, peaked T waves, absent P waves and a QRS of 140 ms. What should be given first?',
        ['Intravenous calcium (gluconate or chloride)', 'Insulin with glucose', 'Intravenous sodium bicarbonate', 'An oral potassium binder'], 'a',
        'Calcium does not lower potassium. It stabilises the myocardial membrane within minutes and buys time for insulin–glucose to shift potassium into cells and for dialysis to remove it. ECG changes are the indication.'),
      q('ch1b', 0, 'b', 'As serum potassium rises, in what order do ECG changes typically appear?',
        ['Peaked T waves → P-wave flattening and PR prolongation → QRS widening → sine-wave pattern', 'QRS widening → peaked T waves → loss of P waves → sine wave', 'Prominent U waves → ST depression → QT prolongation', 'Sine wave → QRS widening → peaked T waves'], 'a',
        'Repolarisation changes come first, followed by slowed atrial and then ventricular conduction. The correlation with the measured level is loose. A normal ECG does not make severe hyperkalaemia safe, and any conduction change is an emergency.'),
      q('ch2a', 1, 'a', 'pH 7.21, PaCO₂ 3.1 kPa (23 mmHg), HCO₃⁻ 9 mmol/L, Na⁺ 138, Cl⁻ 100, albumin 40 g/L. What is the interpretation?',
        ['Raised anion gap metabolic acidosis with appropriate respiratory compensation', 'Normal anion gap metabolic acidosis', 'Metabolic acidosis with a coexisting respiratory acidosis', 'Primary respiratory alkalosis'], 'a',
        'Anion gap = 138 − (100 + 9) = 29 (raised). Winter\'s formula gives an expected PaCO₂ of 1.5 × 9 + 8 = 21.5 ± 2 mmHg. The measured 23 mmHg falls within that range, so compensation is appropriate.'),
      q('ch2b', 1, 'b', 'The measured anion gap is 12 mmol/L and the albumin is 20 g/L. What is the corrected gap and its meaning?',
        ['About 17 mmol/L: a raised gap hidden by hypoalbuminaemia', '12 mmol/L: normal', 'About 7 mmol/L: low', 'About 22 mmol/L: severely raised'], 'a',
        'Albumin is the main unmeasured anion. Add about 2.5 mmol/L to the gap for every 10 g/L that albumin falls below 40: 12 + 0.25 × (40 − 20) = 17. Critically ill patients are exactly the ones in whom this matters.'),
      q('ch3a', 2, 'a', 'In a raised anion gap acidosis, the gap has risen by 14 mmol/L above normal but the bicarbonate has fallen by only 6. What does this suggest?',
        ['A coexisting metabolic alkalosis, such as from vomiting', 'A coexisting normal anion gap acidosis', 'Laboratory error', 'Appropriate respiratory compensation'], 'a',
        'The delta ratio is 14/6 ≈ 2.3. When bicarbonate has fallen less than the gap has risen, something is adding bicarbonate back, usually vomiting or diuretics. A ratio below 1 would instead suggest an added normal-gap acidosis.'),
      q('ch3b', 2, 'b', 'A patient with COPD has pH 7.30, PaCO₂ 8.5 kPa (64 mmHg) and HCO₃⁻ 31 mmol/L. What is the best description?',
        ['Acute-on-chronic respiratory acidosis', 'Acute respiratory acidosis alone', 'Fully compensated chronic respiratory acidosis', 'Primary metabolic alkalosis'], 'a',
        'For a 24 mmHg rise in PaCO₂, acute compensation would give a bicarbonate of about 26 and chronic compensation about 32–34. A bicarbonate of 31 with an acidaemic pH lies between the two: a chronic retainer with an acute deterioration.'),
      q('ch4a', 3, 'a', 'A patient on digoxin has downsloping, "reverse tick" ST depression in the lateral leads and a short QT interval, and no symptoms. What does this indicate?',
        ['Digoxin effect, which shows exposure and not toxicity', 'Digoxin toxicity requiring antibody fragments', 'Lateral subendocardial ischaemia', 'Hypokalaemia'], 'a',
        'The characteristic ST scooping appears at therapeutic levels. Toxicity is judged on symptoms (nausea, visual disturbance, confusion), arrhythmias and levels, not on this morphology.'),
      q('ch4b', 3, 'b', 'At a given serum digoxin concentration, which electrolyte abnormality most increases the risk of toxic arrhythmias?',
        ['Hypokalaemia', 'Hyperkalaemia', 'Hypermagnesaemia', 'Hypocalcaemia'], 'a',
        'Digoxin and potassium compete for the Na⁺/K⁺-ATPase, so low potassium increases digoxin\'s effect. Hypomagnesaemia and hypercalcaemia also potentiate toxicity. Note that acute digoxin poisoning can itself cause hyperkalaemia.'),
    ],
    references: [
      'Alfonzo A, Harrison A, Baines R, et al. UK Kidney Association clinical practice guidelines: treatment of acute hyperkalaemia in adults. Updated July 2026.',
      'Berend K, de Vries APJ, Gans ROB. Physiological approach to assessment of acid–base disturbances. N Engl J Med. 2014;371(15):1434–1445.',
      'Kraut JA, Madias NE. Metabolic acidosis: pathophysiology, diagnosis and management. Nat Rev Nephrol. 2010;6(5):274–285.',
      'Surawicz B, Knilans TK. Chou\'s Electrocardiography in Clinical Practice. 6th ed. Philadelphia: Saunders Elsevier; 2008.',
    ],
    review: DRAFT,
    accreditation: null,
  },

  /* ======================================================================= */
  {
    id: 'shock-volume',
    title: 'Shock, volume and sodium: one patient, three systems',
    blurb: 'The same patient seen through the circulation, the cord and the blood results, joined by mechanism.',
    levels: ['student', 'resident', 'physician'],
    specialty: 'Emergency · Intensive care · Acute medicine',
    minutes: 50, maxHours: 0.75, passMark: 0.75,
    accent: 'volume',
    objectives: [
      'Classify shock from its haemodynamic pattern, including neurogenic shock\'s telltale bradycardia.',
      'Explain how the baroreflex hides early blood loss and what can remove that disguise.',
      'Interpret lactate as a marker of hypoperfusion, with its limits, and state the Sepsis-3 definition of septic shock.',
      'Classify hyponatraemia by volume status and urine studies.',
    ],
    activities: [
      { ref: 'cardio/lesson/venous-return' },
      { ref: 'cardio/lesson/baroreflex' },
      { ref: 'neuro/case/neurogenic' },
      { ref: 'neuro/lesson/cross-domain' },
      { ref: 'labs/lesson/lactate-loop' },
      { ref: 'labs/case/hypovolaemic-hypona' },
      { ref: 'labs/case/siadh' },
    ],
    questions: [
      q('sv1a', 0, 'a', 'After a diving accident with a C5 fracture, a patient has BP 78/40 mmHg, heart rate 48/min and warm peripheries. What is the most likely mechanism?',
        ['Neurogenic shock from loss of sympathetic outflow', 'Haemorrhagic shock', 'Cardiogenic shock from myocardial contusion', 'Tension pneumothorax'], 'a',
        'A cord lesion above T6 removes sympathetic vasomotor tone and cardiac acceleration, leaving vagal activity unopposed. That produces hypotension with a slow pulse and warm skin. Occult haemorrhage must still be excluded, because the two often coexist in trauma.'),
      q('sv1b', 0, 'b', 'A patient has a raised CVP and pulmonary artery wedge pressure, low cardiac output, high systemic vascular resistance and cold peripheries. Which shock state fits best?',
        ['Cardiogenic shock from left ventricular failure', 'Hypovolaemic shock', 'Distributive (septic) shock', 'Obstructive shock from pulmonary embolism'], 'a',
        'High filling pressures on both sides with low output point to pump failure. Pulmonary embolism also raises right-sided pressure and lowers output, but the left-sided wedge pressure is low because the left heart is underfilled. Hypovolaemia lowers all filling pressures.'),
      q('sv2a', 1, 'a', 'A healthy young adult acutely loses about 20% of blood volume. What is typically seen?',
        ['Tachycardia with a narrowed pulse pressure while systolic pressure is still near normal', 'Profound hypotension with bradycardia', 'A widened pulse pressure', 'No change in any vital sign'], 'a',
        'The baroreflex defends mean pressure through tachycardia and vasoconstriction. Rising diastolic pressure and falling stroke volume narrow the pulse pressure, and systolic pressure falls late. A normal blood pressure does not exclude significant haemorrhage.'),
      q('sv2b', 1, 'b', 'An elderly patient on bisoprolol is bleeding from the upper GI tract. Her heart rate is 68/min. How should this be interpreted?',
        ['Beta-blockade can blunt the tachycardic response, so a normal rate does not reassure', 'The normal rate excludes significant blood loss', 'The bleed must be small because the baroreflex is intact', 'Bradycardia is expected in all haemorrhage'], 'a',
        'Drugs (beta-blockers, rate-limiting calcium channel blockers), pacemakers, age and athletic conditioning all mask the compensatory tachycardia. This is the baroreflex experiment in the lesson, with the reflex partly switched off.'),
      q('sv3a', 2, 'a', 'Which statement about blood lactate in shock is correct?',
        ['A raised lactate usually reflects hypoperfusion, but can also come from adrenergic stimulation, liver failure or drugs such as metformin, so its trend matters more than a single value', 'A normal lactate excludes shock', 'Lactate is raised only in septic shock', 'Lactate should be ignored once blood pressure is normal'], 'a',
        'Lactate is a useful, imperfect marker. Clearance with resuscitation is associated with better outcomes, and Surviving Sepsis guidance suggests using it to guide resuscitation. Beta-2 stimulation (for example adrenaline or salbutamol) raises it without any hypoperfusion.'),
      q('sv3b', 2, 'b', 'Under the Sepsis-3 definition, septic shock requires sepsis plus which of the following?',
        ['Vasopressors to maintain MAP ≥ 65 mmHg and a lactate > 2 mmol/L despite adequate fluid resuscitation', 'Systolic BP below 90 mmHg on a single reading', 'Lactate above 4 mmol/L alone', 'A positive blood culture and fever'], 'a',
        'Both criteria are required. Together they identify patients with a hospital mortality above 40%.'),
      q('sv4a', 3, 'a', 'A clinically euvolaemic patient has Na⁺ 124 mmol/L, urine osmolality 480 mOsm/kg and urine Na⁺ 55 mmol/L, with normal thyroid and adrenal function and no diuretics. What is the most likely diagnosis?',
        ['SIADH', 'Hypovolaemic hyponatraemia from vomiting', 'Primary polydipsia', 'Thiazide-induced hyponatraemia'], 'a',
        'Inappropriately concentrated urine with ongoing natriuresis in a euvolaemic patient, after excluding hypothyroidism, adrenal insufficiency and diuretics, is SIADH. Primary polydipsia produces maximally dilute urine (osmolality below 100 mOsm/kg).'),
      q('sv4b', 3, 'b', 'A patient has hyponatraemia after several days of vomiting and looks dry. Which urine sodium is expected, and what is the treatment?',
        ['Below 30 mmol/L; restore volume with isotonic saline', 'Above 40 mmol/L; restrict fluid', 'Above 40 mmol/L; give demeclocycline', 'Below 30 mmol/L; restrict fluid'], 'a',
        'Extrarenal losses make the kidney avid for sodium, and restoring volume removes the stimulus for ADH secretion. Fluid restriction is the treatment for SIADH, and it would harm this patient. Correct chronic hyponatraemia slowly to avoid osmotic demyelination.'),
    ],
    references: [
      'Vincent JL, De Backer D. Circulatory shock. N Engl J Med. 2013;369(18):1726–1734.',
      'Singer M, Deutschman CS, Seymour CW, et al. The Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3). JAMA. 2016;315(8):801–810.',
      'Evans L, Rhodes A, Alhazzani W, et al. Surviving Sepsis Campaign: international guidelines for management of sepsis and septic shock 2021. Intensive Care Med. 2021;47(11):1181–1247.',
      'Spasovski G, Vanholder R, Allolio B, et al. Clinical practice guideline on diagnosis and treatment of hyponatraemia. Eur J Endocrinol. 2014;170(3):G1–G47.',
    ],
    review: DRAFT,
    accreditation: null,
  },

  /* ======================================================================= */
  {
    id: 'peripheral-localisation',
    title: 'Root, nerve, junction or muscle',
    blurb: 'The bottom four rungs of the neurological ladder, separated by the right muscle pair.',
    levels: ['student', 'resident', 'physician'],
    specialty: 'Neurology · General practice · Rehabilitation',
    minutes: 40, maxHours: 0.75, passMark: 0.75,
    accent: 'flow',
    objectives: [
      'Separate a root lesion from a nerve lesion using muscles that share a root but not a nerve.',
      'Recognise neuromuscular junction disease: fatigable, ocular and bulbar, with no sensory loss.',
      'Recognise myopathy: proximal, symmetrical weakness with preserved reflexes and sensation.',
      'Distinguish upper from lower motor neuron signs.',
    ],
    activities: [
      { ref: 'neuro/lesson/ladder' },
      { ref: 'neuro/case/ulnar' },
      { ref: 'neuro/case/footdrop' },
      { ref: 'neuro/case/mg' },
      { ref: 'neuro/case/myopathy' },
    ],
    questions: [
      q('pl1a', 0, 'a', 'In a patient with foot drop, weakness of which movement suggests an L5 radiculopathy rather than a common peroneal nerve palsy?',
        ['Ankle inversion (tibialis posterior)', 'Ankle dorsiflexion', 'Ankle eversion', 'Great toe extension'], 'a',
        'Tibialis posterior is supplied by L5 through the tibial nerve. It is weak in an L5 root lesion and spared in a peroneal palsy. Dorsiflexion, eversion and toe extension are weak in both.'),
      q('pl1b', 0, 'b', 'A patient has weakness of both abductor pollicis brevis and first dorsal interosseous, with sensory loss over the medial forearm. Where is the lesion most likely to be?',
        ['Proximal to the ulnar and median nerves: the C8/T1 root or lower brachial plexus', 'The ulnar nerve at the elbow', 'The median nerve at the wrist', 'The radial nerve in the spiral groove'], 'a',
        'Two nerves are involved, but they share the same roots. The medial forearm is supplied by the medial antebrachial cutaneous nerve (C8–T1), which is not part of the ulnar nerve. Together these findings place the lesion above the point where the nerves separate.'),
      q('pl2a', 1, 'a', 'A 35-year-old woman has ptosis and double vision that worsen through the day. The pupils are normal, sensation is normal and reflexes are preserved. Where is the problem most likely to be?',
        ['The neuromuscular junction', 'The oculomotor nerve', 'The brainstem', 'The muscle'], 'a',
        'Fatigable, fluctuating ocular weakness with normal pupils and no sensory signs is characteristic of myasthenia gravis. A third nerve palsy from compression usually involves the pupil.'),
      q('pl2b', 1, 'b', 'Which bedside finding supports myasthenia gravis?',
        ['Ptosis that worsens during sustained upgaze and improves after an ice pack', 'A dilated, unreactive pupil', 'Loss of the corneal reflex', 'Fasciculations of the tongue'], 'a',
        'Sustained activity depletes the neuromuscular safety margin, and cooling improves transmission. Pupillary involvement points to the third nerve, and fasciculation points to the lower motor neuron.'),
      q('pl3a', 2, 'a', 'A 58-year-old woman has had three months of difficulty rising from chairs and lifting her arms. Weakness is proximal and symmetrical, reflexes and sensation are normal, and creatine kinase is raised. What is the most likely level of the problem?',
        ['Muscle (myopathy)', 'Peripheral nerve (polyneuropathy)', 'Anterior horn cell (motor neuron disease)', 'Neuromuscular junction'], 'a',
        'Proximal, symmetrical weakness with preserved reflexes and sensation, together with a raised CK, is the pattern of myopathy. Polyneuropathy is distal, loses reflexes early and usually has sensory signs.'),
      q('pl3b', 2, 'b', 'Which finding argues against myopathy?',
        ['Early loss of ankle reflexes with stocking-distribution sensory loss', 'Difficulty climbing stairs', 'Neck flexor weakness', 'Symmetrical proximal weakness'], 'a',
        'Sensory loss and early loss of reflexes point to the peripheral nerve. Myopathies spare sensation and keep reflexes until weakness is severe.'),
      q('pl4a', 3, 'a', 'Which combination indicates an upper motor neuron lesion?',
        ['Spasticity, hyperreflexia and an extensor plantar response', 'Wasting, fasciculation and areflexia', 'Fatigable weakness with normal reflexes', 'Weakness in a single peripheral nerve territory'], 'a',
        'Upper motor neuron lesions release spinal reflexes from descending inhibition. Wasting and fasciculation are signs of the lower motor neuron.'),
      q('pl4b', 3, 'b', 'Wasting, fasciculation and loss of reflexes confined to one myotome point to a lesion where?',
        ['The lower motor neuron: anterior horn cell, root or nerve', 'The internal capsule', 'The cerebral cortex', 'The neuromuscular junction'], 'a',
        'These are lower motor neuron signs. Their distribution then decides between horn cell, root, plexus and nerve.'),
    ],
    references: [
      'Guarantors of Brain. Aids to the Examination of the Peripheral Nervous System. Elsevier (current edition).',
      'Campbell WW, Barohn RJ. DeJong\'s The Neurologic Examination. 8th ed. Philadelphia: Wolters Kluwer; 2020.',
      'Gilhus NE. Myasthenia gravis. N Engl J Med. 2016;375(26):2570–2581.',
    ],
    review: DRAFT,
    accreditation: null,
  },

  /* ======================================================================= */
  {
    id: 'central-localisation',
    title: 'Brainstem, cord and visual pathways',
    blurb: 'Crossed signs, the forehead rule, cord syndromes and the swinging torch.',
    levels: ['student', 'resident', 'physician'],
    specialty: 'Neurology · Stroke · Emergency medicine',
    minutes: 55, maxHours: 1, passMark: 0.75,
    accent: 'ecg',
    objectives: [
      'Distinguish upper from lower motor neuron facial weakness using the forehead.',
      'Localise brainstem lesions from crossed signs: an ipsilateral cranial nerve with contralateral long-tract signs.',
      'Recognise hemicord and central cord syndromes from the dissociation of sensory modalities.',
      'Localise visual field defects and a relative afferent pupillary defect.',
    ],
    activities: [
      { ref: 'neuro/lesson/forehead' },
      { ref: 'neuro/case/bells' },
      { ref: 'neuro/case/umn-face' },
      { ref: 'neuro/lesson/brainstem-rule' },
      { ref: 'neuro/case/wallenberg' },
      { ref: 'neuro/case/weber' },
      { ref: 'neuro/lesson/two-systems' },
      { ref: 'neuro/case/bs' },
      { ref: 'neuro/case/central' },
      { ref: 'neuro/case/chiasm' },
      { ref: 'neuro/case/rapd' },
    ],
    questions: [
      q('cl1a', 0, 'a', 'A patient has right facial weakness involving the forehead, loss of taste on the anterior two-thirds of the tongue on the right, and hyperacusis. Where is the lesion?',
        ['Right facial nerve (lower motor neuron)', 'Left internal capsule', 'Right motor cortex', 'Left facial nerve'], 'a',
        'Forehead involvement means the lesion is in the nucleus or the nerve. Taste loss and hyperacusis place it proximal to the branches to the chorda tympani and stapedius.'),
      q('cl1b', 0, 'b', 'Weakness of the left lower face with the forehead spared, together with a weak left arm, points to a lesion where?',
        ['Right cerebral hemisphere or internal capsule', 'Left facial nerve', 'Left pons', 'Right facial nerve'], 'a',
        'The upper face receives corticobulbar input from both hemispheres, so a unilateral upper motor neuron lesion spares the forehead. Face and arm on the same side point to the opposite hemisphere.'),
      q('cl2a', 1, 'a', 'A patient has a right Horner syndrome, loss of pain and temperature sensation on the right face and left body, right limb ataxia, hoarseness and dysphagia. Where is the lesion?',
        ['Right lateral medulla (vertebral artery or PICA territory)', 'Left lateral medulla', 'Right medial medulla', 'Right internal capsule'], 'a',
        'This is Wallenberg syndrome. The trigeminal spinal tract (ipsilateral face) and the already crossed spinothalamic tract (contralateral body) lie side by side in the lateral medulla, and together they produce the crossed sensory loss.'),
      q('cl2b', 1, 'b', 'A left oculomotor palsy with right-sided hemiparesis localises to where?',
        ['Left ventral midbrain (Weber syndrome)', 'Right ventral midbrain', 'Left medial medulla', 'Right internal capsule'], 'a',
        'The third nerve fascicle and the cerebral peduncle lie together in the ventral midbrain. The corticospinal fibres there have not yet crossed, so the hemiparesis is contralateral.'),
      q('cl3a', 2, 'a', 'Below T10 there is left leg weakness with loss of vibration and joint position sense on the left, and loss of pain and temperature sensation on the right. Where is the lesion?',
        ['Left hemicord (Brown-Séquard syndrome)', 'Right hemicord', 'Central cord', 'Anterior spinal artery territory'], 'a',
        'The corticospinal tract and dorsal columns cross in the medulla, so they are affected on the side of the lesion. The spinothalamic tract crosses within a segment or two of entry, so pain and temperature are lost on the opposite side.'),
      q('cl3b', 2, 'b', 'A patient has bilateral loss of pain and temperature sensation over the shoulders and arms, preserved light touch and vibration, and absent arm reflexes. What is the most likely lesion?',
        ['A central cervical cord lesion such as a syrinx', 'A left hemicord lesion', 'Bilateral carpal tunnel syndrome', 'A parasagittal cortical lesion'], 'a',
        'A central lesion first interrupts the spinothalamic fibres crossing in the anterior commissure, producing a cape-like dissociated sensory loss. Anterior horn involvement at the same levels removes the arm reflexes.'),
      q('cl4a', 3, 'a', 'Bitemporal hemianopia localises to which structure?',
        ['The optic chiasm', 'The left optic tract', 'The right occipital cortex', 'Both optic nerves'], 'a',
        'Nasal retinal fibres, which serve the temporal fields, cross at the chiasm. Compression from below, typically by a pituitary tumour, affects them first.'),
      q('cl4b', 3, 'b', 'In the swinging flashlight test, both pupils dilate when the light moves from the right eye to the left eye. What does this show?',
        ['A left relative afferent pupillary defect: an afferent lesion of the left optic nerve', 'A right RAPD', 'A left third nerve palsy', 'A left Horner syndrome'], 'a',
        'Less light signal reaches the midbrain from the left eye, so both pupils dilate when the torch moves onto it. The efferent pathways are intact and the pupils remain equal at rest.'),
    ],
    references: [
      'Blumenfeld H. Neuroanatomy through Clinical Cases. 3rd ed. Oxford University Press / Sinauer; 2021.',
      'Campbell WW, Barohn RJ. DeJong\'s The Neurologic Examination. 8th ed. Philadelphia: Wolters Kluwer; 2020.',
      'Baugh RF, Basura GJ, Ishii LE, et al. Clinical practice guideline: Bell\'s palsy. Otolaryngol Head Neck Surg. 2013;149(3 Suppl):S1–S27.',
      'Beck RW, Cleary PA, Anderson MM Jr, et al. A randomized, controlled trial of corticosteroids in the treatment of acute optic neuritis. N Engl J Med. 1992;326(9):581–588.',
    ],
    review: DRAFT,
    accreditation: null,
  },

  /* ======================================================================= */
  {
    id: 'haemodynamics',
    title: 'Haemodynamics from first principles',
    blurb: 'Preload, afterload, compliance and the valve lesions that make ejection fraction lie.',
    levels: ['student', 'resident'],
    specialty: 'Physiology · Cardiology · Anaesthesia',
    minutes: 60, maxHours: 1, passMark: 0.75,
    accent: 'volume',
    objectives: [
      'Predict how preload and contractility move the pressure–volume loop.',
      'Predict the effect of afterload on stroke volume and end-systolic volume.',
      'Explain pulse pressure in terms of stroke volume and arterial compliance.',
      'Recognise valve lesions in which ejection fraction misrepresents forward flow.',
    ],
    activities: [
      { ref: 'cardio/lesson/preload' },
      { ref: 'cardio/lesson/afterload' },
      { ref: 'cardio/lesson/compliance' },
      { ref: 'cardio/lesson/failure' },
      { ref: 'cardio/lesson/valve-lesions' },
      { ref: 'cardio/lesson/right-heart' },
    ],
    questions: [
      q('hd1a', 0, 'a', 'End-diastolic volume increases while contractility and afterload are held constant. What happens to the pressure–volume loop?',
        ['It widens to the right: stroke volume rises and end-systolic volume barely changes', 'It narrows and shifts left', 'End-systolic volume rises and stroke volume falls', 'The ESPVR becomes steeper'], 'a',
        'With the same ESPVR and arterial elastance, the loop ends at nearly the same end-systolic point. The extra filling therefore becomes extra stroke volume, which is the Frank–Starling mechanism.'),
      q('hd1b', 0, 'b', 'A positive inotrope is given. How does the pressure–volume loop change?',
        ['The ESPVR becomes steeper, end-systolic volume falls and stroke volume rises', 'The EDPVR becomes steeper', 'Only end-diastolic volume increases', 'Arterial elastance falls'], 'a',
        'Contractility is the slope of the end-systolic pressure–volume relation. A steeper slope lets the ventricle empty to a smaller volume against the same load.'),
      q('hd2a', 1, 'a', 'Systemic resistance rises acutely while contractility and preload stay the same. What is the effect?',
        ['End-systolic volume rises and stroke volume falls', 'Stroke volume rises', 'End-diastolic volume falls immediately', 'The ESPVR rotates upwards'], 'a',
        'A steeper arterial elastance line meets the unchanged ESPVR at a higher pressure and a larger volume. The failing heart, whose ESPVR is flat, loses the most stroke volume.'),
      q('hd2b', 1, 'b', 'Effective arterial elastance (Ea) on a pressure–volume diagram is best estimated as which of the following?',
        ['End-systolic pressure divided by stroke volume', 'Stroke volume divided by end-diastolic volume', 'Mean arterial pressure divided by cardiac output', 'End-diastolic pressure divided by end-diastolic volume'], 'a',
        'Ea ≈ Pes/SV. It lumps resistance, compliance and heart rate into one load that can be compared directly with ventricular elastance (Ees). Option c is the definition of SVR.'),
      q('hd3a', 2, 'a', 'The aorta stiffens with age while stroke volume and systemic resistance are unchanged. What happens?',
        ['Pulse pressure widens while mean pressure changes little', 'Pulse pressure narrows', 'Mean pressure rises sharply while pulse pressure is unchanged', 'Diastolic pressure rises'], 'a',
        'Less compliance means each stroke volume produces a larger pressure swing. This is isolated systolic hypertension, which the "aorta as a buffer" experiment reproduces by changing one parameter.'),
      q('hd3b', 2, 'b', 'To a first approximation, pulse pressure is proportional to which of the following?',
        ['Stroke volume divided by arterial compliance', 'Cardiac output multiplied by resistance', 'Heart rate divided by stroke volume', 'Venous return divided by compliance'], 'a',
        'ΔP ≈ SV / C. Cardiac output multiplied by resistance gives mean pressure, not pulse pressure.'),
      q('hd4a', 3, 'a', 'A patient with severe mitral regurgitation has an ejection fraction of 70%. How should this be interpreted?',
        ['Forward stroke volume may be low because much of the ejection goes back into the left atrium', 'Left ventricular function must be normal', 'The regurgitation must be mild', 'Cardiac output is necessarily raised'], 'a',
        'The low-pressure leak lets the ventricle empty well, so EF is inflated. In significant mitral regurgitation, an EF that would be normal for anyone else can mean the ventricle is already failing.'),
      q('hd4b', 3, 'b', 'How does severe aortic stenosis change the left ventricular pressure–volume loop?',
        ['LV systolic pressure is much higher than aortic pressure, so the loop is tall', 'The loop has no isovolumic phases', 'LV systolic pressure is lower than aortic pressure', 'The loop becomes wider with a larger stroke volume'], 'a',
        'The ventricle must generate the transvalvular gradient in addition to aortic pressure. Isovolumic periods persist because the valves still open and close on pressure.'),
    ],
    references: [
      'Burkhoff D, Mirsky I, Suga H. Assessment of systolic and diastolic ventricular properties via pressure-volume analysis: a guide for clinical, translational, and basic researchers. Am J Physiol Heart Circ Physiol. 2005;289(2):H501–H512.',
      'Magder S. Volume and its relationship to cardiac output and venous return. Crit Care. 2016;20:271.',
      'Hall JE, Hall ME. Guyton and Hall Textbook of Medical Physiology. 14th ed. Philadelphia: Elsevier; 2021.',
    ],
    review: DRAFT,
    accreditation: null,
  },
];

export const moduleById = (id) => MODULES.find((m) => m.id === id) || null;

/** Questions for a test, in a fresh random order with shuffled options. */
export function buildTest(mod, form, rnd = Math.random) {
  const shuffle = (a) => {
    const x = [...a];
    for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
    return x;
  };
  return shuffle(mod.questions.filter((qq) => qq.form === form))
    .map((qq) => ({ ...qq, options: shuffle(qq.options) }));
}

export function scoreTest(questions, answers) {
  let correct = 0;
  const byObjective = {};
  for (const qq of questions) {
    const ok = answers[qq.id] === qq.answer;
    if (ok) correct += 1;
    const o = byObjective[qq.objective] || (byObjective[qq.objective] = { n: 0, ok: 0 });
    o.n += 1; if (ok) o.ok += 1;
  }
  return { correct, total: questions.length, score: questions.length ? correct / questions.length : 0, byObjective };
}
