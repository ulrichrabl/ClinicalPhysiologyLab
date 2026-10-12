import type { LocalizedText } from '../model/i18n.ts';
import type { RuntimeView } from '../engine/observe.ts';
import type { PatientModel } from './state.ts';

/* ===========================================================================
   Physiology as data.

   A model is a chapter of the living textbook: its variables (parameters
   the Model Lab can set, states the simulation computes), its governing
   equations (as structured math, so the book shows exactly what runs), an
   animated diagram, and its sources. Measurements elsewhere point at these
   variables; nothing here knows about examinations.
=========================================================================== */

export interface VariableDef {
  id: string;                       // 'haemodynamics.Emax'
  key: string;                      // where it lives in the PatientModel section, or the live-value key
  symbol: string;                   // 'E_{max}', 'P_{LV}', '[K^+]_o'
  label: LocalizedText;
  unit: string;
  kind: 'parameter' | 'state';
  group?: string;                   // Model Lab subgroup
  control?: 'number' | 'toggle' | 'enum' | 'side' | 'lesions';
  min?: number; max?: number; step?: number; digits?: number;
  options?: Array<{ value: string; label: LocalizedText }>;
  note?: LocalizedText;
}

/** Math as a small tree: rendered to MathML, symbolically and with live values substituted. */
export type MathNode =
  | string                                         // operator, number or plain identifier
  | { v: string }                                  // a variable (local key or full id)
  | { frac: [MathNode[], MathNode[]] }
  | { fn: string; args: MathNode[] }                // log, ln, exp
  | { paren: MathNode[] }
  | { sup: [MathNode[], MathNode[]] }
  | { text: string };

export interface EquationDef {
  id: string;
  label: LocalizedText;
  level: 'textbook' | 'full';
  lhs: MathNode[];
  rhs: MathNode[];
  explanation: LocalizedText;
}

export interface LiveContext {
  model: PatientModel;
  snap?: Record<string, any>;       // latest circulation snapshot (instantaneous + beat metrics)
  view: RuntimeView;
}

export interface ModelDef {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  groups: Array<{ id: string; label: LocalizedText }>;
  variables: VariableDef[];
  equations: EquationDef[];
  /** Current value of every variable this model exposes, keyed by variable key. */
  values: (ctx: LiveContext) => Record<string, number | string | boolean>;
  diagram: string;
  sources: string[];
  /** Constant groups (evidence/constants.ts) this model's equations use: shown with their evidence. */
  constants?: string[];
}
