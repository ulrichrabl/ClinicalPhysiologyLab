import type { ObservationId } from '../contracts/brands.ts';
import type {
  ObservationContext,
  ObservationModel,
  ObservationPlan,
  PatientStateProjection,
} from './types.ts';
import { observationShell } from './types.ts';

export type TwelveLeadEcgRequest = {
  type: 'observe.twelve-lead-ecg';
  /** Optional lead subset; default all available. */
  leads?: string[];
};

export interface TwelveLeadEcgValue {
  sampleRateHz: number;
  leads: Record<string, number[]>;
  features: {
    heartRate: number | null;
    qrsAxis: number | null;
    pathology: string | null;
  };
  report: string;
}

const DEFAULT_LEADS = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

/**
 * Ideal twelve-lead ECG observation derived from electrophysiology public state.
 * Separates latent electrical source state from the clinical tracing.
 */
export const twelveLeadEcgObservation: ObservationModel<TwelveLeadEcgRequest, TwelveLeadEcgValue> = {
  manifest: {
    id: 'observation.twelve-lead-ecg.ideal',
    version: '1.0.0',
    observationType: 'observe.twelve-lead-ecg',
    capabilities: ['observation.twelve-lead-ecg', 'ecg.twelve-lead'],
    idealByDefault: true,
  },

  canObserve(_ctx, _request) {
    return { ok: true };
  },

  observe(input: {
    patient: Readonly<PatientStateProjection>;
    request: TwelveLeadEcgRequest;
    context: ObservationContext;
    observationId: ObservationId;
  }): ObservationPlan<TwelveLeadEcgValue> {
    const ep = input.patient.electrophysiology;
    const want = input.request.leads?.length ? input.request.leads : DEFAULT_LEADS;
    const leads: Record<string, number[]> = {};
    const src = ep.leads ?? {};
    for (const name of want) {
      const buf = src[name];
      if (!buf) {
        leads[name] = [];
        continue;
      }
      leads[name] = Array.from(buf);
    }

    const hr = ep.effectiveHeartRate;
    const axis = ep.qrsAxis;
    const pathology = ep.pathology ?? 'normal';
    const report = buildReport(hr, axis, pathology);

    return {
      immediate: observationShell({
        id: input.observationId,
        type: 'observe.twelve-lead-ecg',
        time: input.patient.simTime,
        value: {
          sampleRateHz: 500,
          leads,
          features: {
            heartRate: hr,
            qrsAxis: axis,
            pathology,
          },
          report,
        },
        provenance: {
          modelId: twelveLeadEcgObservation.manifest.id,
          latentPaths: [
            'electrophysiology.leads',
            'electrophysiology.effectiveHeartRate',
            'electrophysiology.qrsAxis',
          ],
        },
        interpretation: pathology && pathology !== 'normal'
          ? [{ id: `pathology:${pathology}`, label: pathology }]
          : [{ id: 'sinus', label: 'Sinus rhythm (educational)' }],
      }),
    };
  },
};

function buildReport(
  hr: number | null,
  axis: number | null,
  pathology: string,
): string {
  const rate = hr != null ? `${Math.round(hr)} bpm` : 'rate unavailable';
  const ax = axis != null ? `QRS axis ${Math.round(axis)}°` : 'axis unavailable';
  return `Twelve-lead ECG (ideal educational acquisition): ${rate}; ${ax}; `
    + `mechanism label “${pathology}”. Not a clinical diagnostic report.`;
}
