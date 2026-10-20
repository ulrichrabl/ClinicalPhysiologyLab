# ADR-018 — Interventions, scenarios and guideline scoring: acting on a running patient

Status: Accepted (owner, 2026-10-19; the answers to the open questions are below); steps 1 and 2 built (2026-10-19/20)  
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

The guideline is ERC 2025, with the German Resuscitation Council's (GRC) German text for German learners (owner). It lives in a versioned file, `guidelines/erc-2025-als.json`; another guideline (AHA) would be another file. Each rule cites its section and is checked against the action log and the model's state:

- **Timing:** compressions started at once on recognising arrest (how many seconds count as "at once" is a placement, to be agreed); a rhythm check every 2 min; adrenaline every 3–5 min.
- **Counts and order:** amiodarone 300 mg after the third shock and 150 mg after the fifth; adrenaline after the third shock in a shockable rhythm.
- **Conditions:** shock only a shockable rhythm; no pulse check during clear asystole.
- **Quality:** compression rate, the count per cycle (30:2), the fraction of time compressing, the longest pause, and the pause before and after a shock under 5 s. Depth is scored only for team members' compressions; a phone cannot measure the learner's (decision 7).

**The grade is not the outcome.** The patient's course is the model's; the score is adherence to the guideline. The debrief shows both on one timeline: what the learner did, what the guideline asked, and what the patient did (rhythm, coronary perfusion pressure, EtCO₂). A learner can do everything right and the patient still die, as in life.

### 4. Practice and assessment

- **Practice:** pause allowed, hints, and a mechanism pane beside the monitor. It shows coronary perfusion pressure, the flow the compressions make and why EtCO₂ follows it, like a station (ADR-017).
- **Assessment:** real time, no pause, no hints, no teaching nudges (decision 6c), debrief at the end. Built after practice (owner: later, but probably good).

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

**Teaching nudges (owner: chance is fine, nudged where it helps learning).** A scenario may carry an explicit nudge for practice, for example a run whose good performance reaches ROSC within the scenario's time, or a first shock that fails so the learner meets refractory VF. A nudge is a named scenario parameter, recorded with the run and stated in the debrief ("this run was set up so that…"). It is never silent, never used in assessment, and never in the population runs that validate the model.

#### d. Drugs

- **Adrenaline:** a one-compartment pharmacokinetic model acting on resistance (α) and contractility (β) through the existing adrenergic hooks. Validated by the coronary perfusion pressure rise after a dose (Paradis's patients); the PARAMEDIC2 trial's outcomes (more ROSC, little change in good neurological survival) are a population check, not a fit.
- **Amiodarone:** its effect on shock success and recurrence is weakly grounded. The ALPS trial's outcomes are a population check only; the effect sizes are labelled.

#### e. After ROSC

The rhythm returns through the electrical model and the existing circulation takes over. Post-arrest stunning (reduced contractility) comes later.

### 7. The learner's hands

- **Compressions:** tapped to the rhythm (owner). What the phone trains is the rate, the count (30 before two breaths) and the pauses, all measured from the taps. Depth cannot be measured on a phone, so the learner's own compressions are taken as adequately deep and depth is not scored for them.
- **Ventilations:** a press per breath, with its duration.
- **Everything else:** commands, by voice-like phrases as in the encounter ("check pulse", "charge 150 J", "adrenaline 1 mg IV"), carried out by whoever they are given to (decision 8).

### 8. Leading the team is trained, from the first second

The learner leads from the start (owner), and what a leader does is part of what is trained and scored:

- **Calling for help:** who calls, and what they say (where, cardiac arrest, bring the defibrillator). A call that does not say where delays the team.
- **Giving each task to someone:** compressions, airway and ventilation, the defibrillator, IV access and drugs, the time and the record. A task nobody has been given is not done. The learner can do one task with their own hands (compressions by tapping); while they do, they lead less well, as in life: commands come slower.
- **Rotating the compressor** every 2 minutes, at the rhythm check.
- **Closed-loop communication:** a team member repeats an order back; an ambiguous order (no dose, no route) is answered with a question, which costs time.
- **The team members are agents** with their own time costs and their own quality. A compressor tires: rate and depth fall over the minutes (to be grounded on studies of rescuer fatigue). In practice, a member may make a scripted, labelled error for the learner to catch, such as not restarting compressions after a shock.

How these are scored is taken from the ERC 2025 guidelines' text on teams and leadership (its ALS and education chapters); the specific rules are still to be sourced, and until then each is marked as a placement.

The first scenario uses this directly. At first the learner and one nurse are alone: the learner decides who calls and who compresses, and taps compressions if they take them. When the arrest team arrives, the learner hands over compressions and assigns the roles.

### 9. Anaesthesia is a second ADR

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

**Setting.** A 64-year-old man on a medical ward, two days after admission with chest pain, collapses while the learner is in the room. One nurse is present and the arrest team is reachable by phone. The learner leads from the first second (decision 8).

**Timeline of what the scene does (scripted):**

| Time | Event |
|---|---|
| 0:00 | VF; the patient collapses and is unresponsive; agonal breathing for about 30 s |
| call + 2:00 | the arrest team (two more people) arrives with the defibrillator, bag-mask, airway kit and drugs; only if the call said where |
| on request | IV access takes 30–60 s; intubation 20–30 s (placements, to be checked against observed times) |

**What the learner must do (ERC 2025):**

1. **Safety and responsiveness:** have help called (by whom, saying what), open the airway, look, listen and feel for breathing for no more than 10 s.
2. **Start CPR:** decide who compresses; 30:2 at 100–120 compressions/min and 5–6 cm deep, with full recoil and as few pauses as possible.
2b. **When the team arrives:** hand over, assign compressions, airway, defibrillator and drugs, and rotate the compressor every 2 min.
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
- the compression fraction, rate, count and longest pause (depth for team members only);
- who was given which task, and when; tasks nobody was given;
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
5. **The ward VF scenario, end to end,** in practice mode: the ERC 2025 file, the team (decision 8), teaching nudges, and the debrief.
5b. **Assessment mode** (decision 4).
6. **Further arrests,** reusing the parts:
   - asystole and PEA, with hypovolaemia, tamponade (which needs gap 13 first) and tension pneumothorax;
   - out-of-hospital arrest with an AED.
7. **Anaesthesia,** in its own ADR (decision 9).

## Step 1, as built

Interventions, the scenario layer and the seeded replay, with no new physiology.

- **Interventions** (`source/src/vp/data/interventions.ts`, types in `src/vp/scenario/types.ts`): a registry with what each needs (equipment, access, the patient's abilities), how long the hands are busy (fixed, or a range drawn from the run's chance), where that time comes from (`measured` or `placement`), and its effect:
  - *continuous:* holds model inputs in a slot while it lasts; a new intervention in the same slot replaces the old; released, the inputs and the patient's state return to what they were. It may keep the holder's hands busy (compressions will).
  - *instantaneous:* writes the model once, and may grant access (`iv`).
  - *pharmacological* comes with step 4.

  Interventions write only what the running models take as inputs (circulation, lungs, the heart's electrical model); the validator refuses the body's slow parameters, which would re-run the illness. The first entries are the oxygen devices, which share their ids and inspired fractions with the encounter's `give.oxygen.*` manoeuvres, and IV access (30–60 s, a placement).
- **Scenarios** (`src/vp/scenarios/*.json`, `vp.scenario/1`): a case, a scene (place, people present or arriving, equipment present or arriving) and a scene state machine. States say lines (EN/DE) and schedule arrivals on entering; transitions wait on what was done (`did`), what is held (`holding`), time (`at`, `inStateFor`) or a value of the running model (`circulation.<metric>`, `resp.<key>`, `body.<key>`), combined with `all` and `any`.
- **The run** (`src/vp/scenario/run.ts`, `ScenarioRun`): one clock in ticks of 0.1 s, the models' coupling interval. Each tick the models advance, due interventions take effect, due arrivals come, the case's course applies, and the scene moves on. Inputs (intervene, release, examine, order, each by a named person) land between ticks. Whoever acts must be present and free; an examination keeps the hands busy for its duration; an order takes no hands. The encounter (`Session`) runs on the same clock, so its events, findings and debrief inputs are the encounter's own.
- **The case's course** applies at its minute on the scenario clock. Its `physiology` (circulation parameters), which the encounter declared but never applied, now reaches the running model in a scenario. An `unless` may name an intervention.
- **Chance** (`src/vp/scenario/chance.ts`): one seed, named streams derived from the seed and the name alone, so a new use of chance never shifts an old one. The heart's own generator is seeded from it (`HeartElectrical.seedChance`). Every draw is recorded as an event.
- **Replay:** `replay(def, { seed, caseDef, log })` rebuilds a run from its seed and inputs. A replay reproduces the scene, the events, the encounter, the model and every value of the patient exactly. `LivePatient.settleNow` settles synchronously with the same arithmetic as `settle`, so a run starts from the same patient every time.
- **Checked on** two draft scenarios, not offered to learners: `copd-ed-oxygen` (oxygen held on the running lungs, a cannula of seeded duration, the tray arriving, the scene waiting for both) and `vestibular-ed-course` (the examination and the case's scripted course at 20 minutes on the scenario clock). Tests: `scripts/scenario.test.mjs` (`npm run test:scenario`), including that a scenario with no inputs runs the patient exactly as the patient runs alone.
- **Not yet:** no screen. The app's encounter still applies oxygen itself (`breatheOxygen` in `app/app.ts`); it could use the intervention's inputs once a scenario screen exists.

## Step 2a, as built: chest compressions

Step 2 is built in two parts: 2a the compression pump (here), 2b ventilation, apnoea in arrest and the end-tidal CO₂ of low flow (next).

- **The input** (`domains/cardio/sim/circulation.ts`): `Pchest`, the rise of intrathoracic pressure, read each integration step from a compressor on the circulation's own clock. It adds to every intrathoracic pressure as the pleural swing does (atria, ventricles, pulmonary vessels: the thoracic pump). The ventricles feel `1 + cpr.cardiacExtra` times as much (the cardiac pump), and the lumped systemic arteries `cpr.aortaInChest` of it, for the thoracic aorta. Zero, it changes nothing: the existing suites are unchanged to the last digit.
- **The compressor** (`physiology/cpr/compressions.ts`): each compression a half-sine for half of its cycle (`cpr.duty`), then full release. The learner's taps are onsets; a team member keeps a steady 110/min (`cpr.rescuerRate`, a placement until fatigue is modelled).
- **The constants** (`evidence/cpr.ts`):
  - the intrathoracic rise is measured: 32 cmH₂O manually and 69 with a device (Charbonney 2018, oesophageal pressure in cadavers whose respiratory mechanics matched arrested patients);
  - the thoracic aorta's share of arterial compliance is derived from Saouti 2012 (0.375, plausible 0.25–0.50);
  - the cardiac pump's extra is fitted once (`scripts/fit-cpr.mjs`) to Ornato 1988's systolic pressure: 0.10, weakly determined (0 to 0.17 fit within Ornato's spread). The measured intrathoracic rise alone carries most of the flow.
- **The readings** (`metrics`): `CPP` (aortic minus right atrial pressure over the relaxation phase, as Paradis measured it), `CPPend` (just before the next compression), `aortaRelax`, `compressionShare`. In VF the circulation's windows are 8 s long.
- **Validated** (`scripts/arrest.test.mjs`):
  - untreated VF: the right atrial pressure 7.5 s after onset is Jellinek 2000's mean systemic filling pressure (10.2 ± 3.5 mmHg); by 30 s aorta and right atrium have met;
  - Ornato's diastolic pressure stays flat across rates;
  - manual compressions at 110/min give a coronary perfusion pressure among Paradis 1990's patients who regained a circulation.
- **Known gaps** (20, 21 in `docs/evidence-grounding-status.md`): the aortic relaxation pressure is 29 against Ornato's 23 (the model's vessels keep a fresh arrest's maximal reflex tone); and the fall of systolic pressure with rate cannot be compared cleanly, because Ornato's machine held its force, not its pressure.
- **In a scenario:** the intervention `cpr.compressions` (continuous, hands busy, 2 s to start, a placement), and the input `compress` with its exact onset inside the tick, so tapped compressions replay exactly.
- **Not yet:**
  - the breath's pleural swing does not reach the thoracic aorta (the heart–lung chain, paused);
  - the lungs kept breathing in arrest, and were handed a normal cardiac output when the measured one was very low: both done in 2b.

## Step 2b, as built: breathing in arrest, given breaths, CO₂ at low flow

- **The respiratory centre** (`physiology/lung/respiratory.ts`) follows the pressure perfusing the brainstem (aortic minus right atrial, over 3 s, from the host). It fails in seconds (`lung.centreFailTau`, 8 s) when that falls between 25 and 10 mmHg, and recovers over a minute. The thresholds and times are placements: no human measurement was found. They are set below every living circulation in the model's cases and tests, and no existing result moved through them.
- **Gasping:** whether a patient gasps, and for how long, is drawn once per run from its seed.
  - **Chance:** Clark 1992, 56 % in VF.
  - **Duration:** exponential, with the mean (8.5 min) derived from Bobrow 2008's decline with time.
  - **Placements:** the gasps' rate and volume.
  - Outside a scenario no one gasps.
- **Real flow to the lungs:** the host hands the lungs and the body the measured cardiac output, not the stand-in normal 5.2 L/min it used below 0.3.
- **CO₂ store:** the tissues and venous blood hold CO₂, with a capacity derived from Stock 1989 (3.4 mmHg/min of apnoea after the first minute). The blood brings the lungs what it carries, not what the body makes, so at low flow end-tidal CO₂ falls with the flow. This replaces the ungrounded 50 s time constant of arterial CO₂ (`lung.paco2Tau`, removed).
- **The lungs' gas:** while breathing is not normal (the centre failing or gasping, apnoea, or breaths given), the lungs' gas is one mixed compartment with a mass balance for O₂ and CO₂.
  - Apnoea on oxygen keeps a patient saturated for minutes.
  - The blood bypassing the alveoli is the lungs' structural shunt.
  - Normal breathing keeps its steady-state solution with its V/Q units.
- **Breaths given** (`physiology/lung/ventilation.ts`): airway pressure in the equation of motion, set so the squeezed volume (0.5 L over 1 s, a placement from the guidelines) reaches the lungs.
  - **Routes:** a mask leaks (30 %, a placement) and gives nothing on an airway that is not open; a supraglottic airway leaks 10 % (a placement); a tube seals; an oesophageal tube gives no chest rise and a flat capnogram, by itself.
  - **Static pressure:** for PEEP and held inflations.
  - **Pleural reference:** the circulation's pleural reference follows normal breathing only, so apnoea and positive pressure act on the heart.
- **In a scenario:**
  - `vent.bag` (needs a bag-mask) and the `ventilate` input (the learner's own breaths);
  - a team member gives 10/min through an airway device; with a mask, breaths only when told (the 30:2 coordination with compressions is step 5);
  - taking over a task frees the hands of whoever had it;
  - `airway.supraglottic` and `airway.tube` (needs the airway kit) change the route.
- **Validated** (`scripts/arrest.test.mjs`):
  - **Stock 1989:** 3.4 mmHg/min after the first minute (fitted), and saturation kept through 5 min of apnoea on oxygen.
  - **Jellinek 2000:** 15 cmH₂O of airway pressure raises right atrial pressure and lowers stroke volume.
  - **Falk 1988:** end-tidal CO₂ falls at arrest and rises with compressions.
  - **Ornato 1988:** end-tidal CO₂ is unchanged by the compression rate, at about 1.7 %.
- **Known gaps** (22–25 in `docs/evidence-grounding-status.md`):
  - **Stock's first minute:** the model rises 8.6 mmHg, Stock 12. The lungs hold an awake adult's FRC.
  - **Jellinek's filling pressure:** the model's mean systemic filling pressure rises +1.0 mmHg, Jellinek +2.5. There is no abdominal venous pool.
  - **Levine's late end-tidal CO₂:** 26 mmHg after 20 min of CPR, against 4.4. Nothing deteriorates during a long arrest, and there is no alveolar dead space at low pulmonary pressures.
- **Refitted:** `cpr.cardiacExtra` 0.10 → 0.11, with the same target and procedure. The lungs no longer breathe in an arrest, and their pleural swings had been pumping a little. With it, Ornato's flat diastolic pressure across rates moved from a pass (by under a millimetre) to a known gap: 30.0 → 35.2 mmHg from 60 to 140/min (gap 21).
- **Moved elsewhere:** CO₂ now settles through the store, so results that run through it move slightly. Moderate PE's rise of mean pulmonary arterial pressure went from just over 3 mmHg to 3.0, now a known gap where it had passed by a hair. The other shifts are in the first decimal place.

## Decided by the owner (2026-10-19)

1. **Guideline:** ERC 2025, with the GRC's German text (decision 3).
2. **Role:** the learner leads from the start, and calling for help and giving tasks (who ventilates, who compresses) are trained too (decision 8).
3. **Chance:** acceptable, for realism, nudged where it helps learning; nudges are explicit and stated (decision 6c).
4. **Compressions:** tapped to the rhythm; rate and count are what the phone trains (decision 7).
5. **Assessment:** later, after practice (decision 4, step 5b).

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
