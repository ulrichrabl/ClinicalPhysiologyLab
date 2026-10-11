import type { Resolver } from './engine/observe.ts';
import type { Formatter } from './text/formatters.ts';
import { FORMATTERS } from './text/formatters.ts';
import { NEURO_CONDITIONS, NEURO_RESOLVERS } from './models/neuro-exam.ts';
import { CARDIO_RESOLVERS } from './models/cardio-exam.ts';

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
  resolvers: { ...NEURO_RESOLVERS, ...CARDIO_RESOLVERS },
  formatters: FORMATTERS,
  renderers: ['svg.eyes', 'svg.field', 'svg.fundus', 'svg.patient', 'svg.pulse', 'svg.neck', 'audio.heart', 'audio.lung'],
  conditions: { ...NEURO_CONDITIONS },
  physiologyKeys: [
    'HR', 'Emax', 'Emin', 'V0', 'edpA', 'edpB', 'EmaxRv', 'Csa', 'Rsys', 'Rven', 'V0sv', 'Cpa', 'Rpul', 'bloodVolume', 'K',
    'Rmitral', 'Raortic', 'Rtricuspid', 'Rpulmonic', 'regMitral', 'regAortic', 'regTricuspid', 'regPulmonic',
    'avConduction', 'lbbConduction', 'rbbConduction',
  ],
};
