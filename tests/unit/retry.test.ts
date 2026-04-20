import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../src/providers/retry';
import { MiraError } from '../../src/types/MiraError';

describe('withRetry', () => {
  it('returns the value on first success', async () => {
    const fn = vi.fn().mockResolvedValue(42);
    expect(await withRetry(fn, [10, 10, 10])).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable MiraError until success', async () => {
    let n = 0;
    const fn = vi.fn(async () => {
      n++;
      if (n < 3) throw new MiraError('provider_rate_limit', 'slow down');
      return 'ok';
    });
    expect(await withRetry(fn, [1, 1, 1])).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry provider_auth (non-retryable)', async () => {
    const fn = vi.fn(async () => {
      throw new MiraError('provider_auth', 'bad key');
    });
    await expect(withRetry(fn, [1, 1, 1])).rejects.toThrow('bad key');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after exhausting retries', async () => {
    const fn = vi.fn(async () => {
      throw new MiraError('provider_server', '500');
    });
    await expect(withRetry(fn, [1, 1, 1])).rejects.toThrow('500');
    expect(fn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  it('does not retry non-MiraError exceptions', async () => {
    const fn = vi.fn(async () => {
      throw new Error('plain');
    });
    await expect(withRetry(fn, [1, 1, 1])).rejects.toThrow('plain');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
