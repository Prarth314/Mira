class MiraPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Int16Array(4096);
    this.offset = 0;
    this.port.onmessage = (event) => {
      if (event.data === 'flush') {
        this.flush();
        this.port.postMessage('flushed');
      }
    };
  }
  flush() {
    if (!this.offset) return;
    const buffer = this.samples.slice(0, this.offset).buffer;
    this.port.postMessage(buffer, [buffer]);
    this.offset = 0;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input) for (const value of input) {
      const sample = Math.max(-1, Math.min(1, value));
      this.samples[this.offset++] = sample < 0 ? sample * 32768 : sample * 32767;
      if (this.offset === this.samples.length) this.flush();
    }
    return true;
  }
}
registerProcessor('mira-pcm', MiraPcmProcessor);
