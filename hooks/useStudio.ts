import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudioState, VoiceMode } from '../src/types/studio';

const INITIAL: StudioState = { phase: 'idle', sessionId: null, draft: null, error: null };

export function useStudio() {
  const api = window.mira?.studio;
  const [state, setState] = useState<StudioState>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [starting, setStarting] = useState(false);
  const owner = useRef<string | null>(null);
  const startingRef = useRef(false);
  const finishingRef = useRef<string | null>(null);
  const generation = useRef(0);
  const capture = useRef<{ id: string; stream: MediaStream; context: AudioContext; node: AudioWorkletNode } | null>(null);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const chunkError = useRef<Error | null>(null);
  const flushDone = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback((id?: string) => {
    if (id && capture.current?.id !== id) return;
    if (timer.current) clearTimeout(timer.current);
    const current = capture.current;
    capture.current = null;
    current?.stream.getTracks().forEach((track) => track.stop());
    current?.node.disconnect();
    void current?.context.close().catch(() => undefined);
    setAnalyser(null);
  }, []);

  const cancel = useCallback(async () => {
    generation.current++;
    cleanup();
    const id = owner.current;
    owner.current = null;
    if (id && api) await api.cancel(id).catch(() => undefined);
    setStarting(false);
  }, [api, cleanup]);

  const finish = useCallback(async () => {
    const id = owner.current;
    if (!id || !api || !capture.current || finishingRef.current === id) return;
    finishingRef.current = id;
    const current = capture.current;
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Audio capture did not finish. Please retry.')), 1000);
        flushDone.current = () => { clearTimeout(timeout); resolve(); };
        current.node.port.postMessage('flush');
      });
      cleanup(id);
      await pending.current;
      if (chunkError.current) throw chunkError.current;
      if (owner.current !== id) return;
      await api.finish(id);
    } catch (e) {
      if (owner.current === id) setError(e instanceof Error ? e.message : 'Could not finish recording');
      await api.cancel(id).catch(() => undefined);
    } finally {
      cleanup(id);
      if (finishingRef.current === id) finishingRef.current = null;
      if (owner.current === id) owner.current = null;
    }
  }, [api, cleanup]);

  const start = useCallback(async (mode: VoiceMode) => {
    if (!api || startingRef.current || owner.current) return;
    startingRef.current = true;
    setStarting(true);
    setError(null);
    const token = ++generation.current;
    let id: string | undefined;
    let acquired: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    try {
      ({ id } = await api.start(mode));
      if (token !== generation.current) { await api.cancel(id); return; }
      owner.current = id;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true } });
      acquired = stream;
      if (token !== generation.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      const context = new AudioContext({ sampleRate: 16_000 });
      audioContext = context;
      if (context.sampleRate !== 16_000) { stream.getTracks().forEach((track) => track.stop()); await context.close(); throw new Error('This audio device does not support 16 kHz capture.'); }
      try { await context.audioWorklet.addModule(new URL('pcm-worklet.js', window.location.href)); }
      catch (e) { stream.getTracks().forEach((track) => track.stop()); await context.close(); throw e; }
      const node = new AudioWorkletNode(context, 'mira-pcm');
      if (token !== generation.current) { stream.getTracks().forEach((track) => track.stop()); await context.close(); return; }
      capture.current = { id, stream, context, node };
      pending.current = Promise.resolve();
      chunkError.current = null;
      let queued = 0;
      const failCapture = (message: string) => {
        if (owner.current !== id) return;
        chunkError.current = new Error(message);
        setError(message);
        void cancel();
      };
      stream.getAudioTracks()[0]?.addEventListener('ended', () => failCapture('Microphone disconnected. Reconnect it and try again.'), { once: true });
      node.onprocessorerror = () => failCapture('Audio processing stopped. Please start a new recording.');
      node.port.onmessage = (event: MessageEvent<ArrayBuffer | 'flushed'>) => {
        if (event.data === 'flushed') { flushDone.current?.(); flushDone.current = null; return; }
        const data = event.data;
        if (chunkError.current || owner.current !== id) return;
        if (++queued > 32) { failCapture('Audio transfer fell behind. Please try a shorter recording.'); return; }
        pending.current = pending.current.then(async () => {
          if (owner.current === id && !chunkError.current) await api.chunk(id, data);
        }).catch(() => failCapture('Audio transfer failed. Please start a new recording.')).finally(() => { queued--; });
      };
      const source = context.createMediaStreamSource(stream);
      const meter = context.createAnalyser();
      meter.fftSize = 512;
      source.connect(meter);
      source.connect(node);
      node.connect(context.destination);
      setAnalyser(meter);
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Audio device did not start. Reconnect it or choose another system microphone.')), 5000);
        void context.resume().then(() => { clearTimeout(timeout); resolve(); }, (error: unknown) => { clearTimeout(timeout); reject(error); });
      });
      timer.current = setTimeout(() => { void finish(); }, 119_000);
    } catch (e) {
      cleanup();
      acquired?.getTracks().forEach((track) => track.stop());
      void audioContext?.close().catch(() => undefined);
      if (id) await api.cancel(id).catch(() => undefined);
      if (owner.current === id) owner.current = null;
      if (token === generation.current) setError(e instanceof Error ? e.message : 'Could not start microphone');
    } finally { startingRef.current = false; setStarting(false); }
  }, [api, cleanup, finish, cancel]);

  useEffect(() => {
    if (!api) return;
    const off = api.onState(setState);
    void api.state().then(setState).catch(() => setError('Desktop connection unavailable.'));
    return () => { off(); generation.current++; cleanup(); const id = owner.current; owner.current = null; if (id) void api.cancel(id).catch(() => undefined); };
  }, [api, cleanup]);

  return { state, error, setError, analyser, starting, start, finish, cancel, ownsSession: owner.current !== null };
}
