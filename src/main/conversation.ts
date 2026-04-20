import type { Msg, ToolCall } from '../types/provider';

const APPROX_CHARS_PER_TOKEN = 4;
const DEFAULT_TOKEN_BUDGET = 8000;

function estimateTokens(msg: Msg): number {
  if (msg.role === 'user') return Math.ceil(msg.content.length / APPROX_CHARS_PER_TOKEN);
  if (msg.role === 'tool') return Math.ceil(msg.content.length / APPROX_CHARS_PER_TOKEN);
  const textLen = msg.content?.length ?? 0;
  const toolLen = msg.toolCalls.reduce((acc, tc) => acc + JSON.stringify(tc.input).length, 0);
  return Math.ceil((textLen + toolLen) / APPROX_CHARS_PER_TOKEN);
}

export class Conversation {
  private messages: Msg[] = [];
  private readonly budget: number;

  constructor(opts?: { tokenBudget?: number }) {
    this.budget = opts?.tokenBudget ?? DEFAULT_TOKEN_BUDGET;
  }

  snapshot(): Msg[] {
    return this.messages.map((m) => ({ ...m }));
  }

  reset(): void {
    this.messages = [];
  }

  addUserMessage(content: string): void {
    this.messages.push({ role: 'user', content });
    this.trim();
  }

  addAssistantMessage(content: string | null, toolCalls: ToolCall[] = []): void {
    this.messages.push({ role: 'assistant', content, toolCalls });
    this.trim();
  }

  addToolResult(toolCallId: string, content: string): void {
    this.messages.push({ role: 'tool', toolCallId, content });
    this.trim();
  }

  size(): number {
    return this.messages.length;
  }

  estimatedTokens(): number {
    return this.messages.reduce((acc, m) => acc + estimateTokens(m), 0);
  }

  private trim(): void {
    while (this.estimatedTokens() > this.budget && this.messages.length > 1) {
      // Drop oldest non-system pair (user + following assistant/tool)
      this.messages.shift();
      // Also drop trailing tool results that now reference a missing tool_use
      while (this.messages[0]?.role === 'tool') {
        this.messages.shift();
      }
    }
  }
}
