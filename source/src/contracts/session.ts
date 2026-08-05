/**
 * Trusted session / capability context — separate from command.source.
 * Command bodies must not be treated as authority credentials.
 */

export type SessionRole =
  | 'clinical'
  | 'exploration'
  | 'authoring'
  | 'system'
  | 'test'
  | 'lesson'
  | 'scenario';

export interface RuntimeSession {
  /** Trusted role assigned by the shell / harness — never taken from the command body. */
  role: SessionRole;
  /** Override latent-read for this call (diagnostic inspector). */
  diagnosticSession?: boolean;
}

/** Default session for UI surfaces in clinical scenarios. */
export function clinicalSession(): RuntimeSession {
  return { role: 'clinical' };
}

/** Trusted system session for scenario seed / trigger dispatch. */
export function systemSession(): RuntimeSession {
  return { role: 'system' };
}

/** Test harness session. */
export function testSession(): RuntimeSession {
  return { role: 'test' };
}
