import type { Resolved, Resolver, RuntimeView } from '../engine/observe.ts';
import { LOBES, type RespSnapshot } from '../physiology/lung/respiratory.ts';

/* ---------------------------------------------------------------------------
   Respiratory measurements: the blood-gas analyser and co-oximeter, the
   spirometer and peak-flow meter, the chest radiograph and CT pulmonary
   angiogram, and D-dimer. Each reads the respiratory (and circulation)
   model and reports what the instrument would; none interprets.
--------------------------------------------------------------------------- */

const rs = (view: RuntimeView): RespSnapshot | undefined => view.respiratory ?? (view.circulation?.resp as RespSnapshot | undefined);
const d = (x: number, n: number) => Math.round(x * 10 ** n) / 10 ** n;

/** What the chest radiograph shows, as coded findings, from the lobes, pleura, lung water and heart. */
export function chestImagingFindings(r: RespSnapshot, circ?: Record<string, any>, kind: 'cxr' | 'ctpa' = 'cxr'): string[] {
  const p = r.params;
  const out: string[] = [];
  for (const l of r.lobes) {
    if (l.consolidated >= 0.25) out.push(`consolidation-${l.id}`);
    const obstructive = Math.max(0, l.collapsed - l.compressed - l.ptx);
    if (obstructive >= 0.4) out.push(`collapse-${l.id}`);
  }
  for (const s of ['L', 'R'] as const) {
    const E = s === 'L' ? p.effusionL : p.effusionR;
    // an erect film needs ~200 mL to blunt the costophrenic angle; CT sees far less
    if (E >= (kind === 'ctpa' ? 50 : 200)) out.push(`effusion-${s}-${E >= 1000 ? 'large' : 'small'}`);
    const ptx = s === 'L' ? p.ptxL : p.ptxR;
    if (ptx >= (kind === 'ctpa' ? 0.03 : 0.08)) out.push(`pneumothorax-${s}`);
  }
  const flooded = r.lobes.reduce((a, l) => a + l.flooded, 0) / 5;
  if (flooded >= 0.08) out.push('oedema-alveolar');
  else if (r.interstitial >= 0.35) out.push('oedema-interstitial');
  else if (r.Pcap >= 15) out.push('oedema-upper-lobe');
  if (p.fibrosis >= 0.25) out.push('reticular-basal');
  if (r.TLC / r.pred.TLC > 1.15 || p.emphysema >= 0.45) out.push('hyperinflation');
  const m = circ?.metrics ?? {};
  if ((m.EDV ?? 120) >= 175 || (m.CVPmean ?? 3) >= 14) out.push('cardiomegaly');
  if (kind === 'ctpa') {
    const emb = LOBES.filter((id) => (p as any)[`emb${id}`] >= 0.2);
    out.push(...(emb.length ? emb.map((id) => `pe-${id}`) : ['no-pe']));
    if (emb.length >= 4 && LOBES.every((id) => (p as any)[`emb${id}`] >= 0.5)) out.push('pe-saddle');
    if ((m.PpaMean ?? 14) >= 30 || r.RpulMult >= 2.5) out.push('rv-strain');
  }
  return out.length ? out : ['normal'];
}

export const RESP_LAB_RESOLVERS: Record<string, Resolver> = {
  /* Blood-gas analyser and co-oximeter: electrodes for pH, PCO2 and PO2, spectrophotometry for the haemoglobins. */
  'resp.abg': (view): Resolved | undefined => {
    const c = view.chemistry; const r = rs(view);
    if (!c) return undefined;
    const v: Record<string, number> = {
      arterialPH: d(c.arterialPH, 2), paCO2: d(c.paCO2, 1), paO2: d(c.paO2, 1), bicarbonate: d(c.bicarbonate, 0), baseExcess: d((c as any).baseExcess ?? 0, 1),
      lactate: d(c.lactate, 1), potassium: d(c.potassium, 1),
    };
    if (r) { v.saO2 = d(r.FO2Hb * 100, 0); v.coHb = d(r.COHb * 100, 1); v.metHb = d(r.metHb * 100, 1); }
    v.fio2 = d(r?.params.FiO2 ?? view.state.oxygen?.fio2 ?? 0.21, 2);
    return { value: v };
  },
  'resp.spirometry': (view): Resolved | undefined => {
    const r = rs(view); if (!r) return undefined;
    return { value: {
      fev1: d(r.FEV1, 2), fvc: d(r.FVC, 2), ratio: d(r.FEV1 / r.FVC, 2), pef: Math.round(r.PEF * 60),
      fev1Pct: Math.round((100 * r.FEV1) / r.pred.FEV1), fvcPct: Math.round((100 * r.FVC) / r.pred.FVC),
    } };
  },
  'resp.peakflow': (view): Resolved | undefined => {
    const r = rs(view); if (!r) return undefined;
    // read off a mechanical meter, to the nearest 10 L/min
    return { value: { pef: Math.round((r.PEF * 60) / 10) * 10, pefPct: Math.round((100 * r.PEF) / r.pred.PEF) } };
  },
  'resp.cxr': (view): Resolved | undefined => {
    const r = rs(view); if (!r) return undefined;
    return { value: { findings: chestImagingFindings(r, view.circulation, 'cxr') } };
  },
  'resp.ctpa': (view): Resolved | undefined => {
    const r = rs(view); if (!r) return undefined;
    return { value: { findings: chestImagingFindings(r, view.circulation, 'ctpa') } };
  },
  /* D-dimer: fibrin degradation products. The model has no clotting cascade yet: it derives the level from the
     thrombus it knows about (emboli) and from the inflammation it knows about (consolidation), plus age. */
  'resp.ddimer': (view): Resolved | undefined => {
    const r = rs(view); if (!r) return undefined;
    const p = r.params as unknown as Record<string, number>;
    const emb = LOBES.reduce((a, id) => a + (p[`emb${id}`] ?? 0), 0);
    const inflam = r.lobes.reduce((a, l) => a + l.consolidated, 0);
    const age = Math.max(0, view.patient.age - 50) * 0.006;
    return { value: d(0.25 + age + 1.9 * emb + 0.9 * inflam, 2) };
  },
};
