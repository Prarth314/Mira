export class AudioBuffer {
  private chunks: Buffer[] = [];
  private byteLength = 0;

  append(chunk: Buffer): void {
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
