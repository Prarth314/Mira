import { describe, expect, it, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: async () => ({
        stop_reason: 'max_tokens',
        content: [{ type: 'text', text: 'partial' }],
        usage: { input_tokens: 1, output_tokens: 4096 },
      }),
    };
  },
}));
vi.mock('openai', () => ({
  default: class {
    chat = {
      completions: {
        create: async () => ({
          choices: [{ finish_reason: 'length', message: { content: 'partial', tool_calls: [] } }],
          usage: { prompt_tokens: 1, completion_tokens: 8192 },
        }),
      },
    };
  },
}));
import { AnthropicProvider } from '../../src/providers/anthropic';
import { OpenAIProvider } from '../../src/providers/openai';

describe('provider output completeness', () => {
  it.each([AnthropicProvider, OpenAIProvider])(
    'rejects truncated responses instead of offering a partial instruction',
    async (Provider) => {
      const provider = new Provider({ apiKey: 'synthetic-test-key' });
      await expect(
        provider.chat({
          messages: [{ role: 'user', content: 'Keep all constraints.' }],
          tools: [],
        }),
      ).rejects.toThrow('truncated');
    },
  );
});
