import Anthropic from '@anthropic-ai/sdk';
import type {
  ChatRequest,
  ChatResponse,
  Provider,
  ProviderName,
  ToolCall,
  Msg,
} from '../types/provider';
import { MiraError } from '../types/MiraError';
import { withRetry } from './retry';

const DEFAULT_MODEL = 'claude-sonnet-4-6';

type AnthropicMessage = Anthropic.MessageParam;

function imageToContentBlock(img: Buffer): Anthropic.ImageBlockParam {
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/jpeg',
      data: img.toString('base64'),
    },
  };
}

function toAnthropicMessages(msgs: Msg[], images?: Buffer[]): AnthropicMessage[] {
  const out: AnthropicMessage[] = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role === 'user') {
      const isLast = i === msgs.length - 1;
      const blocks: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [
        { type: 'text', text: m.content },
      ];
      if (isLast && images?.length) {
        for (const img of images) blocks.push(imageToContentBlock(img));
      }
      out.push({ role: 'user', content: blocks });
    } else if (m.role === 'assistant') {
      const blocks: Anthropic.ContentBlockParam[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const tc of m.toolCalls) {
        blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
      }
      out.push({ role: 'assistant', content: blocks });
    } else {
      out.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }],
      });
    }
  }
  return out;
}

export class AnthropicProvider implements Provider {
  readonly name: ProviderName = 'anthropic';
  private client: Anthropic;
  private model: string;

  constructor(opts: { apiKey: string; model?: string }) {
    if (!opts.apiKey) throw new MiraError('key_missing', 'Anthropic API key not set');
    this.client = new Anthropic({ apiKey: opts.apiKey });
    this.model = opts.model ?? DEFAULT_MODEL;
  }

  async chat(input: ChatRequest): Promise<ChatResponse> {
    const messages = toAnthropicMessages(input.messages, input.images);
    const tools: Anthropic.Tool[] = input.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
    }));

    const resp = await withRetry(async () => {
      try {
        return await this.client.messages.create({
          model: this.model,
          max_tokens: 1024,
          system: input.systemPrompt,
          messages,
          tools,
        });
      } catch (e: unknown) {
        throw mapAnthropicError(e);
      }
    });

    const toolCalls: ToolCall[] = [];
    let text: string | null = null;
    for (const block of resp.content) {
      if (block.type === 'text') {
        text = (text ?? '') + block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: (block.input as Record<string, unknown>) ?? {},
        });
      }
    }

    return {
      text,
      toolCalls,
      usage: {
        inputTokens: resp.usage.input_tokens,
        outputTokens: resp.usage.output_tokens,
      },
    };
  }
}

function mapAnthropicError(e: unknown): MiraError {
  if (e instanceof Anthropic.AuthenticationError) {
    return new MiraError('provider_auth', 'Anthropic auth failed (check API key)', e);
  }
  if (e instanceof Anthropic.RateLimitError) {
    return new MiraError('provider_rate_limit', 'Anthropic rate limited', e);
  }
  if (e instanceof Anthropic.InternalServerError) {
    return new MiraError('provider_server', 'Anthropic server error', e);
  }
  if (e instanceof Anthropic.APIConnectionTimeoutError) {
    return new MiraError('provider_timeout', 'Anthropic request timed out', e);
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return new MiraError('provider_network', 'Network error reaching Anthropic', e);
  }
  return new MiraError('provider_server', e instanceof Error ? e.message : String(e), e);
}
