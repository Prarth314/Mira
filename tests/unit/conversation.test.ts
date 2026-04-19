import { describe, it, expect } from 'vitest';
import { Conversation } from '../../src/main/conversation';

describe('Conversation', () => {
  it('starts empty', () => {
    const c = new Conversation();
    expect(c.snapshot()).toEqual([]);
    expect(c.size()).toBe(0);
  });

  it('appends user, assistant, and tool messages', () => {
    const c = new Conversation();
    c.addUserMessage('hello');
    c.addAssistantMessage('hi', [{ id: 'tc1', name: 'actuate', input: { action: { kind: 'speak', text: 'hi' } } }]);
    c.addToolResult('tc1', 'ok');
    const snap = c.snapshot();
    expect(snap).toHaveLength(3);
    expect(snap[0].role).toBe('user');
    expect(snap[1].role).toBe('assistant');
    expect(snap[2].role).toBe('tool');
  });

  it('reset() clears history', () => {
    const c = new Conversation();
    c.addUserMessage('hello');
    c.reset();
    expect(c.size()).toBe(0);
  });

  it('snapshot returns copies, not references', () => {
    const c = new Conversation();
    c.addUserMessage('hello');
    const snap = c.snapshot();
    snap[0] = { role: 'user', content: 'mutated' };
    expect(c.snapshot()[0]).toMatchObject({ role: 'user', content: 'hello' });
  });

  it('trims oldest messages when over budget', () => {
    const c = new Conversation({ tokenBudget: 20 }); // ~80 chars budget
    for (let i = 0; i < 50; i++) {
      c.addUserMessage('x'.repeat(100));
    }
    expect(c.size()).toBeLessThan(50);
    expect(c.estimatedTokens()).toBeLessThanOrEqual(c['budget' as keyof typeof c] as unknown as number * 2);
  });

  it('drops trailing tool results when their tool_use is dropped', () => {
    const c = new Conversation({ tokenBudget: 10 });
    c.addUserMessage('a'.repeat(50));
    c.addAssistantMessage(null, [{ id: 'tc1', name: 'actuate', input: {} }]);
    c.addToolResult('tc1', 'b'.repeat(50));
    c.addUserMessage('c'.repeat(50));
    // After trim, the orphan tool result shouldn't be at the head
    const snap = c.snapshot();
    if (snap.length > 0) {
      expect(snap[0].role).not.toBe('tool');
    }
  });
});
