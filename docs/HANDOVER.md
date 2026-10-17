# Handover: start here

Last updated: 17 October 2026, after PR #34 (ADR-016 proposed).

This page is the entry point for anyone (or any agent) picking up the work. It covers:

- how to build and check the project;
- the rules agreed so far;
- what is done;
- the open lists;
- the proposed data model for tests, signs and the knowledge graph, which comes first;
- where the topic after it, animations, starts.

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
- **Vendored `node_modules`:** `source/node_modules` is in git and holds macOS binaries.
  - On Linux the esbuild *CLI* fails with "Exec format error". The JS API works, and the build scripts use it.
  - `npm run verify` may touch files under `node_modules` and `dist`. Before committing, run `git checkout -- source/node_modules source/dist` and commit source files only.
- **Deploy:** every push to `main` runs `.github/workflows/deploy.yml`. It tests, builds `dist/lab.html` and publishes it to the `gh-pages` branch, which GitHub Pages serves. A merge is live a few minutes later.
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

## Open lists

- **Physiology known gaps (9).** See `docs/evidence-grounding-status.md`, including the suggested order. Start with the cardiopulmonary reflex.
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
- **Card content review.** The card texts are standard clinical teaching, written but not yet read by a clinician, the German especially. References are cited only where a threshold rests on a study.
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

## First: tests, signs and the knowledge graph (ADR-016, proposed)

Agreed with the owner before more content is added: separate tests from signs, define each sign on the model's observables, and put the clinical knowledge into tables that colleagues can later edit through a backend. The physiology stays in code.

- Decision and migration plan: `docs/adr/ADR-016-tests-signs-knowledge.md`.
- Inventory for review (202 signs, 25 syndromes, every card finding mapped, where the model shows each sign): `docs/adr/ADR-016-inventory.md`.
- Draft tables in the target shape: `docs/adr/adr-016/`.
- Statistics (sensitivity, specificity, likelihood ratios) go into a separate Evidence domain, linked from the sign cards; it gets its own ADR.

Animations (below) should hang on signs once step 1 of the migration is in.

## Next topic: animations

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
