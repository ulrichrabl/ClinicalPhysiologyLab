# Examination menu, search and teaching cards

Last updated: 13 October 2026.

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
- **`data/teaching.ts`** holds one `TeachingCard` per manoeuvre, keyed by manoeuvre id. A card has:
  - `aliases`: eponyms and the names used in other languages; these are also searched.
  - `assesses`: the function and pathway the test examines.
  - `how`: the steps.
  - `normal`: the normal finding.
  - `abnormal[]`: each entry has a `sign` and what it `means`. It also links to the model `properties` that report the sign and the `conditions` (diagnosis ids) it occurs in.
  - `pitfalls`, `refs` (ids in `evidence/references.ts`), and `animation` (an empty slot for a renderer).

  The validator checks that every property, diagnosis and reference a card names exists.
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

## Status and what is missing

- Teaching cards: **1 of 109** written (heel–shin test). The test suite prints the coverage.
- Next: cards for the rest of the nervous system first (coordination, cranial nerves, motor, sensory), then the cardiovascular, respiratory and abdominal examinations, then the general examination and vital signs.
- Some labels are long sentences ("Arms out, palms up, eyes closed: pronator drift"). A short name per manoeuvre, with the sentence kept as the instruction, would make the lists easier to scan.
