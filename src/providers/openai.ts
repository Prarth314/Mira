import OpenAI from 'openai';
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

const DEFAULT_MODEL = 'gpt-5.4';

type OpenAIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

function imageDataUrl(img: Buffer): string {
  return `data:image/jpeg;base64,${img.toString('base64')}`;
}

function toOpenAIMessages(
  msgs: Msg[],
  images?: Buffer[],
  systemPrompt?: string,
): OpenAIMessage[] {
  const out: OpenAIMessage[] = [];
  if (systemPrompt) out.push({ role: 'system', content: systemPrompt });
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role === 'user') {
      const isLast = i === msgs.length - 1;
      if (isLast && images?.length) {
        const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
          { type: 'text', text: m.content },
          ...images.map((img) => ({
            type: 'image_url' as const,
            image_url: { url: imageDataUrl(img) },
          })),
        ];
        out.push({ role: 'user', content: parts });
      } else {
        out.push({ role: 'user', content: m.content });
      }
    } else if (m.role === 'assistant') {
      const tcs = m.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.input) },
      }));
      out.push({
        role: 'assistant',
        content: m.content,
        ...(tcs.length ? { tool_calls: tcs } : {}),
      });
    } else {
      out.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content });
    }
  }
  return out;
}

export class OpenAIProvider implements Provider {
  readonly name: ProviderName = 'openai';
  private client: OpenAI;
  private model: string;

  constructor(opts: { apiKey: string; model?: string }) {
    if (!opts.apiKey) throw new MiraError('key_missing', 'OpenAI API key not set');
    this.client = new OpenAI({ apiKey: opts.apiKey });
    this.model = opts.model ?? DEFAULT_MODEL;
  }

  async chat(input: ChatRequest): Promise<ChatResponse> {
    const messages = toOpenAIMessages(input.messages, input.images, input.systemPrompt);
    const tools = input.tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema as Record<string, unknown>,
      },
    }));

    const resp = await withRetry(async () => {
      try {
        return await this.client.chat.completions.create({
          model: this.model,
          messages,
          tools,
          max_tokens: 1024,
        });
      } catch (e: unknown) {
        throw mapOpenAIError(e);
      }
    });

    const choice = resp.choices[0];
    const text = choice?.message?.content ?? null;
    const toolCalls: ToolCall[] = (choice?.message?.tool_calls ?? [])
      .filter((tc): tc is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall =>
        tc.type === 'function',
      )
      .map((tc) => {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(tc.function.arguments) as Record<string, unknown>;
        } catch (e) {
          throw new MiraError(
            'tool_parse',
            `OpenAI returned tool args that aren't valid JSON: ${tc.function.arguments}`,
            e,
          );
        }
        return { id: tc.id, name: tc.function.name, input: parsed };
      });

    return {
      text,
      toolCalls,
      usage: {
        inputTokens: resp.usage?.prompt_tokens ?? 0,
        outputTokens: resp.usage?.completion_tokens ?? 0,
      },
    };
  }
}

function mapOpenAIError(e: unknown): MiraError {
  if (e instanceof OpenAI.AuthenticationError) {
    return new MiraError('provider_auth', 'OpenAI auth failed (check API key)', e);
  }
  if (e instanceof OpenAI.RateLimitError) {
    return new MiraError('provider_rate_limit', 'OpenAI rate limited', e);
  }
  if (e instanceof OpenAI.InternalServerError) {
    return new MiraError('provider_server', 'OpenAI server error', e);
  }
  if (e instanceof OpenAI.APIConnectionTimeoutError) {
    return new MiraError('provider_timeout', 'OpenAI request timed out', e);
  }
  if (e instanceof OpenAI.APIConnectionError) {
    return new MiraError('provider_network', 'Network error reaching OpenAI', e);
  }
  return new MiraError('provider_server', e instanceof Error ? e.message : String(e), e);
}
