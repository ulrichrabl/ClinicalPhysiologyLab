# Handover: start here

Last updated: 19 October 2026, with the eye station's Predict and Identify (the eye station is complete). Before it: the eye station (Explore). Before it: the ADR-017 step 4 PR (the auscultation station, Explore). Earlier: 18 October 2026, with the ADR-017 step 1 PR (the ECG station). Before it, work was paused after PR #48 at the owner's request.

**Where we paused.** Nothing is in flight; every PR is merged and live. Waiting on the owner (details in "Waiting for the owner" below):

1. Four case texts the model contradicts: change the text, or fix the model?
2. Rewrite the finding texts as observations rather than diagnoses, so the observe-only level is a real test for findings shown only as text?
3. A hands-only inspection, so "look at the hands" works on a dressed patient?
4. Which next: ADR-016 step 5 (draw the signs the views do not show yet), the Evidence ADR, or animations. The owner chose stations (ADR-017); step 1 is in review.

This page is the entry point for anyone (or any agent) picking up the work. It covers:

- how to build and check the project;
- the rules agreed so far;
- what is done;
- the open lists;
- the data model for tests, signs and the knowledge graph (ADR-016), and its next steps;
- problem reports;
- where animations would start.

If you will change the patient figure, also read `source/studio/figure/BRIEF.md`.

The detail lives in the other documents linked below.

## Build, test, look

All commands run from `source/`.

| What | Command |
|---|---|
| Everything (typecheck, all test suites, smoke test, builds) | `npm run verify` |
| The virtual-patient suite only (catalog, cases, models, evidence, cards) | `node scripts/vp-model.test.mjs` (a few minutes) |
| Build the app page | `node scripts/build-vp-demo.mjs` → `dist/encounter.html` (fragment) and `dist/lab.html` (standalone) |
| Serve `dist/` locally | `PORT=8123 node scripts/serve.mjs` |

Notes:

- **Screenshots:** Python Playwright with the preinstalled Chromium works. Use `dist/lab.html` for phone-width checks. `encounter.html` is a fragment without a viewport tag, so it renders at 980 px on a phone emulator.
- **Test output:** the suite ends with "N passed, M failed, K known gaps".
  - A known gap (△) is a comparison with measured data the model does not yet meet. It is reported with its numbers and does not fail the suite.
- **Built page in git:** `dist/index.html` is tracked although `dist/` is ignored (`git add -f`). A rebuild with no source change differs only in `__BUILD_ID`; do not commit that.
- **Vendored `node_modules`:** `source/node_modules` is in git and holds macOS binaries, and no TypeScript.
  - On Linux run `npm ci --ignore-scripts` in `source/` first. Without it, esbuild fails ("installed esbuild for another platform"), and `npx tsc` picks up whatever TypeScript is installed globally, whose stricter defaults report false errors. CI does the same.
  - `npm run verify` may touch files under `node_modules` and `dist`. Before committing, run `git checkout -- source/node_modules source/dist` and commit source files only.
- **Deploy:** every push to `main` runs `.github/workflows/deploy.yml`. It runs `npm run verify`, builds `dist/lab.html` and publishes it to the `gh-pages` branch, which GitHub Pages serves. A merge is live a few minutes later.
- **Pictures for PRs:**
  - `studio/figure/out/` is ignored by git.
  - Before/after images live on the orphan branch `figure-anatomy-images` and are linked from PR bodies as `https://raw.githubusercontent.com/ulrichrabl/ClinicalPhysiologyLab/figure-anatomy-images/<folder>/<file>.png`.
- **GitHub from an agent:** the REST API through `gh api` works (`GH_TOKEN=placeholder gh api repos/ulrichrabl/ClinicalPhysiologyLab/pulls -f title=… -f head=… -f base=main -F body=@file`). GraphQL, so most `gh pr …` commands, is blocked.
- **Branches:** always branch from a freshly pulled `main`. The owner merges quickly, and pushing to a merged branch's head does nothing.

## Rules agreed so far

1. **Ground the model in human data.**
   - Constants live in the registry (`src/vp/evidence/`), each with a status and references.
   - Fit to measured data once, then validate against outcomes not used for fitting.
   - Report mismatches as known gaps, with the numbers. Never tune a constant to make an expected answer come out, and never loosen a test.
   - Do not extrapolate a fitted relation beyond its measured range.
2. **Every learner-facing text in English and German.** This covers case texts, labels, phrases and teaching cards. The validator and tests fail on a missing language. Adding a language means adding data, not code.
3. **Every examination has a teaching card.** Every manoeuvre also sits in exactly one exam section. A card's links to conditions are checked against the cases (see below).
4. **Workflow:**
   - Work on a branch, run `npm run verify`, open a PR, then merge.
   - Commit messages end with the `Co-Authored-By` and `Claude-Session` lines.
   - PR bodies end with the Claude Code line and the session link.
5. **Parked; do not start unasked:** psychiatry and dermatology.

## What is done

| Area | Where to read more |
|---|---|
| Evidence registry; circulation, baroreflex, sepsis, kidney, lungs, ECG and examination thresholds on measured data (PRs #13–#20) | `docs/evidence-grounding-status.md` |
| Examination organised by system and section in clinical order; search as you type; interventions separated (#22) | `docs/examination-and-teaching.md` |
| Teaching cards for all 109 examinations in EN/DE; standard names (#23). Since ADR-016 step 2 they are built from the knowledge tables, and every sign has its own card | `docs/examination-and-teaching.md`, `source/knowledge/` |
| Cards checked against the cases (#24) | test section "Teaching cards against the cases" |
| Patient figure redrawn as an anatomical body: skeleton + outlines, body shape from the patient and the model, gown, hair, trolley (#26–#30) | `source/studio/figure/BRIEF.md` |
| Figure seen from the right, the front (foot of the bed) and the left, with Right / Front / Left buttons in the app; the chest examination views are drawn from the same body (#31) | BRIEF, "How the figure is built" |
| Anatomy from the front: shoulders (clavicle, acromion, deltoid), pectorals, breasts in a bra; arms hang beside the chest (#31, #33) | BRIEF, "Anatomical decisions" |
| Live ECG: a 12-lead monitor that follows the electrodes while they are dragged; a bedside lead II strip; "Print 12-lead ECG"; a measuring tool with calipers, ruler and guided steps (#32) | "The ECG view" below |
| Knowledge tables, ADR-016 step 1: 202 signs defined on the observables, 25 syndromes, links to conditions, EN/DE labels; schema, validator, queries (`explore`, `signsForCondition`, `testsForSign`); every case read for every sign; sign links checked against the cases; no interface change yet | `source/knowledge/README.md`, `docs/knowledge-coverage.md` (`npm run knowledge:report`) |
| ADR-016 step 3: tests named as tests (14 renamed; old names searchable); after each test the feed names the signs it found, with side, normal variants and pertinent negatives; general inspection names what the figure shows; signs found so far in Notes | `docs/examination-and-teaching.md`, "Signs in the encounter" |
| Owner decisions on the ADR-016 open points (#44): grounded thresholds; diagnoses carry a `kind` (syndrome, state, lab finding) and the debrief says "right level, name the cause"; sepsis by qSOFA; mitral stenosis and the Austin Flint rumble split; hypothermia < 35 °C; one test for tremor and asterixis; the septic-shock case meets Sepsis-3 | "Tests, signs and the knowledge graph" below |
| Notes grouped by the exam section of the test that produced each finding (#43) | `engine/notes.ts` |
| Report button: point at a problem, comment, get the full state as a file or a pre-filled GitHub issue; replay script (#45) | "Problem reports" below |
| Command line: 129 everyday phrasings in EN and DE understood, and kept as a test (`scripts/data/typed-commands.json`) (#46) | `engine/language.ts` |
| ADR-016 step 4: expert references and the debrief in signs (#47); the observe-only level, with misses and over-calls scored (#48) | "Tests, signs and the knowledge graph" below |
| ADR-017 step 1: the ECG station, Explore. One test and its mechanism on one clock: strip (two chosen leads) and conduction ladder, a cursor through the beat, the heart and the cardiac vector in both planes at the cursor, explanations in EN/DE; settings derived from what the 12-lead measures. The electrical model logs its activations for it | "Stations (ADR-017)" below |
| The eye station, Explore: the whole eye examination with the pathway each test reads; skew deviation told from a nerve palsy by comitance | "Stations (ADR-017)" below |

## Open lists

- **Physiology known gaps (17).** See `docs/evidence-grounding-status.md`, including the suggested order. Start with the cardiopulmonary reflex. Gaps 10–12 came with the heart sounds timed by the circulation (ADR-017 step 3); gap 13 with the respiratory pump (step 3b); gap 14 (oxygen-induced hypercapnia) replaced a judgement margin in the COPD oxygen test; gap 15 with length-dependent systole; gap 16 (the pump fills the right ventricle a quarter as much as real-time MRI shows) is upstream of 12, 13 and 15 and should be fixed first; gap 17 (moderate mitral stenosis silent at the bedside) came with the auscultation station's Identify mode. That work is parked (owner, 2026-10-19), with its order in the suggested-order list: the breath waveform is ready on the branch `breath-waveform` but moves five other results, so it is not merged. Each ventricle now has its own activation clock: its relaxation comes later on a beat it starts fuller than its recent filling (`CIRC.systoleLengthGain`, fitted to Curtiss 1975). The host re-anchors that reference whenever it equilibrates. Each `beatLog` entry records where in the breath its P2 fell (`breath`), when the beat began (`t0`) and when RV pressure began its rapid fall (`rvRelax`). To compare inspiration with expiration, classify beats by `breath` (P2 in late inspiration vs late expiration), not by the pleural pressure of the beat's window. Since the pump, single beats differ through each breath: examinations read `metricsBreath` (each beat's values averaged over about a breath), the monitor and the body still read the last beat.
- **Signs the model cannot produce yet** (from the card check):
  - Heart: loud P2 in pulmonary hypertension; tricuspid regurgitation murmur; narrow pulse pressure in aortic stenosis.
  - Lungs and veins: pleural rub; deep vein thrombosis.
  - Mouth and breath: glossitis and angular cheilitis; fetor hepaticus; uraemic fetor.
  - Ketoacidosis and volume: tachypnoea in ketoacidosis (only depth rises); an empty JVP in hypovolaemia (RAP 2 mmHg reads as normal).

  Each is listed with its reason in `scripts/vp-model.test.mjs` (`CARD_EXCEPTIONS`). When one is fixed, the test tells you to remove it from the list.
- **Conditions the cards link to that have no case** (324 links), most linked first:
  - acute heart failure;
  - pneumothorax;
  - pleural effusion;
  - multiple sclerosis;
  - lung cancer;
  - B₁₂ deficiency;
  - cerebellar stroke;
  - motor neurone disease;
  - lateral medullary syndrome;
  - myasthenia gravis;
  - Guillain–Barré syndrome.

  Each new case makes more of the cards checkable. Some of these links point to broader diagnoses than the case's primary one; for example, the GI-bleed case is `peptic-ulcer-bleed`, while cards say `upper-gi-bleed`. Letting a case count for its broader diagnosis too would make more of those links checkable.
- **Card content review.** The card texts are standard clinical teaching, written but not yet read by a clinician, the German especially. References are cited only where a threshold rests on a study. Deferred by the owner until colleagues are involved (see the ADR-016 section).
- **Review modes.** Spaced repetition, and matching tests to conditions, can be generated from the cards (see `docs/examination-and-teaching.md`); none is built.
- **Patient figure:** see "Open" in `source/studio/figure/BRIEF.md`. In short:
  - The owner reviews the figure closely and judges anatomy above all, the front view especially. Show close-ups before claiming a fix.
  - The side view still draws the arm's deltoid with its own outline over the trunk.
  - The gown has no bust shaping from the front.
  - Hands are simple.
- **ECG view:** see "The ECG view", Open, below.

## The patient figure

It was redrawn in PRs #26–#33. It is anatomical, shows each patient's body and what the illness does to it, and is seen from three sides. All of its code is in `source/src/vp/render/` (`patient-figure.ts` and `figure-*.ts`).

To work on it, read `source/studio/figure/BRIEF.md`. It covers how the figure is built, the anatomical decisions agreed with the owner, the contract with the app, the screenshot loop and the open list. `studio/figure/contract.test.mjs` is part of `npm test`.

## The ECG view

Tapping the chest and choosing the 12-lead ECG opens the electrode-placement view (`app/focus-ecg.ts`). The learner drags the electrodes onto the chest (`render/thorax.ts`, drawn from the patient figure).

### The live monitor

`render/ecg-monitor.ts` shows the 12 leads sweeping like a bedside monitor, in 4 columns or 2 on a phone. It projects the running heart's dipole (`LivePatient.vcg`, 500 Hz) through the electrodes *as they are now*:

- `measurements/ecg.ts` `leadVectorsOn(partialPlacement)` gives null for a lead whose electrodes are not all placed. That lead shows "Lead off".
- Dragging an electrode changes its leads while it moves.
- With no right-leg electrode, mains hum appears.

The monitor high-pass filters the baseline, as real monitors do, so ST segments on it are approximate. The caption says the printed ECG is the record.

### The bedside strip

Once any electrode is on, a small lead II strip runs next to the patient (`#bed-monitor` in `app.html`, `renderBedMonitor` in `app.ts`). Tapping it opens the ECG view.

### Printing

"Print 12-lead ECG" records the paper: 25 mm/s, 10 mm/mV, the layout in `render/ecg-paper.ts`. `paperGeometry()` maps paper mm to samples.

### The measuring tool

`app/ecg-measure-tool.ts` opens from "Measure: calipers, ruler, squares" on a printed ECG.

- **Tools:** calipers that count small squares (40 ms) and big squares (200 ms); a draggable ruler in mm, cm and seconds; magnify at Fit, 2× or 3×.
- **Guided steps, in EN and DE:**
  - rate: 300 ÷ big squares, 1500 ÷ small squares, or complexes × 6;
  - rhythm: R–R spread;
  - PR;
  - QRS;
  - QT → QTc: Bazett, worked with the learner's own R–R;
  - axis: quadrants from I and aVF.
- **"Show me":** moves the calipers onto fiducials from `measurements/ecg-measure.ts` `delineate()`, then reveals the machine's value.
  - QRS onset and offset are detected on the tracing: spatial slope, with notches bridged so bundle branch block is measured whole.
  - P onset and T end come from the model's own PR and QTc, anchored to the detected QRS onset.
  - Tests cover RR, QRS width for normal, LBBB and complete heart block, axis quadrants, and AF having no P.

### Open

- Lead II is the only bedside strip; the lead cannot be chosen.
- P onset and T end are not detected on the waveform.
- The measuring tool works on the rhythm strip and the 12 leads at fixed paper speed and gain. 50 mm/s and 20 mm/mV are not offered.
- The owner has not yet reviewed the measuring steps' wording clinically.

## Tests, signs and the knowledge graph (ADR-016)

Agreed with the owner: tests and signs are separate, each sign is defined on the model's observables, and the clinical knowledge lives in tables (`source/knowledge/`) that colleagues can later edit through a backend. The physiology stays in code.

- **Read first:** `docs/adr/ADR-016-tests-signs-knowledge.md` (decision, migration) and `source/knowledge/README.md` (how to edit the tables).
- **Done:**
  - step 1, the tables, validator and coverage (#37);
  - step 2, cards built from the tables, with presentations and a card for every sign (#39);
  - step 3, the interface: tests named as tests, signs named after each test, signs in Notes (#40);
  - the owner's decisions on the open points (#44);
  - step 4a, references and debrief in signs (#47), and step 4b, the observe-only level (#48), both below.
- **Coverage:** `npm run knowledge:report` writes `docs/knowledge-coverage.md`. It lists every sign with its definition, the tests that elicit it, where the app shows it, which cases show it, and its gap.
- **Step 4a, done:** the expert references speak in signs, with a side and pertinent negatives (`present: false`).
  - 56 of the 65 property items became sign items. The rest stay property items where a number or context is the point (SpO₂ on air, the murmur's radiation, the leg's relative sparing, a clear chest), or where the case text and the model disagree (below).
  - The debrief reads each test's own recorded findings (`signsShown` in `engine/debrief.ts`). A sign is credited when a test showed it, on its side; a pertinent negative when a test looked for it and did not find it.
  - A sign that needs two tests (unidirectional nystagmus: eye movements, then Frenzel) is credited from everything the learner saw.
  - The debrief names the sign, the test that showed it, or the tests that would have.
  - Two tests check the references: every reference sign is true of its case, and an examiner who does the right tests is credited with every one.
- **Case texts the model contradicts** (kept as property items until decided):
  - pneumonia "hypoxaemia": SpO₂ 94 % on air;
  - GI bleed "tachycardia from the volume lost": pulse 79 (known gap 1);
  - iron-deficiency anaemia "a resting tachycardia": pulse 75;
  - thiazide hyponatraemia "a slightly dry mouth": mucosa moist.
- **Step 4b, done:** the "observe only" level. On the ward the learner chooses who names the signs: *The app names them* (as before) or *You name them*.
  - Observe only: after each test the feed offers the signs that test can show, as chips, without saying which are there. The learner picks what they saw; the Notes tab lists what they named and searches every sign.
  - Each name is a `sign-named` event in the encounter.
  - The debrief adds *Your documentation*: what was named and there; what was there and not named, with the test that showed it; and what was named but shown by no test the learner did (an over-call). An over-call names the normal finding it was, when there was one: gaze-evoked nystagmus that was end-point nystagmus.
  - `documentation()` in `engine/debrief.ts`.
  - **Limitation:** the observation texts still name some signs ("Pale conjunctivae", "end-point nystagmus … physiological"). Observe only is strongest where a view shows the finding: the eyes, face, heart and lung sounds, pulse. Writing the texts as observations rather than diagnoses is a later step.
- **Waiting for the owner:**
  - **Case texts the model contradicts** (the four above): change the text, or fix the model? Changing the model means grounding it in human data, never tuning it to the text.
  - **Finding texts that name the sign** (the limitation above): rewrite them as observations? This is a content job across the formatters and the case layer.
  - **"Look at the hands"** runs the merged skin, hands and chest-wall inspection, which needs the chest and abdomen uncovered, so on a dressed patient it answers "still covered". A hands-only inspection would fix it, but it reopens the owner's decision to keep that inspection merged.
- **Next, step 5** (when the owner chooses it): the model gaps the coverage lists. These include:
  - jaundice, pallor and cyanosis missing from the eye close-up;
  - limb ataxia with the eyes closed, which no test elicits;
  - the resting deviation drawn in the eye close-up but absent from the text;
  - warm septic shock with a narrow pulse pressure (70/45); the case no longer claims a wide one;
  - the visual fields, fundus, dermatomes and gait, which have renderers declared but none drawn.
- **Decided by the owner** (ADR-016, "Open points", #44): the thresholds, the reclassification of syndromes, states and laboratory findings (with a `kind` on each diagnosis and a "right level, name the cause" debrief), the two card texts, and one test for tremor and asterixis.
- **Deferred until colleagues are involved** (owner, 2026-10-17): the clinical read-through of the card texts (the German especially) and of the ECG measuring wording. Every text row stays `draft` until then. A review page (claude.ai artifact "Card Text Review", private to the owner) lists all 389 items in EN and DE and records marks and notes in its own store; refresh its data before the review starts.
- **Statistics** (sensitivity, specificity, likelihood ratios) go into a separate Evidence domain, linked from the sign cards. It gets its own ADR.
- The review drafts in `docs/adr/adr-016/` and `ADR-016-inventory.md` are superseded by `source/knowledge/` and `docs/knowledge-coverage.md`, and are kept as the record of the review.

Animations (below) should hang on signs: the card of a test and the sign it shows.

## Stations (ADR-017)

A station pairs one test with the mechanism that writes it, on one clock. Read `docs/adr/ADR-017-stations.md`.

- **Where:** a "Station" card on the Ward opens `#station` (`app/station-ecg.ts`). It runs its own healthy patient.
- **The activation log:** `HeartElectrical.activations` records every atrial and ventricular activation (P end, conducted or why not, route, late chamber, delta onset, J point, T), on the clock of the dipole samples (`sampledTo`). `LivePatient.recording()` returns the dipole with its activations. Nothing in the log shapes the dipole.
- **The timeline:** `stations/ecg-timeline.ts` reads the log: the phase at any instant, and the state of the atria, AV node, bundles and ventricles.
- **Derived settings:** `stations/station.ts`: the parameters of the models the test measures, plus potassium (with its reason).
- **Authored:** only `stations/ecg-texts.ts`, the explanations, chosen by what the model is doing. Drafts until a clinician reads them.
- **Tests:** `scripts/station.test.mjs` (in `npm test`): the log agrees with the model's intervals and with the dipole, the patterns read correctly from it, settings are derived, texts complete in both languages.
- **Noticed, not changed:** with pre-excitation the delta lobe starts about 70 ms before the activation the model's QRS duration counts from, so the drawn QRS band is wider than the 122 ms the model reports. The text uses the model's figure.
- **Step 2, ECG signs, Predict and Identify:**
  - `ecg-12` reveals the observable `ecg.reading` (`measurements/ecg-reading.ts`, resolver `electrical.ecg-reading`): the tracing measured at the model's fiducials. 25 ECG signs and 6 syndromes in the knowledge tables; the coverage report has an ECG section.
  - In the station, Explore lists the signs on the ECG now; "Predict first" asks which signs a pattern will bring and scores the answer; Identify hides a pattern, shows its 12-lead, and scores the signs and the mechanism named.
  - Tests in `scripts/station.test.mjs`: every pattern shows its signs and syndrome, a healthy heart none. One known gap: in right bundle branch block T in V1 should be inverted; the model's is slightly upright.
- **Step 2b, ECG signs in the encounter:** the ECG result records its reading (`revealed`), through the learner's own electrode placement. The guided level names its signs after the result; the observe-only level offers them as chips; the debrief and "Your documentation" read them from the result (`signsInResult` in `engine/debrief.ts`). No case's expert reference lists an ECG sign yet; the stroke case's atrial fibrillation would be the first candidate, for the owner to decide.
- **The auscultation station (step 4, Explore):** a second Station card opens `app/station-auscultation.ts`.
  - **Signal:** the phonocardiogram the examination model gives at the chosen site (site, bell or diaphragm, position, breathing), over the last few beats. Each beat is timed from its own valve events, under the ECG those beats produced, over the breath they fell in (`render/phono-strip.ts`). "Listen to this beat" plays the beat under the cursor.
  - **Mechanism:** the beat at the cursor as a Wiggers diagram (`render/wiggers.ts`). It shows the pressures of the left or right heart, the ventricle's volume, the beat's ECG and PCG, valve events and phases, all from the circulation's own samples. The live patient keeps its recent beats with their samples (`LivePatient.beats`).
  - **The timeline:** `stations/cardiac-cycle.ts` gives the phase and each valve's state (open, closed, leaking) at any instant, read from each side's own valve flows.
  - **Starting points:** `stations/auscultation-presets.ts`. Each is a patient (a few haemodynamic parameters), named by the guideline category its circulation reaches; the tests check it (Bonow 2006, Zoghbi 2017, McDonagh 2021). Severe regurgitation is beyond the model's largest orifice, so those presets are moderate. Hypertension cannot be made to reach an S4 (the baroreflex holds the pressure), so the S4 is shown with severe aortic stenosis. After a change the station runs the circulation ahead for 20 s, so what is heard is the new steady state.
  - **Explanations:** `stations/auscultation-texts.ts`, per phase and situation, EN/DE, drafts until a clinician reads them.
  - **Model fixes made for it:**
    - Mitral opening is the first opening after A2, not a flicker in diastasis.
    - S1 is the closure that belongs to the beat, including one in the previous window.
    - An event in a beat's last step keeps its time.
    - Lead II no longer drops to zero after the dipole is drained.
- **Auscultation Predict and Identify:** they score the knowledge tables' heart-sound signs, found by the standard cardiac auscultation manoeuvres, each in its own context (`stations/auscultation-signs.ts`).
  - Explore lists the signs heard now and where.
  - "Predict first" asks which signs a heart will bring, and scores the answer once the circulation has settled.
  - Identify hides a heart among the starting points and a healthy one. The learner listens with full control of site, instrument, position and breathing, but sees no labels, measures, finding text or Wiggers diagram. They name the signs and the heart, and are scored hits, misses and over-calls, with where each sign is heard. Moderate mitral stenosis is left out (gap 17).
- **Links (step 5):** `openStation(which, onPatient)` in `app/app.ts`. Every `[data-open-station]` button goes through one delegated handler: on the debrief's "In a station" section, on an ECG result after commit, and on the cardiac auscultation cards. Stations take `StationOptions.patient` (the encounter's model and the patient's name, shown as a banner) and `backLabel`.
- **The eye station (Explore):** a third Station card opens `app/station-eyes.ts`. Read ADR-017, decision 9.
  - **Tests:** pupils and lids, swinging light, eye movements (with "follow a moving target"), cover test (up, ahead, down), nystagmus (Frenzel or fixating), head impulse, visual fields. Each has the controls an examiner has (where the light is, room or dim, gaze, which eye is covered, a head turn to either side, holding the lids up).
  - **Signal:** the encounter's eye view (`render/eye-view.ts`), driven by the station's controls, and the findings worded as the encounter words them.
  - **Mechanism:** `render/eye-mechanism.ts`, per test: the light reflex and the sympathetic chain, the six muscles with their nerves (and the vertical deviation by gaze), the labyrinths' tone with the eye's own position trace, head and eye during the impulse, the visual pathway from above with each eye's field.
  - **Settings:** the vestibular loss and the lesions; the lesions as a curated list of the structures the eye examination reads (`EYE_STRUCTURES`).
  - **Starting points:** `stations/eye-presets.ts`: vestibular neuritis (day 1, day 7), lateral medulla, cerebellar hemisphere, III, IV and VI palsies, Horner, optic nerve, chiasm, optic tract, occipital cortex.
  - **Signs:** `stations/eye-signs.ts`, read from the knowledge tables over the eye manoeuvres; a sign that needs tests compared (Horner's dilation lag) counts when the whole examination shows it. The debrief's "In a station" lists the patient's eye signs; the nine eye test cards link to the station.
  - **Explanations:** `stations/eye-texts.ts`, EN/DE, drafts until a clinician reads them.
  - **The body in the eye:** three more tests, Sclerae, Conjunctivae and Thyroid eye signs, read the body model: bilirubin, haemoglobin and thyroid hormone with Graves' orbitopathy. The station runs the body through the illness in a fresh `LivePatient` whenever a body setting changes (a few seconds: days to weeks of illness), and shows those signs only once it has. The eye view now draws the yellow sclera, the drawn-down lower lid with its conjunctival colour, lid retraction and lid lag, and the globe standing forward, all graded from the findings; the encounter's close-up does too, for the three inspections. Five starting points: bile duct obstruction, haemolytic anaemia, a slow colonic bleed, Graves' disease with orbitopathy, too much levothyroxine (lid signs without exophthalmos). Settings add the liver, blood and thyroid groups and the illness's duration; calcium and bone are left out (`leaveOut`).
  - **Predict and Identify**, as at the auscultation station:
    - "Predict first" asks which signs a starting point will bring. It scores the answer once the eyes (and the body, if it changed) show the new patient.
    - Identify hides one of the starting points, or a healthy patient. The learner examines with every test and control but sees no finding text, signs, settings or pathway. For the visual fields, the patient's own report is shown. The learner then names the signs and the lesion.
    - The signs are offered grouped by the test that shows each one (`eyeSignGroups`).
    - Every unknown runs the body, so the waiting time gives nothing away.
    - The optic tract and the occipital cortex look the same to the model's examination, so either counts as right, with the reason (`EYE_LOOK_ALIKE`). A test checks that no other two starting points look alike, with sides counted.
  - **Not modelled:** the fundus (case data only), INO and other gaze palsies (no MLF or saccade model), quadrantanopia and macular sparing (the field model has halves), a partial afferent defect (the afferent pathway is on or off).
- **Next:** gap 17 (the mitral stenosis rule) and a pulse and neck-vein station (the circulation's arterial and venous waveforms; pulsus paradoxus waits on gap 13).

## Problem reports

Anyone using the app can press **Report** (bottom right), point at what is wrong, say what it should be, and get one JSON file (`src/vp/app/report.ts`).

- **The file holds:**
  - the comment and its kind;
  - what was pointed at: CSS path, text, trimmed HTML, the data attributes it sits in, the nearest heading or caption;
  - PNGs of the canvases in that panel, and the figure SVG when the figure was pointed at;
  - the app state: case and version, screen, layer, tab, visual, the encounter's events, the differential, the model and its current values (without the last beat's waveform);
  - recent script errors;
  - the build: the commit is stamped by `scripts/build-vp-demo.mjs` from `GITHUB_SHA`.
  - It leaves out the learner's own notes.
- **Where reports go today:** the file is downloaded. **Open GitHub issue** also opens a pre-filled issue, labelled `report`, with the comment, the place, the case, the build and the steps; the reporter attaches the file. That needs a GitHub account.
- **Working on a report:** `node scripts/replay-report.mjs report-….json` (from `source/`). It prints the report, rebuilds the patient from its model, replays the steps and compares every finding with what the reporter saw. Vital signs may differ by a beat, because the app runs the circulation live.
- **Not done:**
  - **Sending without a GitHub account.** This would need a relay holding a key that may only create issues (a Cloudflare Worker, plus an access code for testers). The owner ruled it unimportant (18 October 2026); do not start it unasked.
  - A queue for reports made offline.
- **When a report shows a phrasing that was not understood,** add a line to `scripts/data/typed-commands.json` and make it pass.

## Animations (one of the candidate next topics)

### What animates today

Every visual is driven by findings, never by the lesion directly, so it shows exactly what the model says the examiner would see.

| Examination | How it is shown | Code |
|---|---|---|
| Eyes: pupils, light reflexes, swinging light, eye movements, Frenzel, head impulse, cover test | Canvas face with eyes moving by the model's nystagmus, pupil time constants and lid positions | `render/face-canvas.ts`, `eye-view.ts`, `eye-scene.ts`, `eye-motion.ts` |
| Facial movement (VII) | The same face raising the brows, closing the eyes and showing the teeth, each half with its finding's strength | `render/face-view.ts` |
| Heart and carotid auscultation | Chest with stethoscope; phonocardiogram and audio from the heart-sounds finding | `app/focus-thorax.ts`, `render/phono.ts`, `app/sound.ts` |
| Lung percussion, breath sounds, vocal resonance | Chest front or back, tap any of ten sites | `app/focus-chest.ts`, `render/thorax.ts` |
| Pulses | Arterial pressure trace from the running circulation | `app.ts` (pulse visual), `app/sound.ts` |
| 12-lead ECG | Electrodes placed by the learner; live 12-lead monitor and bedside lead II strip from the running dipole; printed paper with the measuring tool | `app/focus-ecg.ts`, `render/ecg-monitor.ts`, `render/ecg-paper.ts`, `app/ecg-measure-tool.ts` |
| Positions and views | The whole-patient figure moves between poses by interpolating joint angles, and turns between right, front and left (eased) | `render/patient-figure.ts`, `render/figure-view.ts` |
| Physiology chapters | Living diagrams of the running models | `app/diagrams.ts` |

The dispatch from a performed manoeuvre to its visual is `visualFor` in `app/app.ts`. Everything else, including all limb, coordination, reflex, sensory, abdominal and general tests, currently produces text only.

### Where to hook in

Each teaching card has an `animation` field (a renderer id) that is not used yet. The intended use:

- The card's animation shows how the test is done.
- The visual after performing a test shows this patient's result.

Both should come from the same renderer, fed with a normal finding for the card and the patient's finding for the result.

### Good first candidates

These are tests whose finding *is* a movement:

- **Limb movements:** finger–nose, heel–shin, rapid alternating movements, pronator drift.
- **Stance and walking:** Romberg, gait.
- **Hands and reflexes:** tremor, asterixis, reflexes.

Their resolvers already return structured values, for example `neuro.coordination` returns dysmetria (none, mild or marked), intention tremor, and whether weakness limits the test. `render/patient-figure.ts` poses a skeleton by joint angles, and every body part hangs on it as an outline (`figure-body.ts`), seen from any side (`figure-view.ts`). It is a natural base for limb and gait animation in the same style as the bedside figure. Animate the `Pose` angles, not the outlines.

Respect `prefers-reduced-motion`, as the figure already does.
