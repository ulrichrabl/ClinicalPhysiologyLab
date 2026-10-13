# Virtual patient — design spec

Status: **Draft for review** — data model (§8), models and measurements (§8a) and the app (§2) implemented
Date: 2026-10-11
Supersedes: the Bedside and Learn layers of PR #4 (closed). Builds on ADR-001 to ADR-015.

---

## 1. What this changes, and why

The app currently has too many parallel things: specialty tabs (Circulation,
Neurology, Labs), patient-first layers (Patient, Examine, Investigate, Treat,
Explore), and in PR #4 a Learn layer, CME modules and a Bedside encounter on
top. The navigation does not match how a clinician thinks.

A clinician meets **one patient** and sees them at different depths:

| Depth | Question it answers | What it is in this app |
|---|---|---|
| **Clinical** | What do I see, hear and feel? | The patient in the room: history, examination, the monitor if attached |
| **Investigations** | What do the tests show? | What I ordered, arriving with realistic delays |
| **Physiology** | Why is this happening? | The mechanism: PV loop, circulation, reflexes, how the ECG arises |
| **Anatomy** | Where is the problem? | The nervous-system graph today; heart, vessels and imaging later |

These **layers** replace specialties as the primary structure. A specialty
becomes a tag on a case.

The second change is the examination. The Bedside in PR #4 was a guided menu:
highlighted tap spots and curated lists told the student where to look. Here
the student is **confronted with the patient and decides what to do**. Nothing
is highlighted, and the patient answers anything a clinician could do at the
bedside, normal or abnormal.

### Principles

1. **One patient, one truth.** All layers read the same Patient Runtime state
   (ADR-001). Nothing is authored twice.
2. **Nothing offered, everything answerable.** The interface never suggests
   what is relevant. Any examination action from the full vocabulary returns
   a finding.
3. **Derived, not written.** Findings come from the models wherever a model
   exists. Authored case findings fill only what no model covers.
4. **Ground truth is hidden during an encounter.** It is revealed only after the
   student commits (extends ADR-005).
5. **Guidance is a dial, not the default.**
6. **Offline first.** Everything works from a single HTML file. Any LLM
   feature is an optional layer on top, never a dependency.

---

## 2. Information architecture

### As built (October 2026)

One page, `dist/encounter.html`, built from `src/vp/app/`:

- **Ward**: the cases, and a **free patient** (a healthy adult on the
  physiology bench).
- **Patient**, in four layers:
  - **Bedside**: the patient figure, history by free text, the examination
    by text or by touch, notes. Focused views open where the examination
    needs them: the eyes and face (canvas), the chest for auscultation
    (stethoscope where the learner puts it, phonocardiogram and sound,
    optional landmarks and the heart beneath), the pulse wave, and ECG
    recording (the learner places ten electrodes).
  - **Tests**: ordering, results with turnaround, lab tables with reference
    ranges, the 12-lead on millimetre paper, and for every test *what it
    measures and how*.
  - **Physiology**: one chapter per model (§8a), opened on this patient.
  - **Model**: the Model Lab, every variable of every model as a list.
- In a case, Physiology and Model are locked until the learner commits;
  afterwards the Model Lab shows the case read-only. In the free patient
  everything is open and every parameter can be changed while it runs.

The plan below is the original design; where it differs, the above is what
exists.

### Top level: three places

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Clinical Physiology Lab       Cases     Patient     You                │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Cases**: the library. Full encounters and short drills. Filter by
  presentation, specialty tag, difficulty and layer.
- **Patient**: the current patient, viewed through the four layers.
- **You**: progress, spaced review and history of encounters. No CME
  machinery for now (see §9).

### The patient screen

```
┌─ Mrs Evelyn Hart, 78 · Acute medical unit ─────── ⏱ 00:12:40 ── Encounter ┐
│  Clinical   Investigations (2)   Physiology 🔒   Anatomy 🔒                │
├────────────────────────────────────────────┬───────────────────────────────┤
│                                            │  Notes                        │
│         [ the patient, in bed ]            │  14:02  Asked about chest pain │
│      no hotspots, no highlights            │         "Only on the hill…"   │
│                                            │  14:05  Carotid pulse: slow-  │
│                                            │         rising, low volume    │
│                                            │  14:07  Auscultation, 2nd R   │
│                                            │         ICS: ejection systolic│
│                                            │         murmur …              │
├────────────────────────────────────────────┴───────────────────────────────┤
│ ›  auscultate 2nd left ics, bell, expiration held▏          ⌫  [Commit…]   │
└────────────────────────────────────────────────────────────────────────────┘
```

### Two modes on the same screen

| | **Encounter** | **Explore** |
|---|---|---|
| Purpose | Assessment practice | Understanding mechanisms |
| Clinical layer | Only what you do or ask | Same |
| Investigations | Only what you order, with turnaround time | Everything available immediately |
| Physiology / Anatomy | Locked until you commit | Open; parameters adjustable |
| Clock | Runs; the patient changes | Pausable |
| "Why?" on a finding | Hidden until debrief | Shown |

Today's specialty workspaces (Loop, ECG, Localise, Examination, Results)
become the contents of the Physiology, Anatomy and Investigations layers in
Explore mode. Their lessons and MCQ cases become **drills** in the library,
attached to the layer they train.

---

## 3. The patient model

```
                    ┌──────────────────────────── Patient Runtime ─────────────────────────────┐
 case definition ──▶│ conditions → effects on ports → models (circulation, ECG, chemistry)     │
                    │ nervous-system lesions (graph)                                           │
                    │ case layer: authored findings the models do not cover                    │
                    │ patient state: position, consciousness, pain, fatigue, cooperation       │
                    │ clock                                                                    │
                    └───────────────────────────────┬──────────────────────────────────────────┘
                                                    │ observe({ type: 'perform.action', … })
                                                    ▼
                                         finding (text, structured, provenance)
```

- **Models** (existing): circulation and ECG, chemistry, the nervous-system
  graph, cord-injury condition. These cover the cardiovascular examination,
  vital signs, the full neurological examination, and lab values.
- **Case layer** (new, authored): findings outside any model, keyed by site and
  verb. Examples: a rash, abdominal guarding, a mass, a goitre, clubbing,
  fundoscopy appearance, mental state. It never contradicts a model value; a
  test enforces this.
- **Patient state** (new): position (supine, 45°, sitting, standing, left
  lateral), level of consciousness, pain, fatigue, cooperation, exposure.
  Actions read and change it.
- **Normal by default.** Any site or verb not affected by a model or the case
  layer returns the age-appropriate normal finding. Example: absent ankle jerks
  can be normal at 85, and a soft flow murmur in pregnancy.

### Provenance on every finding

```ts
interface Finding {
  action: ActionRef;            // what was done
  text: string;                 // "Ejection systolic murmur, grade 3/6, loudest at the 2nd right ICS"
  structured: { sign: string; value?: number | string; grade?: number; side?: 'L' | 'R' | 'B' };
  normal: boolean;
  provenance: 'model' | 'heuristic' | 'case' | 'default-normal';
  basis: string;                // the model value behind it, shown only after commit
  at: SimTime;
}
```

`heuristic` marks bedside rules applied to model values where no model exists
(respiratory rate, SpO₂, capillary refill, S3/S4). The debrief labels these
honestly.

---

## 4. The examination: an action grammar

### Grammar

```
action      := verb  target?  qualifier*
verb        := inspect | palpate | percuss | auscultate | measure | test
             | ask | instruct | position | expose | order | give
target      := body site   (from the anatomical site ontology, with side)
qualifier   := side (left | right | both)
             | instrument (diaphragm | bell | tendon hammer | tuning fork 128/512 Hz
                           | pen torch | ophthalmoscope | neurotip | cotton wool | ...)
             | manoeuvre  (inspiration | expiration held | Valsalva | sit forward
                           | left lateral | squat-to-stand | ...)
             | depth      (light | deep)           for palpation
```

Examples:

```
auscultate 2nd right ics, diaphragm
auscultate apex, bell, left lateral, expiration held
reflex ankle left                          → test · reflex · ankle · L
swinging torch test                        → test · pupils · RAPD
palpate rlq deep                           → palpate · abdomen RLQ · deep
measure jvp                                → requires position 45°
position sit forward
order troponin
```

### Vocabulary size

The vocabulary must be large enough that knowing what to do is the skill, not
recognising it in a list. Target for M1:

| Domain | Sites | Manoeuvres (verb × site × qualifier) |
|---|---|---|
| General inspection | 12 | ~30 |
| Vital signs and monitoring | – | ~12 |
| Hands and arms | 14 | ~25 |
| Head, eyes, mouth, neck | 20 | ~40 |
| Cardiovascular | 12 | ~45 |
| Respiratory | 16 | ~40 |
| Abdomen | 14 | ~35 |
| Neurological (existing 107 bedside tests, reorganised) | 30 | ~110 |
| Musculoskeletal and skin | 20 | ~30 |
| **Total** | **~150** | **~370** |

Each manoeuvre is data:

```ts
{
  id: 'auscultate.aortic-area',
  verb: 'auscultate', site: 'chest.2nd-right-ics',
  synonyms: ['aortic area', '2nd right intercostal space', 'right upper sternal edge', 'RUSE'],
  requires: { instrument: ['diaphragm', 'bell'], position: ['supine', '45', 'sitting'], exposure: 'chest' },
  seconds: 20,
  reads: ['circulation.valves', 'circulation.flows', 'case.chest'],
  normal: 'S1 and S2 heard, no added sounds, no murmur.',
}
```

### Input: command bar and body, both, neither giving hints

- **Command bar** with autocomplete over the **entire** vocabulary, never
  filtered by the case. It uses synonyms and abbreviations ("ruse", "jvp",
  "babinski"), and tolerates typos.
- **Touching the body** opens a radial or sheet menu of everything possible at
  that site. Every site offers the same full set in every case.
- **The patient drawing has no hotspots.** It shows what can be seen from the
  end of the bed: posture, colour, breathing, distress, drips, a cervical
  collar. A learner who never looks at it misses those signs.
- **Examination routines** ("cardiovascular examination") are available as
  macros. A routine runs its steps, costs the full time, and is marked in the
  debrief as routine versus targeted examination. At low guidance levels it
  can be switched off.

### Preconditions and realism

| Mechanism | Example |
|---|---|
| Position | JVP needs 45°; sacral oedema needs the patient rolled; Romberg needs standing |
| Instrument | Reflexes need a tendon hammer; Rinne needs a 512 Hz fork |
| Exposure and consent | Chest exposure asks permission; intimate examinations need consent and a chaperone |
| Patient ability | Drowsy patients cannot follow commands; a patient in pain guards; fatigable signs appear on repetition |
| Contraindication | Moving the neck in suspected cervical injury, or standing a hypotensive patient, is allowed and recorded as harm |
| Time | Every action costs simulated time (seconds to minutes), and the physiology advances |

A failed precondition is answered the way the patient or situation would
answer ("I can't sit up, it hurts"), never with a hint about what to do.

### Resolution pipeline

```
input text ──▶ parse (synonyms, fuzzy) ──▶ ActionRef
ActionRef ──▶ preconditions (position, instrument, exposure, ability)
          ──▶ time cost → runtime.advance()
          ──▶ runtime.observe({ type: 'perform.action', action })     // extends perform.examination
          ──▶ resolvers by `reads`: circulation | neuro graph | chemistry | case layer | default-normal
          ──▶ Finding ──▶ notes
```

Resolvers reuse what exists: the bedside derivations from PR #4 (pulse
character, JVP, apex, heart sounds, crackles, oedema, peripheries) and the
neurological test matchers (with the upper motor neuron fix from PR #5).

---

## 5. Talking to the patient

### Now: free text matched to case facts (offline)

- The case defines **history facts** grouped by topic, about 60 topics:
  - presenting complaint, with SOCRATES for pain
  - systems review
  - past medical history and medications, allergies
  - family history and social history
  - ideas, concerns and expectations
- The learner types freely. An intent matcher (synonyms, stems, phrase
  patterns, no network) maps the question to topics. The patient answers in the
  persona's voice with the matching fact, or a natural negative if the topic is
  covered but negative.
- An unmatched question gets a natural non-answer ("Sorry, I'm not sure what you
  mean"). Every unmatched question is logged so case authors can extend the
  matcher.
- Facts are only revealed when asked. Volunteering is authored explicitly (a
  patient in pain mentions it unprompted).
- Consciousness, pain and distress shape the answers (drowsy, fragmentary,
  unable).

### Later: LLM role-play, grounded

An LLM plays the patient. It receives the persona and the case facts, and it
may reveal only facts that are asked about, and "I don't know" otherwise.
Every answer is checked against the fact list before display. The same
mechanism enables the **mental state examination** (appearance, speech, mood,
thought form and content, perception, cognition, insight). This runs through
Claude in the hosted version, and with the user's own API key in the offline
file.

---

## 6. Investigations

- **Ordering** uses the same command bar ("order fbc", "order ecg").
- Results arrive after realistic turnaround times in simulated time:
  - ECG, monitor, blood gas: minutes
  - Bloods: about 1 hour
  - Echo, imaging: hours
- Results come through `observe` (existing laboratory and ECG observation
  plugins), so they reflect the physiology at the moment of sampling.
- Each order has an effect: blood volume drawn, cost, time. Over-investigation
  shows up in the debrief.

---

## 7. Commit, debrief and guidance

### Commit

- A **ranked differential** chosen from a searchable diagnosis catalogue (about
  200 diagnoses, with synonyms), instead of four options that give the answer
  away.
- A confidence rating per diagnosis.
- Optionally: the key findings that support it, and an immediate management
  step.

### Debrief

Each case carries an **expert reference examination**:

```ts
expert: {
  essential:      ['auscultate.aortic-area', 'palpate.carotid', 'ask.exertional-syncope'],
  discriminating: ['auscultate.carotid', 'palpate.apex'],   // separate it from the differential
  redFlags:       ['ask.exertional-syncope'],
  harmful:        ['test.exercise-tolerance'],              // contraindicated here
  timeBudget:     '15 min',
}
```

The debrief shows:

- **Timeline.** Your actions next to the expert's, with gaps marked.
- **Missed.** Each missed essential or discriminating action, and what it would
  have shown (revealed now).
- **Harm.** Contraindicated actions taken.
- **Reasoning.** Your differential against the truth, with the findings that
  separate them.
- **The truth.** The Physiology and Anatomy layers unlock. Each finding links to
  its mechanism ("why was the S2 soft?" → aortic valve model, gradient 90 mmHg).

Scores are qualitative by default: complete, targeted, efficient, safe.
Numbers are optional.

### Guidance dial

| Level | Behaviour |
|---|---|
| Off | Nothing. |
| Prompts | Neutral nudges by system: "You haven't examined the abdomen." Never names a finding. |
| Coach | After each action: "What are you looking for?" The student states a hypothesis, which is compared with the expert's reasoning in the debrief. |
| Walkthrough | For first-time learners: the expert's examination is shown step by step on this patient. |

---

## 8. Data model

The foundation everything else is built on. It lives in `source/src/vp/` and is
covered by `scripts/vp-model.test.mjs` (116 checks). Nothing in the app uses it
yet; M1 connects it to the Patient Runtime.

### Five layers, all plain data

| Layer | What it holds | Where |
|---|---|---|
| 1. Ontology | Body structures (paired ones expand to `.L` / `.R`), scales, value sets, instruments | `data/ontology.ts` |
| 2. Observables | Everything that can be perceived: a typed, structured value, an age- and sex-appropriate normal, the context dimensions that change it, and where its value comes from | `data/properties.ts` |
| 3. Manoeuvres | Verb + structure, what it reveals in which context, what it requires (position, exposure, instrument, ability, consent), how long it takes, when it is harmful | `data/manoeuvres.ts` |
| 4. Case | One patient: pathology that drives the models, a case layer for what no model covers, history facts, investigations, course over time, expert reference, diagnosis | `cases/*.json` |
| 5. Encounter | An append-only event log: actions (performed or blocked, and why), findings, utterances, orders, results, state changes, hazards, notes, commit | `engine/encounter.ts` |

Everything is JSON-serialisable. Code (resolvers, formatters, renderers) is
referenced by id and registered in `registry.ts`, so data never contains
functions and a future authoring platform can read and write all of it. The
shared vocabulary exports as one JSON document (`exportCatalog()`); cases are
already JSON files.

### Findings are values, never sentences

A finding is a structured value: a nystagmus is
`{ present, type, fastPhase, torsion, slowPhase, spvDegPerS, amplitudeDeg, frequencyHz }`,
a murmur `{ valve, timing, shape, grade, pitch }`, a pupil `{ sizeMm, reaction }`.
From the one value:

- **Formatters** write the clinical sentence in any language (English and
  German now; a language is added as labels in the data plus one branch per
  formatter).
- **Renderers** draw and animate it. `render/eye-motion.ts` already turns a
  nystagmus value into eye angles over time; its measured slow-phase velocity
  matches the model's within 5%.
- **The debrief** compares it with the expert reference, and later with the
  learner's own notes, on the structure rather than the wording.

### Where a value comes from

Each property declares its source: `model` (only a resolver over the
runtime), `case` (only authored), or `model-or-case`. Observation runs in a
fixed order: model resolver, then the case layer, then the age-appropriate
normal. Every examinable property always answers, by the same path whether
normal or not, so nothing reveals relevance. The validator forbids a case from
authoring a model-only property: physiology cannot be contradicted by hand,
only changed through the pathology.

Each finding records its provenance (`model` / `case` / `default-normal`) and,
for model findings, the quantity it rests on ("aortic gradient 76 mmHg";
"false-negative Rinne: bone conduction heard by the other cochlea"). The
debrief shows these after the commit.

### Context

Signs depend on how they are elicited. The examination context carries site,
gaze, fixation, position, respiration, instrument, which eye is lit, ambient
light, eyes closed, which eye is covered, direction of a head impulse, and how
long a posture is held. Models compute context-dependent values directly
(fixation suppressing a peripheral nystagmus, the bell needed for an S4).
Authored values use rules: `{ value, when: [{ if, mode: replace | merge | scale }] }`.

### Models behind the seed set

- **Vestibular and ocular motor** (`models/neuro-exam.ts`): resting tone per
  side, central compensation, a leaky gaze-holding integrator, fixation
  suppression, VOR gain, otolith pathway. It reproduces HINTS from the lesion
  alone: left vestibular neuritis gives a right-beating horizontal-torsional
  nystagmus that obeys Alexander's law and is suppressed by fixation, an
  abnormal head impulse to the left and no skew; a left lateral medullary
  lesion gives a normal head impulse, direction-changing nystagmus, skew with
  the left eye lower, and Horner's syndrome; a cerebellar lesion gives
  gaze-evoked nystagmus and ipsilateral dysmetria. Pupils, lids, ductions,
  visual fields and hearing come from the nervous-system graph.
- **Cardiovascular** (`models/cardio-exam.ts`): pulse, blood pressure, JVP,
  apex, heart and lung sounds from the closed-loop circulation's beat metrics.
  Raising aortic valve resistance produces a graded ejection murmur that
  radiates to the carotids and changes pitch at the apex, a soft single S2, a
  slow-rising carotid pulse, a heaving apex and an S4 heard with the bell.

- **Neurological** (`models/neuro-limb.ts`): cranial nerves V, VII and IX–XII,
  speech and language, and the limbs (tone, MRC power for 15 movements, five
  reflexes and the plantar response, pinprick by dermatome and nerve territory,
  vibration and joint position, pronator drift), plus gait. It reads which
  graph pathways a lesion interrupts, whether upper or lower motor neuron, and
  at which rung (cortex, cord, root, plexus, nerve, junction, muscle). The
  classic dissociations come out of the lesion with nothing written down:
  - pyramidal weakness, face and arm more than leg in a cortical MCA lesion
  - an L5 root weakens dorsiflexion, eversion, inversion and hip abduction
    together, while a peroneal palsy spares inversion and hip abduction
  - an ulnar lesion spares thumb abduction where a C8 root does not
  - a facial nerve palsy takes the forehead, an upper motor neuron lesion
    spares it
  - myasthenic weakness fatigues with repetition
  - a myopathy is proximal with normal reflexes
  - Brown-Séquard and Wallenberg give their crossed sensory losses
  - the facial-movement examination is animated from the same values

### Example cases

Four cases, all complete in English and German: `acute-stroke-left-mca.json` (an aphasic patient with collateral history from his wife) and `foot-drop-right-l5.json`, plus `vestibular-neuritis-left.json` (pathology: `vestibular-hypofunction`, left,
80%, day 1) and `exertional-syncope-as.json` (pathology: `Raortic 0.3`). None of them authors a single eye, heart or neurological
finding; all of them come from the models.

### Validation

`validateCatalog` and `validateCase` check what an authoring platform must
check on save: every id resolves (structures, properties, value sets, graph
nodes, conditions, topics, facts, diagnoses), every learner-facing string
exists in each language the case declares, every authored value fits its type,
model-only properties stay model-only, and a published case has a clinical
reviewer. Terminology codes (SNOMED CT, LOINC, FMA, ICD) have fields
everywhere; only the standard vital-sign LOINC codes are filled. The rest are
for clinicians to map, never to be guessed.

### Language

History matching and the action parser (`engine/language.ts`) use the
phrasings in the catalog, per language, with simple normalised matching. An
LLM can later replace the matcher and return the same structures; nothing else
changes.

---

## 8a. Physiology as models, findings as measurements

Agreed 2026-10-11, and implemented. The line is drawn radically: **an ECG is
not physiology, nor is a potassium of 6.8 or a murmur.** They are
*measurements* of physiology, each made through an instrument with physics,
limits and artefacts of its own. The connection is explicit in the data.

### Models (`src/vp/physiology/`)

A model is a chapter of a living textbook (`ModelDef`): its variables
(parameters a case or the Model Lab sets; states the simulation computes),
its governing equations as data (`MathNode` trees, rendered as MathML both
symbolically and with the patient's current values substituted), a diagram
id, and sources. Equations are given at textbook level, with the full system
one level down; they are the equations the code runs.

| Chapter | What runs | Diagram |
|---|---|---|
| Haemodynamics | closed-loop circulation: time-varying elastance chambers, valves (stenosis and regurgitation as separate paths), compliant vessels, conserved blood volume | circuit with chambers sized by volume, valves opening, flow; PV loop with ESPVR/EDPVR; Wiggers diagram |
| Baroreflex | receptor sigmoid, sympathetic/vagal tone, four effectors (rate, resistance, venous capacity, contractility) | sigmoid with the moving operating point, tone bars, effectors |
| Cardiac electrical activity | beat scheduler (sinus driven by the autonomic state; AF, flutter, AV blocks, escape, VT, VF) and the heart's dipole H(t) built from the activation sequence; K⁺ and Ca²⁺ from the fluids model | conduction system lighting in sequence; frontal vector loop on the hexaxial system; E_K |
| Breathing: mechanics and ventilation | equation of motion Pmus = V/C + R·V̇ integrated breath by breath, passive expiration (intrinsic PEEP when 3τ exceeds the expiratory time), lung volumes and the forced expiration (flow limited by recoil over resistance) from ECSC predicted values | lungs inflating with each breath, lobes coloured by their state, pleural fluid and air; volume and flow traces; flow–volume loop against predicted |
| Gas exchange and oxygen transport | five lobes, each split into a low and a high V/Q unit plus shunted and dead-space fractions; each unit solved by O₂ and CO₂ mass balance against the Severinghaus and CO₂ dissociation curves, mixed venous blood from cardiac output and VO₂ (Fick); diffusion limitation by capillary transit time; hypoxic vasoconstriction per lobe and per unit; emboli as lost vessels and dead space; Starling filtration from left atrial pressure filling interstitium then alveoli from the bottom up; pulse- and co-oximetry | V and Q bars per lobe with V/Q and PAO₂; the dissociation curve at the patient's pH, CO₂ and temperature with arterial and mixed venous points |
| Control of breathing | central CO₂ (as CSF pH, so chronic bicarbonate resets it), carotid [H⁺] and O₂, drive from the lung's own receptors; delivered ventilation limited by a sustainable fraction of MVV; rate and depth shared out by load and stiffness. Winters' formula emerges | the controller line meeting the metabolic hyperbola, with the operating point moving; bars for each drive |
| Body water and sodium | amounts, not concentrations: total body water split between cells and ECF by osmotic equilibrium, ECF between plasma and interstitium by a Starling balance that settles over hours; exchangeable sodium; ADH from tonicity and (steeply) volume; thirst; urine flow = solute ÷ urine osmolality; whole blood lost or given | the compartments to scale against normal; water in and out; ADH and urine osmolality |
| The kidney | GFR with autoregulation whose lower limit an ACE inhibitor, an NSAID and volume depletion raise; creatinine and urea by production and clearance (urea reabsorbed when flow is slow); sodium excretion by volume, pressure, aldosterone and angiotensin with diuretic braking; K⁺ secretion by plasma K⁺, aldosterone, distal flow and tubular adaptation; ammonium and bicarbonaturia; tubular injury, obstruction, nephron loss | GFR against perfusion pressure with the operating point; what the urine carries today against what came in |
| Potassium and acid–base | K⁺ shared between cells (≈140 mmol/L, moved by insulin, adrenaline, pH, tonicity) and ECF, about 300 mmol per mmol/L; a base balance (fixed acid, ketoacids, lactate, ammonium, vomit, stool) in an apparent space twice the ECF; chloride by electroneutrality, so the anion gap is the unmeasured anions; pH by Henderson–Hasselbalch with the lungs' CO₂; clamps for what no model produces yet | Gamblegram, pH against the HCO₃⁻/CO₂ ratio |
| Glucose, insulin and ketones | glucose balance (gut, liver output suppressed by portal insulin, brain, insulin-dependent uptake, renal threshold); insulin secretion, injected insulin absorbed from a depot; ketogenesis without insulin, saturable oxidation, ketonuria; lactate from oxygen extraction near its limit, cleared by the liver in proportion to its flow | pools of glucose, ketoacids and lactate with fluxes in and out |
| Infection, inflammation and fever | infection severity → cytokine signal (settling over hours); hypothalamic set point and core temperature; CRP synthesis with a 19 h half-life; neutrophilia (leukopenia when overwhelming); platelets consumed; in sepsis: vasoplegia (lower SVR, venous pooling, blunted baroreflex effectors), capillary leak (plasma and albumin to the interstitium), myocardial depression, septic kidney injury, lactate; fever raises O₂ consumption, insensible loss, heart rate; cytokines drive fast breathing | thermometer against the set point; white cells, CRP, platelets, resistance, lactate |
| Blood: red cells and iron | red cell volume made under erythropoietin (kidney oxygen sensing, blunted in CKD, raised by hypoxaemia), limited by marrow capacity, iron and B₁₂; destroyed after 120 days or faster in haemolysis; lost by bleeding; storage iron as a recycling loop with absorption (blocked by hepcidin in inflammation); MCV of each day's new cells; plasma expands to keep blood volume in anaemia | red cell and iron pools with flows |
| The liver | bilirubin conjugated and excreted (liver function, cholestasis); ALT, ALP, GGT from injury; albumin and clotting factors from synthesis (INR fast, albumin slow); ammonia from gut protein and digested blood against liver clearance and portosystemic shunting, graded as encephalopathy; portal hypertension: platelets held by the spleen, splanchnic vasodilatation, sodium retention, ascites (fluid the kidney cannot sense) | bilirubin, albumin, INR, ammonia, ascites, platelets against normal |
| Hormones: thyroid, adrenal cortex and calcium | TSH from the pituitary suppressed by free T4 (fourth power), T4 made by the gland under TSH, TSH-receptor antibodies (Graves) or levothyroxine, half-life a week; thyroid action sets metabolic rate (O₂ consumption), sinus rate, contractility, vascular resistance, temperature set point, sweating; ACTH driven by illness and suppressed by cortisol, cortisol from the adrenal (or hydrocortisone); cortisol short of what illness demands blunts vascular response to noradrenaline, gluconeogenesis and ADH restraint; aldosterone needs the adrenal but not ACTH; PTH answering ionised calcium within minutes; calcium from gut (calcitriol), bone (PTH, PTHrP, metastases, bisphosphonates) and kidney (PTH, sodium, diuretics, and a high calcium switching off its own reabsorption); hypercalcaemia causes nephrogenic diabetes insipidus, natriuresis and a lower GFR, and shortens the QT | the three loops, each pituitary or calcium-sensing hormone against what it controls, on normal ranges |
| VOR and gaze holding | labyrinth tone, compensation, leaky integrator, fixation | labyrinth tones and a live eye-position trace |
| Pupillary light reflex | afferent, pretectal, Edinger–Westphal, efferent, sympathetic | the pathway responding to a swinging light |
| Nervous system | the lesion graph | pathways interrupted |

**Evidence for every number.** Model constants live in a registry
(`src/vp/evidence/`), not inline: each has a value, unit, meaning, a status
(measured, derived, assumed, or not yet sourced), the references it rests on and,
for derived and assumed values, the working. References record DOI/PMID and how
far they were checked (full text, abstract, a secondary summary, or the
bibliographic record only). Model code reads constants through typed objects, the
chapter equations print them from the same source, and each chapter shows its
constants with their status and references. The test suite fails if a measured
or derived constant has no reference, if a derived or assumed one has no working,
if a reference is unknown, or if a registered constant is no longer used; it
prints how much of each model is grounded and which constants still await a read
of the original. Where the model misses measured data, the test reports it as a
known gap (△, with the numbers) instead of being loosened until it passes; the
gaps are listed below. Migration: the endocrine, water, kidney, circulation,
baroreflex and inflammation models and the reachable part of the kidney are in
the registry; the lungs, the ECG and the examination thresholds follow.

**Where the circulation and baroreflex constants come from.** The reference man
(45 years, 176 cm, 76 kg, supine) is anchored to human normals: left ventricular
volumes and ejection fraction (Lang 2015), wedge pressure derived from Kovacs's
pulmonary pressure and resistance reviews (mean PA 12.9 mmHg, PVR 69 dyn·s·cm⁻⁵),
blood volume (Nadler), systemic resistance (Johnson 2014). Both ventricles fill on
Klotz's normalised human EDPVR, anchored at 120 mL/8 mmHg (left) and 130 mL/5 mmHg
(right; that the right ventricle shares the left's curve is an assumption), which
replaced an exponential limb that left the ventricle three times too compliant at
its operating point. Right ventricular Ees follows Kuehne's coupling ratio (1.9).
Venous compliance and unstressed volume are set from Maas's measured stressed
volume (about a quarter of the blood) with the filling pressures held at their
normals; Maas's own compliance came with ventilation-raised pressures and would
leave a 1 L haemorrhage emptying the circulation. The heart-rate parameter is the
intrinsic rate (Jose: 118.1 − 0.57 × age), and the vagal and sympathetic gains are
fitted to it and to the rate under atropine (Cina): the model then gives atropine
101/min, double blockade 92/min and propranolol 62/min. Checked, not fitted:
cardiovagal baroreflex sensitivity 17 ms/mmHg (Monahan: 19 young, 8 older) and a
graded 1 L haemorrhage (Johnson 2014): pressure held, stroke volume −15 % (−20 %),
output −10 % (−11 %). With the reflex switched off, autonomic tone is held at rest.

**Where the inflammation constants come from.** The inflammatory signal is
abstract (1 = the response to a systemic infection) and severity runs from its
onset to septic shock as Sepsis-3 defines it. Grounded: CRP clearance (19 h
half-life, the same in health and disease: Vigushin), normal temperature
(Mackowiak), the time course of albumin loss (escape rate 5 %/h, more than
quadrupled in septic shock: Fleck). The arteriolar resistance lost to vasoplegia
is calibrated on the coupled model so that full severity, after 30 mL/kg of
saline, holds SVR at about half of normal: endotoxin alone lowered the SVR index
46 % in healthy volunteers (Suffredini), and an SVRI below about 0.7 of normal
marked those who died of septic shock (Parker 1987). Checked against outcomes: after
the fluid the output is high (1.4× normal) and the pressure needs a vasopressor
(MAP 67), with lactate about 2. Myocardial depression is real and reversible
(Parker 1984, Suffredini) but its size is assumed. The model's septic patient
looks like Parker's nonsurvivors: rate about 145 and small ventricles even after
fluid, not the dilated ventricle of survivors. Cytokine dynamics, the white cell
and platelet responses, capillary leak and vascular hyporeactivity are not yet
grounded. (The chapter's equation had printed 0.55 for a resistance loss the
model applied as 0.6; both now read the registry.)

**Known gaps (reported by the tests).** Haemorrhage raises the heart rate +3 %
against +14 % and lowers CVP 2.7 against 4.7 mmHg: there is no cardiopulmonary
(low-pressure) afferent and no pulse-pressure component of the baroreceptor
signal. The embolism-to-resistance mapping and right ventricular ischaemia are
ungrounded: moderate PE raises mean PA pressure only 2.4 mmHg and massive PE
shows shock without CVP above 10. Lung water at a wedge of 20 lowers PaO2 1.3 kPa.
Hypothyroid cardiac output falls 25 % (reported 30–50 %). The Addisonian crisis
lies at 113 systolic (half of crises present at 110 or less). With potassium adaptation added, the triple-whammy case reaches a potassium of 5.8,
not the 6.2 or more such patients present with; how much RAAS blockade impairs the
adaptation is not grounded. The heart rate is not yet a function of age,
and arterial and pulmonary compliances, atrial elastances, valve and pericardial
constants are not yet sourced.

**Where the water and kidney constants come from.** Volume is sensed as blood
volume (arterial filling), not extracellular fluid, so fluid leaked into the
tissues or pooled in the splanchnic bed holds sodium as the arterial-underfilling
hypothesis describes. Renin activity is separate from angiotensin II, which rises
only as renin^0.37 (Walker 1976) and less in septic shock, where converting
activity falls to 43 % (Benaroua 2025); a macula densa term reads the sodium
delivered before aldosterone acts. Renin's sensitivity to volume, the macula
densa, angiotensin II's vascular potency and the steepness of volume natriuresis
are fitted jointly to the Cochrane meta-analysis of salt reduction (renin +55 %,
aldosterone +127 %, systolic −1 mmHg; the model gives +63 %, +71 %, −1.1 mmHg:
aldosterone stays short, most likely for want of the adrenal's rising
sensitivity to angiotensin II on a low-salt diet); the aldosterone effect on
sodium is fitted to Dürr's fludrocortisone escape (345 ± 50 mmol; model 317) and
checked against DOCA expanding the ECF by about 2 L (Shade 1975). Plasma–
interstitial exchange follows Hahn's volume kinetics of crystalloid infusions.
Body water (Watson), ADH (Robertson, Thompson), GFR and concentrating ability
with age (Rowe), creatinine production (Cockcroft–Gault), urea and sodium
fractional excretion (Carvounis), bicarbonate threshold (Pitts) and ammonium
capacity are sourced. Potassium secretion now follows the potassium eaten:
the distal nephron's capacity rises over about a day toward the intake
(Rabelink: balance on 400 mmol/day in the second day, at a modestly raised
plasma potassium; the model gives 472 mmol/day at 4.4 mmol/L), which needs
mineralocorticoid (an assumption), and the secretion ceiling was raised from
6 to 25 mmol/h (the old ceiling held a 400 mmol diet at a plasma potassium of
15). How the kidney conserves potassium on a poor intake is not modelled.
Checked against Miller's urinary indices: established tubular necrosis gives a
urine osmolality of 338, urine sodium 95 and FENa 5 %; diarrhoea gives a
concentrated urine with FENa 0.05 % but a urine sodium of 32 (Miller: below 20).
The lower limit of autoregulation (72 mmHg of perfusion pressure) is an
assumption between the animal plateau of about 80 (Carlström) and the
outcome of SEPSISPAM (Asfar). Diuretic natriuresis, the tubular-injury and CKD
modifiers and most of acid handling are still not grounded: the human
acid-loading and diuretic studies that would ground them could not be read here.

**Where the endocrine constants come from.** Grounded in measurements: the cortisol
permissive effect (vascular gain halved at a complete deficit, from hydrocortisone
doubling the maximal α-agonist response with ED50 unchanged; basal resistance −20 %
from glucocorticoid-receptor blockade), applied to sympathetic, angiotensin II and
vasopressin constriction alike; thyroid action on metabolic rate (Graves' patients
before and during treatment; hypothyroid patients before and after levothyroxine),
on heart rate, SVR and blood volume (Table I of the Recent Progress in Hormone
Research review); the PTH–ionised calcium sigmoid (Brown's four-parameter form
through Ramirez's clamps). Checked against outcomes rather than fitted: adrenal
crisis presenting pressure (about half of crises present with systolic ≤100;
saline barely moves it, hydrocortisone raises it within an hour), typical calcium
and PTH in primary hyperparathyroidism, malignancy and vitamin D deficiency.
Assumptions and known gaps: overt disease is taken as free T4 4.5× (Graves’ at diagnosis) and 0.25× (untreated hypothyroidism) normal;
the model's resting ionised calcium is read as 1.24 mmol/L; the thyroid
temperature effect, cortisol's effects on ADH and glucose output, the renal
effects of hypercalcaemia and the potency scales of PTHrP and osteolysis are not
yet grounded; blood volume stays near normal in both thyroid states (measured 105.5 % and
84.5 %): the kidney defends blood volume, and the renin stimulation by thyroid
hormone and the fall in venous capacity that would move it are not modelled; untreated Addison's raises renin only about 1.4×, because the
kidney's floor on aldosterone-dependent sodium loss is too high.

`PatientModel` (`physiology/state.ts`) holds every parameter in one object:
patient, circulation, electrical, respiratory, vestibular, lesions, chemistry pins.

**Couplings** (`engine/circulation-host.ts`, every 0.1 s of simulated time).
Circulation → lungs: cardiac output, left atrial and pulmonary arterial
pressure. Chemistry → lungs: haemoglobin, metabolic bicarbonate, albumin.
Lungs → circulation: pulmonary vascular resistance (emboli, hypoxic
vasoconstriction), a chemoreflex drive (hypoxaemia and dyspnoea withdraw vagal
tone and add sympathetic), and an acutely overloaded right ventricle losing
contractility. Haemoglobin → circulation: blood viscosity. Body → circulation: thyroid action on the sinus rate, contractility and resistance, cortisol on vascular responsiveness, calcium on the ECG. Body → lungs: the metabolic rate. So a PE gives
tachycardia, a narrow pulse pressure and an EtCO₂ far below PaCO₂; a failing
left ventricle floods the bases; lactic acidosis is met by Kussmaul breathing.

### Measurements

Every model-backed property and investigation carries a `MeasurementSpec`
(`data/measurements.ts`): the model variables it reads and the physics of the
instrument (oscillometry reads mean pressure and estimates the rest; the JVP
is a manometer open to the right atrium; haemolysis raises potassium; the ECG
lead is a projection of H(t) onto its lead vector). The validator checks that
every measurement names real variables. Chapters list what observes them;
results link back to the chapter.

**The ECG as measurement** (`measurements/ecg.ts`). The electrical model
produces the dipole H(t) in Frank coordinates. Each electrode's lead vector is
Dower's at the standard positions and follows a field fitted to them
elsewhere, so a recording depends on where the electrodes are: V1–V2 two
spaces high, limb electrodes swapped, a low precordial row all give the
tracing those mistakes give. The machine axis is measured from the recorded
leads, so it moves with the misplacement too.

**The body's course.** The body runs in hours. A case gives causes (intake, losses, kidney, drugs, insulin, illness) and `courseHours`, and optionally a `chronic` state (a disease and its usual treatment) that is reached as a steady state first; the illness then acts on top of it. Settling a patient integrates the body from health, through the chronic state, through the illness, coupling it to the circulation and lungs whenever what it hands them (blood volume, K⁺, haemoglobin, bicarbonate, vasoconstrictor tone) has moved; then circulation and lungs settle in seconds around it. Live, the body advances with the clock. Plasma sodium, potassium, chloride, bicarbonate, glucose, urea, creatinine, lactate, ketones, albumin and haemoglobin are outputs: a case cannot set them.

### Cases are parameters

A case's pathology is parameters only: `physiology` (circulation),
`electrical`, `respiratory`, `chemistry` pins, `conditions`, `lesions`. It may
still author what no model covers (temperature, imaging of the head and spine,
a fundus); it may not author a finding a model produces, and may not pin blood
gases (they are outputs: set their causes). Hyperkalaemia is a potassium of
7.2, not an ECG pattern; atrial fibrillation is an atrial rhythm, and the
irregular pulse, the lost atrial kick and the fibrillatory baseline follow.

### Running

`LivePatient` (`live/live-patient.ts`) runs circulation and heart in the page
in real time (about a hundred times faster than real time on a laptop), keeps
16 s of the dipole for recording, and is what every layer reads. Settling a
new patient takes 20 simulated seconds, a fraction of a second, in passes that
bring the slow respiratory states (CO₂ stores, lung water, drive) to steady
state between them.

**Interventions change the model.** Oxygen is a manoeuvre that puts a device on
the patient (`PatientState.oxygen`) and sets the inspired fraction the running
lungs breathe; the saturation and the blood gas report the FiO₂ they were
taken on. In COPD a Venturi 28 % brings SpO₂ to 88–92 % with little CO₂ change,
while a non-rebreather raises CO₂ (released hypoxic vasoconstriction, Haldane
effect, less hypoxic drive): the rule follows from the mechanism.

**The respiratory examination** (`models/resp-exam.ts`) reads the lobes and
pleura under each of ten sites (upper zone, mid zone, axilla, upper back, base,
each side): percussion, breath sounds, added sounds, vocal resonance; plus
trachea, expansion, the breathing pattern and central cyanosis (capillary
deoxyhaemoglobin, so the anaemic stay pink). Breath sounds are synthesised from
the model's own breathing waveform; the chest X-ray is drawn from the model.

---

## 9. Learning around encounters

- **Spaced review stays, in the background.** Encounters and drills are
  scheduled by result and confidence (SM-2, from PR #4). "You" shows what is
  due.
- **Courses later.** A course is an ordered series of cases with a debrief at
  the end. CME certification (accreditation, time tracking, evaluation) is
  dropped from scope until the encounter model is proven.

---

## 10. What is kept, reworked and removed

| Keep | Rework | Remove (for now) |
|---|---|---|
| Patient Runtime, conditions, ports, observations | Shell navigation → Cases / Patient / You | Specialty tabs as navigation |
| Circulation + ECG engines, chemistry, nervous-system graph | Examine layer → encounter screen (§2) | CME modules (pre/post tests, certificates) |
| Bedside findings derivations (PR #4), as resolvers | Specialty workspaces → contents of the Physiology / Anatomy / Investigations layers | Guided bedside menus and hotspots |
| Heart-sound synthesis (PR #4) | MCQ cases and lessons → drills attached to layers | 4-option diagnosis commit |
| Spaced review store (PR #4) | `perform.examination` → `perform.action` | |
| Simulator fixes, tap fallback (PR #5) | | |

---

## 11. Milestones

| | Scope | Done when |
|---|---|---|
| **M0** | This spec | Agreed |
| **M1** | **Examination engine, headless.** *Data model, engine core and two cases done (§8).* Remaining: site ontology, ~370 manoeuvres, parser with synonyms, preconditions, time cost, `perform.action`, resolvers, case layer, five cases ported | For each case, every manoeuvre returns a finding; findings match the models; no case finding contradicts a model; parser resolves a list of 300 phrasings written by a clinician |
| **M2** | **Encounter screen.** Patient drawing without hotspots, command bar, body touch menu, notes, monitor, ordering with turnaround, free-text history | A student completes the aortic stenosis case on a phone without guidance |
| **M3** | **Commit and debrief.** Differential search, expert reference, timeline, unlocks to Physiology/Anatomy with finding → mechanism links | Debrief correctly identifies missed discriminating actions in scripted runs |
| **M4** | **Navigation.** Cases / Patient / You; layers; drills migrated; old shells removed | No specialty tabs remain; every current workspace reachable from a layer |
| **M5** | **Time and treatment.** Deterioration, treatments as actions, guidance dial, 10 cases | A bleeding patient deteriorates without fluids and stabilises with them |
| Later | LLM patient, mental state examination, imaging, anatomy layer expansion, courses | |

---

## 12. Decisions

Recorded 2026-10-11.

1. **Language.** English and German now; other languages later, added as data.
2. **Notes.** Both. Automatic notes are generated from the encounter log
   (`autoNote`); learners later write their own and compare. Comparison works
   on structured findings, so it teaches what to document, not phrasing.
3. **Explore mode.** Yes, but after the foundational model.
4. **Case authoring.** By collaborators, later, on a case management and
   editing platform. For now the data model is prepared for it: JSON cases,
   an exportable catalog, a validator, authoring metadata (authors,
   reviewers, sources, status, version).
5. **Findings.** As clinical as possible, with illustrations and SVG
   animations driven by the same values the models compute (the eye
   examination first).

6. **Physiology is models.** Chapters with their equations, animated and
   evaluated on the patient, like opening a living Klinke–Silbernagl.
7. **Measurements are not physiology.** ECG, laboratory values and signs are
   measurements related to the models, with their physics shown (§8a).
8. **Equations as data**, textbook level first, the full system one level down.
9. **Model Lab** is a list of every variable, grouped and collapsible, editable
   from a healthy adult in the free patient; disabled in a case until commit,
   then read-only.
10. **Focused views** for more of the examination: the chest for auscultation,
    electrode placement for the ECG; more to follow (abdomen, fundus, neck veins).

11. **Pulmonary first** among internal medicine (2026-10-12), then the other
    organ systems; dermatology and psychiatry after, with a model suited to
    each.

Still open: **scoring** — qualitative only, or numeric scores for courses later?
