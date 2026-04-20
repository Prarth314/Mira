import { describe, it, expect } from 'vitest';
import { createProvider } from '../../src/providers';
import { MiraError } from '../../src/types/MiraError';

describe('createProvider', () => {
  it('returns an Anthropic provider when name=anthropic', () => {
    const p = createProvider({ name: 'anthropic', apiKey: 'sk-ant-test' });
    expect(p.name).toBe('anthropic');
  });

  it('returns an OpenAI provider when name=openai', () => {
    const p = createProvider({ name: 'openai', apiKey: 'sk-test' });
    expect(p.name).toBe('openai');
  });

  it('throws MiraError when key is missing', () => {
    expect(() => createProvider({ name: 'anthropic', apiKey: '' })).toThrow(MiraError);
    expect(() => createProvider({ name: 'openai', apiKey: '' })).toThrow(MiraError);
  });

  it('thrown error has key_missing kind', () => {
    try {
      createProvider({ name: 'anthropic', apiKey: '' });
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(MiraError);
      expect((e as MiraError).kind).toBe('key_missing');
    }
  });
});
