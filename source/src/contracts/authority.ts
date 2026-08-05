import type { RuntimeError } from './errors.ts';
import { runtimeError } from './errors.ts';
import type { ScenarioAuthority } from './scenarios.ts';
import type { PatientCommand } from './commands.ts';
import type { ObservationRequest, RuntimeQuery } from './queries.ts';
import type { RuntimeSession } from './session.ts';

export type AuthorityMode = 'clinical' | 'exploration' | 'authoring' | 'diagnostic';

export interface AuthorityContext {
  mode: AuthorityMode;
  authority: ScenarioAuthority;
  /** When true, diagnostic/latent queries are allowed. */
  diagnosticSession?: boolean;
  /** Trusted session — never derived from command.source. */
  session?: RuntimeSession;
}

const LATENT_QUERIES = new Set([
  'adapter.cardio.privateParams',
  'effects.resolved',
  'conditions.active',
  'mechanisms.active',
]);

const LATENT_PROJECTIONS = new Set([
  'modelDiagnostics',
  'authoringState',
  'publicPhysiology',
]);

/** Privileged session roles that may author conditions / use experimental controls. */
const PRIVILEGED_ROLES = new Set(['system', 'test', 'lesson', 'scenario', 'authoring']);

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

function examinationTokens(exam: string): string[] {
  // Exact subtype match only — do not OR unrelated examination permissions.
  return [
    exam,
    `${exam}-examination`,
    'examination',
  ];
}

export function authorizeCommand(
  command: PatientCommand,
  ctx: AuthorityContext,
): RuntimeError | null {
  const auth = ctx.authority;
  const type = command.type;
  const role = ctx.session?.role;
  const privileged = role != null && PRIVILEGED_ROLES.has(role);

  if (type === 'runtime.advance' && auth.mayAdvanceTime === false) {
    return runtimeError('UNAUTHORISED_COMMAND', 'advancing time is not permitted');
  }

  if (
    (type === 'condition.activate' || type === 'condition.resolve')
    && auth.mayAuthorConditions === false
    && !privileged
  ) {
    return runtimeError('UNAUTHORISED_COMMAND', 'authoring conditions is not permitted in this scenario');
  }

  if (type === 'experimental.circulation-param') {
    if (!privileged && auth.mayUseExperimentalControls === false) {
      return runtimeError('UNAUTHORISED_COMMAND', 'experimental circulation controls not permitted');
    }
  }

  if (type === 'model.set-pathology' || type === 'model.set-baro') {
    if (!privileged && auth.mayUseExperimentalControls === false) {
      return runtimeError('UNAUTHORISED_COMMAND', 'model controls not permitted in this scenario');
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

  if (query.type === 'state.projection') {
    if (LATENT_PROJECTIONS.has(query.projection)) {
      return runtimeError('UNAUTHORISED_COMMAND', `latent projection not permitted: ${query.projection}`);
    }
    // Unknown projections deny rather than falling through to publicPhysiology.
    if (
      query.projection !== 'clinicalSummary'
      && query.projection !== 'timelineRange'
    ) {
      return runtimeError('UNAUTHORISED_COMMAND', `projection not permitted: ${query.projection}`);
    }
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

  // Empty allow-list means deny everything (explicit open requires '*').
  if (auth.mayObserve != null && auth.mayObserve.length === 0) {
    return runtimeError('UNAUTHORISED_COMMAND', 'no observations permitted');
  }

  if (auth.mayObserve?.includes('*')) return null;

  if (request.type === 'perform.examination') {
    const exam = (request as { exam?: string }).exam || 'examination';
    const candidates = examinationTokens(exam);
    if (candidates.some((c) => auth.mayObserve.includes(c))) return null;
    return runtimeError('UNAUTHORISED_COMMAND', `observation not permitted: ${exam}`);
  }

  if (!auth.mayObserve?.length) {
    // No scenario authority list and not '*': open exploration default handled by caller.
    return null;
  }

  if (token && !auth.mayObserve.includes(token)) {
    return runtimeError('UNAUTHORISED_COMMAND', `observation not permitted: ${token}`);
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
