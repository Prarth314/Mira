import { describe, it, expect } from 'vitest';
import { AudioBuffer } from '../../src/main/audio-buffer';

describe('AudioBuffer', () => {
  it('starts empty', () => {
    const b = new AudioBuffer();
    expect(b.size()).toBe(0);
    expect(b.flush().length).toBe(0);
  });

  it('appends and flushes round-trip the bytes in order', () => {
    const b = new AudioBuffer();
    b.append(Buffer.from([1, 2, 3]));
    b.append(Buffer.from([4, 5]));
    expect(b.size()).toBe(5);
    const out = b.flush();
    expect(Array.from(out)).toEqual([1, 2, 3, 4, 5]);
    expect(b.size()).toBe(0);
  });

  it('reset() clears without yielding bytes', () => {
    const b = new AudioBuffer();
    b.append(Buffer.from([9, 9, 9]));
    b.reset();
    expect(b.size()).toBe(0);
    expect(b.flush().length).toBe(0);
  });

  it('computes durationMs for Int16 mono at 16kHz', () => {
    const b = new AudioBuffer();
    b.append(Buffer.alloc(16000 * 2)); // 1 second
    expect(b.durationMs(16000)).toBeCloseTo(1000, 0);
  });
});
