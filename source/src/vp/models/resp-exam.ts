import type { ExamContext, Side } from '../model/types.ts';
import { LUNG } from '../evidence/lung.ts';
import { EXAM } from '../evidence/exam.ts';
import type { Resolved, Resolver, RuntimeView } from '../engine/observe.ts';
import { pulseOximeter, idealWeight, type LobeId, type RespSnapshot } from '../physiology/lung/respiratory.ts';
import { CARDIO_RESOLVERS } from './cardio-exam.ts';

/* ===========================================================================
   Respiratory examination model.

   What the hands, the ear and the eye perceive over each part of the chest,
   from the state of the lobes beneath it and the pleura around it. Nothing
   here is authored per disease; it follows from physics:

     percussion   a gas-filled lung under the finger rings (resonant); solid
                  lung is dull; fluid is stony dull; free air or trapped air
                  is hyper-resonant.
     breath       turbulence in the large airways reaches the ear through
     sounds       lung that filters it. Aerated lung filters out the high
                  frequencies (vesicular); solid lung around a patent bronchus
                  conducts them (bronchial); fluid, air, or a collapsed lobe
                  behind a blocked bronchus keeps them away (reduced, absent).
     vocal        the same physics for the voice: louder over consolidation,
     resonance    quieter over fluid or air.
     crackles     small airways snapping open (fine: water, fibrosis), or air
                  bubbling through secretions (coarse); wheeze is flow through
                  narrowed airways, and disappears when the flow does.

   The sites map to lobes: anteriorly the upper zone is the upper lobe, the
   right mid zone the middle lobe and the left the lingula; the axilla is
   middle (or lingula) and lower lobe; posteriorly the upper back is upper
   lobe and the base is lower lobe. Fluid lies at the bottom: a sitting
   patient's effusion reaches the base first and the upper back last.
=========================================================================== */

export type SiteKey = 'upper-zone' | 'mid-zone' | 'axilla' | 'upper-back' | 'lung-base';
/** The lobes under each site, with the share each contributes to what is heard or felt there. */
export const SITE_LOBES: Record<SiteKey, Record<Side, Array<[LobeId, number]>>> = {
  'upper-zone': { R: [['RUL', 1]], L: [['LUL', 1]] },
  'mid-zone': { R: [['RML', 0.8], ['RUL', 0.2]], L: [['LUL', 1]] },
  axilla: { R: [['RML', 0.4], ['RLL', 0.6]], L: [['LUL', 0.4], ['LLL', 0.6]] },
  'upper-back': { R: [['RUL', 0.7], ['RLL', 0.3]], L: [['LUL', 0.7], ['LLL', 0.3]] },
  'lung-base': { R: [['RLL', 1]], L: [['LLL', 1]] },
};
/** How much pleural fluid (mL, sitting) before it lies between the lung and this site. */
export const FLUID_REACHES: Record<SiteKey, number> = { 'lung-base': 250, axilla: 700, 'mid-zone': 1500, 'upper-back': 2200, 'upper-zone': 2800 };

export function siteOf(ctx: ExamContext): { key: SiteKey; side: Side } | null {
  const m = /^chest\.(upper-zone|mid-zone|axilla|upper-back|lung-base)\.(L|R)$/.exec(ctx.site ?? '');
  return m ? { key: m[1] as SiteKey, side: m[2] as Side } : null;
}

const rs = (view: RuntimeView): RespSnapshot | undefined => view.respiratory ?? (view.circulation?.resp as RespSnapshot | undefined);

/** The state of the chest under one site. */
export function underSite(r: RespSnapshot, key: SiteKey, side: Side) {
  let w = 0, solid = 0, flooded = 0, collapsed = 0, compressed = 0, aerated = 0, obstructed = 0;
  for (const [id, f] of SITE_LOBES[key][side]) {
    const l = r.lobes.find((x) => x.id === id);
    if (!l) continue;
    w += f;
    solid += f * l.consolidated; flooded += f * l.flooded; collapsed += f * Math.max(0, l.collapsed - l.compressed - l.ptx);
    compressed += f * l.compressed; aerated += f * l.aerated;
    obstructed += f * Math.max(0, l.collapsed - l.compressed - l.ptx);
  }
  w = w || 1;
  const ptx = r.lobes.find((l) => l.side === side)?.ptx ?? 0;
  return { solid: solid / w, flooded: flooded / w, collapsed: collapsed / w, compressed: compressed / w, aerated: aerated / w, obstructed: obstructed / w, ptx };
}

export interface ChestFindings { note: string; breath: string; added: string[]; resonance: string }

/** Percussion, breath sounds, added sounds and vocal resonance at one site, from the model. */
export function chestAt(r: RespSnapshot, key: SiteKey, side: Side, effusion: number, p: { bronchoconstriction: number; emphysema: number; fibrosis: number }): ChestFindings {
  const u = underSite(r, key, side);
  const fluid = effusion >= FLUID_REACHES[key];
  const fluidJustBelow = !fluid && effusion >= FLUID_REACHES[key] * 0.45 && u.compressed > 0.15;
  const silent = p.bronchoconstriction >= 0.75;
  let note = 'resonant', breath = 'vesicular', resonance = 'normal';
  const added: string[] = [];

  if (fluid) {
    note = 'stony-dull';
    breath = effusion >= FLUID_REACHES[key] * 2.5 ? 'absent' : 'reduced';
    resonance = breath === 'absent' ? 'absent' : 'reduced';
  } else if (u.ptx >= 0.15) {
    note = 'hyper-resonant';
    breath = u.ptx >= 0.6 ? 'absent' : 'reduced';
    resonance = 'reduced';
  } else if (u.obstructed >= 0.5) {
    // a lobe collapsed behind a blocked bronchus: solid, but no airway to carry sound
    note = 'dull'; breath = u.obstructed >= 0.8 ? 'absent' : 'reduced'; resonance = 'reduced';
  } else if (u.solid + u.flooded >= 0.4) {
    // consolidation around an open bronchus conducts the high frequencies that aerated lung filters out
    note = 'dull'; breath = u.solid >= 0.4 ? 'bronchial' : 'vesicular'; resonance = u.solid >= 0.4 ? 'increased' : 'normal';
  } else if (fluidJustBelow) {
    // lung compressed above the fluid: bronchial breathing and aegophony at the upper border
    note = 'dull'; breath = 'bronchial'; resonance = 'increased';
  } else if (p.emphysema >= 0.4) {
    note = 'hyper-resonant'; breath = 'reduced'; resonance = 'reduced';
  }
  if (silent && breath === 'vesicular') breath = 'reduced';

  if (!fluid && u.ptx < 0.6 && u.obstructed < 0.8) {
    if (u.solid >= 0.12 && u.solid <= 0.95) added.push('coarse-crackles');
    const basal = key === 'lung-base' || key === 'axilla';
    if (u.flooded >= 0.04 || (basal && r.interstitial >= 0.45) || (r.interstitial >= 0.85)) added.push('fine-crackles');
    else if (basal && p.fibrosis >= 0.25) added.push('fine-crackles');
    if (p.bronchoconstriction >= 0.2 && !silent) added.push('wheeze');
  }
  return { note, breath, added: [...new Set(added)], resonance };
}

/** How far the mediastinum (and the trachea on it) is moved toward the left (negative: toward the right): pushed away by
    fluid or by air under tension (a simple pneumothorax is at atmospheric pressure and moves nothing), pulled toward a
    collapsed (especially upper) lobe. Beyond ±0.5 the trachea is felt displaced. */
export function mediastinalShift(r: RespSnapshot, p: Partial<Record<string, number>>): number {
  const collapse = (s: Side) => r.lobes.filter((l) => l.side === s).reduce((a, l) => a + (l.id.endsWith('UL') ? 1.6 : 1) * Math.max(0, l.collapsed - l.compressed - l.ptx) * 0.25, 0);
  return ((p.effusionR ?? 0) - (p.effusionL ?? 0)) / 3000 + 0.5 * ((p.tensionR ?? 0) - (p.tensionL ?? 0)) / LUNG.trachealShiftTension
    + (collapse('L') - collapse('R')) * 2.2;
}

const respParams = (view: RuntimeView): Partial<Record<string, number>> => (rs(view)?.params ?? {}) as unknown as Record<string, number>;

const atSite = (view: RuntimeView, ctx: ExamContext): { f: ChestFindings; basis: string } | undefined => {
  const r = rs(view); const s = siteOf(ctx);
  if (!r || !s) return undefined;
  const p = respParams(view);
  const E = s.side === 'L' ? p.effusionL ?? 0 : p.effusionR ?? 0;
  const f = chestAt(r, s.key, s.side, E, { bronchoconstriction: p.bronchoconstriction ?? 0, emphysema: p.emphysema ?? 0, fibrosis: p.fibrosis ?? 0 });
  const u = underSite(r, s.key, s.side);
  const parts = [`aerated ${(u.aerated * 100).toFixed(0)} %`];
  if (u.solid > 0.02) parts.push(`consolidated ${(u.solid * 100).toFixed(0)} %`);
  if (u.flooded > 0.02) parts.push(`alveolar oedema ${(u.flooded * 100).toFixed(0)} %`);
  if (u.obstructed > 0.02) parts.push(`collapsed ${(u.obstructed * 100).toFixed(0)} %`);
  if (E > 0) parts.push(`pleural fluid ${E.toFixed(0)} mL`);
  if (u.ptx > 0) parts.push(`pneumothorax ${(u.ptx * 100).toFixed(0)} %`);
  if (r.interstitial > 0.05) parts.push(`interstitial water ${(r.interstitial * 100).toFixed(0)} %`);
  return { f, basis: `lung under the site: ${parts.join(', ')}` };
};

const r0 = Math.round;

export const RESP_RESOLVERS: Record<string, Resolver> = {
  'resp.rr': (view): Resolved | undefined => {
    const r = rs(view); if (!r) return undefined;
    return { value: r0(r.RR), basis: `minute ventilation ${r.VE.toFixed(1)} L/min at ${(r.VT * 1000).toFixed(0)} mL` };
  },
  'resp.spo2': (view): Resolved | undefined => {
    const r = rs(view); if (!r) return undefined;
    const ox = pulseOximeter(r);
    const fio2 = Math.round((r.params.FiO2 ?? 0.21) * 100) / 100;   // what the patient is actually breathing
    return { value: { spo2: r0(ox.SpO2), fio2 }, basis: `arterial O₂ saturation ${(r.SaO2 * 100).toFixed(1)} %, COHb ${(r.COHb * 100).toFixed(0)} %, MetHb ${(r.metHb * 100).toFixed(0)} %, red/infrared ratio ${ox.R.toFixed(2)}` };
  },
  'resp.sounds': (view, _ref, ctx): Resolved | undefined => {
    const a = atSite(view, ctx);
    if (!a) return CARDIO_RESOLVERS['circulation.lungs']?.(view, _ref, ctx);
    return { value: { breath: a.f.breath, added: a.f.added }, basis: a.basis };
  },
  'resp.percussion': (view, _ref, ctx): Resolved | undefined => {
    const a = atSite(view, ctx); if (!a) return undefined;
    return { value: { note: a.f.note }, basis: a.basis };
  },
  'resp.resonance': (view, _ref, ctx): Resolved | undefined => {
    const a = atSite(view, ctx); if (!a) return undefined;
    return { value: { resonance: a.f.resonance }, basis: a.basis };
  },
  'resp.expansion': (view, ref): Resolved | undefined => {
    const r = rs(view); if (!r || !ref.side) return undefined;
    const p = respParams(view);
    const side = ref.side;
    const lob = r.lobes.filter((l) => l.side === side);
    const vol: Record<string, number> = { RUL: 0.19, RML: 0.09, RLL: 0.24, LUL: 0.22, LLL: 0.26 };
    const sideVol = lob.reduce((a, l) => a + vol[l.id], 0);
    const lost = lob.reduce((a, l) => a + vol[l.id] * (1 - l.aerated), 0) / sideVol;
    const E = side === 'L' ? p.effusionL ?? 0 : p.effusionR ?? 0;
    const both = (p.fibrosis ?? 0) >= 0.4 || (p.emphysema ?? 0) >= 0.5;
    const reduced = lost >= 0.25 || E >= 800 || both;
    return { value: { expansion: reduced ? 'reduced' : 'normal' }, basis: `${(lost * 100).toFixed(0)} % of the ${side === 'L' ? 'left' : 'right'} lung not aerated${E ? `, ${E.toFixed(0)} mL pleural fluid` : ''}` };
  },
  'resp.trachea': (view): Resolved | undefined => {
    const r = rs(view); if (!r) return undefined;
    const towardL = mediastinalShift(r, respParams(view));
    const position = towardL > 0.5 ? 'L' : towardL < -0.5 ? 'R' : 'central';
    return { value: { position }, basis: `net mediastinal shift index ${towardL.toFixed(2)} (positive toward the left)` };
  },
  'resp.pattern': (view): Resolved | undefined => {
    const r = rs(view); if (!r) return undefined;
    const p = respParams(view);
    const vtKg = (r.VT * 1000) / idealWeight({ age: view.patient.age, sex: view.patient.sex, heightCm: view.patient.heightCm ?? 170, weightKg: view.patient.weightKg ?? 70 });
    const depth = vtKg < LUNG.tidalShallow ? 'shallow' : vtKg > LUNG.tidalDeep ? 'deep' : 'normal';
    const load = r.effort;
    const hypoxic = r.SaO2 < 0.85;
    const speech = load >= 4 || r.SaO2 < 0.7 ? 'unable' : load >= 1.2 || r.SaO2 < 0.8 ? 'words' : load >= 0.55 || hypoxic || r.RR >= 26 ? 'phrases' : 'sentences';
    return {
      value: {
        depth, accessory: load >= 0.5 || r.RR >= 28, pursedLips: (p.emphysema ?? 0) >= 0.4 && (r.iPEEP > 1 || (p.bronchoconstriction ?? 0) >= 0.3),
        speech, hyperinflated: r.TLC / r.pred.TLC > 1.12, paradoxical: (p.muscleStrength ?? 1) < 0.35,
      },
      basis: `ventilation ${r.VE.toFixed(1)} of a sustainable ${r.capacity.toFixed(0)} L/min (demand ${r.demand.toFixed(1)}), tidal volume ${vtKg.toFixed(1)} mL/kg, intrinsic PEEP ${r.iPEEP.toFixed(1)} cmH₂O`,
    };
  },
  /* The first look: perfusion from the circulation, colour and distress from the lungs. */
  'general.appearance': (view, ref, ctx): Resolved | undefined => {
    const c = CARDIO_RESOLVERS['general.appearance']?.(view, ref, ctx);
    const r = rs(view);
    if (!r) return c;
    const cyanosed = r.deoxyHb >= EXAM.cyanosis;
    const distress = r.effort >= 1.2 || r.SaO2 < 0.8 ? 'severe' : r.effort >= 0.6 || r.RR >= 26 ? 'moderate' : r.effort >= 0.35 || r.RR >= 21 ? 'mild' : 'none';
    if (!cyanosed && distress === 'none' && !(r.PaCO2 >= 8)) return c;
    const base = (c?.value as Record<string, unknown> | undefined) ?? { distress: 'none', colour: 'normal', sweating: false };
    const rank = ['none', 'mild', 'moderate', 'severe'];
    return {
      value: {
        distress: rank[Math.max(rank.indexOf(base.distress as string), rank.indexOf(distress))],
        colour: cyanosed ? 'cyanosed' : base.colour,
        sweating: !!base.sweating || r.PaCO2 >= 8 || distress === 'severe',
      },
      basis: `${c?.basis ? c.basis + '; ' : ''}capillary deoxygenated haemoglobin ${r.deoxyHb.toFixed(0)} g/L (cyanosis from about ${EXAM.cyanosis}), SaO₂ ${(r.SaO2 * 100).toFixed(0)} %, respiratory rate ${r.RR.toFixed(0)}/min`,
    };
  },
};
