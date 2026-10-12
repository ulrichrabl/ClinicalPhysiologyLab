import type { Resolver } from './engine/observe.ts';
import type { Formatter } from './text/formatters.ts';
import { FORMATTERS } from './text/formatters.ts';
import { NEURO_CONDITIONS, NEURO_RESOLVERS } from './models/neuro-exam.ts';
import { CARDIO_RESOLVERS } from './models/cardio-exam.ts';
import { NEURO_LIMB_RESOLVERS } from './models/neuro-limb.ts';
import { CIRCULATION_DEFAULTS } from './physiology/state.ts';
import { LAB_RESOLVERS } from './measurements/labs.ts';
import { RESP_RESOLVERS } from './models/resp-exam.ts';
import { RESP_LAB_RESOLVERS } from './measurements/respiratory.ts';
import { BODY_EXAM_RESOLVERS, BODY_LAB_RESOLVERS } from './models/body-exam.ts';

/* ---------------------------------------------------------------------------
   The code side of the data model. Data refers to these by id; the validator
   checks that every id a catalog or case uses is registered here.
--------------------------------------------------------------------------- */

export interface Registry {
  resolvers: Record<string, Resolver>;
  formatters: Record<string, Formatter>;
  /** Renderer ids that exist or are reserved. A missing renderer falls back to text. */
  renderers: string[];
  /** Condition ids models understand, with parameter kinds. */
  conditions: Record<string, { params: Record<string, 'side' | 'fraction' | 'number'> }>;
  /** Circulation parameters a case may set (the circulation model's vocabulary). */
  physiologyKeys: string[];
}

export const REGISTRY: Registry = {
  resolvers: { ...NEURO_RESOLVERS, ...NEURO_LIMB_RESOLVERS, ...CARDIO_RESOLVERS, ...RESP_RESOLVERS, ...LAB_RESOLVERS, ...RESP_LAB_RESOLVERS, ...BODY_EXAM_RESOLVERS, ...BODY_LAB_RESOLVERS },
  formatters: FORMATTERS,
  renderers: ['svg.eyes', 'svg.face', 'svg.dermatomes', 'svg.field', 'svg.fundus', 'svg.patient', 'svg.pulse', 'svg.neck', 'audio.heart', 'audio.lung', 'audio.percussion', 'canvas.cxr', 'canvas.spirometry'],
  conditions: { ...NEURO_CONDITIONS },
  physiologyKeys: Object.keys(CIRCULATION_DEFAULTS),
};
