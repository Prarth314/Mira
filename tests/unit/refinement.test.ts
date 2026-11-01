import { afterEach, describe, expect, it, vi } from 'vitest';
import { refineInstruction } from '../../src/main/refinement';
import type { Provider } from '../../src/types/provider';

const response = (text: string | null) => ({
  text,
  toolCalls: [],
  usage: { inputTokens: 1, outputTokens: 1 },
});
afterEach(() => vi.useRealTimers());
describe('reviewed instruction refinement boundary', () => {
  it('sends exactly the instruction, no attachments, images, history or tools', async () => {
    const chat = vi.fn<Provider['chat']>(async () => response('Keep auth.ts unchanged.'));
    const result = await refineInstruction(
      'Keep auth.ts unchanged.',
      async () => ({ name: 'openai', chat }),
      new AbortController().signal,
    );
    expect(result.issue).toBeNull();
    expect(chat.mock.calls[0]).toHaveLength(1);
    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'Keep auth.ts unchanged.' }],
        tools: [],
      }),
    );
    expect(Object.keys(chat.mock.calls[0][0] as object).sort()).toEqual([
      'messages',
      'signal',
      'systemPrompt',
      'tools',
    ]);
  });
  it.each(['invalid key', 'rate limited', 'network', 'truncated output', 'timeout'])(
    'retains reviewed text on %s without leaking provider error content',
    async (message) => {
      const result = await refineInstruction(
        'Keep auth.ts unchanged.',
        async () => {
          throw new Error(message);
        },
        new AbortController().signal,
      );
      expect(result).toEqual({ prompt: 'Keep auth.ts unchanged.', issue: 'unavailable' });
    },
  );
  it.each([null, '', 'x'.repeat(16001)])('rejects malformed text', async (text) => {
    const provider: Provider = { name: 'openai', chat: async () => response(text) };
    expect(
      await refineInstruction('Keep this.', async () => provider, new AbortController().signal),
    ).toEqual({ prompt: 'Keep this.', issue: 'unavailable' });
  });
  it('falls back on lost identifiers or negation', async () => {
    expect(
      await refineInstruction(
        'Do not change sessionTTL or 300.',
        async () => ({ name: 'openai', chat: async () => response('Change the timeout.') }),
        new AbortController().signal,
      ),
    ).toMatchObject({ prompt: 'Do not change sessionTTL or 300.', issue: 'details' });
  });
  it('enforces its deadline even if a provider ignores abort', async () => {
    vi.useFakeTimers();
    const result = refineInstruction(
      'Keep this.',
      async () => ({ name: 'openai', chat: () => new Promise(() => {}) }),
      new AbortController().signal,
      100,
    );
    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toMatchObject({ prompt: 'Keep this.', issue: 'unavailable' });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('propagates cancellation and ignores a late result', async () => {
    const controller = new AbortController();
    const result = refineInstruction(
      'Keep this.',
      async () => ({ name: 'openai', chat: () => new Promise(() => {}) }),
      controller.signal,
    );
    const rejected = expect(result).rejects.toThrow();
    controller.abort(new Error('Cancelled'));
    await rejected;
  });
});
