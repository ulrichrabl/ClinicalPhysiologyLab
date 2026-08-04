import type { RuntimeError } from './errors.ts';
import { runtimeError } from './errors.ts';
import type { ScenarioAuthority } from './scenarios.ts';
import type { PatientCommand } from './commands.ts';
import type { ObservationRequest, RuntimeQuery } from './queries.ts';

export type AuthorityMode = 'clinical' | 'exploration' | 'authoring' | 'diagnostic';

export interface AuthorityContext {
  mode: AuthorityMode;
  authority: ScenarioAuthority;
  /** When true, diagnostic/latent queries are allowed. */
  diagnosticSession?: boolean;
}

const CLINICAL_OBSERVATIONS = new Set([
  'observe.vital-signs',
  'observe.general-appearance',
  'observe.laboratory-panel',
  'observe.twelve-lead-ecg',
  'perform.examination',
]);

const LATENT_QUERIES = new Set([
  'adapter.cardio.privateParams',
  'effects.resolved',
]);

const LATENT_PROJECTIONS = new Set([
  'modelDiagnostics',
  'authoringState',
]);

/** Map observation request types onto scenario mayObserve tokens. */
function observationToken(type: string): string | null {
  switch (type) {
    case 'observe.vital-signs': return 'vital-signs';
    case 'observe.general-appearance': return 'general-appearance';
    case 'observe.twelve-lead-ecg': return 'twelve-lead-ecg';
    case 'observe.laboratory-panel': return 'laboratory-panel';
    case 'observe.physiology': return 'physiology-latent';
    case 'perform.examination': return 'examination';
    default: return type.replace(/^observe\./, '').replace(/^perform\./, '');
  }
}

export function authorizeCommand(
  command: PatientCommand,
  ctx: AuthorityContext,
): RuntimeError | null {
  const auth = ctx.authority;
  const type = command.type;

  if (type === 'runtime.advance' && auth.mayAdvanceTime === false) {
    return runtimeError('UNAUTHORISED_COMMAND', 'advancing time is not permitted');
  }

  if (
    (type === 'condition.activate' || type === 'condition.resolve')
    && auth.mayAuthorConditions === false
    && command.source.type !== 'scenario'
    && command.source.type !== 'test'
    && command.source.type !== 'system'
  ) {
    return runtimeError('UNAUTHORISED_COMMAND', 'authoring conditions is not permitted in this scenario');
  }

  if (type === 'experimental.circulation-param') {
    const src = command.source?.type;
    if (src !== 'test' && src !== 'lesson' && auth.mayUseExperimentalControls === false) {
      return runtimeError('UNAUTHORISED_COMMAND', 'experimental circulation controls not permitted');
    }
  }

  if (type.startsWith('treatment.')) {
    const token = type === 'treatment.fluid-bolus' ? 'intravenous-fluid'
      : type === 'treatment.vasopressor' ? 'vasopressor'
      : type;
    if (auth.mayTreat && !auth.mayTreat.includes(token) && !auth.mayTreat.includes('*')) {
      return runtimeError('UNAUTHORISED_COMMAND', `treatment not permitted: ${token}`);
    }
  }

  return null;
}

export function authorizeQuery(
  query: RuntimeQuery,
  ctx: AuthorityContext,
): RuntimeError | null {
  const auth = ctx.authority;
  if (ctx.mode === 'diagnostic' || ctx.diagnosticSession || auth.mayReadLatentState) {
    return null;
  }

  if (LATENT_QUERIES.has(query.type)) {
    return runtimeError('UNAUTHORISED_COMMAND', `latent query not permitted: ${query.type}`);
  }

  if (query.type === 'state.projection' && LATENT_PROJECTIONS.has(query.projection)) {
    return runtimeError('UNAUTHORISED_COMMAND', `latent projection not permitted: ${query.projection}`);
  }

  return null;
}

export function authorizeObservation(
  request: ObservationRequest,
  ctx: AuthorityContext,
): RuntimeError | null {
  const auth = ctx.authority;
  if (ctx.mode === 'diagnostic' || ctx.diagnosticSession) return null;

  const token = observationToken(request.type);
  if (request.type === 'observe.physiology' && !auth.mayReadLatentState) {
    return runtimeError('UNAUTHORISED_COMMAND', 'latent physiology observation not permitted');
  }

  if (auth.mayObserve?.includes('*')) return null;
  if (!auth.mayObserve?.length) return null;

  // Map examination subtypes
  if (request.type === 'perform.examination') {
    const exam = (request as { exam?: string }).exam || 'examination';
    const candidates = [
      exam,
      `${exam}-examination`,
      'examination',
      'neurological-examination',
      'cardiovascular-examination',
    ];
    if (candidates.some((c) => auth.mayObserve.includes(c))) return null;
    return runtimeError('UNAUTHORISED_COMMAND', `observation not permitted: ${exam}`);
  }

  if (token && !auth.mayObserve.includes(token) && !CLINICAL_OBSERVATIONS.has(request.type)) {
    return runtimeError('UNAUTHORISED_COMMAND', `observation not permitted: ${token}`);
  }

  // If mayObserve is a non-empty allow-list, require membership for known tokens
  if (token && auth.mayObserve.length && !auth.mayObserve.includes(token)) {
    // Allow general clinical set when token aliases differ slightly
    if (token === 'examination') return null;
    if (CLINICAL_OBSERVATIONS.has(request.type) && auth.mayObserve.some((m) => token.includes(m) || m.includes(token))) {
      return null;
    }
    // twelve-lead-ecg / laboratory-panel / vital-signs must match
    if (['vital-signs', 'twelve-lead-ecg', 'laboratory-panel', 'general-appearance'].includes(token)) {
      if (!auth.mayObserve.includes(token)) {
        return runtimeError('UNAUTHORISED_COMMAND', `observation not permitted: ${token}`);
      }
    }
  }

  return null;
}

export function defaultAuthority(): ScenarioAuthority {
  return {
    mayObserve: ['*'],
    mayTreat: ['intravenous-fluid', 'vasopressor'],
    mayUseExperimentalControls: true,
    mayReadLatentState: true,
    mayAdvanceTime: true,
    mayAuthorConditions: true,
  };
}

/** Strip latent pathology labels from clinical ECG features when diagnoses are hidden. */
export function redactEcgPathology(
  pathology: string | null | undefined,
  visibility: { diagnoses?: string } | null | undefined,
): string | null {
  if (visibility?.diagnoses === 'hidden') return null;
  return pathology ?? null;
}
