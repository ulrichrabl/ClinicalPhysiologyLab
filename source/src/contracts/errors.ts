export type RuntimeErrorCode =
  | 'UNSUPPORTED_CAPABILITY'
  | 'UNAUTHORISED_COMMAND'
  | 'INVALID_PARAMETER'
  | 'OUT_OF_RANGE'
  | 'INVARIANT_VIOLATION'
  | 'COMMAND_CONFLICT'
  | 'MODEL_FAILURE'
  | 'UNKNOWN_COMMAND'
  | 'UNKNOWN_CONDITION'
  | 'CHECKPOINT_MISSING';

export interface RuntimeError {
  code: RuntimeErrorCode;
  message: string;
  path?: string;
  received?: unknown;
  allowed?: unknown;
  alternatives?: string[];
}

export function runtimeError(
  code: RuntimeErrorCode,
  message: string,
  extra: Partial<Omit<RuntimeError, 'code' | 'message'>> = {},
): RuntimeError {
  return { code, message, ...extra };
}
