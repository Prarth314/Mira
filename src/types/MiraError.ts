export type MiraErrorKind =
  | 'provider_auth'
  | 'provider_rate_limit'
  | 'provider_server'
  | 'provider_timeout'
  | 'provider_network'
  | 'tool_parse'
  | 'action_invalid'
  | 'app_not_found'
  | 'url_invalid'
  | 'permission_denied'
  | 'stt_failed'
  | 'tts_unsupported'
  | 'tts_failed'
  | 'key_missing'
  | 'unknown_channel';

export class MiraError extends Error {
  readonly kind: MiraErrorKind;
  readonly cause?: unknown;

  constructor(kind: MiraErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = 'MiraError';
    this.kind = kind;
    this.cause = cause;
  }

  toJSON() {
    return { kind: this.kind, message: this.message };
  }
}

export function isMiraError(e: unknown): e is MiraError {
  return e instanceof MiraError;
}
