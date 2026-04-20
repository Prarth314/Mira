import { MiraError } from '../types/MiraError';

const RETRYABLE: ReadonlySet<string> = new Set([
  'provider_rate_limit',
  'provider_server',
  'provider_timeout',
  'provider_network',
]);

const DEFAULT_DELAYS_MS = [200, 400, 800];

export async function withRetry<T>(
  fn: () => Promise<T>,
  delays: number[] = DEFAULT_DELAYS_MS,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!(e instanceof MiraError) || !RETRYABLE.has(e.kind) || attempt === delays.length) {
        throw e;
      }
      await new Promise((res) => setTimeout(res, delays[attempt]));
    }
  }
  throw lastErr;
}
