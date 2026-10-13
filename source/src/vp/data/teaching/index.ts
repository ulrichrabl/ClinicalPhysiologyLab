import type { TeachingCard } from '../../model/types.ts';
import { VITALS } from './vitals.ts';
import { GENERAL } from './general.ts';
import { CARDIO } from './cardio.ts';
import { RESP } from './resp.ts';
import { ABDOMEN } from './abdomen.ts';
import { NEURO_CRANIAL } from './neuro-cranial.ts';
import { NEURO_LIMBS } from './neuro-limbs.ts';
import { NEURO_COORDINATION } from './neuro-coordination.ts';
import { CARE } from './care.ts';

/* ---------------------------------------------------------------------------
   Teaching cards: what each examination is, how it is done and what it shows.

   Keyed by manoeuvre id and merged into the catalog; one file per system.
   Every card is written in every language the app offers (the validator
   reports what is missing). Abnormal findings name the model properties that
   report them and the diagnoses they occur in; the validator checks those ids
   exist. Review modes (spaced repetition, matching tests to conditions) are
   generated from these cards, so nothing here is specific to one mode.

   The content is standard clinical teaching. Where a threshold or a test's
   performance rests on a study, the card cites it (refs, from
   evidence/references.ts).
--------------------------------------------------------------------------- */

const parts: Array<Record<string, TeachingCard>> = [VITALS, GENERAL, CARDIO, RESP, ABDOMEN, NEURO_CRANIAL, NEURO_LIMBS, NEURO_COORDINATION, CARE];

export const TEACHING: Record<string, TeachingCard> = {};
for (const p of parts) for (const [id, card] of Object.entries(p)) {
  if (TEACHING[id]) throw new Error(`two teaching cards for ${id}`);
  TEACHING[id] = card;
}
