# ADR-017 — Stations: one test and its mechanism on one clock

Status: Proposed; step 1 (the ECG station, Explore) in this PR  
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

## Steps

1. **The ECG station, Explore** (this PR): the activation log in the electrical model, with tests; the station screen with settings, strip, ladder, cursor, conduction heart and explanations in EN and DE; a Stations card on the Ward.
2. **ECG signs and the other two modes:** ECG observables and signs in the knowledge tables; Predict; Identify with the observe-only scoring.
3. **Heart sounds timed from valve events** (decision 6).
4. **The auscultation station.**
5. **Links:** teaching cards and the debrief open a station on the relevant patient.

Further stations follow the same pattern where a test's signal and its mechanism are both in a model: the pulse wave and the arterial pressure, the eye movements and the vestibulo-ocular reflex, the pupils and the light reflex.

## Consequences

- One new screen type, reused for every station: the work for each new station is its signal renderer, its mechanism renderer and its explanations.
- The electrical model exposes its activation timeline. This adds no physiology and changes no constant; a test checks that the log agrees with the dipole and with the model's own intervals.
- Stations make the explanations into content that colleagues will review with the card texts. Like those, they stay `draft` until a clinician has read them.
