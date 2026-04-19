import React, { useEffect, useState, useRef } from 'react';
import { Mic, Loader2, Volume2, X } from 'lucide-react';
import AudioVisualizer from '../../components/AudioVisualizer';
import type { ChatResult, ValidatedActionResult } from '../types/window';

type State = 'idle' | 'recording' | 'thinking' | 'done' | 'error';

const SAMPLE_RATE = 16000;
const CHUNK_SAMPLES = 4096;
const AUTO_DISMISS_MS = 2400;

const Overlay: React.FC = () => {
  const [state, setState] = useState<State>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [resultText, setResultText] = useState<string>('');
  const [errorText, setErrorText] = useState<string>('');
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearDismiss() {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }

  function scheduleDismiss(ms = AUTO_DISMISS_MS) {
    clearDismiss();
    dismissTimer.current = setTimeout(() => {
      void window.mira?.overlay?.hide();
    }, ms);
  }

  function stopCapture() {
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
  }

  async function startRecording() {
    const api = window.mira;
    if (!api) {
      setErrorText('IPC bridge unavailable');
      setState('error');
      scheduleDismiss();
      return;
    }
    clearDismiss();
    setTranscript('');
    setResultText('');
    setErrorText('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const a = ctx.createAnalyser();
      a.fftSize = 512;
      source.connect(a);
      setAnalyser(a);
      const proc = ctx.createScriptProcessor(CHUNK_SAMPLES, 1, 1);
      processorRef.current = proc;
      await api.voice.start();
      proc.onaudioprocess = (ev) => {
        const data = ev.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(data.length);
        for (let i = 0; i < data.length; i++) {
          const s = Math.max(-1, Math.min(1, data[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        void api.voice.chunk(int16.buffer);
      };
      source.connect(proc);
      proc.connect(ctx.destination);
      setState('recording');
    } catch (e) {
      stopCapture();
      setErrorText(e instanceof Error ? e.message : String(e));
      setState('error');
      scheduleDismiss();
    }
  }

  async function stopAndProcess() {
    if (state !== 'recording') return;
    stopCapture();
    setState('thinking');
    const api = window.mira!;
    let result: ChatResult;
    try {
      result = await api.voice.end();
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e));
      setState('error');
      scheduleDismiss();
      return;
    }
    if (!result.ok) {
      setTranscript(result.transcript ?? '');
      setErrorText(`${result.error.kind}: ${result.error.message}`);
      setState('error');
      scheduleDismiss();
      return;
    }
    if (result.transcript) setTranscript(result.transcript);
    const summary = renderSummary(result.response.text, result.validatedActions);
    setResultText(summary);
    setState('done');
    if (result.response.text) {
      void api.tts.speak(result.response.text).catch(() => {/* noop */});
    }
    scheduleDismiss();
  }

  async function cancel() {
    stopCapture();
    await window.mira?.voice.cancel();
    setState('idle');
    void window.mira?.overlay?.hide();
  }

  // Listen for main-process commands
  useEffect(() => {
    const off = window.mira?.overlay?.onShow(() => {
      void startRecording();
    });
    const offToggle = window.mira?.overlay?.onToggle(() => {
      if (state === 'recording') void stopAndProcess();
      else if (state === 'idle') void startRecording();
    });
    const offHide = window.mira?.overlay?.onHide(() => {
      stopCapture();
      setState('idle');
    });
    return () => {
      off?.();
      offToggle?.();
      offHide?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // No in-window keyboard listener: the overlay window is non-focusable
  // (NSPanel + focusable:false) so it doesn't steal focus from the user's
  // foreground app. State is driven entirely by Option+Space via the main
  // process globalShortcut.

  useEffect(() => () => stopCapture(), []);

  return (
    <div className="h-full w-full flex items-center justify-center px-3 py-3">
      <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl px-4 py-3 w-full flex items-center gap-3">
        <div className="shrink-0 w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center">
          {state === 'recording' && <Mic size={14} className="text-blue-400" />}
          {state === 'thinking' && <Loader2 size={14} className="text-amber-400 animate-spin" />}
          {state === 'done' && <Volume2 size={14} className="text-emerald-400" />}
          {state === 'idle' && <Mic size={14} className="text-zinc-500" />}
          {state === 'error' && <X size={14} className="text-red-400" />}
        </div>

        <div className="flex-1 min-w-0">
          {state === 'recording' && (
            <div className="h-7 flex items-center">
              <AudioVisualizer isActive={true} analyser={analyser} size="sm" />
            </div>
          )}
          {state === 'thinking' && (
            <div className="text-[12px] text-zinc-300 truncate">
              <span className="text-zinc-500">▸ </span>{transcript || 'Transcribing…'}
            </div>
          )}
          {state === 'done' && (
            <div className="text-[12px] text-zinc-100 truncate" title={resultText}>{resultText}</div>
          )}
          {state === 'error' && (
            <div className="text-[12px] text-red-300 truncate" title={errorText}>{errorText}</div>
          )}
          {state === 'idle' && (
            <div className="text-[12px] text-zinc-500">Press ⌥Space again to start</div>
          )}
        </div>

        <button
          onClick={cancel}
          className="shrink-0 text-zinc-500 hover:text-zinc-200 p-1 rounded-md hover:bg-white/5"
          aria-label="Dismiss"
          title="Dismiss (Esc)"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

function renderSummary(
  text: string | null,
  actions: ValidatedActionResult[],
): string {
  const succeeded = actions.filter((a) => a.action && a.actuator?.ok);
  const failed = actions.filter((a) => !a.action || a.actuator?.ok === false);
  if (succeeded.length === 1 && failed.length === 0) {
    const actuator = succeeded[0].actuator;
    if (actuator?.ok) return actuator.message;
    return text ?? 'done';
  }
  if (text) return text;
  if (succeeded.length) return `${succeeded.length} action(s) executed`;
  if (failed.length) {
    const f = failed[0];
    if (f.actuator && !f.actuator.ok) return `failed: ${f.actuator.error.message}`;
    return `failed: ${f.error ?? 'unknown'}`;
  }
  return 'no action';
}

export default Overlay;
