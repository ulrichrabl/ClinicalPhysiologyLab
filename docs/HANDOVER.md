# Handover: start here

Last updated: 29 October 2026, with the EEG station part 2a (the corticothalamic loop and generalised seizures; ADR-017 decision 13), stacked on part 1a (decision 12). Before it: 20 October 2026, ADR-018 step 5 part 2 (the team, and the arrest drawn as a scene). Before it: ADR-018 step 5 part 1 (the guideline file and the debrief). Before it: the practice screen's open questions settled (#78). Before it: ADR-018 step 4 (adrenaline and amiodarone). Before it: ADR-018 step 3 (the heart in an arrest and the shock). Before it: a first practice screen for cardiac arrest (draft). Before it: ADR-018 step 2b (breathing in arrest, given breaths, CO₂ at low flow). Before it: ADR-018 step 2a (chest compressions on the circulation). Before it: ADR-018 step 1 (interventions, the scenario layer, seeded replay). Before it: the pulse and neck-vein station's Predict and Identify (the station is complete). Before it: gap 17 closed, and the eye station completed. Before it: the eye station (Explore). Before it: the ADR-017 step 4 PR (the auscultation station, Explore). Earlier: 18 October 2026, with the ADR-017 step 1 PR (the ECG station). Before it, work was paused after PR #48 at the owner's request.

**Where we paused.** ADR-018 steps 1–4, the practice screen, its open questions settled, and step 5 parts 1–2 (the guideline file and debrief; the team and the animated scene) are merged and live (#71–#80, merged at the owner's word, 2026-10-20). The open questions from #74 and #76 were handed over by the owner and are settled in ADR-018, "The open questions of the practice screen and step 4, settled": tapping kept with a phone layout that keeps monitor, feedback and pad on one screen; the arterial line switchable, on while practising; a breath lasts as long as the press; the adrenaline gain stays fitted to a first dose until gap 20 is addressed. Next: step 5 (the ward VF scenario end to end: the ERC 2025 file, the team, nudges, the debrief). Waiting on the owner (details in "Waiting for the owner" below):

1. Four case texts the model contradicts: change the text, or fix the model?
2. Rewrite the finding texts as observations rather than diagnoses, so the observe-only level is a real test for findings shown only as text?
3. A hands-only inspection, so "look at the hands" works on a dressed patient?
4. Which next: ADR-016 step 5 (draw the signs the views do not show yet), the Evidence ADR, or animations. The owner chose stations (ADR-017); step 1 is in review.
5. Interactivity with the clock running (owner, 2026-10-19): cardiac arrest and later anaesthesia. ADR-018 (interventions, scenarios and guideline scoring) is accepted with the owner's answers: ERC 2025 with the GRC's German text; the learner leads from the first second, and calling for help and giving tasks are trained; chance outcomes, seeded, with explicit teaching nudges; compressions tapped to the rhythm (rate and count trained, depth not); assessment mode after practice. Step 1 (interventions and the scenario layer, with seeded replay) is built, with no screen yet; see "Interventions and scenarios (ADR-018)" below. Steps 2a (the compression pump) and 2b (breathing in arrest, given breaths, CO₂ at low flow) are built too. Next (owner, 2026-10-20): a first practice screen, then step 3 (the heart in arrest and the shock). Both built, and step 4 (adrenaline and amiodarone) after them.

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
| Interventions and scenarios (ADR-018) | `npm run test:scenario` (about two minutes) |
| The physiology of an arrest against human data (ADR-018 steps 2–4) | `npm run test:arrest` (about four minutes) |
| A run scored against the ERC 2025 guideline, and the debrief (ADR-018 step 5) | `npm run test:debrief` (about a minute) |
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
| The figure breathes: chest and belly move with the running lungs' breath (rate, depth, rib cage against abdomen, a weak diaphragm's paradox), magnified; in the ward and the station's Look | `source/studio/figure/BRIEF.md`, "Breathing" |
| The respiratory station: the chest examination beside the lungs, pleura and airways beneath it and the breath on one clock; Explore, Predict and Identify | "Stations (ADR-017)" below; gaps 56–58 |
| ADR-018 step 1: interventions acting on the running model, scenarios (a case in a scene with a state machine), one clock in 0.1 s ticks, one seeded generator, exact replay from seed and inputs | "Interventions and scenarios (ADR-018)" below |
| Neurology ward cases: cauda equina from a central disc, Guillain–Barré after diarrhoea, generalised myasthenia, early Parkinson's disease, subacute combined degeneration from B₁₂ deficiency. Every reference sign is the model's; new investigations (CSF, nerve conduction, AChR antibodies, bladder scan, MMA, whole-spine and brain MRI, CT thorax); a spastic paraparetic gait; `parkinsonism` and `subacute-combined-degeneration` syndromes; fatigue tests now record their baseline | `source/src/vp/cases/`, gaps 54–55 in `docs/evidence-grounding-status.md` |
| The ECT station's patient, drawn (PR B): the bedside figure on the trolley with what the team puts on him; a head close-up; pad sites chosen from above decide the placement; the cuff pumped with the bulb against the systolic pressure; the cuffed arm jerks in the motor seizure | ADR-017 decision 16 |
| The ECT station as a procedure (PR A): the order card, three roles (the learner takes one or all; the team does the rest), 18 steps in Czerwonka 2024's order, practise/watch/exam, mistakes noticed, time faster only while waiting; the device output always in English | "Stations (ADR-017)" below; ADR-017 decision 16 |
| The ECT station, part 2a, the heart: the lab's own body behind channel 4; the stimulus's vagal discharge by placement and pulse width (Stewart 2010), the seizure's sympathetic surge (Nagler 2013), atropine, glycopyrrolate, esmolol and labetalol; known gaps 68–71 | "Stations (ADR-017)" below; ADR-017 decision 15 |
| The ECT station, part 1: a front panel after the real device and its manual (impedance test, baseline, dose, treat, strip, report), the stimulus's current through part 1's head by reciprocity, pulses into the cortex with human synaptic depression, the threshold fitted to van Waarde 2012 and checked against pulse width, frequency and placement; the device's endpoints and indices; known gaps 64–67; part 2a's regions corrected | "Stations (ADR-017)" below; ADR-017 decision 14 |
| The EEG station, part 2a: Robinson's corticothalamic model (Deeba 2020's parameters; fitted in the literature to human resting and ECT EEG), ten regions through part 1's head, a stimulus-started generalised seizure that slows, flickers, ends and leaves the EEG suppressed; the brake fitted to ECT seizure duration and the scale to ictal amplitude; known gaps 60–63 | "Stations (ADR-017)" below; ADR-017 decision 13 |
| The EEG station, part 1a: the head as four shells with the exact series, a cortical patch as a source, ACNS montages, spikes and sharp waves, the page, the scalp map, a section through the head and one chain; ten starting points checked against how a reader localises; known gap 59 | "Stations (ADR-017)" below; ADR-017 decision 12 |

## Next topics: an EEG station, then electroconvulsive therapy (owner, 2026-10-28)

**Status (2026-10-29):** EEG part 1a is built (ADR-017 decision 12), and part 2a (decision 13): Robinson's corticothalamic model, generalised seizures started by a stimulus, slowing, ending and leaving the EEG suppressed. Part 2 was split: 2a now, **2b (focal seizures, spread, periodic discharges) after ECT**. ECT part 1 is built (decision 14), part 2a, the heart (decision 15), and the station is now a procedure (decision 16, PR A; owner, 2026-10-30). PR B, the patient, is built too (the bedside figure on the trolley with pads, leads, cuff, mask and bag; a head close-up; pad sites chosen from above; the cuff pumped against the systolic pressure). PR C's first half is built (the breathing, the oxygen, the relaxant and the cuffed arm, SpO₂ and EtCO₂; ADR-017 decision 16; gap 72). The learner places the monitoring leads (four channels and the ground, red minus black; ADR-017 decision 16). The IV is in the left forearm; the cuff and the EMG go on the arm without it (owner, 2026-10-30). The procedure follows the owner's hospital (2026-10-31; ADR-017 decision 16): two roles, the psychiatrist doing the device and the skin; brakes, paper, cuff put on early and pumped on signal, EEG sites and stimulus sites prepared separately, a check strip and second impedance test before the stimulus; EEG on the mastoids (M1/M2). The station then follows the hospital's written in-house procedure (owner, 2026-11-01; kept out of the repository; ADR-017 decision 16). Next: SAMS and the restimulation task, then the hospital's anaesthetic as the standard (esketamine, propofol, sevoflurane, rocuronium with sugammadex, urapidil; succinylcholine as the alternative), and a restimulation task (1.5 times the dose). Agreed order of the owner's latest list (2026-10-30): the dial (done), the resting EEG (done: the awake background at the normal floor, 20 µV, Hirsch 2021, silenced postictally by the relays; gaps 63/65 updated), the leads (done), the physics made interactive (the pulse train to scale, Ohm's law, charge, energy), then PR C's second half. Next: **PR C's second half** (the induction agent and its dose acting on the seizure's threshold and duration, hyperventilation lengthening the seizure; research in the scratchpad notes is summarised in decision 16), **PR D** (the exam's debrief, more tasks: missed seizure, high impedance, prolonged seizure, titration over a course); then part 3 (the course) and part 4 (the background). The target group (owner): medical trainees, students and residents in psychiatry and anaesthesia. Agreed order since (owner): **1a, then part 2 (the seizure model), then ECT, then EEG 1b–1d** (background and slowing; artefacts and variants; EEG signs, Predict and Identify). The owner's answers: a spherical head; the brain-to-skull ratio a setting with the dispute named; ACNS electrode names with the old ones in brackets. Still open for 1b and 1d: inputs with no human EEG threshold (sodium, CO₂, urea; the agent's suggestion is to leave them out as known gaps rather than drive them from the body model's partly ungrounded encephalopathy grade), and whether the EEG becomes an investigation in the cases (the stroke case first) in 1d. The Thymatron IV manual (Rev 21) was attached by the owner on 2026-10-29: take the device's settings from it (specifications on its printed p. 25, program tables in Addendum VII, monitoring placements in Addendum II).

The owner wants an EEG station, with the weight on what makes EEG reading hard: seizures and focal findings. Then an ECT station that trains a complete course of ECT with the Thymatron IV. Start each in a new chat. Suggested order, each part its own PR:

1. **EEG station, part 1: how the scalp sees a source.** A forward model from a cortical source (a dipole on a chosen patch, with its orientation) through brain, skull and scalp to the 10–20 electrodes. With it, montages (bipolar and referential: phase reversal and amplitude maximum follow from the physics), spikes and sharp waves, focal slowing from a lesion (the stroke case's), and artefacts and benign variants as their own physical sources (the eye as a dipole for blinks, the temporal muscles, an electrode pop; wicket spikes, small sharp spikes, mu). Explore, Predict ("where is the maximum, where does the phase reverse?") and Identify ("epileptiform or not, where, or artefact?"). Name patterns by the ACNS standardized critical care EEG terminology. A normal background (posterior alpha that blocks on eye opening) and metabolic slowing can come from the existing glucose, sodium, liver, oxygen, CO₂, temperature and arrest models.
2. **EEG station, part 2: seizures.** A published neural mass model, grounded in human data, for the transition into a seizure and its evolution in frequency, shape and spread, and for lateralised and generalised periodic discharges. ECT reuses it.
3. **ECT station.** The seizure threshold and the stimulus dose: age, sex and electrode placement (right unilateral, bitemporal, bifrontal), titration and age-based dosing, right unilateral needing about six times threshold, the threshold rising over the course. Anaesthesia: the induction agent's effect on threshold and seizure length, succinylcholine and the cuff method, hyperventilation. The heart: a subconvulsive stimulus's unopposed vagal bradycardia or asystole, then the seizure's sympathetic surge (extending the circulation and autonomic models). The device's two frontomastoid EEG channels, EMG, ECG and motion sensor, and the seizure quality measures read from them (duration, ictal amplitude, regularity, postictal suppression, interhemispheric coherence). Decisions: the impedance check, a missed or short seizure and restimulation, a prolonged seizure and ending it, the course session by session with cognitive monitoring.

**Depth (owner, 2026-10-29).** The ECT station teaches the whole course and what to do, and also the background: how the parameters relate to each other, to the level someone like Max Fink would know, including the physics of the treatment. So, besides the session itself:

- **The physics of the stimulus:** constant-current brief pulses; charge = current × pulse width × pulses (2 × frequency × duration); energy = charge × current × impedance; static versus dynamic impedance and what each says; how much current the scalp and skull shunt, and how electrode placement sets the current paths and density in the brain; why ultrabrief pulses are more efficient (pulse width against the neurons' chronaxie); what percent energy on the dial means in charge and energy.
- **The seizure and the dose:** threshold and how it is measured; dose above threshold and its relation to efficacy and to cognitive effects, by placement; why the threshold rises over a course; the seizure's generalisation and its quality measures, and what they predict.
- **Why it works, as the evidence stands:** the anticonvulsant hypothesis (postictal suppression and the rising threshold), the neuroendocrine (diencephalic) view Fink argued, and what is not known.
- **The patients:** indications (melancholic and psychotic depression, catatonia with the lorazepam challenge and the Bush–Francis scale, mania), contraindications and risks, consent, interacting drugs (benzodiazepines and flumazenil, anticonvulsants, lithium), cognitive monitoring, continuation and maintenance; and the history (Meduna, Cerletti and Bini).

Each relation in the model is grounded in published human data, as for the other stations; where the evidence is thin or disputed, the station says so.

**Reference pictures (owner, 2026-10-29), for layout and validation only, not to be copied into the app:**

- **A photograph of the front panel**, from the owner in the chat. Left to right:
  - the large red display (impedance in ohms) with the yellow IMPEDANCE TEST button below it;
  - the ECT and EEG/ECG/EMG sockets;
  - the FlexDial (ADJUST/SET) with its indicator light;
  - the PERCENT ENERGY display and its dial, with two small lights beside it (meaning to be taken from the manual);
  - the guarded yellow TREAT button;
  - START/STOP with the "Safety monitor activated" light;
  - the power switch;
  - the strip printer on the right.
- **Two printed strips** in Kawashima et al. 2018, Neuropsychiatr Dis Treat 14:607–10 (doi 10.2147/NDT.S160093; reference `kawashima2018`): https://www.dovepress.com/article/fulltext_file/160093/aW1n/NDT-160093-F01.jpg and …/NDT-160093-F02.jpg.
  - **The strip:** four traces, EEG1 and EEG2 at 200 µV/cm and EMG and ECG at 1000 µV/cm; a seconds scale with a black block every 6 s; the heart rate printed about every 3 s.
  - **The report:**
    - "Thymatron system IV S/N", then % Energy set, Charge delivered (mC), Current (A), Stimulus duration (s), Frequency (Hz), Pulse width (ms), Static impedance, Dynamic impedance (Ω);
    - EEG endpoint or "EEG endpoint is not detected", EMG endpoint or "EMG activity is not detected";
    - Base and Peak heart rate (b/m), Average seizure energy index (µV²), Postictal suppression index (% or N/A), Maximum sustained power (µV²), Time to peak power, Maximum sustained coherence (%), Time to peak coherence;
    - "Program selected: Low 0.5 charge rate".
  - **The stimulus arithmetic checks out on both:**
    - 0.91 A × 0.5 ms × 2 × 70 Hz × 8.0 s = 510 mC, printed 507.4;
    - 0.91 A × 0.25 ms × 2 × 30 Hz × 5.6 s = 76.4 mC, printed 76.5.
    Static impedance 1430–1760 Ω, dynamic 210 Ω.
  - **Figure 1, an inadequate seizure:** bilateral, 100 %, no motor seizure, heart rate not rising, neither endpoint detected, suppression index N/A.
  - **Figure 2, adequate:** right unilateral ultrabrief, 15 %, after a third stimulation. The clinician's arrows put the EMG end at 26 s and the EEG end at 31 s; the device's estimates were 8 s and 37 s. Suppression index 23.5 %, coherence 91 %.

**The Thymatron IV manual:** attached by the owner (2026-10-29, "System IV Instruction Manual Rev 21"); ask for it again in a new chat if it is not in the repository's reach. The device's settings (percent energy and charge, current, pulse width, frequency, duration) come from it, not from memory. The station draws its own panel with the device's functions; it does not copy the device's face or brand. **But (owner, 2026-10-29) it must be similar enough that the training carries over to the real device:** the same controls in the same places (the dial, the buttons, the display, the strip printer), the same displays and print-out, the same sequence of steps (impedance test, baseline, treat, the seizure monitoring and end of seizure), drawn from photographs of the real device and the manual's descriptions, without the brand name or logo.

## Open lists

- **Physiology known gaps (65 open; 18 closed; 59 with the EEG station's forward model, 60–63 with its seizure model, 64–67 with the ECT station, 68–71 with its heart, 72 with its anaesthetic; 20–21 new with chest compressions, 22–25 with breathing in arrest, 26–28 with the heart in an arrest, 29–32 with the drugs, 33–34 the P and T axes, 35–37 with the arrest from a pulmonary embolism, 38 with the collapse of vessels, 39 with the tension pneumothorax, 40 the pericardium, 41 hyperkalaemia, 42–43 with hypoxia, 44–45 the opioid, 46 hypothermia, 47 hypokalaemia, 48 local anaesthetic; 49–53 the neurological model's grading, time course, pull test, release of tone and conduction block; 35 and 49 closed).** See `docs/evidence-grounding-status.md`, including the suggested order. Start with the cardiopulmonary reflex. Gaps 10–12 came with the heart sounds timed by the circulation (ADR-017 step 3); gap 13 with the respiratory pump (step 3b); gap 14 (oxygen-induced hypercapnia) replaced a judgement margin in the COPD oxygen test; gap 15 with length-dependent systole; gap 16 (the pump fills the right ventricle about a third as much as real-time MRI shows) is upstream of 12, 13 and 15 and should be fixed first; gap 17 (moderate mitral stenosis silent at the bedside) came with the auscultation station's Identify mode and is closed: the stenosis is now heard by its mean gradient. That work resumed (owner, "Resume the chain"): the breath waveform is merged (inflow lasts Tobin's duty cycle, pleural pressure lowest at end-inspiration); the results it moved were each looked at (gap 5, 12, 16, 19), and a lumped abdominal pump was tried and not adopted (gap 16c). Next in that chain: separate abdominal and leg venous pools. Each ventricle now has its own activation clock: its relaxation comes later on a beat it starts fuller than its recent filling (`CIRC.systoleLengthGain`, fitted to Curtiss 1975). The host re-anchors that reference whenever it equilibrates. Each `beatLog` entry records where in the breath its P2 fell (`breath`), when the beat began (`t0`) and when RV pressure began its rapid fall (`rvRelax`). To compare inspiration with expiration, classify beats by `breath` (P2 in late inspiration vs late expiration), not by the pleural pressure of the beat's window. Since the pump, single beats differ through each breath: examinations read `metricsBreath` (each beat's values averaged over about a breath), the lungs and the body now read it too (the host's `couple`); the monitor still reads the last beat.
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
  - **Starting points:** `stations/auscultation-presets.ts`. Each is a patient (a few haemodynamic parameters), named by the guideline category its circulation reaches; the tests check it (Bonow 2006, Zoghbi 2017, McDonagh 2021). Severe regurgitation is beyond the model's largest orifice, so those presets are moderate. Hypertension cannot be made to reach an S4 (the baroreflex holds the pressure), so the S4 is shown with severe aortic stenosis. After a change the station runs the circulation ahead for 20 s out of sight (not on screen at speed), so what is heard is the new steady state. The site is chosen by tapping the chest (the examination's thorax view), and the sound stays on across changes (one shared audio context in `app/sound.ts`, `cycleLoop`). See ADR-017, 8b.
  - **Explanations:** `stations/auscultation-texts.ts`, per phase and situation, EN/DE, drafts until a clinician reads them.
  - **Model fixes made for it:**
    - Mitral opening is the first opening after A2, not a flicker in diastasis.
    - S1 is the closure that belongs to the beat, including one in the previous window.
    - An event in a beat's last step keeps its time.
    - Lead II no longer drops to zero after the dipole is drained.
- **One axis (ADR-017, 9c):** every axis the app shows is the standard 12-lead reading from I and aVF on Einthoven's circle (`axisFromIandAvf`); the vector's own frontal angle is `vcgAxis` and is not shown as the axis.
- **ECG station, second look (ADR-017, 9b):** Explore shows all twelve leads through the examination's electrode view (move an electrode and every view follows), and an axis pane: the Cabrera circle with the mean QRS vector, each limb lead's QRS, the reading from I and aVF, ranges and Lagetyp, explanations, and "see it move" buttons including swapped arm electrodes (`stations/ecg-axis.ts`, `render/cabrera.ts`).
- **Auscultation Predict and Identify:** they score the knowledge tables' heart-sound signs, found by the standard cardiac auscultation manoeuvres, each in its own context (`stations/auscultation-signs.ts`).
  - Explore lists the signs heard now and where.
  - "Predict first" asks which signs a heart will bring, and scores the answer once the circulation has settled.
  - Identify hides a heart among the starting points and a healthy one. The learner listens with full control of site, instrument, position and breathing, but sees no labels, measures, finding text or Wiggers diagram. They name the signs and the heart, and are scored hits, misses and over-calls, with where each sign is heard. Moderate mitral stenosis is in the pool since gap 17 was closed.
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
- **The pulse and neck-vein station (Explore):** a Station card opens `app/station-pulse.ts`.
  - **The waves are the circulation's own.** Each beat's 2 ms samples are read by `domains/cardio/sim/waves.ts`. Right atrial pressure gives the a wave (atrium contracting), x, v (filling against a shut tricuspid valve) and y. The highest pressure while atrium and ventricle contract together (`aClosed`) is the cannon wave. Arterial pressure gives the foot, the peak and the upstroke. Every entry of the circulation's `beatLog` now carries `rr`, `ven` and `art`.
  - **The findings read them.** The pulse rhythm comes from the last 12 intervals (`rhythmOf` in `models/cardio-exam.ts`): regular below `EXAM.pulseIrregularCv` (10 %, assumed), regularly irregular when the intervals fall into two tight repeating groups, otherwise irregularly irregular. Before this it came from a text label. The JVP waveform comes from the last 8 beats (`jvpWaveform`):
    - cannon a: an atrial wave against a shut valve, taller than the v wave, on any beat;
    - absent a: no atrial wave on any beat;
    - large v: v taller than a on most beats;
    - otherwise normal.
    Before this, cannon and absent a could never appear. New signs: `absent-a-waves`, `large-v-waves`, `regularly-irregular-pulse`.
  - **What it shows:** the strip (ECG, arterial and right atrial pressure over the last seconds, each beat's a/x/v/y named where the model made them, cannon waves marked), the neck at 45° (the jugular column rising and falling with right atrial pressure now; the JVP read from the beat's mean), and one beat in detail (tap a beat). Explanations are in `stations/pulse-texts.ts`.
  - **Starting points:** `stations/pulse-presets.ts`: aortic stenosis and regurgitation, pulmonary hypertension, severe tricuspid regurgitation, AF, Wenckebach, complete heart block and VT, each checked to bring its signs.
  - **Not modelled:** the c wave, and the respiratory signs (Kussmaul's sign, pulsus paradoxus), which wait on gap 13. Gap 18: the model's tricuspid regurgitation is too small to fill in the x descent.
  - **Predict and Identify,** as at the other stations. The signs are offered beside the manoeuvre that finds each one (`pulseSignGroups`). Identify gives what the bedside gives: the pulse and the neck at 45°, with no ECG, no named waves, no findings and no beat in detail. A test checks that every starting point can be told from health and from the others by its signs.
- **The neurological station (ADR-017 decision 10, steps 8a–8c: Explore, the whole examination, Predict and Identify):** a Station card opens `app/station-neuro.ts`.
  - **Tests:** pronator drift, finger–nose (each side, eyes open or closed) and the knee jerk (each side), done by the bedside figure sitting on the edge of the bed (`render/neuro-motion.ts`, shown through `app/neuro-motion-view.ts`), moved by the examination model's finding. The findings are worded as the encounter words them; the leg reflexes also give the ankle jerk and the plantar response in words.
  - **Mechanism:** the ladder a clinician descends (`render/neuro-mechanism.ts`): cortex, capsule, brainstem, cord, root, plexus, nerve, junction, muscle, and the cerebellum beside it. The rungs the test reads are strong, the lesion's rung is marked with its structures named. The explanations (`stations/neuro-texts.ts`, EN/DE, drafts) say what the test reads and what this patient's finding says, with the model's own reason (`basis`).
  - **Settings:** the lesions, as a curated list by rung (`NEURO_STRUCTURES`), and complete or partial.
  - **Starting points:** `stations/neuro-presets.ts`: left MCA stroke, left internal capsule, right half of the cervical cord, right L4 root, right femoral nerve, right S1 root, left cerebellar hemisphere, dorsal columns. Each is checked to bring its signs (`stations/neuro-signs.ts`, read from the knowledge tables).
  - **Model fixes made for it** (owner: "of course it should do exactly what it would do in a real patient"):
    - The nervous-system graph (`domains/neuro/data/anatomy.js`): the tracts to the leg segments start in the leg's part of the motor strip (a string comparison had sent them from the arm's part) and run down the thoracic cord (T6, T10). Each tendon reflex has one arc per root it runs through (`REFLEX_ROOTS`, after the MRC's Aids to the examination of the peripheral nervous system): biceps and supinator C5–6, triceps C7–8, knee L3–4, ankle S1. One root of two reduces the reflex; both, or the muscle's nerve or plexus, abolish it (the radial nerve now takes the supinator jerk too).
    - `cortical()` in `models/neuro-limb.ts` no longer gives an untouched part of the strip 0.3 of a lesion. A part the lesion does not reach is spared; a part it reaches loses the share a case gives as the lesion's `extent` (new, 0–1, default 1). The stroke case now states what its patient has: face and arm, and the infarct's edge grazing the leg's fibres (`L_mcx_leg`, extent 0.3: "leg… bit", the leg nearly spared, extensor plantar). Its findings are unchanged.
    - A corticospinal lesion in the cord counts on its own side (below the decussation).
    - Sensory ataxia (`ataxiaOnlyEyesClosed`) is read limb by limb.
    - New sign: `reduced-knee-reflex` (reduced or absent).
  - **The whole examination (8b, owner: "We need complete neurology"):** the tests are a registry (`stations/neuro-tests.ts`) in six groups: tone and bulk, power, pronator drift; arm reflexes, leg reflexes and plantars; finger–nose, rapid alternating movements, heel–shin; Romberg, gait; sensation; face, mouth and neck, and speech. Each names the manoeuvres it reads, its finding lines, the rungs it reads and its path. Shown as:
    - **Motions** (`render/neuro-motion.ts`): tone (a rest phase with any rest tremor, then the examiner's hands moving the elbow: spastic catch, cogwheel rigidity, floppy), the arm reflexes (biceps, supinator, triceps, each with the hammer), the leg reflexes (knee, ankle with the examiner's hand, the plantar stroke: the big toe up 55° for extensor, down for flexor), heel–shin, rapid alternating movements, Romberg (front view, the sway and the catch), gait (eight patterns from the side, after Winter's joint angles, plus the parkinsonian shuffle).
    - **Charts:** power by movement, MRC bars right and left, with the repetition (`render/power-chart.ts`); the sensory chart, the dermatomes front and back by modality (`render/sensory-chart.ts`, with `scripts/sensory-chart.test.mjs` in `npm test`).
    - **The face** (`render/face-view.ts`): the cranial nerves, and the mouth (ahh with the uvula and palate, the tongue out, the jaw opening).
    - **In words:** speech, the shoulder shrug.
  - **Starting points (26, in six groups):** upper motor neuron (MCA, capsule, cervical hemicord, T10 hemicord, motor neurone disease); brainstem (Wallenberg, medial medulla, Bell's palsy); roots and nerves (C6, L4, L5, S1, cauda equina, Erb, femoral, peroneal, ulnar); junction and muscle (myasthenia, myopathy); basal ganglia and polyneuropathy; coordination and sensation (cerebellar hemisphere, vermis, dorsal columns, sensory cortex). A test checks that no two look the same at the bedside, and none looks healthy (`neuroSignature`).
  - **Model additions for it:** the ascending tracts by level (a sensory level), the cortical sensory loss (pinprick reduced, position lost, vibration kept), the corneal reflex from V1 or the eye closure, parkinsonism (`L_snc`/`R_snc`: rigid tone, rest tremor 4–6 Hz after Deuschl 1998, slowed alternating movements, shuffling gait), a length-dependent polyneuropathy (`polyneuropathy` node: distal weakness, ankle jerks lost, stocking and later glove loss, vibration and position lost in the feet), fasciculation and wasting with the anterior horn, myasthenia proximal. New signs: `rest-tremor`, `shuffling-gait`, `sustained-clonus`, `stocking-sensory-loss`, `sensory-level`, `saddle-anaesthesia`, `distal-vibration-loss`.
  - **Predict and Identify (8c):** Predict first asks, on choosing a starting point, which signs it will bring, offered by the test that finds each (`neuroSignGroups`), then shows what it brought, what was missed and what did not come. Identify hides a starting point or a healthy patient and shows only what the bedside shows: the motions, charts and face, no findings in words (speech excepted: what the patient says), no signs, ladder or explanation. The learner names the signs and the lesion; the result scores named and there, there and not named, named and not there, says where each is found, and opens Explore on that patient.
  - **Completed (8d, owner: "Then finish the missing parts"):**
    - **Graded weakness and its time course** (`models/neuro-limb.ts`, `evidence/neuro.ts`): a lower motor neuron lesion takes a share of each muscle's motor units (each root its share: London 2022 for tibialis anterior, else equal; the plexus and nerve all of them; a lesion's `extent`, partial without one 0.5); the force left is the share, and the survivors sprout up to twice it over months (Hansen 1978, Sharrard 1955); the hand grades the force (MRC 5 ≥ 80 %, Bohannon 2005; grade 3 and 4 by joint, Dvir 1997, Sato 1999). Denervated muscle wastes from about three weeks. Lesions carry `days` since onset (case, model, view, the station's "Time since onset"); the default is day 1. Sensation is lost or reduced by the share of fibres taken. Big toe extension (extensor hallucis longus, L5) joins the leg. Known gaps 49–51.
    - **The eyes** (a test in the cranial group): the eye station's eyes run through room light, dim light and the gaze in four directions, a covering lid held up; signs from the catalog's eye manoeuvres (Horner's syndrome, III and VI, nystagmus). Presets: third nerve, sixth nerve, sympathetic chain; Wallenberg brings its Horner's syndrome.
    - **The pull test** (`test.pull`, `posture.pull-test`, sign `postural-instability`): the examiner pulls the shoulders back; one step is normal, retropulsion or a fall is not. Lost in bilateral parkinsonism after Macleod 2026's median 7.4 years. Preset: Parkinson's disease, both sides, eight years.
    - **The shrug, the head turn and speech shown** (`render/face-view.ts`, `text/speech-script.ts`): a bust framing with the shoulders lifting against the examiner's hands by the trapezius's grade, the head turning against a hand; the face speaking the answer, a repetition and counting to fifty as the findings sound, word by word, in the station and the ward. Preset: right accessory nerve.
    - **The hanging hand from the front** (`render/figure-hand.ts` `radialHand`): seen from its thumb edge (see the figure's brief).
  - **Made realistic (8e, owner: "we want a complete, realistic model"):**
    - **Tone and reflexes over time** (`models/neuro-limb.ts`, `evidence/neuro.ts`): after a stroke a severely weak limb (MRC ≤ 2) turns spastic with brisk reflexes (ankle clonus if complete) from day 3, floppy before if paralysed; a lesser weakness stays unreleased. In the cord an incomplete lesion releases the reflexes from day 4 and tone from a month; a complete transection goes through spinal shock (all silent, the plantar `mute`), the ankle jerk back at a week, the knee at two, brisk and spastic by a month. The stroke case, 50 minutes in, has normal reflexes; its tests say so.
    - **What a lesion is** (`process` on a case's lesion, the model and the view; a station setting): only `degeneration` (motor neurone disease) fasciculates, in the limbs and the tongue; `compression` blocks 45 % of the lost fibres, weak without wasting.
    - **A patient's own anatomy** (`patient.anatomy.myotome`): the L5 case's tibialis anterior is L5 alone, and her root is compressed: foot drop and a steppage gait, as the case was written, from the model (gap 49 closed).
    - **The tongue** deviates toward its lower motor neuron side when both halves are weak; equally weak, not at all.
    - **Presets:** complete transection at T10 (spinal shock), bulbar motor neurone disease; the capsule (dense hemiplegia, a month) and the hemicords (a week) state their stage.
    - **Hands in every view** (`radialHand`, `restingTemplate`): from the back a hanging hand shows its little-finger edge; palm down on the thighs or the bed, its back.
  - **Still conventions (known gaps 50–53):** sprouting's and atrophy's time constants, the spasticity threshold, the block share, the median patient's postural instability.
- **The respiratory station (ADR-017 decision 11):** a Station card opens `app/station-resp.ts`.
  - **Tests:** look (the figure sitting up, oximeter, counted rate, what the patient says), trachea, expansion, and percussion, breath sounds and vocal resonance at ten sites through the encounter's chest view (`focus-chest.ts`), with a chart of all sites in Explore. Registry: `stations/resp-tests.ts`.
  - **Mechanism:** `render/lung-mechanism.ts` (the lobes, pleura, mediastinum and airways in chest centimetres; the breath on one clock from `BreathRecorder`; ventilation and blood flow by lobe). Explanations: `stations/resp-texts.ts`, chosen by `stations/resp-context.ts`.
  - **Starting points:** `stations/resp-presets.ts` (14), each checked to bring its signs; no two look alike. Signs: `stations/resp-signs.ts`.
  - **Model change:** the trachea moves with tension, not a simple pneumothorax (`LUNG.trachealShiftTension`).
  - **Known gaps:** 56 (acute asthma, grounded since; two residuals), 57–58.
- **Next:** open for the owner. The heart–lung chain (gaps 16, 12, 13, 15) is parked; with it would come pulsus paradoxus and Kussmaul's sign at this station.
- **The EEG station, part 1a (ADR-017 decision 12):** a Station card opens `app/station-eeg.ts`.
  - **The head** (`measurements/eeg-forward.ts`): four shells with the registry's conductivities (`evidence/eeg.ts`), the exact multi-shell series, the standard 10-10 positions (plus A1/A2, Fpz, AFz, Oz, TP9, TP10). `ForwardModel.scalp` and `.inside` (µV from nAm and mm).
  - **A source** is a patch (`Patch`: where on the map, depth, area, tilt from radial, the way it leans, moment density) made into rings of dipoles (`patchPoints`); `leadField` gives µV at each electrode at the discharge's peak.
  - **Montages and reading** (`measurements/eeg-montage.ts`): ACNS LB-18.1, TB-18.1, R-18.1, Cz, average; `readField` (maxima, reversals with equipotential pairs, end of chain, two poles, the largest bipolar channel).
  - **Recording** (`measurements/eeg-record.ts`): spike and sharp-wave shapes (`dischargeAt`), `recordPage`, `channelTrace` with LFF/HFF.
  - **Scene** (`stations/eeg-scene.ts`, `eeg-presets.ts`): ten starting points, each with what a reader would find; the map and the section are computed after the page (a few hundred ms each).
  - **Tests:** `npm run test:eeg` (`scripts/eeg.test.mjs`, in `npm test`): exact solutions, the skull's smearing, every starting point, the localisation rules, the rolandic field, the active ear reference, the areas against Tao 2005 (known gap 59), filters, texts in EN/DE, constants registered.
  - **Not yet:** Predict and Identify; background, slowing, artefacts, variants; EEG signs and observables; the EEG in the cases. A folded patch (crown and sulcal walls) is the suggested way at gap 59.
- **The EEG station, part 2a (ADR-017 decision 13):** the station's second tab, "A seizure" (`app/station-eeg-seizure.ts`).
  - **The engine** (`physiology/brain/corticothalamic.ts`): `Region` (one corticothalamic loop: RK4, delay buffers, the progression and the relay brake, `gains()` for Stuiver's X, Y, Z) and `Brain` (ten regions, thresholded coupling into the relays, `stimulate`, `activity()`, seeded noise). Constants in `evidence/seizure.ts` (`CT`, the published model and our path and brake) and `BRAIN_COUPLING`.
  - **A trial** (`physiology/brain/trial.ts`, `seizureTrial`): settle, stimulate, run; onset, end, duration, dominant frequency by second, suppression, gains at rest and after. Used by the fit, the tests and the screen.
  - **To the scalp** (`stations/eeg-seizure.ts`): each region a 30 cm² crown patch under its electrodes; `scalpFromActivity`.
  - **Fit:** `node scripts/fit-seizure.mjs` (the brake's rate to Luccarelli 2021's duration; `--scale-only` for the firing-to-moment scale to Pottkämper 2021's amplitude). Several minutes.
  - **Tests:** `npm run test:seizure` (about a minute, in `npm test`). Known gaps 60–63.
  - **For ECT:** done in ECT part 1: the device's pulses go into the cortex as a rate (`Brain.pulses`), not into the relay.
- **The ECT station, part 1** (ADR-017 decision 14; Ward card "ECT station"; `npm run test:ect`, about 4 minutes, in `npm test`):
  - **The device** (`stations/ect-device.ts`): a state machine after the manual; `stimulusFor(program, percent, user)`; program tables in `stations/ect-programs.ts` (from Addendum VII, by script). The panel order follows the owner's photograph.
  - **The current** (`physiology/brain/ect-stimulus.ts`): `PLACEMENTS`, `StimulusField` (reciprocity through part 1's head; `at`, `magnitude`, `brainShare`), `thresholdField(width)`, `regionDoses`, `pulseTrain`, `fieldSection`.
  - **Thresholds** (`physiology/brain/ect-trial.ts`): `seizes`, `firstSeizing`, `thresholdCharge` on a ladder of stimuli (interpolated between steps by the drive each needs).
  - **The session** (`stations/ect-session.ts`): `EctSession` (device, brain, impedances, the four channels at 200 Hz, the paper log, `lastReport()`), `scriptedTreatment`. Measures in `stations/ect-indices.ts`; texts in `stations/ect-texts.ts`.
  - **Constants:** `evidence/ect.ts` (`ECT`); fits in `scripts/fit-ect.mjs` (`pulseDrive`; `--emg` for `emgThreshold`). Known gaps 64–67.
  - **The heart (part 2a, decision 15):** `EctSession.body` is a `LivePatient` (healthy model) advanced in 0.1 s blocks beside the brain; channel 4 is its lead II; `heartRateAt(t)`, `longestPause`, `pressure`, `give(drug, mg)`. The stimulus sets `run.external.vagalStim` (`vagalDrive(placement, width)`, fitted to Stewart 2010) while the current flows, fading with `BARO.tauP`; the seizure sets `run.external.adrenergic` (`ECT.seizureSympathetic` × `ictalIntensity`, fitted to Nagler 2013). New in the body: `HeartElectrical.vagalStim` (the sinus node as a phase that slows or stops within its cycle; the junction's escape held back by `junctionLag`), `Circulation.vagalBlock`/`betaBlock`, `CirculationRun.external`, and atropine, glycopyrrolate, esmolol, labetalol in `Drugs` (`vagalBlock()`, `betaBlock()`; constants in `evidence/drugs.ts`). Fits: `scripts/fit-ect-heart.mjs vagal|surge|esmolol`. Known gaps 68–71.
  - **The procedure (decision 16):** `stations/ect-procedure.ts`: `Procedure(session, order, mode, roles)`, `STEPS` (role, kind, `after`), `act(step)` for room steps, `tick(dt)` notices the device steps and runs the team (device steps as generators after the manual), `errors`, `canHurry`, `waitFor`, `summary()`. It starts the room without clean skin, pads or leads (`setPrepared(false)`, `setPads(null)`, `monitoringCable = false`). Tests in `scripts/ect.test.mjs`, "The treatment as a procedure".
  - **Not yet:** the anaesthetic, relaxant, hyperventilation and oxygen in the model (part 2b, PR C; the procedure's anaesthetic steps set the order only); age, sex, the threshold's rise, titration over a course (part 3); indications, mechanisms, drugs, history (part 4). The intermittent program cannot be given (volley timing not in the manual). The panel's USER SET light marks the user program, not a saved user set (SAVE USR is not offered).

## Interventions and scenarios (ADR-018)

Read `docs/adr/ADR-018-interventions-scenarios.md`, especially "Step 1, as built".

- **Code:** `src/vp/scenario/` (types, `run.ts`, `chance.ts`, `validate.ts`), the registry `src/vp/data/interventions.ts`, scenarios in `src/vp/scenarios/*.json` (exported as `SCENARIOS` from `src/vp/index.ts`). Not to be confused with `src/scenarios/`, which belongs to the older runtime (`src/main.js`).
- **One clock:** `ScenarioRun` advances in ticks of 0.1 s; inputs land between ticks; the encounter's `Session` runs on the same clock. Drive it with `advanceTo(seconds)`, never with the live patient's own frame loop, or a run cannot be replayed.
- **One seed:** every source of chance draws a named stream from `Chance`; the heart is seeded from it. Add a new use of chance as a new stream name.
- **Replay:** `replay(def, { seed, caseDef, log })`. The test checks that a replay reproduces everything exactly; keep it that way (no `Math.random`, `Date` or wall-clock time in a run).
- **Interventions** write only circulation, lung and electrical inputs (the validator refuses the body's slow parameters). Times that are judgements are marked `placement`.
- **Course physiology:** a case's `course[].change.physiology` is applied to the running model in a scenario. The encounter alone still does not apply it.
- **The two scenarios are drafts** for checking the layer (`copd-ed-oxygen`, `vestibular-ed-course`); there is no scenario screen yet.
- **Step 2a, chest compressions:** the circulation takes `Pchest` (the intrathoracic pressure rise) from a compressor on its own clock (`physiology/cpr/compressions.ts`); constants in `evidence/cpr.ts` (the rise measured, the thoracic aorta's share derived, the cardiac pump's extra fitted once by `scripts/fit-cpr.mjs`). Coronary perfusion pressure is a metric (`CPP`, `CPPend`). In a scenario, `cpr.compressions` and the `compress` input (tapped onsets, replayed exactly). Tests: `scripts/arrest.test.mjs`, known gaps 20 and 21.
- **Step 2b, breathing in arrest:** the respiratory centre fails when the brainstem is not perfused (`brainPerfusion` from the host); gasping drawn from the seed (Clark, Bobrow); the lungs get the real cardiac output; a CO₂ store (Stock) replaced the ungrounded `paco2Tau`; while breathing is not normal the lungs' gas is one mixed compartment (`stepAlveoli`); breaths given at the airway (`physiology/lung/ventilation.ts`: mask, supraglottic, tube, oesophageal). In a scenario: `vent.bag`, the `ventilate` input, `airway.supraglottic`, `airway.tube`. Read ADR-018, "Step 2b, as built", for what was validated and the gaps (22–25).
- **Practice screen (draft):** a "Practice · draft" card on the Ward opens `app/practice-arrest.ts`, a `ScenarioRun` of `scenarios/arrest-practice.json` on the free patient: he fibrillates 4 s in (a scene `change`, a scripted change to the model). The learner taps compressions (or the space bar), takes the bag and gives breaths as long as the press is held, and tells the nurse to compress, take the bag or give two breaths. The monitor draws the circulation's own 2 ms samples (ECG II, an arterial line for teaching, the compression pressure, airway pressure), with arterial pressure, coronary perfusion pressure, end-tidal CO₂, the breathing (breathing, gasping, not breathing), the learner's rate, count and hands-off time, two minutes of trends, and a log. Each run gets a fresh seed. Since then: the defibrillator (step 3), the line and drugs (step 4), the arterial line switchable, held breaths, and a phone layout (ADR-018, "The open questions … settled"). Not yet: the debrief. Pictures: `figure-anatomy-images/practice-arrest/`.
- **Later (owner, 2026-10-20):** a real patient and animated tools in the arrest, as in the examination and the stations: where the hands go for compressions, the airway and mask grip, pads on the chest, a venflon placed before drugs. The buttons are a stand-in until the circuit is right. See ADR-018, "A first practice screen".
- **Step 3, the heart in an arrest:** `physiology/heart/arrest.ts` (the myocardium's state M from coronary perfusion; VF coarseness, the rhythm after a shock, contractility), asystole in the electrical model, the defibrillator in scenarios (`defib.pads`, `defib.charge`, `defib.shock`; outcomes and VF recurrence drawn from the seed; hazards for unsafe shocks). Constants in `evidence/arrest.ts` with what is measured, derived and placed. Read ADR-018, "Step 3, as built".
- **Step 4, the drugs:** `physiology/drugs/drugs.ts` (a dose into a vein, arriving with a 30 s placement; adrenaline with its half-life measured in arrest, acting on the arterioles only; amiodarone lowering the recurrence of VF). Constants in `evidence/drugs.ts`; the arterial gain is fitted by `scripts/fit-drugs.mjs` to Paradis's rise after a first dose, and his own several-dose protocol is a known gap (the CPP ceiling of gap 20). In scenarios: `drug.adrenaline`, `drug.amiodarone.300`, `drug.amiodarone.150` (need `access.iv` and the drugs in the room; a `dose` event). `scripts/arrest.test.mjs` also runs a cheap cohort through the shocks (MyocardialState and the chance streams, not the circulation) against ARREST and PARAMEDIC2. Read ADR-018, "Step 4, as built". Gap 26 (PEA) is unchanged: adrenaline's β effects are not modelled.
- **The stale-constant check** in `vp-model.test.mjs` now covers the `arrest` and `drugs` groups (step 3 had left `arrest` out).
- **Step 5, part 1, the guideline and the debrief:** `src/vp/guidelines/` (`erc-2025-als.json`, read against the ERC 2025 text; `score.ts` scores a run from its record; `validate.ts`). The run records every compression and a once-a-second trace; `check.rhythm` records the rhythm seen. The practice screen has "Finish and debrief" and a "Check rhythm" button; the debrief is `app/arrest-debrief.ts`. Tests: `npm run test:debrief`. Read ADR-018, "Step 5, part 1, as built".
- **Step 5, part 2, the team and the scene:** `ScenarioRun.call` (what the call says; the arrest team arrives 2 min later, 90 s more without "where"), `assign` and `roles` (compressions, airway, defibrillator, drugs), `fetch.trolley`. The practice screen draws the scene each frame (`render/arrest-scene.ts`: the bedside figure collapsing, the team behind the trolley, hands pumping with the compression pressure, the bag squeezing with the airway pressure, pads, defibrillator, drip); the team panel gives tasks; orders and read-backs are spoken in bubbles. The debrief is a ring and grouped cards. Read ADR-018, "Step 5, part 2, as built".
- **Step 5, second pass (playability):** he slumps and stays up until `bed.flat`; compressions need him supine; `assess.breathing`, `assess.mouth`, and in a quarter of runs a bolus in his pharynx that blocks every breath until `airway.clear` (airway kit on the trolley). Two new rules (breathing checked first; a blocked airway cleared). Toasts over the scene say what was refused and what was found; the debrief narrates the heart's course. Read ADR-018, "Step 5, second pass, as built".
- **Phone layout:** under 600 px the practice screen is one fixed screen (scene, strip, status, pad, tabs with slide-up sheets); people and the patient in the scene can be tapped on any screen for a menu of what can be done there. Read ADR-018, "The phone layout".
- **Step 5, part 3, teaching nudges:** six set-ups (the sixth, `seizure`, since 2026-10-24) in the scenario (`nudges`), chosen before a run ("Surprise me", "Pure chance", or a lesson) and revealed in the debrief; each overruled draw is marked in the run's chance events. Read ADR-018, "Step 5, part 3, as built".
- **Playtest copy (owner, 2026-10-23: "use it for everything … in a mirrored version of the app"):** the deploy publishes the same app twice, at the root and at `/playtest/` (locally: `lab.html?playtest`). Only the playtest copy records (`app/session-record.ts`), on the device only: each tap and setting on every screen (ward, cases, stations, the practice arrest), the app's state at each change of screen, refusals and messages screens report (`note`), and each finished practice arrest with what replays it (`recordRun`). A purple bar says so and has "Save session", which downloads one file (`vp.playtest-session/1`); it is also kept in localStorage every 30 s. `node scripts/playtest-report.mjs <files>` lists time per screen, the path, refusals, quiet stretches and most touched controls, and replays and scores each arrest. A report made in the playtest copy carries the trail's last 60 steps. The protocol for the owner's sessions is a doc ("Playtest: practice cardiac arrest").
- **Agreed order (owner, 2026-10-23):** playtest; then a non-shockable arrest (PEA); then placing hands and pads; assessment only once courses are planned.
- **Arrests with a cause (owner, 2026-10-23: "We need all PEA situations that are required to be capable of all CPR situations"):** the guideline's reversible causes (hypoxia, hypovolaemia, potassium and metabolic, hypothermia; pulmonary and coronary thrombosis, tension pneumothorax, tamponade, toxins) and the heart's own PEA (gap 26), one PR each. A check of the model unchanged found: massive PE gives PEA; tension pneumothorax does nothing to the circulation (the pleural-pressure input `dPpl` is the hook); bleeding levels off at 63/52 even after 60 % loss (the decompensating phase, Barcroft / Schadt & Ludbrook 1991, is missing); tamponade looks right at 500 mL but its pericardial constants are ungrounded and above 550 mL the numbers blow up. Order: PE (done), vessel collapse (done; the shared prerequisite), tension pneumothorax (done), bleeding (done), tamponade (done), potassium (done: hyperkalaemia, hypokalaemia), hypoxia (done, with gap 26 partly), hypothermia (done), toxins (opioid done, local anaesthetic done; beta-blocker and tricyclic not in the ERC 2025 text read), gap 26.
- **Vessels collapse (done, 2026-10-23):** the first step of the tension pneumothorax and of bleeding. A floor backstop in the circulation (`domains/cardio/sim/circulation.ts`) refilled an emptied right atrium from the systemic veins whatever the pressures: a hidden pump that kept a bled circulation going and let no pressure in the chest stop it. Now: the great veins' waterfall (`CIRC.venousCollapsePressure`, Guyton 1957), the tube law below unstressed volume (`CIRC.collapseCompliance`, a placement), no backflow through the arterioles, no flow out of an empty compartment (`CIRC.emptyVolume`, numerical), and a floor deficit taken back from downstream. Results: a 20 % bleed holds pressure (Schadt & Ludbrook 1991, phase 1); half the blood lost gives no pulse; +20 mmHg in the chest stops output; tamponade no longer blows up above 550 mL (it stops the circulation; draining restores it), though its pericardial constants are still ungrounded. No other test moved beyond 0.1 mmHg. Gap 38: the decompensating phase of haemorrhage.
- **Arrest from a tension pneumothorax (done, 2026-10-23):** `scenarios/arrest-tension.json` (`scene.cause: 'tension-pneumothorax'`, `causeSide: 'left'`): an hour after a left subclavian line, the left lung collapsed with trapped air at 8 mmHg, then 25 at the collapse (placements). New respiratory inputs `tensionL/R` (mmHg), added to the pleural pressure the heart feels (`LUNG.tensionTransmission`, 1, a placement); with the vessels able to collapse, a pressure above the mean filling pressure stops venous return and gives PEA. `assess.chest` (each side silent or not; which side pushes the trachea over), `decompress.left` / `decompress.right` (a cannula from the trolley; only the tension's side helps). Guideline 1.4.0: `decompress-tension` (`done-for-cause`, 2 min, a placement; ERC 2025 Special circumstances, read only in part). The practice draws among three arrests. Gap 39: the tension does not build with breaths given (Roberts 2015).
- **Arrest from blood loss (done, 2026-10-23):** `scenarios/arrest-bleeding.json` (`scene.cause: 'hypovolaemia'`): an ulcer bleed, a third of the blood volume lost for 45 s (3200 mL, hypotensive with a pulse), then half (2500 mL): PEA, possible only since the vessels can collapse. `fluid.bolus` (500 mL through a pressure bag, counted in when it has run; equipment `fluids`, brought by the team in every arrest so the controls do not give the cause away); about 1000 mL brings a pulse back. Guideline 1.5.0: `fluids-hypovolaemia` (begun within 3 min, a placement) and `fluids-only-hypovolaemia` (a hazard outside hypovolaemia, ERC's own words). `done-for-cause` now counts an intervention from when it began. Not checked: how the body's fluid model moves a crystalloid bolus out of the vessels over the run. Stopping the bleeding is outside the scene; gap 38 (people decompensate at about 30 %) applies.
- **Arrest from a tamponade (done, 2026-10-23):** `scenarios/arrest-tamponade.json` (`scene.cause: 'tamponade'`): the day after a pacemaker, a perforating lead; 400 mL in the pericardium for 30 s (hypotensive, raised venous pressure), then 500 mL: PEA with equalised pressures (Reddy 1978). `pericardiocentesis` (to 200 mL left, a placement; the bleeding does not re-accumulate). `assess.echo`, a focused ultrasound in the pause (ERC 2025: POCUS may help identify tamponade and tension pneumothorax), shows in each arrest its own sign: a large effusion, a dilated right ventricle, absent lung sliding, small empty ventricles (thresholds are placements). The ultrasound and the pericardiocentesis set come with the team in every arrest. Guideline 1.6.0: `pericardiocentesis-tamponade` (5 min, a placement). Gap 40: the pericardium is ungrounded; at Reddy's 16 mmHg right atrial pressure the model has no output left.
- **Arrest from hyperkalaemia (done, 2026-10-23):** the heart now reacts to potassium beyond the ECG's shape: at an effective potassium of 8.0 the sinus impulse is blocked and a slow, wide ventricular escape takes over, slowing as potassium rises; at 9.5 it stands still (`HeartElectrical.kEffective`, `hyperKBlock`, `hyperKStandstill`; the run reads standstill as asystole, and the myocardium depletes in it). Calcium raises the effective threshold (`drug.calcium`, 6.8 mmol; `Drugs.calciumRise`); insulin with glucose moves potassium into cells (`drug.insulin`; `Drugs.potassiumShift`, Harel 2016). Scenes may now clamp chemistry (`chemistry.potassium`, as a learner can). `scenarios/arrest-hyperkalaemia.json`: a dialysis patient, K 8.6 for 30 s (escape at about 27/min), then 10.0 (asystole). Guideline 1.7.0: `calcium-hyperkalaemia` (3 min) and `insulin-hyperkalaemia` (5 min), placements. Gap 41.
- **A heart that beats on too little oxygen runs down; hypoxic arrest (done, 2026-10-24):** gap 26 partly closed. `MyocardialState.step` now runs the myocardium down whenever its supply falls short, beating or not: supply = coronary perfusion (as before) × arterial oxygen content against `ARREST.criticalCaO2` (10 mL/dL, an assumption: the coronary reserve covers anaemia). An organised heart below `ARREST.standstillM` (0.05) stops and reads as asystole (`HeartElectrical.myocardialStandstill`, `standstill()`). Nothing else in the suite moved; gap 35 closed (PEA from an embolism now declines). Scenarios can now say what happened before the clock (`before`: changes run for some seconds before t = 0). `scenarios/arrest-hypoxia.json` (owner: status epilepticus as a cause): after a long seizure he has not breathed for 7 min; he arrives with a pulse, desaturated; PEA follows in about 4 min unless he is ventilated, and breaths prevent the arrest. Guideline 1.8.0: `ventilate-hypoxia` (`fromStart`, 60 s). Gaps 42 (no bradycardia before the hypoxic arrest) and 43 (the bag gives room air). The seizure-at-onset variant of the VF practice (ERC 2025 BLS) is next and needs the figure to show jerking.
- **A toxic arrest: an opioid (done, 2026-10-24):** `scenarios/arrest-opioid.json` (`scene.cause: 'opioid'`): the day after an operation, a morphine pump; apnoeic for 6 min before the clock (`before`). Breaths prevent the arrest; `drug.naloxone` gives back the breathing drive after its 1–2 min; once the heart has stopped it should do nothing for it (ERC 2025 First aid: "Naloxone is not effective once cardiac arrest has occurred"); in the model it still does (gap 45). `scenario.test.mjs` now counts known gaps. Guideline 1.9.0: `naloxone-opioid` (3 min from the start, a placement); `ventilate-hypoxia` now applies to hypoxia and opioid (`done-for-cause` takes a list of causes). Gap 44.
- **Arrest in hypothermia (done, 2026-10-24):** `scenarios/arrest-hypothermia.json` (`scene.cause: 'hypothermia'`): found in the snow, core 26 °C (`chemistry.temperature`, a clamp), then VF. A cold myocardium needs less oxygen (`MyocardialState.demand`, ERC's 6–7 % per °C); below 30 °C shocks rarely end VF and adrenaline accumulates (placements). The run records a fourth shock below 30 °C and adrenaline below 30 °C as hazards. Guideline 1.10.0: `hypothermia-shocks`, `hypothermia-adrenaline` (the guideline's own rules; `no-hazard` can be limited to a cause) and `ecls-hypothermia` (`call.ecls`, 5 min, a placement); the normothermic drug rules carry `skipCauses: ['hypothermia']`. Gap 46.
- **Arrest from a pulmonary embolism (done):** `scenarios/arrest-pe.json` (`scene.cause: 'pulmonary-embolism'`, `reveal` for the debrief): 85 % of the bed blocked before the collapse, 95 % after (placements). Alteplase (`drug.alteplase`, 50 mg; `Drugs.lysed`, `DRUGS.lysisRate` from PAIMS 2) dissolves the same fraction in every lobe; the host hands the lungs the emboli left. Guideline 1.3.0: `adrenaline-non-shockable` (`dose-non-shockable`, 60 s from possible, a placement) and `thrombolysis-pe` (`dose-for-cause`, 5 min, a placement); `adrenaline-first` no longer counts a dose in a non-shockable rhythm as early. The practice now picks the arrest at random for a surprise or pure chance and reveals it in the debrief; the PE arrest is also a lesson. The VF practice (0.7.0) carries the lytic too, so the controls do not give the arrest away. Tests: `arrest.test.mjs` (Wood 2002, PAIMS 2; gap 35), `scenario.test.mjs`.
- **The stunned heart after a shock (gap 26, done 2026-10-24):** a shock that leaves an organised rhythm draws a stunning (`MyocardialState.stun`, uniform up to `ARREST.stunMax` 0.835, recovering over 6 h after Laurent 2002); contractility × (1 − stun). So an organised rhythm after a long VF may stay pulseless under compressions (PEA), come back over minutes, or come back within a minute of adrenaline (its vasoconstriction alone; Norvik 2025). `stunMax` is derived once by `scripts/fit-stunning.mjs` (about an hour) from Norvik 2022's 0.15 per minute; the cohort in `arrest.test.mjs` uses the full model's times to a pulse by stunning (`STUN_T`). The run logs the drawn stunning as a chance event.
- **Arrest from local anaesthetic toxicity (done, 2026-10-24):** `scenarios/arrest-local-anaesthetic.json` (`scene.cause: 'local-anaesthetic'`): bupivacaine into a vein during a nerve block. A scene can now give a `poison` (a drug that reaches him outside anyone's hands; a `poison` event). Free plasma bupivacaine 0.4 mg/L for 20 s (Knudsen 1997's CNS threshold 0.3), then 3.8: both ventricles depressed (`Drugs.cardiacDepression`, half at 1.0 mg/L, a placement), PEA. It leaves with Litonius 2012's half-life, 45 min, 25 min with lipid emulsion (`drug.lipid`, 100 mL of 20 %, ERC 2025), the only lipid effect measured in people. With CPR his own pulse comes back after about 33 min with lipid and 51 min without: the ERC's "prolonged resuscitation (> 1 h) and ECPR". Guideline 1.13.0: `lipid-local-anaesthetic` (the bolus within 3 min, a placement). Gap 48. Beta-blocker and tricyclic poisoning are not in the ERC 2025 Special circumstances text read (the RCUK text cites only lipid emulsion); the AHA 2023 toxicology update would be the source.
- **Arrest from hypokalaemia (done, 2026-10-24):** `scenarios/arrest-hypokalaemia.json` (`scene.cause: 'hypokalaemia'`): a man on a loop diuretic with diarrhoea, potassium 2.4 (a clamp), U waves, then VF. At or below 3.5 mmol/L VF comes back after a terminating shock with 2.45 times the hazard (Nordrehaug 1983 by analogy; gap 47). `drug.potassium` (20 mmol over 2–3 min) and `drug.potassium10` (10 mmol over 2 min), the guideline's regimen; potassium chloride spreads in the extracellular fluid and moves into cells down to Kruse 1990's retained fraction (`DRUGS.potassiumRetained`, `potassiumTau` a placement). Both doses take him above 3.5 for about six minutes. Guideline 1.12.0: `potassium-hypokalaemia` (the first 20 mmol run in within 5 min, a placement). Interventions may carry a `timing.status` of `guideline`. The debrief marks every drug with its own letter (calcium and insulin had shown as amiodarone's "Am").
- **Seizure-like jerking at the onset (done, 2026-10-24; owner: "Also, status epilepticus we need?"):** the VF practice's sixth nudge, `seizure`. 1.5 s after the collapse he jerks for 7.7–16.5 s (drawn; Lempert 1994's induced syncope, 12.1 ± 4.4 s, placements: `ARREST.seizureDelay`, `seizureMinSeconds`, `seizureMaxSeconds`), and the nurse says so (a nudge may carry a `say`). The run records a `seizure` event and `seizing()`; a breathing check while he jerks is marked `seizing` and cannot judge the breathing. Guideline 1.11.0: such a look does not count for `check-breathing`, and `start-compressions` is timed from the end of the jerking (ERC 2025 BLS, Smyth: "Once the seizure stops, assess breathing"). The scene draws the jerks (`jerkPose` in `render/arrest-scene.ts`: multifocal, arrhythmic flexion twitches of each limb on its own clock, with generalised jerks now and then, after Lempert; amplitudes placed by eye, never into the mattress). The eyes (open, deviated upwards in Lempert) are not drawn. A long seizure as the arrest's cause is the hypoxia arrest above.
- **Assessment mode (5b): deferred to the very end** (owner, 2026-10-25). The lab will likely be used for OSCEs, but that needs infrastructure first (student and teacher accounts, a backend), and it should cover the whole lab, not only the arrest. Until then the priority is more of the model: more specialities, more stations, more physiology, more animation and immersion.
- **Next here:** the rest of the animated arrest (placing hands and pads by dragging, on the chest view), when the owner chooses it.

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
| The neurological examination | The bedside figure on the edge of the bed: pronator drift; finger–nose with overshoot and intention tremor; the arm and leg reflexes by grade, with clonus and the plantar response; tone moved by the examiner's hands (spastic catch, cogwheel, rest tremor); heel–shin; rapid alternating movements; Romberg from the front; gait in nine patterns. In the ward (after the test) and the neurological station | `render/neuro-motion.ts`, `app/neuro-motion-view.ts` |
| Physiology chapters | Living diagrams of the running models | `app/diagrams.ts` |

The dispatch from a performed manoeuvre to its visual is `visualFor` in `app/app.ts`. Everything else, including the other limb, coordination, reflex, sensory, abdominal and general tests, currently produces text only.

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
