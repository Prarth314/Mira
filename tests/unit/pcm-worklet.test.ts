import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

describe('audio worklet completion boundary', () => {
  it('flushes the final samples once and never posts PCM after acknowledgement', () => {
    const messages: unknown[] = [];
    type Processor = {
      port: { onmessage: (event: { data: string }) => void };
      process: (input: number[][][]) => boolean;
    };
    let Constructor: (new () => Processor) | undefined;
    runInNewContext(readFileSync('public/pcm-worklet.js', 'utf8'), {
      AudioWorkletProcessor: class {
        port = { onmessage: null, postMessage: (data: unknown) => messages.push(data) };
      },
      registerProcessor: (_name: string, value: new () => Processor) => {
        Constructor = value;
      },
    });
    if (!Constructor) throw new Error('Worklet did not register');
    const processor = new Constructor();
    expect(processor.process([[[0.1, -0.1]]])).toBe(true);
    expect(messages).toHaveLength(0);
    processor.port.onmessage({ data: 'flush' });
    expect(messages).toHaveLength(2);
    expect((messages[0] as ArrayBuffer).byteLength).toBe(4);
    expect(messages[1]).toBe('flushed');
    expect(processor.process([[[0.5, 0.8]]])).toBe(false);
    expect(messages).toHaveLength(2);
  });
});
