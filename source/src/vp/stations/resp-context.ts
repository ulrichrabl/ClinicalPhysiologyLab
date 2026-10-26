import type { PatientModel } from '../physiology/state.ts';
import type { RespSnapshot } from '../physiology/lung/respiratory.ts';
import { mediastinalShift, FLUID_REACHES, underSite } from '../models/resp-exam.ts';
import { EXAM } from '../evidence/exam.ts';
import { respObserve } from './resp-signs.ts';
import { RESP_SITES, type RespTestId, type SiteKey } from './resp-tests.ts';
import type { RespContext } from './resp-texts.ts';

/* ---------------------------------------------------------------------------
   What the respiratory station's explanations are chosen by: the findings of
   the test (at its site), what lies beneath the site, and the lungs' numbers,
   all read from the running model. Shared by the station and its tests.
--------------------------------------------------------------------------- */

export function respContext(model: PatientModel, snap: Record<string, any>, chemistry: Record<string, number> | undefined, test: RespTestId, site?: string): RespContext {
  const r = snap.resp as RespSnapshot, p = r.params;
  const v = (ref: string, ctx = {}) => respObserve(model, snap, ref, ctx, chemistry).value as any;
  let s: RespContext['site'];
  if (site && (test === 'percussion' || test === 'auscultation' || test === 'resonance')) {
    const m = /^chest\.(.+)\.(L|R)$/.exec(site)!, key = m[1] as SiteKey, side = m[2] as 'L' | 'R';
    const u = underSite(r, key, side), E = side === 'L' ? p.effusionL : p.effusionR;
    const snd = v('lung.sounds', { site }), per = v('chest.percussion', { site }), res = v('chest.resonance', { site });
    s = { key, side, label: RESP_SITES.find((x) => x.key === key)!.label, note: per.note, breath: snd.breath, added: snd.added, resonance: res.resonance,
      under: { aerated: u.aerated, solid: u.solid, flooded: u.flooded, obstructed: u.obstructed, compressed: u.compressed, ptx: u.ptx }, fluid: E, fluidHere: E >= FLUID_REACHES[key] };
  }
  const share = (side: 'L' | 'R') => r.lobes.filter((l) => l.side === side).reduce((a, l) => a + l.ventShare, 0);
  const tr = v('trachea.position') ?? {};
  return {
    test, site: s,
    r: { RR: r.RR, VT: r.VT, VE: r.VE, SaO2: r.SaO2, PaO2: r.PaO2, PaCO2: r.PaCO2, AaGradient: r.AaGradient, shunt: r.shunt, VDVT: r.VDVT, iPEEP: r.iPEEP, tauE: r.tauE, Te: r.Te, Ti: r.Ti,
      effort: r.effort, demand: r.demand, capacity: r.capacity, deoxyHb: r.deoxyHb, interstitial: r.interstitial, FiO2: p.FiO2, FEV1pct: (r.FEV1 / r.pred.FEV1) * 100, PEFpct: (r.PEF / r.pred.PEF) * 100 },
    p: { bronchoconstriction: p.bronchoconstriction, emphysema: p.emphysema, fibrosis: p.fibrosis, muscleStrength: p.muscleStrength, effusionL: p.effusionL, effusionR: p.effusionR, ptxL: p.ptxL, ptxR: p.ptxR,
      tensionL: p.tensionL, tensionR: p.tensionR, capillaryLeak: p.capillaryLeak, emb: p.embRUL + p.embRML + p.embRLL + p.embLUL + p.embLLL },
    trachea: { position: tr.position ?? 'central', shift: mediastinalShift(r, p as any) },
    expansion: { L: { share: share('L'), finding: v('chest.expansion.L')?.expansion ?? 'normal' }, R: { share: share('R'), finding: v('chest.expansion.R')?.expansion ?? 'normal' } },
    pattern: v('breathing.pattern') ?? {}, cyanosisAt: EXAM.cyanosis,
  };
}
