import { spawn } from 'node:child_process';
import { MiraError } from '../types/MiraError';

/** Resolve only after exit: callers can then safely remove temporary audio. */
export function runSpeechProcess(
  binary: string,
  args: string[],
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    graceMs?: number;
  } = {},
): Promise<void> {
  options.signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true, shell: false, stdio: 'ignore' });
    let failed = false;
    let stopped = false;
    let escalation: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      child.kill();
      escalation = setTimeout(() => child.kill('SIGKILL'), options.graceMs ?? 500);
    };
    const timeout = setTimeout(stop, options.timeoutMs ?? 120_000);
    options.signal?.addEventListener('abort', stop, { once: true });
    if (options.signal?.aborted) stop();
    child.once('error', () => {
      failed = true;
    });
    child.once('close', (code) => {
      clearTimeout(timeout);
      if (escalation) clearTimeout(escalation);
      options.signal?.removeEventListener('abort', stop);
      if (options.signal?.aborted) reject(options.signal.reason);
      else if (!failed && !stopped && code === 0) resolve();
      else
        reject(
          new MiraError(
            'stt_failed',
            'Speech processing failed or timed out. Try a shorter recording.',
          ),
        );
    });
  });
}
