import type { Action, ActionKind } from './actions';

export type Role = 'user' | 'assistant' | 'tool';

export type Msg =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls: ToolCall[] }
  | { role: 'tool'; toolCallId: string; content: string };

export type ToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  action?: Action;
};

export type ToolParameter = {
  type: 'string' | 'number' | 'object';
  description?: string;
  enum?: string[];
};

export type Tool = {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
};

export type ChatRequest = {
  messages: Msg[];
  tools: Tool[];
  images?: Buffer[];
  systemPrompt?: string;
};

export type ChatResponse = {
  text: string | null;
  toolCalls: ToolCall[];
  usage: { inputTokens: number; outputTokens: number };
};

export type ProviderName = 'anthropic' | 'openai';

export interface Provider {
  readonly name: ProviderName;
  chat(input: ChatRequest): Promise<ChatResponse>;
}

export const ACTUATE_TOOL: Tool = {
  name: 'actuate',
  description:
    'Execute a typed action on the user\'s machine. Pick exactly one action.kind. ' +
    'You CANNOT run shell commands or arbitrary code; you can only emit one of the typed action shapes.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'object',
        description:
          'A discriminated-union action. Must be one of: ' +
          '{kind:"launch_app", appName:string}, ' +
          '{kind:"open_url", url:string (https://...)}, ' +
          '{kind:"set_volume", level:number (0-100)}, ' +
          '{kind:"describe_screen"}, ' +
          '{kind:"speak", text:string}.',
      },
      reason: {
        type: 'string',
        description: 'Brief explanation of why this action satisfies the user request.',
      },
    },
    required: ['action'],
  },
};

export const ACTION_KINDS: readonly ActionKind[] = [
  'launch_app',
  'open_url',
  'set_volume',
  'describe_screen',
  'speak',
] as const;
