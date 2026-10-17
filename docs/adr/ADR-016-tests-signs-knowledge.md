# ADR-016 — Tests, signs and a queryable clinical knowledge graph

Status: Accepted; steps 1–3 done (#37, #39, #40); open points decided (#44); step 4a, references and debrief in signs (#47); step 4b, the observe-only level (#48)  
Date: 2026-10-17  
Repository: ClinicalPhysiologyLab

Appendix: [`ADR-016-inventory.md`](ADR-016-inventory.md), generated from the draft tables in [`adr-016/`](adr-016/).

## Context

The examination mixes two different things: what the examiner *does* (a test) and what is *found* (a sign).

- **Tests and observables are already separate.** A manoeuvre `reveals` properties, and a property is a typed value: `eye.lid` holds `ptosisMm`. That part is sound.
- **Signs exist only as free text.** They are the 265 `abnormal[]` entries on the teaching cards (205 distinct texts). They are duplicated across cards, and no code can tell whether a patient has one.
- **Names mix the two.** Thirteen tests are labelled with a sign or a finding ("Peripheral oedema", "Asterixis", "Carotid bruit", "Sensory level"). So are some properties (`legs.oedema`, `skin.liver-stigmata`).
- **Properties stand in for signs.** The expert reference and the debrief ask whether a *property* was examined. The "cards against cases" test asks whether a property differs from normal. Neither can say *which* sign. One consequence: every patient is told "on looking left: horizontal jerk nystagmus" in all four directions. That is physiological end-point nystagmus, but nothing names it as normal, and the card check counts it as nystagmus.
- **Nothing is queryable.** "Which syndromes and conditions show ptosis?" has no answer in data.
- **Colleagues should eventually edit the clinical content** through a backend, while the physiology stays in code.

## Decisions

### 1. Five clinical layers, linked as a graph

| Layer | What it is | Example |
|---|---|---|
| **Test** | What the examiner does | Inspection of the eyes at rest; sustained upgaze |
| **Observable** | A typed value the models produce | `eye.lid.ptosisMm`, `hands.crt` |
| **Sign** | A named finding, defined on observables | Ptosis = lid ≥ 2 mm lower |
| **Syndrome** | A named constellation of signs | Horner's syndrome; signs of consolidation |
| **Condition** | A diagnosis | Carotid dissection, myasthenia gravis |

**Structure** (anatomy, joined to the neuro graph) sits beside them for localisation.

It is a graph, not a tree. Ptosis leads to Horner's syndrome, third nerve palsy and myasthenia gravis. Horner's syndrome is reached from ptosis and anisocoria. The interface shows it as a tree that unfolds from whichever node the learner starts at, in either direction.

### 1a. Presentations (added while building step 2)

A sign looks different on different tests: consolidation is "dull" to percussion, "bronchial" to auscultation and "increased" to vocal resonance. The card texts describe exactly that. So a **presentation** links one or more tests to the signs (and the syndrome) it shows, and carries the words: a `description` and a `meaning`.

- **Its signs must be ones its tests can elicit**, by the signs' definitions. Signs its words merely mention ("the eye is down and out, *with ptosis*") are `accompanying`.
- **Condition links name the presentations that assert them** (`via`), so a card shows each finding with its own conditions.
- **A test card** is its presentations, then the further signs it can elicit (derived), then the normal variants.
- **A sign card** gathers the sign's presentations across tests.

### 2. The line between code and knowledge

- **Code (hard-coded):** the physiology models, resolvers, formatters, renderers, and the list of observables with their value types and normal ranges.
- **Knowledge (tables, editable later):** tests, signs, syndromes, conditions, structures, the links between them, thresholds, texts in each language, references.
- **Observables are the contract.** The models promise to produce them; the knowledge refers to them. The build exports them as a read-only table, so an editor can choose from them but never change them.

A sign definition only *reads* model output. It cannot change the physiology, so it cannot be used to tune the model toward an expected answer (rule 1 of the handover).

### 3. Sign definitions

A sign is defined by a predicate over observables, written as data:

```json
{ "obs": "eye.lid", "path": "ptosisMm", "op": "ge", "value": 2, "ctx": { "gaze": "primary" } }
```

- **Operators:** `eq`, `ne`, `in`, `gt`, `ge`, `lt`, `le`, `has` (a list contains a code), `hasWhere` (a list contains a matching record), and `abnormal` (outside the observable's own grounded normal, e.g. capillary refill by age and sex).
- **Composition:** `all`, `any`, `not`.
- **Side:** `any` (default), `one` (unilateral) or `both`.
- **Context:** the examination context the value must be observed in (gaze, position, eyes closed, sustained upgaze).
- **Named predicates:** patterns that a threshold cannot express are written in code, registered by id, and named from data, the same way resolvers are today. The draft needs 21, among them:
  - `ctxDelta`: a change between two contexts (orthostatic fall, fatigable ptosis);
  - `sideDiff`: a difference between sides (anisocoria);
  - the nystagmus patterns;
  - the field patterns;
  - the Romberg sign;
  - the facial weakness patterns;
  - the root and sensory patterns: myotomal, dermatomal, hemisensory, crossed.
- **Thresholds carry evidence statuses** as constants do in the registry (`measured`, `derived`, `assumed`, `standard`), with references. Nine thresholds in the draft are `assumed` and listed for grounding: ptosis, anisocoria, raised and empty JVP, wide pulse pressure, refractory hypoxaemia, abduction deficit, foot drop, fatigable ptosis. (Gaze-evoked nystagmus needs none since #36: the model flags the physiological drift itself.)
- **A sign may have no definition yet.** It is then "not represented": it is taught and linked but not simulated. The draft has 40 such signs, among them pleural rub, glossitis and stocking sensory loss.
- **Normal variants are signs too**, flagged `normalVariant` (end-point nystagmus). Naming them is how the app tells a learner that a finding is normal.

### 4. Granularity

A sign takes **qualifiers**: side, severity, distribution, and context, such as "greater in light". A separate sign exists only where clinicians use a separate name; it then links to its parent with `variant-of`.

- Fatigable ptosis is a variant of ptosis.
- The Carvallo sign is a variant of a pansystolic murmur.
- "Deep breathing" is the sign. *Kussmaul* is the name when the cause is a metabolic acidosis. That is interpretation, so it lives on the link to ketoacidosis rather than in the definition.

### 5. One relation table

| Relation | From → to | Attributes |
|---|---|---|
| `variant-of` | sign → sign | |
| `part-of` | sign → syndrome | `role`: required, supporting, or **absent** (a pertinent negative, e.g. a normal head impulse in the central vestibular pattern) |
| `suggests` | sign or syndrome → condition | frequency, mechanism text, qualifier (complete ptosis, pupil-involving), references |
| `localises-to` | sign or syndrome → structure | side rule (same side, opposite side) |
| `is-a` | condition → condition | `peptic-ulcer-bleed` is an `upper-gi-bleed` |

- **Attributes live on the link, not the node.** Ptosis means different things in different places: 1–2 mm with a small pupil in Horner's (Müller's muscle), complete with a large pupil in a third nerve palsy, and progressive on upgaze in myasthenia.
- **Every row carries provenance:** author, reviewer, status (`draft`, `reviewed`) and references.
- **The validator enforces endpoint types per relation,** and forbids cycles in `is-a` and `variant-of`.

### 6. Derived, never authored

These are computed by the build or at run time, so they cannot drift:

- **which test elicits which sign:** a test that reveals the sign's observables in a matching context;
- **which cases show which sign:** evaluate the definition on the case;
- **a test card's list of abnormal findings:** the signs its observables can produce, with the conditions reached through syndromes;
- **discriminators:** signs that one condition has and another lacks;
- **the "suggests" closure:** sign → syndrome → condition, and up through `is-a`.

So "ptosis → Horner's syndrome, third nerve palsy, myasthenia gravis → their conditions" is a query, in either direction.

### 7. Texts and identifiers

- **Every learner-facing text sits in one table:** entity, field, language, text, review status. A new language is new rows. The validator still fails on a missing language.
- **Ids are stable and never shown.** Renaming changes the label, not the id. A retired id stays as `deprecated` with a pointer to its successor, because learner progress and the Evidence tables refer to ids.

### 8. Storage and build

- **One JSON file per table** in `source/knowledge/`, checked against a JSON Schema:
  - `tests`, `signs`, `syndromes`, `conditions`, `structures`;
  - `relations`, `texts`, `references`;
  - plus `observables`, generated and read-only.
- **The build validates everything:**
  - every link resolves;
  - endpoint types fit their relation;
  - both languages are present;
  - every definition names an existing observable, field and context dimension, with a value of the right type;
  - every named predicate is registered.
- **The build compiles the tables into the bundle.** The app stays one offline file.
- **Later, the same schema moves into a database** with an editing interface for colleagues. Their edits publish as a content release that goes through the same validator and test suite, without touching the physiology code.

The draft tables in `adr-016/` already use this shape, so they become the first content of `source/knowledge/`.

### 9. Statistics live in the Evidence domain

Diagnostic accuracy is a fourth domain, **Evidence**, beside Circulation, Neurology and Labs. A sign card links to it by sign id and definition. The graph itself holds no likelihood ratios, because an LR belongs to a clinical question (target condition, setting, comparison population, reference standard), not to a sign.

The Evidence domain stores:

- **counts** (2×2 tables, or 2×k for ordinal signs), with the statistics derived from them;
- **reported pooled estimates** where no counts exist, flagged as such;
- **base rates** per setting;
- **reliability** (kappa) per sign;
- **validated scores** as the only sanctioned way to combine signs.

It gets its own ADR.

### 10. Cases, encounters and the debrief speak in signs

- **The expert reference** lists signs (with side and qualifiers) instead of property refs. A property ref stays allowed where a number matters ("SpO₂ 88 % on air").
- **A recorded finding keeps the observation** (the typed value) and, separately, the sign the learner named, if any. That makes documentation scoreable, both for misses and for over-calls.
- **The debrief reports in signs:** "You found ptosis on the left, but not that it was fatigable."
- **The "cards against cases" test becomes "signs against cases":** each `suggests` link to a condition that has a case must be produced by that case, or the sign must carry a `modelGap` note. The hand-kept `CARD_EXCEPTIONS` list moves into that column. The check becomes stricter than today's "any abnormal value", so expect it to surface gaps that were hidden.

### 11. Interface

1. **The examination menu lists tests only,** named as tests. Fourteen labels change: thirteen sign names and one tidy-up. The proposals in EN and DE are in the appendix, for review.
2. **After a test, the result names the signs.** The observation text stays. Below it, a line names every sign whose definition the test's observations meet, with side and qualifiers: "Signs: ptosis (left, 3 mm), anisocoria (left smaller)". Each opens its sign card.
   - **Pertinent negatives:** signs the test is designed to look for but did not find are listed as "looked for, not found", collapsed by default.
   - **Normal variants are named as normal:** "end-point nystagmus (normal)".
3. **Signs are named wherever the model allows it,** not only after a targeted test. The bedside figure already shows jaundice, cyanosis, pallor, sweating, oedema, ascites, barrel chest, accessory muscles and pursed lips without any test.
   - The figure itself stays unlabelled ("no highlighting", figure contract rule 3).
   - The signs it shows are named when the learner performs **General inspection**.
   - With the free patient, an Explore panel **"Signs present"** lists every sign the model currently produces, each with the tests that elicit it.
   - In a case, that list stays hidden until the learner commits to a diagnosis.
4. **A findings list** collects the signs elicited so far in the encounter, as a structured note the learner can review.
5. **An "observe only" level** hides sign names after tests. The learner names what they see from a sign picker; the debrief scores misses and over-calls against the model. The default stays as today: the app names the sign.
6. **Two kinds of card:**
   - **Test cards** keep how, normal, pitfalls and animation, and list the signs the test can show (derived).
   - **Sign cards** hold the definition, the tests that elicit it, its syndromes and conditions (conditions hidden during a case until commit, as now), and the link to Evidence.

### 12. Coverage: where the model shows a sign, and where it does not

Each test run prints a coverage report, as it does for evidence grounding today. Per sign it gives:

- **representation:** model, case layer only, needs another context, or not represented;
- **the channels that present it:** text, bedside figure, eye close-up, face view, sound with phonocardiogram, chest view, pulse trace;
- **the cases that produce it.**

The `modelGap` column on the sign table records what to add in a later run. The appendix is that report for the current code. Its main findings:

- **Gaps between views.**
  - Jaundice, pallor and cyanosis colour the bedside figure, but the eye close-up and face view are drawn from the patient's fixed appearance. A jaundiced patient has white sclerae there.
  - Lid retraction, lid lag and exophthalmos are text only; the eye close-up draws the lids from ptosis alone.
  - Saccadic pursuit is not drawn.
  - The depth of breathing is not drawn.
- **Renderers declared but never wired to a visual:** `svg.field`, `svg.fundus`, `svg.dermatomes`, `svg.neck`, and `svg.patient` for Romberg, gait and finger–nose. Those findings are text only. The movement signs among them belong to the animation topic.
- **Signs that cannot be elicited.** Finger–nose and heel–shin are only observed with the eyes open, although the property supports `eyesClosed`. So limb ataxia that appears only with the eyes closed (dorsal columns) cannot be found.
- **Values that exist but that no model produces:** pleural rub, uraemic fetor, rigidity. Values with no observable at all: pericardial rub, carotid bruit, glossitis, fetor hepaticus, a site for abdominal tenderness, consciousness as an examinable finding.
- **The end-point nystagmus defect** described under Context (fixed in #36).
- **79 of 202 signs** are produced by at least one of the 17 cases. Most of the rest wait for a case: Horner's syndrome, a third nerve palsy, myasthenia, cerebellar stroke.

### 13. Diagnoses that belong in another layer

Some current diagnosis ids are syndromes, states or laboratory findings. The appendix lists ten, among them:

- **syndromes:** `horner-syndrome`, `third-nerve-palsy`, `lateral-medullary-syndrome`, `cauda-equina-syndrome`;
- **a state:** `thyrotoxicosis`;
- **laboratory findings:** `hyperkalaemia`.

Moving them changes what a learner commits to at the end of a case, so it needs the owner's decision.

## Migration (one PR per step)

1. **Knowledge tables** (done in #37):
   - add `source/knowledge/`, the schema, the validator, the compile step, and the observables export;
   - load the draft signs, syndromes and links;
   - add the coverage report;
   - replace `CARD_EXCEPTIONS` with `modelGap`.
   - No interface change.
2. **Cards:** build test cards and sign cards from the tables. Card findings become presentations (§1a), and all card texts move into the text table. Done in #39.
3. **Interface:** test renames; sign naming after a test, with pertinent negatives and normal variants; General inspection naming what the figure shows; findings list; the "Signs present" list (in Notes, with the free patient or after commit). Done in #40.
4. **Cases and debrief** in signs, then the "observe only" level with documentation scoring.
5. **Model gaps,** in later runs, worked from the coverage report.
6. **Backend and editing interface,** when the tables have settled.

## Open points for the owner (decided 2026-10-17)

1. **Assumed thresholds:** raised JVP > 3 cm (standard); ptosis ≥ 1 mm, graded (standard); anisocoria grounded in Lam 1987 and fatigable ptosis in the ice-test criterion (Golnik 1999) (derived); wide pulse pressure and foot drop standard; "refractory hypoxaemia" renamed *hypoxaemia despite oxygen*, anchored to the BTS target; abduction deficit described as the examiner sees it (still assumed).
2. **Reclassification:** accepted. Diagnoses carry a `kind`: Horner's, third and sixth nerve palsy, lateral medullary and cauda equina syndrome, and sepsis are syndromes; thyrotoxicosis is a state; hyperkalaemia, hyponatraemia and hypercalcaemia are laboratory findings. Each syndrome or state is the knowledge syndrome of the same id and suggests its causes; sepsis is flagged by qSOFA, with fever and the rest as `associated` members. Committing one is scored as the right level, with a prompt for the cause.
3. **Renames:** accepted as proposed.
4. **Card fixes:** the opening snap now points to mitral stenosis (new condition) and the Austin Flint rumble, without a snap, to aortic regurgitation; hypothermia is below 35 °C, with below 36 °C named as the SIRS criterion.
5. **Grouping:** asterixis and postural tremor are one test, *Arms outstretched, fingers spread, then wrists bent back*; the merged skin, hand and chest-wall inspection stays merged.

Also decided: the septic-shock case is set at infection 0.92, where the untreated patient meets Sepsis-3 (lying 70/45, lactate 2.6); the GI-bleed case stays as it is (about 600 mL lost: normal lying vitals, pulse 79 → 108 and 115/80 → 84/70 on standing, consistent with McGee 1999 for a moderate loss).

## Consequences

- **Every sign is written once,** in every language, and checked against the model.
- **Every link is queryable** in both directions, and new learning modes come from queries rather than new content: spot the sign, which test, what does it mean, assemble the syndrome, discriminate, document.
- **Clinical content becomes editable** without touching the physiology, and an edit cannot break the model, only fail validation.
- **The card-versus-case check becomes sign-precise,** so some currently hidden gaps will appear as failures or `modelGap` entries.
- **Cost:** a new build step and validator, about 21 named predicates in code, and a one-time migration of the cards. The draft tables cut most of the migration work.
