import { describe, it, expect } from 'vitest';
import { record, text, providerName, imageBuffers } from '../../src/main/validation';
import { AudioBuffer } from '../../src/main/audio-buffer';

describe('IPC resource boundaries', () => {
  it('rejects non-object payloads and coercion of arbitrary values to strings', () => {
    for (const value of [null, [], 'a', 1]) expect(() => record(value)).toThrow();
    for (const value of [null, {}, 123, '']) expect(() => text(value, 'input')).toThrow();
    expect(() => text('a'.repeat(11), 'input', 10)).toThrow();
  });
  it('only accepts configured provider identifiers', () => {
    expect(providerName('openai')).toBe('openai');
    expect(() => providerName('__proto__')).toThrow();
  });
  it('bounds image count, type and size', () => {
    expect(() => imageBuffers([new ArrayBuffer(1), new ArrayBuffer(1)])).toThrow();
    expect(() => imageBuffers(['not bytes'])).toThrow();
    expect(() => imageBuffers([new ArrayBuffer(4 * 1024 * 1024 + 1)])).toThrow();
  });
  it('bounds audio memory without corrupting accepted chunks', () => {
    const audio = new AudioBuffer(4);
    audio.append(Buffer.from([1, 2]));
    expect(() => audio.append(Buffer.alloc(3))).toThrow();
    expect([...audio.flush()]).toEqual([1, 2]);
  });
});
