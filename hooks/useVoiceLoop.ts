import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action } from '../src/types/actions';
import type { ChatResult, ValidatedActionResult } from '../src/types/window';

export type LoopMessage = {
  id: number;
  type: 'user' | 'assistant' | 'system' | 'action' | 'error';
  text: string;
  action?: Action;
};

let _id = 0;
const nextId = () => ++_id;

const SAMPLE_RATE = 16000;
const CHUNK_SAMPLES = 4096;

export type VoiceState = 'idle' | 'recording' | 'thinking' | 'speaking';

export function useVoiceLoop() {
  const [messages, setMessages] = useState<LoopMessage[]>([]);
  const [state, setState] = useState<VoiceState>('idle');
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const append = useCallback((m: Omit<LoopMessage, 'id'>) => {
    setMessages((prev) => [...prev.slice(-100), { id: nextId(), ...m }]);
  }, []);

  const stopCapture = useCallback(() => {
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {/* noop */}
      processorRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {/* noop */}
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setAnalyser(null);
  }, []);

  const startRecording = useCallback(async () => {
    if (state !== 'idle') return;
    const api = window.mira;
    if (!api) {
      append({ type: 'error', text: 'IPC bridge not available — run inside Electron.' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 512;
      source.connect(analyserNode);
      setAnalyser(analyserNode);
      const processor = ctx.createScriptProcessor(CHUNK_SAMPLES, 1, 1);
      processorRef.current = processor;
      await api.voice.start();
      processor.onaudioprocess = (ev) => {
        const data = ev.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(data.length);
        for (let i = 0; i < data.length; i++) {
          const s = Math.max(-1, Math.min(1, data[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        void api.voice.chunk(int16.buffer);
      };
      source.connect(processor);
      processor.connect(ctx.destination);
      setState('recording');
    } catch (e) {
      stopCapture();
      append({
        type: 'error',
        text: `mic capture failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }, [state, append, stopCapture]);

  const cancelRecording = useCallback(async () => {
    if (state !== 'recording') return;
    stopCapture();
    await window.mira?.voice.cancel();
    setState('idle');
  }, [state, stopCapture]);

  const handleResult = useCallback(
    async (result: ChatResult, fallbackUserText?: string) => {
      if (result.transcript) append({ type: 'user', text: result.transcript });
      else if (fallbackUserText) append({ type: 'user', text: fallbackUserText });
      if (!result.ok) {
        append({ type: 'error', text: `${result.error.kind}: ${result.error.message}` });
        return;
      }
      if (result.response.text) append({ type: 'assistant', text: result.response.text });
      const wantsScreen = result.validatedActions.some(
        (v) => v.action?.kind === 'describe_screen',
      );
      for (const v of result.validatedActions) {
        renderActionMessage(v, append);
      }
      if (wantsScreen) {
        const userText = result.transcript ?? fallbackUserText ?? '(describe the screen)';
        const image = await captureScreenJpeg();
        if (!image) {
          append({ type: 'error', text: 'screen capture failed' });
          return;
        }
        setState('thinking');
        const followUp = await window.mira!.chat(userText, [image]);
        if (followUp.ok && followUp.response.text) {
          append({ type: 'assistant', text: followUp.response.text });
        }
        for (const v of followUp.ok ? followUp.validatedActions : []) {
          renderActionMessage(v, append);
        }
      }
      const spokenLine = result.response.text ?? null;
      if (spokenLine) {
        setState('speaking');
        await window.mira!.tts.speak(spokenLine).catch(() => {/* ignore in v0.1 */});
      }
    },
    [append],
  );

  const stopAndSubmit = useCallback(async () => {
    if (state !== 'recording') return;
    stopCapture();
    setState('thinking');
    const api = window.mira!;
    const result = await api.voice.end();
    await handleResult(result);
    setState('idle');
  }, [state, stopCapture, handleResult]);

  const sendText = useCallback(
    async (text: string) => {
      if (!text.trim() || state !== 'idle') return;
      const api = window.mira;
      if (!api) {
        append({ type: 'error', text: 'IPC bridge not available.' });
        return;
      }
      setState('thinking');
      const result = await api.chat(text);
      await handleResult(result, text);
      setState('idle');
    },
    [state, append, handleResult],
  );

  const reset = useCallback(async () => {
    await window.mira?.conversation.reset();
    setMessages([]);
  }, []);

  useEffect(() => () => stopCapture(), [stopCapture]);

  return {
    messages,
    state,
    analyser,
    sendText,
    startRecording,
    stopAndSubmit,
    cancelRecording,
    reset,
  };
}

function renderActionMessage(
  v: ValidatedActionResult,
  append: (m: Omit<LoopMessage, 'id'>) => void,
) {
  if (!v.action) {
    append({ type: 'error', text: `invalid action: ${v.error ?? 'unknown'}` });
    return;
  }
  const desc = describe(v.action);
  if (v.actuator?.ok) {
    append({ type: 'action', text: `✓ ${desc}`, action: v.action });
  } else if (v.actuator) {
    append({
      type: 'error',
      text: `✕ ${desc} — ${v.actuator.error.kind}: ${v.actuator.error.message}`,
      action: v.action,
    });
  } else {
    append({ type: 'action', text: desc, action: v.action });
  }
}

function describe(a: Action): string {
  switch (a.kind) {
    case 'send_developer_prompt':
      return `→ dev tool: ${a.prompt.slice(0, 80)}${a.prompt.length > 80 ? '…' : ''}`;
    case 'launch_app':
      return `launch app: ${a.appName}`;
    case 'open_url':
      return `open url: ${a.url}`;
    case 'set_volume':
      return `set volume to ${a.level}%`;
    case 'describe_screen':
      return `describe screen`;
    case 'speak':
      return `speak: ${a.text}`;
  }
}

async function captureScreenJpeg(): Promise<ArrayBuffer | null> {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 1 },
      audio: false,
    });
    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();
    await new Promise((res) => setTimeout(res, 250));
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stream.getTracks().forEach((t) => t.stop());
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, 'image/jpeg', 0.45),
    );
    if (!blob) return null;
    return await blob.arrayBuffer();
  } catch {
    return null;
  }
}
