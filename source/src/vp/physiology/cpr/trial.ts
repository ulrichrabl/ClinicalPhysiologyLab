import { createCirculation } from '../../engine/circulation-host.ts';
import { healthyModel, type PatientModel } from '../state.ts';
import { Compressor } from './compressions.ts';
import { CPR } from '../../evidence/cpr.ts';

/* ---------------------------------------------------------------------------
   One protocol for comparing compressions with the human studies, used by the
   fit (scripts/fit-cpr.mjs) and the tests alike: a patient in VF, untreated
   for a while, then compressions at a steady rate. Returns what a catheter
   would read over the last seconds, averaged over the circulation's windows
   (8 s each without a heartbeat): each window's own peak, trough and
   relaxation-phase means.
--------------------------------------------------------------------------- */

export interface CprReading { Psys: number; Pdia: number; CPP: number; CPPend: number; aortaRelax: number; CO: number; CVP: number; RAmax: number }

export function cprTrial(o: { device: 'manual' | 'mechanical'; rate: number; vfSeconds?: number; cprSeconds?: number; readSeconds?: number; model?: PatientModel }): CprReading {
  const m = o.model ?? healthyModel();
  const run = createCirculation(m);
  run.settle(20);
  run.apply({ ...m, electrical: { ...m.electrical, ventricular: 'vf' } });
  run.advance(o.vfSeconds ?? 60);
  const c = new Compressor(o.device === 'mechanical' ? CPR.itpMechanical : CPR.itpManual);
  c.steady(o.rate, run.sim.t);
  run.setCompressor(c);
  const total = o.cprSeconds ?? 40, read = o.readSeconds ?? 10;
  run.advance(total - read);
  const rows: Array<Record<string, number>> = [];
  let last: unknown = null;
  for (let t = 0; t < read; t += 0.1) {
    run.advance(0.1);
    const mt = run.sim.metrics;
    if (mt && mt !== last) {
      last = mt;
      const b = run.sim.lastBeat?.samples ?? [];
      rows.push({ ...mt, RAmax: Math.max(...b.map((s: any) => s.Pra)) });
    }
  }
  const avg = (k: string) => rows.reduce((a, r) => a + (r[k] ?? NaN), 0) / rows.length;
  return { Psys: avg('Psys'), Pdia: avg('Pdia'), CPP: avg('CPP'), CPPend: avg('CPPend'), aortaRelax: avg('aortaRelax'), CO: avg('CO'), CVP: avg('CVPmean'), RAmax: avg('RAmax') };
}
