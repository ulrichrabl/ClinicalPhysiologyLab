# Examination menu, search and teaching cards

Last updated: 13 October 2026 (all teaching cards written).

This document describes how the bedside examination is organised and searched, and how each examination carries its own teaching card. It also covers what the data model is built to support later and what is still to do.

## Languages

Every text a learner sees is a `LocalizedText`, with English as the fallback. That covers labels, section names, phrases, aliases and every part of a teaching card. German is complete; another language is added as data, without code changes.

The validator warns about any text that is missing a language. The test suite requires the catalog to have no warnings, so a card cannot be merged in only one language.

Search matches names in all languages at once, so an English learner who types "Knie-Hacke" finds the heel–shin test, and a German learner who types "heel shin" finds the Knie-Hacke-Versuch. Each result is shown in the learner's language. The name that matched is shown underneath, so learners also pick up the other terms.

## Data model

- **`data/exam-structure.ts`** defines the systems in the order a clinician examines:
  1. vital signs;
  2. general examination;
  3. cardiovascular;
  4. respiratory;
  5. abdomen;
  6. nervous system;
  7. position and treat.

  Each system has sections, and each section lists its manoeuvres in the order they are done (look, feel, tap, listen).
  - Every manoeuvre belongs to exactly one section; the tests check this.
  - When the catalog is built, each manoeuvre receives its `section` and an `order` across the whole examination.
- **A section's `kind`** is `measure`, `examine` or `intervene`.
  - Interventions (positioning, exposing, oxygen) are kept out of the examination menu and shown as a separate control.
  - `layout: 'chips' | 'select'` sets how they are displayed: chips for positions, a dropdown for oxygen devices.
- **Teaching cards are built from the knowledge tables** in `source/knowledge/` (ADR-016; see its README). A card is not written by hand any more.
  - A test's texts (`assesses`, `how.N`, `normal`, `pitfall.N`, `alias.N`) are in the text table, in every language.
  - Its findings are **presentations**: how signs show on that test (`description`) and what it means (`meaning`), with the signs and syndrome they belong to. The conditions shown with a finding are the `suggests` links that name it.
  - Below them, the card lists the further signs the test can elicit, derived from the signs' definitions, and the normal variants worth naming.
  - Every sign has its own card: the tests that find it, how it presents on each, its syndromes, variants and conditions.

  The validator checks every link and text; a presentation's signs must be ones its tests can elicit.
- **`engine/suggest.ts`** produces the suggestions for the command field.
  - It searches manoeuvres (labels, parser phrases, aliases, and the signs and meanings on their cards), investigations and history questions.
  - Results are ranked by match quality, then by clinical order.
  - Choosing a suggestion does exactly what typing its label would do.

## Interface

- **Body region menu** (tap the figure): lists that region's examinations under "System · Section" headings, in clinical order.
- **All examinations:** collapsible systems; one is open at a time, so the list stays short enough to scan.
- **Position and treat:**
  - always visible under the figure;
  - position and exposure are chips, oxygen is a dropdown;
  - the patient's current state is highlighted.
- **Command field:**
  - Focusing it shows a hint; typing shows grouped suggestions (Examine, Order, Ask), each with its section and the name that matched.
  - ↑/↓ chooses a suggestion, Enter does it, Tab copies its text into the field, and Esc closes the list.
  - Free text still goes to the parser as before.
- **ⓘ** next to an examination that has a card opens the card. Reading it does not count as performing the test, and the card has a "Do it now" button.
  - During a case, the conditions linked to each abnormal finding stay hidden until the learner commits to a diagnosis.
  - With the free patient, and after committing, they are shown.

## What the model is built to allow later (not built yet)

- **Spaced repetition:** a card's front is the test name and its back is the card. Alternatively, the front is a sign and the question is "which test?". Learner progress is stored per learner, keyed by manoeuvre id, and never in the catalog.
- **Matching challenges:**
  - From `abnormal[].conditions`: which test tells condition A from condition B?
  - From a case: what would you examine to confirm X?
- **Animations:** `animation` names a renderer, drawn in the same style as the patient figure.
- **Checking cards against the model:** a test that runs each linked condition through the model and confirms it produces the stated sign, so the cards stay honest the way the evidence registry does.

## Signs in the encounter (ADR-016 step 3)

- **After a test, the feed names the signs it found:**
  - **What is read:** only that test's own observations, on the side it was done.
  - **Sides:** each sign carries its side, or "both sides". A sign that exists only by comparing the sides, such as anisocoria, has none.
  - **Normal variants** are named as normal (end-point nystagmus).
  - **Pertinent negatives:** signs the test looked for but did not find are listed collapsed.
  - **Interventions** (positioning, exposing, oxygen) name none themselves.
- **General inspection names what the bedside figure shows,** where the eye alone could find it: jaundice, cyanosis, a distended abdomen, a barrel chest. Shifting dullness and pitting oedema read the same fields but need percussion or pressure, so they are not named by sight.
- **The Notes tab** lists the signs found so far. With the free patient, and after committing to a diagnosis, it also lists every sign the model produces, whether examined or not.
- **Every sign chip opens the sign's card.**

## Signs in the debrief, and the observe-only level (ADR-016 step 4)

- **The expert reference speaks in signs** (with side, and pertinent negatives). The debrief credits a sign when a test the learner did showed it, read from that test's own recorded findings, and names the test, or the tests that would have shown it.
- **Who names the signs** is chosen on the ward: *The app names them* (as above) or *You name them* (observe only). With observe only, the feed offers after each test the signs that test can show, without saying which are there; the learner picks what they saw, and the Notes tab lists and searches them. The debrief adds *Your documentation*: named and there, there and not named, and over-calls, with the normal finding an over-call really was.
- **The typed command line** is checked against `scripts/data/typed-commands.json`, 129 phrasings learners type (EN and DE).

## Names

Each manoeuvre's label is the name of the test, never of a sign it shows (ADR-016): "Inspection of the sclerae", not "Scleral icterus". The old sign-named labels remain as aliases, so search still finds them. Otherwise the label is the name a medical student learns the test by, in each language: "Romberg test" / "Romberg-Stehversuch", "Pronator drift" / "Armvorhalteversuch", "Facial nerve (VII)" / "N. facialis (VII)", "Lying and standing blood pressure" / "Schellong-Test". How to perform the test is on its card, not in the label.

## Status and what is missing

- Teaching cards: **109 of 109** written, in English and German; the tests require a card for every manoeuvre.
- Repeated techniques share one card body with a site-specific line: the five heart auscultation areas, and percussion, breath sounds and vocal resonance at five lung sites.
- Interventions (positions, exposure, oxygen devices) have cards too: what each is for, and what the patient's response shows (for example orthopnoea when lying flat, or a saturation that will not rise on oxygen because of shunt).
- The cards cite references where a threshold rests on a study: McGee (postural pulse), Schriger & Baraff (capillary refill), Hung (jaundice), Sheth and Kalantri (pallor), Lundsgaard and Comroe (cyanosis), Mackowiak (temperature). The rest is standard clinical teaching and has no references yet.
- **Cards against the model** (test section "Teaching cards against the cases"): wherever a card links a sign to a condition that has a case, the model must show the sign in that patient. 134 links do; 324 link to conditions without a case yet; 32 are listed exceptions with reasons. A new mismatch fails the suite.
  - *The model cannot produce the sign yet* (work for the model): loud P2 in pulmonary hypertension; tricuspid regurgitation murmur; pleural rub; deep vein thrombosis; glossitis; fetor hepaticus and uraemic fetor; a narrowed pulse pressure in aortic stenosis; tachypnoea in ketoacidosis (only depth rises); an empty JVP in hypovolaemia (2 mmHg reads as normal).
  - *This patient does not have the sign* (the card is right): the pneumonia case saturates 94 % on air; warm septic shock has normal capillary refill; the PE is submassive; the triple-whammy patient is dry; the stroke case has no hemianopia or sensory loss, and is too early for spasticity.
- Not yet done: review modes (spaced repetition, matching); animations; finding texts written as observations rather than diagnoses (so observe-only also tests text-only findings); a clinical read-through of the card texts, especially the German (deferred by the owner until colleagues are involved).
