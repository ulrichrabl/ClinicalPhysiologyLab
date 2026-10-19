# ADR-018 — Interventions, scenarios and guideline scoring: acting on a running patient

Status: Proposed (for the owner's decision; nothing built yet)  
Date: 2026-10-19  
Repository: ClinicalPhysiologyLab

## Context

The owner wants more interactivity: whole situations with the clock running. A cardiac arrest from finding the patient through airway, pulse check, compressions, ECG and defibrillator, checked against the guidelines. Later, the anaesthetist's work: induction, the ventilator and its curves, the events of an anaesthetic.

What exists:

- **A patient that runs in real time.** `LivePatient` advances the circulation, the heart's electrical model, the lungs and the body. It runs about a hundred times faster than real time on a laptop.
- **The rhythms of an arrest.** The electrical model has VT and VF (`ventricular: 'vt' | 'vf'`), complete heart block and escape rhythms, and they drive the circulation.
- **Lungs that breathe.** The muscle pressure acts on resistance and compliance in each lobe, with gas exchange, SpO₂, EtCO₂ and the respiratory pump on the heart.
- **A timed encounter.** `Session` keeps a clock and an event log (`events`, each with `t`). Examinations and orders are logged, and the debrief reads the log.

What is missing is the direction of action. Today the learner observes, and the course is scripted (`course[].atMinutes`, `unless`). Nothing the learner does changes the physiology while it runs. An arrest or an anaesthetic is nothing but that.

## Decisions

### 1. Interventions act on the running model

An **intervention** is a registry entry like a manoeuvre or an investigation, with:

- **what it needs:** equipment present, abilities, an airway, IV access;
- **what it costs in time:** a pulse check takes up to 10 s; intubation takes about 20–30 s; drawing up a drug takes time. During that time the learner's hands are busy, and the log says so;
- **what it does to the model,** in one of three kinds:
  - *continuous* while held: compressions and ventilations, which are inputs to the circulation and lungs at each step;
  - *instantaneous:* a shock, which changes the electrical state at once (or does not);
  - *pharmacological:* a dose into a pharmacokinetic compartment, whose concentration drives effects through existing hooks (resistance, contractility, venous tone, the sinus node).

Interventions never write findings. As everywhere in the app, the monitor, the pulse, EtCO₂ and the skin show what the model now does.

### 2. A scenario wraps a case in a scene

A **scenario** is a case plus what happens around it:

- **The scene:** where (ward, street, operating theatre), who is there, and what equipment is present or arriving. For example, the arrest team with the defibrillator arrives 2 minutes after the call.
- **A scene state machine:** for the parts that are not physiology, such as safety, responsiveness, calling for help, opening the airway and the breathing check. These are steps with conditions and timings. The patient's model keeps running underneath.
- **The patient's own course:** the existing `course`, so an arrest can begin on the ward from a sick patient who deteriorates.

All learner-facing text is in English and German.

### 3. Guidelines are data, scored from the log

The guideline lives in a versioned file, for example `guidelines/erc-2025-als.json`. Each rule cites its section and is checked against the action log and the model's state:

- **Timing:** compressions started at once on recognising arrest (how many seconds count as "at once" is a placement, to be agreed); a rhythm check every 2 min; adrenaline every 3–5 min.
- **Counts and order:** amiodarone 300 mg after the third shock and 150 mg after the fifth; adrenaline after the third shock in a shockable rhythm.
- **Conditions:** shock only a shockable rhythm; no pulse check during clear asystole.
- **Quality:** compression rate and depth, the fraction of time compressing, the longest pause, and pause before and after a shock under 5 s.

**The grade is not the outcome.** The patient's course is the model's; the score is adherence to the guideline. The debrief shows both on one timeline: what the learner did, what the guideline asked, and what the patient did (rhythm, coronary perfusion pressure, EtCO₂). A learner can do everything right and the patient still die, as in life.

### 4. Practice and assessment

- **Practice:** pause allowed, hints, and a mechanism pane beside the monitor. It shows coronary perfusion pressure, the flow the compressions make and why EtCO₂ follows it, like a station (ADR-017).
- **Assessment:** real time, no pause, no hints, debrief at the end.

### 5. Reproducible runs

Every source of chance draws from one seeded generator. The seed plus the action log replays a run exactly. The debrief can therefore scrub through what happened, and tests can script a performance and check its outcome.

### 6. Physiology the arrest needs, each part grounded

Rule 1 holds: ground the model in human data, record weak grounding, never tune to an expected answer.

#### a. Compressions as an external pump

A compression pressure acts on the chest's contents, the heart and the intrathoracic vessels, in the same way the pleural pressure swing already does. A share acts directly on the ventricles (the cardiac pump), and the rest on the whole thorax (the thoracic pump). The depth sets the pressure. The rate and duty cycle come from the learner's input.

Calibration and validation against human CPR haemodynamics:

- **Ornato 1988** (mechanical CPR, 18 patients): systolic 59 mmHg at 60/min, falling to 46 at 140/min; diastolic about 23 at every rate; EtCO₂ unchanged by rate.
- **Paradis 1990** (100 patients): no ROSC with an initial coronary perfusion pressure below 0; ROSC only with a maximal pressure of 15 mmHg or more (25.6 ± 7.7 in those with ROSC, 8.4 ± 10.0 without).
- **Falk 1988:** EtCO₂ 1.4 % before arrest, 0.4 % at arrest, 1.0 % with compressions. At ROSC it overshoots to 3.7 % within about 30 s, then settles at 2.4 %. The model already makes EtCO₂ from pulmonary flow; this is a validation, not a fit.
- **Levine 1997:** EtCO₂ after 20 min of ALS was 4.4 ± 2.9 mmHg in non-survivors and 32.8 ± 7.4 in survivors. This is a validation of whole runs.

Which pump dominates in people is debated, so the split between the two is weak grounding and is labelled as such.

#### b. Ventilation by mask, supraglottic airway and tube

The lung model gains a positive-pressure source at the airway in place of the muscle pressure. This is the same piece the ventilator needs later. Mask leak, an unopened airway and oesophageal intubation are states of that source. Oesophageal intubation gives no chest rise and a flat capnogram, by itself.

#### c. The heart in arrest

The myocardium's state during arrest is one variable. It falls without coronary flow and recovers in proportion to coronary perfusion pressure. VF goes from coarse to fine as it falls.

**Whether a shock ends VF, and whether ROSC follows, is a probability of that state.** This is the first stochastic part of the model, and the app says so. It is grounded on outcome data:

- **Larsen 1993** (1,667 witnessed VF arrests): survival is 67 % if all three interventions happen at collapse, minus 2.3 % per minute to CPR, 1.1 % per minute to defibrillation and 2.1 % per minute to ALS. That is 5.5 % per minute untreated.
- **Valenzuela 1997:** a logistic model of collapse-to-CPR and collapse-to-shock intervals.

These are validated by running many simulated arrests with varied delays and comparing the survival curve. What a single shock does (first-shock termination with biphasic waveforms) still needs sourcing.

#### d. Drugs

- **Adrenaline:** a one-compartment pharmacokinetic model acting on resistance (α) and contractility (β) through the existing adrenergic hooks. Validated by the coronary perfusion pressure rise after a dose (Paradis's patients); the PARAMEDIC2 trial's outcomes (more ROSC, little change in good neurological survival) are a population check, not a fit.
- **Amiodarone:** its effect on shock success and recurrence is weakly grounded. The ALPS trial's outcomes are a population check only; the effect sizes are labelled.

#### e. After ROSC

The rhythm returns through the electrical model and the existing circulation takes over. Post-arrest stunning (reduced contractility) comes later.

### 7. The learner's hands

- **Compressions:** tap or hold to the rhythm. The rate and pauses are measured, not chosen. Depth is a choice of "shallow / right / deep", or comes from pressure on devices that report it.
- **Ventilations:** a press per breath, with its duration.
- **Everything else:** commands, by voice-like phrases as in the encounter ("check pulse", "charge 150 J", "adrenaline 1 mg IV"). Once the team arrives, the learner leads and gives orders; team members carry them out with their own time costs.

### 8. Anaesthesia is a second ADR

The same three layers carry it. Interventions are drugs, the ventilator and airway devices; scenarios are an induction, a difficult airway, bronchospasm, anaphylaxis; the guideline files are the DAS and ESAIC algorithms. It also needs:

- **Pharmacokinetic and pharmacodynamic models:** propofol, remifentanil, rocuronium and a volatile agent. These have published human models (Schnider, Minto, Eleveld and others), which fit rule 1 well.
- **A ventilator:** volume- and pressure-controlled modes, PEEP and FiO₂, and the pressure, flow and volume curves it shows. PEEP lowering cardiac output follows from the heart–lung coupling, which makes gap 16 more important.
- **Capnography as a waveform** from the alveolar CO₂ model.
- **Scenarios from existing parts:**
  - endobronchial intubation is one lung's lobes collapsed;
  - bronchospasm is airway resistance, with a sloped capnogram;
  - hypotension after induction is venous tone and contractility.

  Malignant hyperthermia and anaphylaxis need new mechanisms.

## The first scenario: a witnessed VF arrest on the ward

One complete arrest, chosen because it is bounded: one algorithm, clear metrics, and physiology that mostly exists.

**Setting.** A 64-year-old man on a medical ward, two days after admission with chest pain, collapses while the learner is in the room. A bystander nurse is present and the arrest team is reachable by phone.

**Timeline of what the scene does (scripted):**

| Time | Event |
|---|---|
| 0:00 | VF; the patient collapses and is unresponsive; agonal breathing for about 30 s |
| call + 2:00 | the arrest team arrives with the defibrillator, bag-mask, airway kit and drugs |
| on request | IV access takes 30–60 s; intubation 20–30 s (placements, to be checked against observed times) |

**What the learner must do (ERC 2025):**

1. **Safety and responsiveness:** call for help, open the airway, look, listen and feel for breathing for no more than 10 s.
2. **Start CPR:** 30:2 at 100–120 compressions/min and 5–6 cm deep, with full recoil and as few pauses as possible.
3. **When the defibrillator arrives:**
   - pads on, compressions continued while it charges;
   - a pause of under 5 s for the shock (first biphasic shock at least 150 J), then compressions resumed at once;
   - a rhythm check every 2 min.
4. **Drugs:**
   - adrenaline 1 mg after the third shock, then every 3–5 min;
   - amiodarone 300 mg after the third shock and 150 mg after the fifth.
5. **Airway:**
   - the highest feasible oxygen, each breath over 1 s with visible chest rise;
   - after a tube or supraglottic airway, 10 breaths/min with continuous compressions;
   - waveform capnography to confirm the tube.
6. **Reversible causes:** the 4 H's and 4 T's, asked and answered from the case (here, ischaemia).
7. **ROSC:**
   - recognised by signs of life, the rhythm and a pulse;
   - EtCO₂ rising supports it, but is never alone a reason to stop compressions;
   - post-resuscitation care begins.

**The debrief shows:**

- time to the first compression and to the first shock;
- the compression fraction, rate, depth and longest pause;
- shocks and drugs against the algorithm;
- the patient's coronary perfusion pressure and EtCO₂ through the run, with each deviation marked where it happened.

**Tests:**

- An ideal performance and three poor ones, scripted from the log, reach the human ranges above. The poor ones are a late first compression, long pauses and slow compressions.
- Their survival over many seeded runs follows Larsen's slopes.

## Steps

1. **Interventions and the scenario layer,** with the seeded replay. No new physiology; checked on an existing case with a scripted course.
2. **The compression pump and positive-pressure ventilation** (decision 6a–b), validated against Ornato, Paradis and Falk.
3. **The heart in arrest and the shock** (6c), validated against Larsen and Valenzuela.
4. **Adrenaline and amiodarone** (6d).
5. **The ward VF scenario, end to end,** with the ERC 2025 file, practice and assessment, and the debrief.
6. **Further arrests,** reusing the parts:
   - asystole and PEA, with hypovolaemia, tamponade (which needs gap 13 first) and tension pneumothorax;
   - out-of-hospital arrest with an AED.
7. **Anaesthesia,** in its own ADR (decision 8).

## Open questions for the owner

1. **Which guideline:** ERC 2025 (with the German Resuscitation Council's translation), AHA 2025, or both as separate files?
2. **The learner's role in the first scenario:** single rescuer, then team leader once the team arrives (as proposed), or team leader from the start?
3. **Stochastic outcomes:** acceptable, if labelled and seeded? The alternative is a deterministic "ROSC at the third good shock", which is simpler but not grounded.
4. **Compression input:** tapping to the rhythm (measures rate and pauses honestly, tiring on a phone), or choosing a quality level?
5. **Assessment:** practice only, or a scored mode that could be used in teaching?

## Consequences

- The app gains a direction it lacks, action on the physiology, while keeping its rule that findings come from the model.
- The models gain inputs, not rules. External chest pressure, airway pressure and drug concentrations act through the same couplings that exist (pleural pressure, adrenergic hooks). Tests check that the inputs at rest change nothing.
- Guidelines become content that changes every five years; keeping them as versioned data means a new edition is a new file, not new code.
- The first stochastic element enters the model. It is seeded, labelled in the app, and validated on populations, not single runs.

## References

- Soar J, Böttiger BW, Carli P, et al. European Resuscitation Council Guidelines 2025 Adult Advanced Life Support. *Resuscitation* 2025;215 Suppl 1:110769. [doi:10.1016/j.resuscitation.2025.110769](https://doi.org/10.1016/j.resuscitation.2025.110769). Its numbers here (shock energy, adrenaline and amiodarone timing, pauses under 5 s, ventilation at 10/min, EtCO₂ use) were read from the Resuscitation Council UK's 2025 ALS guideline, which follows it; check them against the ERC text before the guideline file is written.
- Smyth MA, van Goor S, Hansen CM, et al. European Resuscitation Council Guidelines 2025 Adult Basic Life Support. *Resuscitation* 2025;215 Suppl 1:110771. [doi:10.1016/j.resuscitation.2025.110771](https://doi.org/10.1016/j.resuscitation.2025.110771). The compression rate and depth (100–120/min, 5–6 cm, 30:2) are those of earlier editions; still to be confirmed in the 2025 text.
- Paradis NA, Martin GB, Rivers EP, et al. Coronary perfusion pressure and the return of spontaneous circulation in human cardiopulmonary resuscitation. *JAMA* 1990;263:1106–13. PMID 2386557.
- Ornato JP, Gonzalez ER, Garnett AR, et al. Effect of cardiopulmonary resuscitation compression rate on end-tidal carbon dioxide concentration and arterial pressure in man. *Crit Care Med* 1988;16:241–5. [doi:10.1097/00003246-198803000-00007](https://doi.org/10.1097/00003246-198803000-00007).
- Falk JL, Rackow EC, Weil MH. End-tidal carbon dioxide concentration during cardiopulmonary resuscitation. *N Engl J Med* 1988;318:607–11. [doi:10.1056/NEJM198803103181005](https://doi.org/10.1056/NEJM198803103181005).
- Levine RL, Wayne MA, Miller CC. End-tidal carbon dioxide and outcome of out-of-hospital cardiac arrest. *N Engl J Med* 1997;337:301–6. [doi:10.1056/NEJM199707313370503](https://doi.org/10.1056/NEJM199707313370503).
- Larsen MP, Eisenberg MS, Cummins RO, Hallstrom AP. Predicting survival from out-of-hospital cardiac arrest: a graphic model. *Ann Emerg Med* 1993;22:1652–8. [doi:10.1016/s0196-0644(05)81302-2](https://doi.org/10.1016/s0196-0644(05)81302-2).
- Valenzuela TD, Roe DJ, Cretin S, et al. Estimating effectiveness of cardiac arrest interventions: a logistic regression survival model. *Circulation* 1997;96:3308–13. [doi:10.1161/01.cir.96.10.3308](https://doi.org/10.1161/01.cir.96.10.3308).
