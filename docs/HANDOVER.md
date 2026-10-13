# Handover: start here

Last updated: 13 October 2026, after PR #24.

This page is the entry point for anyone (or any agent) picking up the work. It covers:

- how to build and check the project;
- the rules agreed so far;
- what is done;
- the open lists;
- where the next topic, animations, starts.

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
| Teaching cards for all 109 examinations in EN/DE; standard names (#23) | `docs/examination-and-teaching.md`, `src/vp/data/teaching/` |
| Cards checked against the cases (#24) | test section "Teaching cards against the cases" |

## Open lists

- **Physiology known gaps (8).** See `docs/evidence-grounding-status.md`, including the suggested order. Start with the cardiopulmonary reflex.
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
| 12-lead ECG | Electrodes placed by the learner; tracing from the model's dipole | `app/focus-ecg.ts`, `render/ecg-paper.ts` |
| Positions | The whole-patient figure moves between poses by interpolating joint angles | `render/patient-figure.ts` |
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

Their resolvers already return structured values, for example `neuro.coordination` returns dysmetria (none, mild or marked), intention tremor, and whether weakness limits the test. `render/patient-figure.ts` is a jointed skeleton posed by joint angles: a natural base for limb and gait animation in the same style as the bedside figure.

Respect `prefers-reduced-motion`, as the figure already does.
