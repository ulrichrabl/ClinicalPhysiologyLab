# Virtual patient — design spec

Status: **Draft for review**
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

## 8. Case format

```js
export default {
  id: 'as-syncope',
  tags: ['cardiology', 'syncope', 'valvular'],
  difficulty: 2,
  presentation: { name: 'Evelyn Hart', age: 78, sex: 'F', setting: 'Acute medical unit',
                  triage: 'Collapsed walking uphill to church this morning.' },
  physiology: {
    params: { Raortic: 0.35 },                      // severe AS, peak gradient ~90 mmHg
    conditions: [],
    neuro: null,
  },
  state: { position: 'sitting', consciousness: 'alert', pain: 0 },
  caseFindings: {
    'hands': { inspect: 'Arcus senilis is visible; no clubbing.' },
    'chest.sternum': { inspect: 'No scars.' },
  },
  history: {
    'pc':            'I passed out walking up the hill to church…',
    'chest-pain':    { fact: 'Tightness on exertion, relieved by rest, for months', volunteers: false },
    'syncope':       'This morning, on exertion, without warning.',
    'medications':   'Amlodipine, atorvastatin.',
  },
  timeline: [ { after: '20m', if: 'no-action', change: null } ],
  expert: { /* §7 */ },
  diagnosis: { accepted: ['aortic-stenosis-severe'], differential: ['hocm', 'chb', 'vasovagal'] },
};
```

The five patients from PR #4 (volunteer, aortic stenosis, heart failure, GI
bleed, C5 cord injury) port to this format first.

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
| **M1** | **Examination engine, headless.** Site ontology, ~370 manoeuvres, parser with synonyms, preconditions, time cost, `perform.action`, resolvers, case layer, five cases ported | For each case, every manoeuvre returns a finding; findings match the models; no case finding contradicts a model; parser resolves a list of 300 phrasings written by a clinician |
| **M2** | **Encounter screen.** Patient drawing without hotspots, command bar, body touch menu, notes, monitor, ordering with turnaround, free-text history | A student completes the aortic stenosis case on a phone without guidance |
| **M3** | **Commit and debrief.** Differential search, expert reference, timeline, unlocks to Physiology/Anatomy with finding → mechanism links | Debrief correctly identifies missed discriminating actions in scripted runs |
| **M4** | **Navigation.** Cases / Patient / You; layers; drills migrated; old shells removed | No specialty tabs remain; every current workspace reachable from a layer |
| **M5** | **Time and treatment.** Deterioration, treatments as actions, guidance dial, 10 cases | A bleeding patient deteriorates without fluids and stabilises with them |
| Later | LLM patient, mental state examination, imaging, anatomy layer expansion, courses | |

---

## 12. Open questions

1. **Language.** English only, or German as well? It affects the parser
   vocabulary from M1 onwards.
2. **Notes.** Should students write their own notes (and be assessed on them),
   or only see the automatic log?
3. **Explore mode access.** Open to everyone, or unlocked per case after the
   encounter?
4. **Case authoring.** Who will write cases beyond the first ten? This decides
   whether an authoring tool (or LLM-assisted drafting with clinician review)
   belongs in scope.
5. **Scoring.** Qualitative only, or numeric scores for courses later?
