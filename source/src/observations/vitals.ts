import type { ObservationId } from '../contracts/brands.ts';
import type { VitalSignsValue } from '../contracts/queries.ts';
import type {
  ObservationContext,
  ObservationModel,
  ObservationPlan,
  PatientStateProjection,
} from './types.ts';
import { observationShell } from './types.ts';

export type VitalSignsRequest = { type: 'observe.vital-signs' };

/**
 * Ideal vital-sign observation over canonical cardiovascular public state.
 * Does not mutate physiology; interprets for educational pattern recognition.
 */
export const vitalSignsObservation: ObservationModel<VitalSignsRequest, VitalSignsValue> = {
  manifest: {
    id: 'observation.vital-signs.ideal',
    version: '1.0.0',
    observationType: 'observe.vital-signs',
    capabilities: ['observation.vital-signs'],
    idealByDefault: true,
  },

  canObserve() {
    return { ok: true };
  },

  observe(input: {
    patient: Readonly<PatientStateProjection>;
    request: VitalSignsRequest;
    context: ObservationContext;
    observationId: ObservationId;
  }): ObservationPlan<VitalSignsValue> {
    const cv = input.patient.cardiovascular;
    const value: VitalSignsValue = {
      heartRate: cv.heartRate,
      bloodPressure: {
        systolic: cv.systolicPressure,
        diastolic: cv.diastolicPressure,
        mean: cv.meanArterialPressure,
      },
      cardiacOutput: cv.cardiacOutput,
    };

    const interpretation: { id: string; label: string }[] = [];
    if (value.bloodPressure.mean != null && value.bloodPressure.mean < 65) {
      interpretation.push({ id: 'hypotension', label: 'Hypotension' });
    }
    if (
      value.heartRate != null
      && value.heartRate < 60
      && value.bloodPressure.mean != null
      && value.bloodPressure.mean < 70
    ) {
      interpretation.push({ id: 'relative-bradycardia', label: 'Relative bradycardia' });
    }
    if (
      interpretation.some((i) => i.id === 'hypotension')
      && interpretation.some((i) => i.id === 'relative-bradycardia')
    ) {
      interpretation.push({ id: 'neurogenic-shock-pattern', label: 'Neurogenic shock pattern' });
      value.pattern = 'hypotension-with-relative-bradycardia';
    } else if (value.bloodPressure.mean != null && value.bloodPressure.mean < 70
      && value.heartRate != null && value.heartRate < 60) {
      value.pattern = 'hypotension-with-relative-bradycardia';
    }

    return {
      immediate: observationShell({
        id: input.observationId,
        type: 'observe.vital-signs',
        time: input.patient.simTime,
        value,
        provenance: {
          modelId: vitalSignsObservation.manifest.id,
          latentPaths: [
            'cardiovascular.meanArterialPressure',
            'cardiovascular.heartRate',
            'cardiovascular.cardiacOutput',
          ],
        },
        interpretation,
      }),
    };
  },
};
