# ADR-017 — Stations: one test and its mechanism on one clock

Status: Proposed; step 1, the ECG station's Explore mode (#50); step 2, ECG signs, Predict and Identify  
Date: 2026-10-18  
Repository: ClinicalPhysiologyLab

## Context

The app meets a patient in two ways today.

- **The Physiology chapters** start from a mechanism. Each lists, under "Observed through", the tests that measure it. A learner can read why the T wave peaks in hyperkalaemia, but does not see a T wave while reading it.
- **The free patient** lets the learner change any parameter. To see what changed, they must then examine the whole patient, and the mechanism stays in another layer.

What is missing is the reverse direction: **start from one examination, and see the physiology that produces it, live and side by side**. A learner who wants to understand the ECG, or heart sounds, should be able to stay on that one test, move the parameters that change it, and see at every instant which part of the heart is doing what.

## Decisions

### 1. A station pairs one test with the mechanism that writes it

A **station** is a screen with three panes on one clock:

| Pane | What it shows | ECG station |
|---|---|---|
| **Signal** | What the clinician perceives, drawn by the test's own renderer | Leads II and V1 on paper, from the running heart's dipole |
| **Mechanism** | What generates the signal, drawn from the model | The conduction system and the cardiac vector at the cursor; a conduction ladder under the strip |
| **Settings** | Only the parameters that move this test | Rate, rhythm, AV and bundle-branch conduction, chambers, ischaemia, repolarisation, potassium |

A **cursor** moves through the signal and the mechanism together. Tap the QRS and the ventricles light up; tap the T wave and they repolarise. The explanation underneath is written for that moment and that patient.

### 2. Derived, not authored

As everywhere in the app, the station reads the models; it does not draw what a text says.

- **The signal** is the test's own measurement. The ECG station records the dipole through standard electrodes (`measurements/ecg.ts`), as the 12-lead does.
- **The mechanism** is the model's own state at the cursor. The electrical model now keeps a log of each activation (atria, AV node, ventricles, a late chamber behind a blocked bundle, repolarisation), in the same clock as the dipole samples. The station asks it what was happening at any instant of a recorded strip. The arrow is the recorded dipole at that instant, not a drawn direction.
- **The settings** come from the test's measurement: the parameters of every model whose variables it measures. The 12-lead measures `electrical.*`, so the electrical model's parameters are offered, grouped as the Model Lab groups them. `electrical.EK` depends on plasma potassium, so the potassium clamp is listed with it. The named starting points are the electrical model's existing presets.
- **The explanations** are the only authored part. They are written per phase and per situation (normal conduction, a blocked bundle, pre-excitation, an ectopic beat, high or low potassium, ischaemia), in English and German, and selected by what the model is doing.

### 3. Three modes, each harder than the last

1. **Explore:** change a setting, watch the signal and the mechanism change. (Step 1.)
2. **Predict:** before a change plays, the learner says what will happen. (Step 2.)
3. **Identify:** a hidden change has been made to a healthy heart. The learner names the signs, then the mechanism. Scoring reuses the observe-only debrief: named and there, there but not named, named but not there. (Step 2.)

### 4. Where stations live

- A **Stations** section on the Ward, next to the free patient.
- Later, an "Open in station" link on each teaching card, and from the debrief, the station opened on the case's own patient ("this is your patient's ECG, and here is why").
- The teaching card's unused `animation` field can point at a station.

### 5. Signs on investigations need the knowledge tables

Identify scores signs, and signs live in the knowledge tables (ADR-016). Today those tables define signs on bedside observables only; the ECG investigation reports rate, PR, QRS, QTc and axis, and nothing about morphology. Step 2 therefore adds ECG observables (the machine measurements, and morphology the model knows exactly: an R′ in V1, a delta wave, peaked T, U waves, ST shift by lead) and ECG signs defined on them. No sign is defined inside a station.

### 6. Heart sounds must be timed by the circulation first

The auscultation station would show a Wiggers diagram (pressures and valve events from the circulation, which computes them every 0.5 ms) next to the phonocardiogram. Today the phonocardiogram is timed by a rule of thumb from a qualitative finding (`render/phono.ts`: systole ≈ 0.45 × cycle, a fixed 20 or 50 ms split). Side by side, the two would disagree. So before the auscultation station, the timing of S1, A2, P2, S3 and S4 comes from the model's own valve events, and respiratory splitting from the breath's effect on right-heart filling, grounded in human data under rule 1.

### 7. How step 2 was built (added with it)

- **An investigation can reveal observables.** `InvestigationDef.reveals` names them; the knowledge layer then treats the investigation as a test (`contextsFor`, `testsForSign`, `signsTestLooksFor`), in no context. `ecg-12` reveals `ecg.reading`.
- **`ecg.reading` is a measurement of the tracing** (`measurements/ecg-reading.ts`). The heart is recorded again from what drives it now (its parameters, the rate it is driven at, potassium and calcium), so readings are deterministic and the same in the live app, in settled tests and in every case. Amplitudes are measured on the recorded leads against the T–P baseline, at the model's own fiducials: P (only where nothing ventricular overlaps it), QRS shape in V1 and V6, ST at the J point, T height, a U wave as a wave of its own, Sokolow–Lyon voltage. Intervals are the model's own.
- **ST is read at the J point**, where the Fourth Universal Definition of MI measures it. At J + 60 ms a fast heart's T wave already rises, and ten cases with sinus tachycardia read as ST elevation.
- **Signs are rows in `signs.json`** with standard thresholds (Thygesen 2018, Sokolow and Lyon 1949, the AHA/ACCF/HRS statements of 2009), two named predicates for leads that look at the same wall, and six syndromes (bundle branch blocks, pre-excitation, the second- and third-degree blocks).
- **In the encounter (step 2b):** an investigation's result records the observables it reveals, as they were when it was taken (`revealed` on the result event). The ECG's reading is taken through the electrodes where the learner put them, so reversed arm leads read as inverted T in I and a moved axis, as on the tracing. After the result, the guided level names its signs and the observe-only level offers them to name; the debrief reads them from the result (`signsInResult`).

### 8. How step 4 was built (added with it)

- **The signal** is the heart-sounds finding at the chosen site and context, timed beat by beat. Each beat's sounds run from its own S1 to the next beat's S1, so the split moves with breathing and S1 with an irregular rhythm.
- **The mechanism** is a Wiggers diagram of the beat at the cursor, drawn from the circulation's 2 ms samples. These now carry atrial activation, the right heart's valve flows and its volume. The live patient keeps its last ten beats.
- **Phases come from flows, not times.** A valve is open while blood passes forward, leaking while blood passes back. Between the first and last diastolic flow the inflow valve counts as open, even while flow pauses. Each side is read from its own valves.
- **Starting points are patients, named by what they reach.** Each is a few haemodynamic parameters on a healthy adult, named by the guideline category its circulation reaches by the guideline's own measure, and a test checks it.
- **Event timing, fixed in the circulation:**
  - mitral opening is the first opening after A2;
  - S1 is the closure belonging to the beat;
  - an event in a beat's last step keeps its time;
  - lead II holds its value between drains.

### 8b. The auscultation station revisited (owner, 2026-10-21)

- **The site is chosen on the chest.** The station now shows the thorax view of the examination, cropped to the chest, with the stethoscope where it lies. A tap moves the stethoscope to the nearest of the five cardiac areas; the arrow keys step through them. In Explore the areas are marked faintly; in Identify they are not, since finding them is part of the task. The dropdown is gone.
- **The sound stays on.** Once switched on, it follows the site, the bell, the position, the breathing and the heart without being switched on again, so two sites or two hearts can be compared by ear.
  - The page has one audio context, resumed on each start. A browser plays a context only if it was created or resumed in a tap; the old code made a new one whenever the heart changed, outside a tap, and that one stayed silent.
  - The loop changes its sound where the cycle playing ends, so the rhythm does not break.
- **The timing after a change** (it raced, then slowed) had two causes:
  - **Settling played on screen.** The station ran the 20 s of settling at eight times real time on screen. It now runs them out of sight, as fast as they compute (a fraction of a second), while the last picture stays dimmed; then the new heart plays in real time.
  - **Beats went missing.** `LivePatient.advance` recorded a beat only at the end of each step. A step longer than a beat (eight-times speed, or a slow frame) dropped all but the last, so the strip had gaps and the cursor jumped. It now advances in steps of at most 0.2 s, and a test checks that 1.5 s steps keep every beat.

### 9. How the eye station was built (added with it)

- **One station for one examination, not one test.** The eye examination reads several observables (pupils, lids, ductions, alignment, nystagmus, head impulse, pursuit, fields), so `StationDef` gains `alsoTests`, and the settings are derived from all of them: the vestibular loss and the lesions of the nervous-system graph.
- **No clock of its own.** The eyes need no running circulation. The eye view the encounter uses draws them from the examination model's findings; the mechanism diagram is drawn every frame from that same scene, so its traces are the animation's own.
- **Starting points are lesions**, each naming the textbook signs it should bring; a test checks the model brings them.
- **Model changes made for it:**
  - the cover test also looks up and down, and the alignment model gives the vertical deviation in each gaze: a nerve palsy's grows in the weak muscle's field, a skew deviation's does not;
  - `skew-deviation` now needs that comitance, and a new sign, `vertical-tropia`, names the incomitant one, so a fourth nerve palsy is no longer called a skew (Brodsky 2006);
  - `fixed-dilated-pupil` now needs the pupil to be dilated (≥ 5.5 mm in room light), so a blind eye's pupil is an afferent defect, not this sign;
  - the scene can hold the lids up and show slow pursuit; a paretic eye can rest beyond its voluntary range (the third nerve's down and out).

### 9b. The ECG station revisited: all twelve leads, the electrodes, the axis (owner, 2026-10-21)

**Owner:** "only two leads at the same time visible?"; "the thorax view with the leads would be nice to be integrated"; "there is really nowhere where axis is taught … no Cabrera circle?"

- **All twelve leads, and the electrodes.** Explore now includes the examination's own electrode view (`mountEcgPlacement`, `app/focus-ecg.ts`): the patient's chest and limbs with the ten electrodes at the standard positions, and its live twelve-lead monitor, fed by the station's running heart. Nothing new was drawn for it.
  - Moving an electrode changes every lead it belongs to: on the monitor, in the two-lead detail strip (now titled so), in the heart pane's lead axes, and in the axis.
  - "Print 12-lead ECG" puts the last ten seconds on paper below.
- **The axis** (`stations/ecg-axis.ts`, drawn by `render/cabrera.ts`):
  - **What is drawn:** the six limb leads on the Cabrera circle (aVL, I, −aVR, II, aVF, III), shaded by range, with the mean QRS vector (red), the loop the dipole drew through the last QRS, and the dipole at the cursor. Beside it is each lead's QRS with its net area.
  - **Where the numbers come from:** the mean vector is the recorded dipole integrated over the last QRS. Each lead's net area is that vector projected on the lead through the electrodes as they are.
  - **How it is read:** the reading is the one a machine or a reader makes: from I and aVF on Einthoven's ideal circle (I = |M| cos θ, aVF = (√3/2)|M| sin θ).
  - **Tapping a lead** shows the vector's shadow on it and puts that lead into the detail strip.
  - **The words under it** give:
    - the axis and its range (AHA/ACCF/HRS 2009: −30° to +90° normal), plus the German Lagetyp in German;
    - the signs of I and aVF;
    - the most nearly isoelectric lead.
  - **Explanations** (EN/DE, folded): what the axis is; why a lead sees what it sees (Einthoven, Goldberger, Cabrera); why it points where it points (left ventricular mass; what turns it left and right); why we measure it; and reading it in ten seconds.
  - **"See it move":** left and right ventricular hypertrophy, both bundle branch blocks, pre-excitation, and swapping the arm electrodes. When a reading differs by more than 15° from the same heart read through standard electrodes, it is flagged as the electrodes, not the heart, and the standard reading is drawn as a dashed arrow.
- **What the model gives** (`station.test`):
  - The healthy heart reads about +70°, normal. Its own mean vector in body coordinates is +46°: the model's limb leads are askew (lead I points at about −20°, aVF at about +94°; Burger's triangle is not equilateral either). The station shows both and says why. Nothing was tuned to bring them together.
  - Right ventricular hypertrophy reads about +102° (right). Left ventricular hypertrophy moves the heart's own vector only from +46° to +37°.
  - Swapping the arms turns lead I negative and reads about +110°.
- **Not in the model:**
  - fascicular blocks (left anterior and posterior);
  - an old infarct with Q waves: its infarcts are acute. The inferior infarct is therefore not among the "see it move" buttons; the text says so.

### 9c. One axis (owner, 2026-10-21: "merge it, then separate PR")

- **The axis is the standard 12-lead ECG's reading everywhere.** It is read from leads I and aVF on Einthoven's ideal circle, as a machine or a reader takes it (`axisFromIandAvf` in `measurements/ecg.ts`): I = |M| cos θ, aVF = (√3/2)|M| sin θ. This is used for:
  - the electrical model's metrics (`qrsAxis`, `pAxis`, `tAxis`; `standardAxisOf` on Dower's standard lead vectors);
  - the machine's measurement on a recorded tracing (`measuredAxis`, which had used atan2(aVF, I) without the √3/2);
  - the station's axis pane;
  - the observables' normal example.
- **The vector's own direction** in Frank's frontal plane (what a vectorcardiogram shows) is kept as `vcgAxis` and is not called "the axis". Dower's lead vectors see the chest askew (lead I at about −20°), so the two differ: healthy, 71° against 46°. The station no longer shows the second number; the "Why a lead sees what it sees" text explains the difference.
- **Against human data** (Rijnbeek 2014, 13,354 healthy Dutch adults, men 40–49, median (2nd, 98th percentile)):

  | Axis | Reference | Model | Result |
  |---|---|---|---|
  | QRS | 69° (−40, 97) | 71° | matches |
  | P | 61° (−1, 82) | 80° | within the limits but 19° above the median: known gap 33 |
  | T | 54° (−2, 81) | 72° | within the limits but 18° above the median: known gap 34 |

  The old body-frame QRS angle (46°) would have been 23° below the median. Nothing was tuned.
- **What moved:** under the one definition the presets read: LVH 59°, RVH 102°, LBBB 4°, RBBB 89°, WPW 77°, VT −104°, complete heart block's escape −63°.

### 10. The neurological examination station (owner, 2026-10-25: built in steps 8a–8c; see the handover)

**Owner:** after the arrest work, more functionality for the model: more stations, more animation and immersion. "Neurological examination station + animation seem natural candidates?"

- **What it teaches:** localisation. The same lesion graph the eye station uses (`domains/neuro/data/anatomy.js`) already drives the limb, cranial-nerve, coordination, balance and gait examination (`models/neuro-limb.ts`, `neuro-exam.ts`). A lesion is set on one rung of the ladder (cortex, internal capsule, brainstem, cord, root, plexus, nerve, junction, muscle, cerebellum), and the model derives what the hands, the hammer and the eyes find: power movement by movement (MRC), tone, reflexes and plantars, drift, dermatomes and nerve territories, vibration, cranial nerves V and VII–XII, speech, finger–nose, heel–shin, rapid alternating movements, Romberg and gait. Upper versus lower motor neuron, root versus nerve, face-and-arm-more-than-leg are emergent, not written down. Nothing in the station is authored but the explanations.
- **The three panes:**
  - **Signal:** the patient doing the test, animated on the bedside figure (below), with the finding the examination model returns, in the encounter's own words.
  - **Mechanism:** the pathway the test reads, from cortex to muscle, with the lesion on it and the reason the model gives (`basis`: "upper motor neuron", "motor strip partly spared", "L5 root", "cerebellar vermis").
  - **Settings:** the lesions, as the eye station has them, grouped by rung and side; and the starting points.
- **One station for one examination, not one test,** as for the eyes (decision 9): `StationDef.alsoTests` lists the limb, cranial-nerve, coordination and gait tests.
- **Starting points are lesions,** each naming the textbook signs it should bring, checked by a station test. Candidates (the graph has cortex, capsule, brainstem, cord tracts by level, roots, plexus, nerves, junction and muscle): left MCA stroke, internal capsule lacune, cervical cord (Brown-Séquard), L5 root, common peroneal nerve (foot drop: inversion separates them), C7 root, ulnar nerve, myasthenia (fatigue), proximal myopathy, cerebellar hemisphere, vermis, posterior columns (Romberg), and normal. A starting point whose signs the model does not bring is reported as a gap, not drawn as if it did.
- **Predict and Identify,** as at the other stations, scored on the knowledge tables' neurological signs; Identify asks for the signs, then the level of the lesion.

**The animations, on the bedside figure (`render/patient-figure.ts`), one renderer for two uses:** the teaching card shows how the test is done (on a normal finding), and the result shows this patient's (on the patient's finding), in the station and in every ward case, where these tests answer with text today (`visualFor` in `app/app.ts`).

- **Driven by findings, never by the lesion,** as every visual in the app is: the knee jerk's swing comes from the reflex grade, the drift from `arm.drift`, the overshoot and the tremor from `dysmetria` and `intentionTremor`.
- **The skeleton is posed, not the outlines** (the figure's brief): `Pose` gains what the tests need, kept to the figure's style and checked at zoom.
- **First (step 8a):** pronator drift (arms out, palms up, eyes closed; the weak arm pronates and sinks), finger–nose (the finger's path to the nose, with dysmetria and the intention tremor that grows near the target), and the reflexes (the hammer, the knee jerk's swing by grade, absent, brisk with spread, clonus; the plantar response). The figure needs the forearm's rotation and a pointing hand for these: new, and shown to the owner at zoom before going on.
- **Then (step 8b):** heel–shin, rapid alternating movements, Romberg (eyes open and closed), gait (hemiplegic circumduction, high-stepping, waddling, ataxic broad-based, sensory-ataxic stamping).
- **Later:** tremor and asterixis (hands), which need the hands to be more than mittens (the figure's brief, "Open").
- **Respect `prefers-reduced-motion`:** a still of the result, as the figure does today.

### 11. The respiratory station (owner, 2026-10-26: "Let's do the respiratory station now!")

- **What it teaches:** the chest examination as localisation in the chest: which lobe, the pleura or the airways, and why each finding comes. The examination model (`models/resp-exam.ts`) already derives percussion, breath sounds, added sounds and vocal resonance at ten sites from the lobes beneath each (consolidated, flooded, collapsed, compressed by fluid, fallen away in a pneumothorax), and the trachea, expansion and the work of breathing from the lungs' state. Nothing in the station is authored but the explanations.
- **One station for one examination:** `StationDef.alsoTests` lists percussion, vocal resonance, expansion, the trachea, the breathing pattern, the rate and the oximeter beside the breath sounds. The settings derive from these (mechanics, gas exchange, the respiratory centre), with the left ventricle as a driver (pulmonary oedema).
- **The three panes:**
  - **Signal:** the encounter's own chest view (`app/focus-chest.ts`) for percussion, breath sounds and vocal resonance, with their sounds; the patient sitting up, framed on the head, neck and chest (colour, accessory muscles, pursed lips, barrel chest), with the oximeter, the counted rate and what the patient manages to say; the trachea under a fingertip in the suprasternal notch, placed by the mediastinal shift; two hands on the lower ribs, moved by each lung's share of the model's own breath (`render/chest-palpation.ts`). Explore adds the findings in words and a chart of the test at all ten sites.
  - **Mechanism:** the lungs in the chest's own centimetres (`render/lung-mechanism.ts`), so the lobe under a site is the lobe drawn there: each lobe coloured by what fills it in the model's proportions, a collapsed lobe shrunk toward its hilum with its bronchus plugged, fluid to the height its volume reaches, air round a fallen lung, the mediastinum moved by the same shift the trachea finding reads, airway walls thickened by bronchoconstriction, Kerley lines and reticulation at the bases; the lobes under the site outlined with their shares. The breath on one clock: volume, flow and the muscles', pleural and alveolar pressures, recorded every 20 ms by the lungs themselves (`BreathRecorder`, which only watches; a test checks it changes nothing), with the site's added sounds marked where they fall. Ventilation against blood flow lobe by lobe for the oximeter.
  - **Settings:** the derived parameters, and fourteen starting points (`stations/resp-presets.ts`) in four groups: the lung, the pleura, the airways, and heart, vessels and muscles. Each names its textbook signs; a test checks the model brings them, and that no two (nor health) look the same at the bedside, sides counted.
- **Model changes made for it:** the trachea is moved by air under tension, not by the size of a pneumothorax (gap 57); `mediastinalShift`, `SITE_LOBES` and `FLUID_REACHES` are exported so the drawing cannot disagree with the finding; `tissueVolume` is the one place the lungs' size from their tissue is computed.
- **Predict and Identify,** as at the other stations, over the knowledge tables' chest signs grouped by the test that finds each (`respSignGroups`). Identify gives the bedside only: the patient, the hands' findings drawn, the notes and sounds, no words, lungs or settings.
- **Known gaps found:** 56 (asthma's breathing response to a given peak flow), 57 (the palpable shift), 58 (pleural rub, stridor, clubbing, breathing drawn as motion).

### 12. The EEG station, part 1: how the scalp sees a source (owner, 2026-10-28/29)

**Owner:** an EEG station with the weight on what makes EEG reading hard, seizures and focal findings; part 1 the forward model, montages, spikes, artefacts and variants; then a neural mass seizure model; then ECT. Agreed order (2026-10-29): EEG 1a, then the seizure model, then ECT, then EEG 1b–1d. The head is a sphere (exact, testable); the brain-to-skull ratio is a setting with the dispute named; electrode names as ACNS (T7/T8, P7/P8) with the old names in brackets.

- **The model is the head, not a physiology model.** `measurements/eeg-forward.ts`: four concentric shells (brain, CSF, skull, scalp) with the registry's conductivities and thicknesses (`evidence/eeg.ts`: McCann 2019, Baumann 1997, Gonçalves 2003, Antonakakis 2020; radius from the sphere through the standard 10-20 template). The potential of a current dipole is the exact Legendre series (de Munck & Peters 1993; Zhang 1995), solved order by order by matching potential and current at each interface; the same coefficients give the potential inside every shell. Electrodes at the standard 10-10 spherical positions (Oostenveld 2001, the set distributed with MNE-Python); the ears from the same template.
- **A source is a patch, not a dipole.** Rings of dipoles on a sphere at the patch's depth, each with its share of the area, at Murakami & Okada's moment density, oriented by a tilt from radial and the direction it leans on the map. So area, depth and orientation decide what the scalp sees, and Tao 2005's areas become a test.
- **Montages** (`measurements/eeg-montage.ts`): ACNS Guideline 3's LB-18.1, TB-18.1, R-18.1 (ears), Cz and the average of the 19. `readField` reads a field as a reader does: the negative and positive maxima against the average, the phase reversals in the longitudinal chains (an equipotential pair counts, joined by =), the end-of-chain maximum, two poles.
- **The recording** (`measurements/eeg-record.ts`): every source a fixed field times its own time course; a channel the difference of its inputs; a first-order LFF and HFF as in an amplifier. The spike's shape follows the IFCN glossary (duration, faster rise, a slow wave of the same polarity); its proportions are drawing conventions, said so in the code.
- **The screen** (`app/station-eeg.ts`, `render/eeg-view.ts`): the page (negative up, 30 mm/s, sensitivity, LFF, HFF; four seconds around the cursor on a phone), the head from above with the scalp field at the cursor (tap to move the source), a section through the source in the plane it leans (upright, from behind) with the field in every shell, and one chain with the potential at each electrode and each channel's deflection. Explanations (`stations/eeg-texts.ts`, EN/DE, drafts) are chosen by the field: radial, oblique or tangential; reversal, equipotential pair or end of chain; a reference that is not quiet; not seen at all; spike or sharp wave.
- **Starting points** (`stations/eeg-presets.ts`): temporal (anterior, mid), right frontal sharp wave, vertex, two ends of chains (O1, Fp2), the rolandic tangential source, a basal temporal source (the ear reference active), a 4 cm² patch, a small discharge 3 cm deep. Each names what a reader would find; `scripts/eeg.test.mjs` checks it.
- **Against exact solutions and human data** (`npm run test:eeg`): the centred dipole, equal shells against one sphere, the unbounded limit, continuity at every interface, mirror symmetry; the skull smears (1:80 smaller and wider than 1:15); the rolandic field is negative centrotemporal and positive frontal (Gregory & Wong 1984); a basal temporal source makes A1 active and leaves Cz quieter (Acharya 2016's advice); 10–20 cm² gives 89–172 µV (the usual spike, IFCN glossary); a small discharge 3 cm deep is not seen (Pacia & Ebersole 1997). Known gap 59: 6 cm² gives 53 µV, where Tao 2005 never saw spikes from under 6 cm².
- **For ECT later:** the same head carries the stimulus current (reciprocity), and the electrodes include the device's monitoring sites (Fpz, AFz, TP9, TP10). The Thymatron IV manual (Rev 21) is in hand: 0.9 A constant current, 0.25–1.5 ms pulses, 10–70 Hz (140 in the low programs), 0.08–8 s, 504 mC at most; static impedance tested at 800 Hz, 100–3000 Ω; fronto-mastoid EEG.
- **Not in part 1:** Predict and Identify, the background rhythms, slowing (metabolic, focal), artefacts and benign variants, the `eeg.reading` observable and EEG signs in the knowledge tables, the EEG as an investigation in the cases. Those are parts 1b–1d.

## Steps

1. **The ECG station, Explore** (this PR): the activation log in the electrical model, with tests; the station screen with settings, strip, ladder, cursor, conduction heart and explanations in EN and DE; a Stations card on the Ward.
2. **ECG signs and the other two modes:** ECG observables and signs in the knowledge tables; Predict; Identify with the observe-only scoring. (Done; see decision 7.)
2b. **ECG signs in the encounter:** named after an ECG result in the guided level, chips in the observe-only level, credited in the debrief. (Done.)
3. **Heart sounds timed from valve events** (decision 6).
4. **The auscultation station** (done; see decision 8): Explore, then Predict and Identify, scored on the knowledge tables' heart-sound signs as found by the standard cardiac auscultation manoeuvres.
5. **Links** (done). The debrief has an "In a station" section: what the patient's ECG and heart sounds show (the tables' signs), each with a way into the station on that patient. An ECG result has the same link once spoilers are allowed. The cardiac auscultation teaching cards link to the auscultation station (`animation: "station:auscultation"` in `tests.json`).
   - A station opens on the learner's own patient only in the free lab or after commit, so the mechanism is not a spoiler. Before that, the card's link opens a healthy heart.
   - Back returns to the encounter or debrief as it was; the encounter's patient is paused, not discarded.

6. **The eye station, Explore** (done; see decision 9): pupils and lids, the swinging light, eye movements and pursuit, the cover test, nystagmus, the head impulse and the visual fields, each beside the pathway it reads. The eye as a window on the body followed (jaundice, conjunctival pallor, thyroid eye signs): those tests need the body run through the illness, so the station runs it in the background whenever a body setting changes. Predict and Identify followed, over all eye signs, with the signs offered beside the test that shows each, and starting points the examination cannot tell apart counted as equivalent (with the reason).

7. **The pulse and neck-vein station, Explore** (done): the arterial pulse and the jugular venous pressure, read from each beat's own pressures (`waves.ts`). The pulse rhythm and the venous waveform findings now come from those waves instead of a label or a parameter. Predict and Identify followed (Identify without the ECG or named waves, as at the bedside).

9. **The respiratory station** (done; decision 11): Explore, Predict and Identify in one step.

10. **The EEG station** (decision 12): 1a the forward model, montages, spikes and Explore (this PR); then the seizure model and ECT; then 1b background and slowing, 1c artefacts and benign variants, 1d EEG signs, Predict and Identify.

8. **The neurological examination station** (proposed, decision 10): 8a Explore with the first animations (pronator drift, finger–nose, reflexes); 8b heel–shin, rapid alternating movements, Romberg and gait; 8c Predict and Identify (the level of the lesion). The animations serve the ward cases too.

## Consequences

- One new screen type, reused for every station: the work for each new station is its signal renderer, its mechanism renderer and its explanations.
- The electrical model exposes its activation timeline. This adds no physiology and changes no constant; a test checks that the log agrees with the dipole and with the model's own intervals.
- Stations make the explanations into content that colleagues will review with the card texts. Like those, they stay `draft` until a clinician has read them.
