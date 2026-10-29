import type { LocalizedText } from '../model/i18n.ts';
import { E1020 } from './eeg-forward.ts';

/* ===========================================================================
   Montages: how the electrodes are paired into channels.

   A channel records the difference between its two inputs: input 1 minus
   input 2. By the EEG convention a channel deflects upward when input 1 is
   negative relative to input 2. So the same potentials look different in
   different montages, and reading where a discharge is means knowing how
   each montage turns a field into deflections:

   - In a bipolar chain each channel compares neighbours. Over a negative
     maximum the channel before it points down and the one after it points
     up: they point at each other, a phase reversal at the shared electrode.
     A maximum at the end of a chain (Fp1, O1) has no reversal.
   - In a referential montage every channel compares with one reference, and
     the largest deflection is the maximum, provided the reference itself is
     quiet. An ear near a temporal discharge is not.

   The montages are ACNS Guideline 3's (Acharya 2016), channel by channel.
=========================================================================== */

const L = (en: string, de: string): LocalizedText => ({ en, de });

export interface Channel { a: string; b: string }
export interface Montage {
  id: string;
  label: LocalizedText;
  kind: 'bipolar' | 'referential';
  /** the channels, grouped as drawn (a gap between groups) */
  groups: Channel[][];
  /** chains of electrodes, for bipolar montages: each group's electrodes in order */
  chains?: string[][];
}

const chain = (...e: string[]): Channel[] => e.slice(1).map((b, i) => ({ a: e[i], b }));
const refTo = (ref: string, ...e: string[]): Channel[] => e.map((a) => ({ a, b: ref }));

const LB_CHAINS = [
  ['Fp1', 'F7', 'T7', 'P7', 'O1'], ['Fp1', 'F3', 'C3', 'P3', 'O1'], ['Fz', 'Cz', 'Pz'],
  ['Fp2', 'F4', 'C4', 'P4', 'O2'], ['Fp2', 'F8', 'T8', 'P8', 'O2'],
];
const TB_CHAINS = [
  ['F7', 'Fp1', 'Fp2', 'F8'], ['F7', 'F3', 'Fz', 'F4', 'F8'], ['T7', 'C3', 'Cz', 'C4', 'T8'],
  ['P7', 'P3', 'Pz', 'P4', 'P8'], ['P7', 'O1', 'O2', 'P8'],
];

export const MONTAGES: Montage[] = [
  { id: 'LB-18.1', kind: 'bipolar', label: L('Longitudinal bipolar (“double banana”)', 'Längsreihe bipolar („Double Banana“)'),
    groups: LB_CHAINS.map((c) => chain(...c)), chains: LB_CHAINS },
  { id: 'TB-18.1', kind: 'bipolar', label: L('Transverse bipolar', 'Querreihe bipolar'),
    groups: TB_CHAINS.map((c) => chain(...c)), chains: TB_CHAINS },
  { id: 'R-18.1', kind: 'referential', label: L('Ear reference (left to A1, right to A2)', 'Ohrreferenz (links gegen A1, rechts gegen A2)'),
    groups: [refTo('A1', 'F7', 'T7', 'P7'), refTo('A1', 'Fp1', 'F3', 'C3', 'P3', 'O1'), [...refTo('A1', 'Fz'), ...refTo('A2', 'Pz')], refTo('A2', 'Fp2', 'F4', 'C4', 'P4', 'O2'), refTo('A2', 'F8', 'T8', 'P8')] },
  { id: 'Cz', kind: 'referential', label: L('Cz reference', 'Cz-Referenz'),
    groups: [refTo('Cz', 'F7', 'T7', 'P7'), refTo('Cz', 'Fp1', 'F3', 'C3', 'P3', 'O1'), refTo('Cz', 'Fz', 'Pz'), refTo('Cz', 'Fp2', 'F4', 'C4', 'P4', 'O2'), refTo('Cz', 'F8', 'T8', 'P8')] },
  { id: 'AVG', kind: 'referential', label: L('Average reference (all 19)', 'Mittelwertreferenz (alle 19)'),
    groups: [refTo('AVG', 'F7', 'T7', 'P7'), refTo('AVG', 'Fp1', 'F3', 'C3', 'P3', 'O1'), refTo('AVG', 'Fz', 'Cz', 'Pz'), refTo('AVG', 'Fp2', 'F4', 'C4', 'P4', 'O2'), refTo('AVG', 'F8', 'T8', 'P8')] },
];
export const MONTAGE_BY_ID: Record<string, Montage> = Object.fromEntries(MONTAGES.map((m) => [m.id, m]));

/** An electrode's potential, or the average of the 19 for 'AVG'. */
export function potentialOf(v: Record<string, number>, e: string): number {
  if (e !== 'AVG') return v[e] ?? 0;
  let s = 0; for (const x of E1020) s += v[x] ?? 0; return s / E1020.length;
}
export const channelValue = (v: Record<string, number>, c: Channel) => potentialOf(v, c.a) - potentialOf(v, c.b);
export const channelLabel = (c: Channel) => `${c.a}–${c.b === 'AVG' ? 'Avg' : c.b}`;

/* ---- reading a discharge's field the way a reader does ------------------------------------------ */

/** `at` is the electrode the channels point at, or two joined by '=' when they are equipotential; `strength` is the smaller
    of the two channels (µV), to rank reversals in different chains */
export interface Reversal { chain: string[]; at: string; kind: 'negative' | 'positive'; strength: number }
export interface FieldReading {
  /** the most negative electrode against the average of the 19, and those within 80 % of it */
  negMax: string; negNear: string[];
  /** the most positive, likewise (a second pole shows a tangential source) */
  posMax: string; posNear: string[];
  /** peak-to-baseline in the longitudinal bipolar montage at the largest channel (µV): how ACNS measures voltage */
  bipolarPeak: number;
  /** phase reversals in the longitudinal bipolar chains */
  reversals: Reversal[];
  /** the negative maximum at the end of a chain, where no reversal can show */
  endOfChain: boolean;
  /** the positive pole is at least half as strong as the negative: a tangential (or oblique) source */
  twoPoles: boolean;
}

/** Read the field (µV at each electrode at the discharge's peak). A channel counts in a reversal only if it carries at
    least a tenth of the chain's largest channel: smaller deflections are not read as a reversal. */
export function readField(v: Record<string, number>): FieldReading {
  const ref = potentialOf(v, 'AVG');
  const rel = E1020.map((e) => ({ e, v: (v[e] ?? 0) - ref }));
  const neg = [...rel].sort((a, b) => a.v - b.v), pos = [...rel].sort((a, b) => b.v - a.v);
  const negMax = neg[0].e, posMax = pos[0].e;
  const negNear = neg.filter((x) => x.v <= 0.8 * neg[0].v && x.v < 0).map((x) => x.e);
  const posNear = pos.filter((x) => x.v >= 0.8 * pos[0].v && x.v > 0).map((x) => x.e);
  const reversals: Reversal[] = [];
  let bipolarPeak = 0;
  for (const c of LB_CHAINS) {
    const ch = c.slice(1).map((b, i) => (v[c[i]] ?? 0) - (v[b] ?? 0));
    const big = Math.max(...ch.map(Math.abs));
    bipolarPeak = Math.max(bipolarPeak, big);
    /* the significant channels in order; a flat channel between two that point at each other means its two
       electrodes are equally the maximum (an equipotential pair), and the reversal is at both */
    const sig = ch.map((x, i) => ({ x, i })).filter((s) => Math.abs(s.x) >= 0.1 * big);
    for (let k = 0; k + 1 < sig.length; k++) {
      const a = sig[k], b = sig[k + 1];
      if (Math.sign(a.x) === Math.sign(b.x)) continue;
      const at = c.slice(a.i + 1, b.i + 1);
      const strength = Math.min(Math.abs(a.x), Math.abs(b.x));
      reversals.push({ chain: c, at: at.join('='), kind: a.x > 0 ? 'negative' : 'positive', strength });
    }
  }
  reversals.sort((a, b) => b.strength - a.strength);
  const ends = new Set(LB_CHAINS.flatMap((c) => [c[0], c[c.length - 1]]));
  const endOfChain = ends.has(negMax) && !reversals.some((r) => r.kind === 'negative' && r.at.split('=').includes(negMax));
  const twoPoles = pos[0].v >= 0.5 * -neg[0].v;
  return { negMax, negNear, posMax, posNear, bipolarPeak, reversals, endOfChain, twoPoles };
}
