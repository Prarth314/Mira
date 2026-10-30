import { MiraError } from '../types/MiraError';
import { setTimeout as delay } from 'node:timers/promises';

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
  signal?: AbortSignal,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    signal?.throwIfAborted();
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!(e instanceof MiraError) || !RETRYABLE.has(e.kind) || attempt === delays.length) {
        throw e;
      }
      await delay(delays[attempt], undefined, { signal });
    }
  }
  throw lastErr;
}
