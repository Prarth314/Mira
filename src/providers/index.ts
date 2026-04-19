import type { Provider, ProviderName } from '../types/provider';
import { MiraError } from '../types/MiraError';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';

export function createProvider(opts: {
  name: ProviderName;
  apiKey: string;
  model?: string;
}): Provider {
  if (!opts.apiKey) {
    throw new MiraError('key_missing', `API key missing for provider ${opts.name}`);
  }
  switch (opts.name) {
    case 'anthropic':
      return new AnthropicProvider({ apiKey: opts.apiKey, model: opts.model });
    case 'openai':
      return new OpenAIProvider({ apiKey: opts.apiKey, model: opts.model });
    default: {
      const exhaustive: never = opts.name;
      throw new MiraError('unknown_channel', `unknown provider: ${exhaustive as string}`);
    }
  }
}

export type { Provider, ProviderName } from '../types/provider';
