# ADR-018 — Interventions, scenarios and guideline scoring: acting on a running patient

Status: Accepted (owner, 2026-10-19; the answers to the open questions are below); steps 1–3 built (2026-10-19/20)  
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

- **Adrenaline:** a one-compartment pharmacokinetic model acting on resistance (α) and contractility (β) through the existing adrenergic hooks. (As built in step 4: on resistance only, with the fit on the first dose; see "Step 4, as built".) Validated by the coronary perfusion pressure rise after a dose (Paradis's patients); the PARAMEDIC2 trial's outcomes (more ROSC, little change in good neurological survival) are a population check, not a fit.
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
4. **Adrenaline and amiodarone** (6d). Built: see "Step 4, as built".
5. **The ward VF scenario, end to end,** in practice mode: the ERC 2025 file, the team (decision 8), teaching nudges, and the debrief. Part 1 (the file, scoring and the debrief) and part 2 (the team, and the scene) are built: see "Step 5, part 1, as built" and "part 2".
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

## Step 3, as built: the heart in an arrest and the shock

- **The myocardium's state** (`physiology/heart/arrest.ts`, constants `evidence/arrest.ts`): one variable M, 1 for a perfused heart.
  - It falls while the heart fibrillates or stands still without coronary flow, and recovers with coronary perfusion pressure (aortic minus right atrial pressure between compressions, from the host).
  - It sets how coarse VF is, the chance of an organised rhythm after a terminating shock, and the contractility of an organised heart.
  - A perfused heart stays at exactly 1, so no existing result moved.
  - **Asystole** is a new rhythm of the electrical model.
- **Pulse or not is the circulation's:** an organised heart contracts at M times its own strength. Below about 12 %, the circulation makes too little pressure for a pulse (PEA) without being told to.
- **The shock** (in a scenario: `defib.pads`, `defib.charge` (7 s, compressions go on), `defib.shock`, 150 J):
  - **Termination:** it ends VF with Stiell 2007's measured 86.8 %, independent of duration.
  - **What follows:** an organised rhythm with chance M^0.39, else asystole. The exponent is derived from Stiell's 44 % of terminations, assuming a 10-minute untreated arrest; that assumption is stated.
  - **Recurrence:** VF comes back in 79 % (van Alem 2003), at an exponential time with median 45 s.
  - All draws come from the run's seed and are logged.
  - **Hazards:** a shock with hands on the patient, or of a rhythm that is not shockable, is recorded as a hazard (never blocked).
- **Time course:** depletion and recovery are placements. They are set so that ten minutes without compressions brings an organised rhythm to the edge of pulselessness, the end of Weisfeldt & Becker's circulatory phase (read as quoted; based largely on animals).
- **Validated** (`scripts/arrest.test.mjs`):
  - **Electrical phase:** an organised rhythm after an early shock perfuses within 30 s.
  - **Late:** an organised rhythm starts pulseless and perfuses within minutes (Pierce 2015: ROSC a median 136 s after the shock).
  - **Compressions first:** within Wik 2003's confidence interval late (OR 2.22, 1.06–4.63), no difference early (Wik, Cobb 1999).
  - **Falk 1988:** the end-tidal CO₂ overshoot at the return of a circulation, peaking within 30 s.
  - **Scenarios:** over many seeds, termination and recurrence follow the measured odds.
- **Known gaps** (26–28):
  - **26:** no PEA that persists.
  - **27:** Paradis's 15 mmHg threshold is not met (weak compressions still restore).
  - **28:** VF is finer than Weaver's.
- **Not used:** Valenzuela 1997's coefficients (not confirmed in any readable source). Larsen's and Valenzuela's survival curves are not compared, because survival depends on the brain after the arrest, which the model does not have. The validation is at the level of the heart (an organised rhythm, a pulse).
- **The practice screen:**
  - The nurse runs for the arrest trolley at the collapse (a scene `leave`) and is back with the defibrillator a minute later, so the learner starts alone.
  - Pads, charge and shock go to whoever has free hands.
  - The log names shocks, outcomes, recurrences and hazards.

## Step 4, as built: adrenaline and amiodarone

- **The drug model** (`physiology/drugs/drugs.ts`, constants `evidence/drugs.ts`):
  - **Doses:** a dose goes into a vein and reaches the central circulation with a time constant of 30 s (a placement, with the flush).
  - **Adrenaline:** leaves with Heradstveit 2023's half-life measured in people in arrest, 2.6 min, from a volume of 6.38 L. The volume is derived from Wortsman 1993's ~0.5 µmol/L at 2.5 min after 1 mg.
  - **Amiodarone:** stays; its half-life is weeks.
  - **With no drug given,** every multiplier is exactly 1, so no existing result moved.
- **Arrival is not tied to the flow.** A first version carried the dose in with the model's cardiac output. Adrenaline then lowered the flow that carries it (0.45 → 0.13 L/min under compressions), and the plasma level stood for minutes instead of falling from a peak as measured. The model's CPR flow is not validated, so arrival is a fixed placement.
- **Adrenaline acts on the arterioles (α) only:**
  - the systemic resistance rises in proportion to the plasma level, held above the 400 ng/mL measured range;
  - the gain is fitted once (`scripts/fit-drugs.mjs`) to Paradis 1991's +3.7 mmHg of coronary perfusion pressure after a standard dose;
  - at the first dose's peak (115 ng/mL) the resistance is ×4.5.
- **Why the first dose is the fit, not Paradis's protocol.** Paradis measured a dose given after several earlier ones. In the model a dose onto a circulation that already has adrenaline adds little: the coronary perfusion pressure is near a ceiling, because its arteries keep full reflex tone in an arrest (gap 20). Fitting the third dose could not reach +3.7 at any gain; the rise falls as the gain grows. So the fit uses the first dose, the one with room, and Paradis's protocol is a validation that the model does not meet (gap 29).
- **Not modelled:**
  - adrenaline's β effects (rate, contractility, β2 vasodilation at low levels), its venoconstriction, and its effect on the fibrillating myocardium's oxygen use;
  - amiodarone's hypotension and bradycardia (ARREST: 59 % against 48 %, 41 % against 25 %).

  The decision's "contractility (β)" is not built: no human measurement at arrest levels was found.
- **Amiodarone** lowers the chance that VF comes back after a terminating shock by 13 % at a full dose (300 mg arrived; less acts in proportion; the second 150 mg adds nothing). The cut is derived from ARREST's 4 against 6 shocks per patient, taking shocks to follow the number of VF episodes, 1 / (1 − r). Shock termination is unchanged: no human data say otherwise.
- **In a scenario:** `drug.adrenaline` (1 mg), `drug.amiodarone.300` and `drug.amiodarone.150`. They need IV access (`access.iv`, which needs the cannula kit) and the drugs in the room. A `dose` event is logged, and replay is exact. In the practice scene the nurse brings the cannulas and the drugs on the trolley with the defibrillator; the screen has a "Line and drugs" panel.
- **Validated** (`scripts/arrest.test.mjs`):
  - **The plasma peak after a standard dose:** within Paradis's 152 ± 162 ng/mL.
  - **A high dose raises CPP more than a standard one** (Paradis): +1.8 against +0.9 mmHg.
  - **Gonzalez 1988, mechanical compressor at 60/min:** systolic 59.6 → 66.2 mmHg after 1 mg, against 35 → 57 ± 20 in five patients. It passes only on the wide tolerance; the diastolic rises more (30 → 42).
  - **ARREST** (a cohort through the shocks, below): amiodarone gives 34 % against 27 % with a circulation at 20 min, OR 1.40. ARREST found 44 % against 34 % admitted alive, adjusted OR 1.6 (1.1–2.4).
- **The cohort through the shocks:**
  - each patient's myocardial state and rhythm are run second by second, with a shock every 2 min in VF and the run's own chance streams;
  - the coronary perfusion pressure is the model's in CPR, with and without adrenaline, read from the full runs;
  - 4,000 seeded patients per arm, in a fraction of a second.

  The full circulation takes 16 s per 10 simulated minutes, too slow for cohorts. Asystole has no way out here, and an organised rhythm always perfuses (gap 26). The outcome is a circulation at the end; survival is not compared, because the model has no brain.
- **Known gaps** (29–32):
  - **29:** a standard dose after earlier ones adds +0.9 mmHg, against Paradis's 3.7.
  - **30:** a high dose adds +1.8 mmHg, against 11.3.
  - **31:** the high dose's plasma peak is 1653 ng/mL, against 393. One compartment scales with the dose; the effect is held at 400.
  - **32:** in VF, adrenaline raises the odds of a circulation by only OR 1.10, against PARAMEDIC2's 3.59. Most of PARAMEDIC2's patients were in asystole or PEA, which the model cannot leave or does not need to. With only the coronary pressure it adds, small under the ceiling, adrenaline barely helps here.
- **Not compared:** ALPS's survival (the brain); Wortsman's aortic pressure 20 → 28 and CPP 4 → 10 (a standard and a high dose in one window).
- **Gap 26** (no persistent PEA) is not changed by this step: without β effects adrenaline does nothing to a weak organised heart that the model's own perfusion does not already do.
- **Observation:** with adrenaline the forward flow under compressions falls (0.45 → 0.13 L/min) while the pressures rise. The model's brain perfusion is a pressure (arterial minus right atrial), so this does not reach it. Whether flow to the brain falls in people is debated (and is part of why PARAMEDIC2 found more survivors with severe brain injury).

## Step 5, part 1, as built: the guideline file and the debrief

Step 5 is built in parts: (1) the guideline file, scoring and the debrief; (2) the team (calling for help, the arrest team arriving, giving tasks, structured communication); (3) the teaching nudges. Then 5b, assessment.

- **The guideline file** (`src/vp/guidelines/erc-2025-als.json`, schema `vp.guideline/1`):
  - **Read in full (2026-10-20):** the ERC 2025 ALS chapter, with the BLS and Education chapters, from a redistributed copy of the published PDF, through a fetch that quotes in pieces. The quotes are near-verbatim and should be checked against the publisher's PDF when it can be opened.
  - **Each rule** cites its section (most quote the sentence) and says whose its number is: the guideline's, or a placement of ours, with a note.
  - **Definitions:** a pause is a gap between compression onsets over 2 s; a pulse needs a systolic of 50 mmHg. Both are placements.
  - **Validated** by `guidelines/validate.ts`: both languages, a note for every placement, known checks and drugs.
- **What the ERC text changed** against the numbers first read from the UK guideline:
  - **The shock:** one limit for the whole interruption ("less than 5 s"), not 5 s before and 5 s after.
  - **No 10 s limit** for the pause for two breaths was found. That rule stays as a placement, and so does the 80 % compression fraction (the guideline asks for "as few interruptions as possible").
  - **Confirmed:** the 2-minute cycles; adrenaline after the third shock, then every 3–5 min; amiodarone 300 mg after three shocks and 150 mg after five, whether the VF persists or recurs; 100–120/min and 30:2 (BLS); each breath over 1 s; 10/min with continuous compressions after an airway.
  - **Not found:** "closed-loop communication"; the guideline speaks of "structured communication", task allocation and leadership (for part 2).
- **What a run records for it** (`ScenarioRun`):
  - every compression's onset (tapped, or at a team member's steady 110/min);
  - a once-a-second trace (rhythm, arterial pressure, coronary perfusion pressure, end-tidal CO₂).

  The new `check.rhythm` intervention records the rhythm it showed. A replay scores the same.
- **The scorer** (`guidelines/score.ts`) reads only the record:
  - **When CPR was needed:** VF, VT, asystole, or an organised rhythm without a pulse.
  - **The compressions:** the pauses, each with what it was for (breaths, a shock, a rhythm check), the compression fraction, the rate, the cycles of 30:2, and the interruption for each shock.
  - **Against the algorithm:** rhythm checks (a shock counts as one), the drugs counted over shocks for VF, and hazards.
  - **Each rule** gives met, missed or did not apply, with the times where it went wrong.
- **The debrief** (`app/arrest-debrief.ts`), from "Finish and debrief", or by itself at the scene's end:
  - the patient's outcome, stated and not scored;
  - the measures;
  - one timeline: rhythm band, compressions with pauses over 10 s, shocks, doses and checks, coronary perfusion pressure and end-tidal CO₂, and the misses numbered as in the rule list;
  - the rules with why each matters, its section and, for placements, "our threshold".

  "Back to the patient" resumes a run that has not ended.
- **Tests** (`scripts/debrief.test.mjs`, `npm run test:debrief`):
  - **Scripted records:** an ideal performance meets every rule that applies. The poor ones the ADR names miss where they went wrong: a first compression 36 s late; 14 s pauses for breaths (longest pause and fraction); 80/min (the rate only). Also: 2 s plus 2 s around a shock (the whole interruption), a missing rhythm check, early adrenaline, a late repeat, no amiodarone, and an unsafe shock.
  - **On the clock:** a run through the practice scene records its compressions and trace, reads back its scripted rate and 30:2, and scores the same on replay.
- **Not yet:**
  - adrenaline as soon as possible in a non-shockable rhythm;
  - continuous compressions after an airway;
  - capnography rules;
  - the team (part 2);
  - Larsen's survival slopes (the brain is not modelled).

## Step 5, part 2, as built: the team, and the scene

**Owner (2026-10-20): "zero animations, it's just a wall of text".** This part brings the team and makes the arrest something seen:
- the scene (below) is the first part of "What to build it from";
- the debrief became mostly visual.

- **Calling the arrest team** (a `call` input, `ScenarioRun.call`): whoever is free calls, and the call takes their hands for 15 s.
  - **What it says** is chosen by the learner: where, "cardiac arrest, adult", bring the defibrillator.
  - **When the team comes:** the scene's team (a doctor and a second nurse) arrives 2 min after the call with the trolley (defibrillator, cannulas, drugs); 90 s later if the call did not say where.
  - **Fetching the trolley instead:** `fetch.trolley` sends someone for it; they leave and come back in 60 s.
  - **Placements:** all these times, in `scene.team` and in the intervention.
- **Giving tasks** (an `assign` input; `ScenarioRun.roles`). The four tasks are compressions, the airway, the defibrillator, and the line and drugs. One task per pair of hands: taking one gives up the last.
  - **Compressions and the airway** begin at once. Whoever had them lets go, and letting go clears the task.
  - **On the screen,** the defibrillator's and the drugs' buttons go to whoever has that task. If nobody has it, the leader does it with free hands, or is told "nobody has this task: give it to someone" (decision 8).
  - **Replay:** an input made inside another (a task given starts its intervention) is not logged on its own, so a replay applies it once.
- **Structured communication** (the ERC's term; "closed-loop" is not in its text):
  - each order and its read-back are logged and spoken in a bubble over the person ("Doctor, take compressions." / "Compressions: I've got it.");
  - a team member says what they start and finish ("Put the defibrillator pads on: on it." / "…: done.");
  - the call is spoken as it was made.

  Ambiguous orders, and the question they draw, are not built: the buttons cannot be ambiguous.
- **Scored** (three rules, all placements, with their notes):
  - **The call:** the arrest team called within 30 s of the collapse, saying where.
  - **Tasks:** each task held within 60 s of its becoming possible.
  - **Rotation:** the compressor changed about every 2 min (± 30 s) once a second person could take over. The ERC BLS wording is still to be checked.

  The debrief groups all rules into team, compressions, airway, defibrillation and drugs.
- **The scene** (`render/arrest-scene.ts`), seen from the patient's right, drawn each frame from the run:
  - **The patient:** the bedside figure itself. He sits up while he talks and lies flat in the 1.4 s after his heart fibrillates. He turns grey after 20 s without a circulation. His chest is bared once compressions start.
  - **The bag-valve mask:** the figure's own mask, now without strap or tubing for a bag.
  - **The team** stand behind the trolley in their scrub colours, without faces, so they do not compete with the patient:
    - the compressor's arms come straight down onto the lower half of the sternum and sink with the compression pressure the circulation feels;
    - whoever has the airway stands at the head, sealing the mask with one hand and squeezing the bag with the other as the airway pressure rises;
    - the defibrillator stands at the foot end with lead II on its screen and a charge light; the pad sits below the right clavicle with its cable;
    - the cannula is in the forearm, with a drip on a pole.
  - **Placement:** the figure's own landmarks place hands, pads and cannula; the mask's point on the face was measured on the lying figure.
  - **Checked** at close-up: the sealing hand on the mask, the bag at the head, the hands on the lower sternum.
- **The debrief, less text:**
  - a ring with the rules met;
  - the outcome and the measures;
  - the timeline;
  - five compact cards with one line per rule. Why it matters and its source open on a tap.
- **Layout:** the scene sits above the monitor on a desk, on top on a tablet, and after the hands on a phone, so that monitor, feedback and pad still fit one phone screen while compressing.
- **Tests:**
  - `scenario.test.mjs`: the call, a late team without "where", fetching, tasks, letting go, and replay.
  - `debrief.test.mjs`: no call, a call without where, a late call, one compressor throughout, and the drugs given to nobody.
- **Not yet:**
  - the compressor tiring (depth is not modelled);
  - scripted team errors to catch;
  - the leader slower while compressing (decision 8);
  - the 4 H's and 4 T's;
  - placing hands and pads by dragging (the chest view, `render/thorax.ts`).

## Step 5, second pass, as built: the bed, the airway, and playability

**Owner (2026-10-21), after playing:** the debrief's layout broke in German; it said "still in arrest (VF)" when he was breathing with a sinus rhythm at the end; "Start again" hung on "Preparing the patient…"; the interface felt illogical and unresponsive at times; he lay down flat by himself; nobody set the bed up for CPR or checked the airway ("What if he has a bolus in his throat?").

- **Start again** threw before the new patient was made (the page was wired against the old run, whose controls were gone). The old run is now dropped first.
- **The outcome** is narrated from the trace instead of one line: the course of the heart in spells of at least 3 s ("0:04 VF → 3:20 a circulation → 4:20 VF …"), and the state at the end with his breathing. A circulation that came back and was lost again (in the model VF comes back after most successful shocks) now shows as such; the run that was reported could not be reproduced, and this is the likeliest explanation. The trace records his breathing each second.
- **The German debrief:** each rule's line is a grid (mark, title, value), so long titles wrap instead of pushing values out of the card. The play page no longer overflows a 390 px phone (the header's buttons wrap).
- **The bed.** He slumps where he sat when his heart stops (`SLUMPED`: the backrest up, chin on the chest, arms fallen), and stays so. `bed.flat` (3 s, a placement) lowers the backrest; the scene animates it over those 3 s. `cpr.compressions` needs him supine (`needs.position`), and so does giving someone the compressions; the refusal says why.
- **Breathing.** `assess.breathing` (7 s; the guideline allows no more than 10 s) records what someone looking would see: normal only while the respiratory centre works (at least 0.9 of its function, our cut); the last slow, shallow breaths of a failing centre (`failing`), gasping, or nothing. The monitor no longer shows his breathing all the time: it shows the last check and when it was. Gasps are still logged as they come, since they are seen and heard across the room.
- **The airway.** In a quarter of runs (`scene.airway`: a teaching variant drawn from its own stream, not a rate) a bolus of food from his meal sits in his pharynx. No breath gets past it, by mask, supraglottic airway or tube (`Ventilator.obstructed`); each breath records whether the chest rose. `assess.mouth` (3 s) shows it; `airway.clear` (suction or Magill forceps, 10–20 s, placements) takes it out and needs the airway kit, which is on the arrest trolley (it comes with the team or the fetched trolley). On the screen, whoever holds the bag puts it down to look or clear and takes it up again after.
- **Scored** (two new rules, version 1.2.0 of the guideline file):
  - **Breathing checked before compressions** (the guideline's sequence: unresponsive, open the airway, look for normal breathing, then compress).
  - **A blocked airway cleared** within 60 s (ours) of the first breath that did not get in, or of the airway kit's arrival if that was later; not applicable without a bolus or without the kit. The run now records what was in the room from the start (`startEquipment`).
  - Laying the bed flat adds about 3 s before the first compression; the 15 s rule for it is unchanged.
- **Playability:**
  - a message over the scene (a toast) for what was refused and why, and for what was found: the breathing, the mouth, the rhythm (with the pulse for an organised rhythm), a shock's outcome, VF coming back, the team arriving, no chest rise;
  - the team cards say how many seconds someone is still busy;
  - a first-steps row in the hands panel (bed, breathing, mouth, suction), done by the learner with free hands, else by whoever is free;
  - in the scene, whoever lowers the bed stands at its head end, and whoever checks the breathing or the mouth has a hand on the forehead and two fingers under the chin; speech bubbles stay inside the scene.
- **Tests:** `scenario.test.mjs` (the raised bed refuses compressions, laying it flat, the breathing and the mouth, the bolus drawn by seed, no chest rise, the kit, clearing, a supraglottic airway not past a bolus, replay, the validator); `debrief.test.mjs` (the two rules, the kit arriving late or never, the course and the outcome in English and German). The compression tests that are about compressions start with the patient lying flat.
- **Not yet:**
  - a bolus does not stop his own breaths (a failing centre's last breaths and gasps still move air in the model);
  - choking before the arrest (a hypoxic arrest) is a different scenario;
  - suction at the bedside (many wards have wall suction) is not in the room;
  - his eyes stay open in the figure when he is unconscious.

## The phone layout (2026-10-21)

**Owner, after the second pass:** "on the phone it is rather unplayable". The page was about 4,060 px tall on a 390 × 844 phone. The scene was at the bottom, and the pad was 930 px below the monitor.

- **One screen, no page scroll** (under 600 px wide; `renderPhone` in `app/practice-arrest.ts`). From top to bottom:
  - a compact header (back, time, pause, debrief, start again);
  - the scene, with EtCO₂ (and CPP and arterial pressure while the arterial line is on) in a corner;
  - a 4 s strip of lead II (and the arterial line);
  - one status line (who compresses, the learner's rate and count, who has the bag);
  - the pad under the thumb: the compression pad or the bag's squeeze, whichever the learner holds, else a hint;
  - a tab bar.
- **The tabs** (Hands, Airway, Defib, Drugs, Team, Monitor) open a sheet that slides up over the pad with that part's controls. The full monitor, the trends, "Why it works" and the log are in Monitor.
- **The scene answers a tap,** on the phone and on the desk:
  - a person: give them a task, two breaths, hands off, call the team, fetch the trolley;
  - the head: breathing, mouth, suction, the bag;
  - the chest: compressions, pads, rhythm check;
  - the bed: lay it flat;
  - the arm: line and drugs;
  - the defibrillator: pads, charge, check, shock.

  Each menu item stands for a control that already exists, so the same rules and refusals apply. An item is greyed when its control is disabled.
- **The desk layout is unchanged.** One set of HTML fragments with the same data attributes serves both layouts, and crossing 600 px re-renders.
- **On the phone while playing:** the layout covers the page, so the language switch is reached from the ward or the debrief. The report button moves to the scene's empty top corner.

## A first practice screen (draft, after step 2)

Asked for by the owner (2026-10-20) before step 3, to try the hands on a running patient. `app/practice-arrest.ts`, opened from the Ward:
- **The run:** a `ScenarioRun` of `scenarios/arrest-practice.json` on the free patient. The scene fibrillates his heart 4 s in (`SceneDo.change`, a scripted change to the model, validated like an intervention's).
- **Hands:** compressions are tapped (or the space bar); the bag is taken and each press gives a breath as long as it is held (since 2026-10-20; from the keyboard a standard 1 s breath). One pair of hands cannot do both.
- **The nurse:** compresses, takes the bag or gives two breaths when told.
- **What is shown:** the circulation's own samples and numbers, the patient's breathing (breathing, gasping, not breathing), the learner's rate, count and hands-off time, two minutes of coronary perfusion pressure and end-tidal CO₂ with a short explanation, and a log.
- **Not yet:** the debrief and scoring (step 5).

**Owner (2026-10-20): the buttons are a stand-in.** Later the arrest gets a real patient and animated tools, as the examination and the stations have, because where and how things are done is part of what is learned:
- **The patient figure** in the arrest: collapsed, on the floor or the bed, with the rescuers.
- **Hand position for compressions:** the learner places the hands, and a wrong place is scored and weakens the compressions (the model would then need a placement factor, grounded where data allow).
- **The airway and the bag:** head tilt and chin lift, the mask grip and seal (the leak would follow from it), the chest rising.
- **Pads** placed on the chest (step 3).
- **IV access as a procedure:** placing a venflon, with its steps and its time, before drugs can be given (step 4).

For now the screen stays as it is, to get the circuit right: physiology, scene, inputs and replay.

**What to build it from** (looked at 2026-10-20; agreed with the owner as its own topic, after step 5 or before it if the owner prefers):
- **The patient:** the bedside figure (`render/patient-figure.ts`, `figure-*.ts`; read `studio/figure/BRIEF.md` first). It is anatomical, built from the patient and the model's findings, posed by joint angles with smooth transitions, and seen from three sides, from above when lying. The collapse is a pose change to `supine` at the scene's VF; the bag-mask goes on the face like the oxygen mask does.
- **Where the hands go:** the chest views (`render/thorax.ts`): the same body, with landmarks and positions in chest-frame cm, where the ECG electrodes are already dragged on. Hands on the lower half of the sternum, the pads (right infraclavicular and apical), later the cannula on the forearm, are placed the same way. A wrong place is logged; any effect on the compressions waits for grounding.
- **The mechanism:** the stations' signal-and-mechanism pattern (`render/wiggers.ts`, `conduction-heart.ts`) for a diagram of the thoracic pump and coronary filling, in place of the trend alone.
- **Checking it:** the figure loop (`sh studio/figure/run.sh`, `shoot.py zoom`), with close-ups for the owner before any claim.

## The open questions of the practice screen and step 4, settled (2026-10-20)

The owner handed these over ("tackle those"); each is decided here, with its reason, and can be revisited.

1. **Tapping on a phone: keep it, with the layout reworked.** Checked on an emulated phone (390 × 844, touch):
   - **The taps:** each counts, the rate reads the true interval, and the page does not zoom (`touch-action: manipulation`).
   - **What was wrong:** while compressing, neither the monitor nor the rate was on screen. The introduction filled the first screen, and the feedback sat below the pad.
   - **On phones now:** the monitor comes first and is compact (its note hidden; the canvas keeps it as its label), and the rate, count, hands-off and last-breath tiles sit above the pad, on desktop too. Starting compressions brings the monitor to the top. Monitor, feedback and the 140 px pad then fit one screen.
   - **Left as it is:** the app-wide floating Report button overlaps the pad's corner.
2. **The arterial line: switchable, on while practising.**
   - **Why it stays on:** the pressure and the coronary perfusion pressure are what the practice screen teaches with (Paradis's 15 mmHg).
   - **Why it can be switched off:** a ward patient has no arterial line. The switch sits in the monitor and is remembered on the device. Without the line, the arterial trace and numbers and the coronary perfusion trend are hidden, and the monitor says that end-tidal CO₂ is the guide to the compressions.
   - **Assessment mode** (step 5b) will start with it off.
3. **A breath's press duration counts** (decision 7).
   - **How:** a press squeezes the bag at a standard breath's pressure for as long as it is held (`Ventilator.squeeze` and `release`). The volume follows from the lungs' own inspiratory time constant, so a quick squeeze gives less (about 0.39 L for 0.3 s against 0.5 L for 1 s), and holding past a second adds little. A squeeze is cut at 3 s.
   - **What the learner sees:** the last breath's duration and volume, marked when outside 0.6–1.5 s (ERC: about 1 s each).
   - **In the run:** a `bag` input (squeeze and release) and a `breath` event; replay is exact.
   - **Also fixed:** putting the mask on takes 5 s, and the screen now says so ("Putting the mask on…") rather than offering a breath that is refused.
4. **Adrenaline's gain: keep the fit to the first dose** (step 4).
   - **Why not leave it an assumption:** a fit to a measured human response, with its protocol difference stated, is better grounded than a number with no measurement behind it.
   - **Why the first dose:** fitting Paradis's own several-dose protocol is impossible under the ceiling of gap 20, and tuning towards it would hide that gap in a drug constant.
   - **What would change it:** when gap 20 is addressed (how vascular tone fails in a long arrest), refit, and gaps 29, 30 and 32 should be rechecked.

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

- Soar J, Böttiger BW, Carli P, et al. European Resuscitation Council Guidelines 2025 Adult Advanced Life Support. *Resuscitation* 2025;215 Suppl 1:110769. [doi:10.1016/j.resuscitation.2025.110769](https://doi.org/10.1016/j.resuscitation.2025.110769). Its numbers were first read from the Resuscitation Council UK's 2025 ALS guideline, which follows it, and then checked against the ERC text itself (2026-10-20, a redistributed copy of the published PDF; see "Step 5, part 1, as built" for what changed). Compression rate and depth, 30:2 and rescue breaths are in the companion BLS chapter: Smyth MA, van Goor S, et al. European Resuscitation Council Guidelines 2025 Adult Basic Life Support. *Resuscitation* 2025;215 Suppl 1:110771. [doi:10.1016/j.resuscitation.2025.110771](https://doi.org/10.1016/j.resuscitation.2025.110771).
- Smyth MA, van Goor S, Hansen CM, et al. European Resuscitation Council Guidelines 2025 Adult Basic Life Support. *Resuscitation* 2025;215 Suppl 1:110771. [doi:10.1016/j.resuscitation.2025.110771](https://doi.org/10.1016/j.resuscitation.2025.110771). The compression rate and depth (100–120/min, 5–6 cm, 30:2) are those of earlier editions; still to be confirmed in the 2025 text.
- Paradis NA, Martin GB, Rivers EP, et al. Coronary perfusion pressure and the return of spontaneous circulation in human cardiopulmonary resuscitation. *JAMA* 1990;263:1106–13. PMID 2386557.
- Ornato JP, Gonzalez ER, Garnett AR, et al. Effect of cardiopulmonary resuscitation compression rate on end-tidal carbon dioxide concentration and arterial pressure in man. *Crit Care Med* 1988;16:241–5. [doi:10.1097/00003246-198803000-00007](https://doi.org/10.1097/00003246-198803000-00007).
- Falk JL, Rackow EC, Weil MH. End-tidal carbon dioxide concentration during cardiopulmonary resuscitation. *N Engl J Med* 1988;318:607–11. [doi:10.1056/NEJM198803103181005](https://doi.org/10.1056/NEJM198803103181005).
- Levine RL, Wayne MA, Miller CC. End-tidal carbon dioxide and outcome of out-of-hospital cardiac arrest. *N Engl J Med* 1997;337:301–6. [doi:10.1056/NEJM199707313370503](https://doi.org/10.1056/NEJM199707313370503).
- Larsen MP, Eisenberg MS, Cummins RO, Hallstrom AP. Predicting survival from out-of-hospital cardiac arrest: a graphic model. *Ann Emerg Med* 1993;22:1652–8. [doi:10.1016/s0196-0644(05)81302-2](https://doi.org/10.1016/s0196-0644(05)81302-2).
- Valenzuela TD, Roe DJ, Cretin S, et al. Estimating effectiveness of cardiac arrest interventions: a logistic regression survival model. *Circulation* 1997;96:3308–13. [doi:10.1161/01.cir.96.10.3308](https://doi.org/10.1161/01.cir.96.10.3308).
