import { MiraError } from '../types/MiraError';

export class AudioBuffer {
  private chunks: Buffer[] = [];
  private byteLength = 0;
  constructor(private readonly maxBytes = 16_000 * 2 * 120) {}

  append(chunk: Buffer): void {
    if (this.byteLength + chunk.length > this.maxBytes) {
      throw new MiraError('action_invalid', 'Recording exceeds the two-minute limit');
    }
    this.chunks.push(chunk);
    this.byteLength += chunk.length;
  }

  flush(): Buffer {
    const out = Buffer.concat(this.chunks, this.byteLength);
    this.reset();
    return out;
  }

  reset(): void {
    this.chunks = [];
    this.byteLength = 0;
  }

  size(): number {
    return this.byteLength;
  }

  durationMs(sampleRate: number, bytesPerSample = 2): number {
    return (this.byteLength / bytesPerSample / sampleRate) * 1000;
  }
}
