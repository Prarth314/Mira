import { spawn, ChildProcess } from 'node:child_process';
import { MiraError } from '../types/MiraError';

let active: ChildProcess | null = null;

export function isSupportedPlatform(): boolean {
  return process.platform === 'darwin';
}

export async function speak(text: string): Promise<void> {
  if (!isSupportedPlatform()) {
    throw new MiraError(
      'tts_unsupported',
      `TTS not supported on platform '${process.platform}' yet (macOS 'say' only in v0.1)`,
    );
  }
  cancel();
  return new Promise((resolve, reject) => {
    const child = spawn('say', ['-r', '210', text], { stdio: 'ignore' });
    active = child;
    child.on('error', (e) => {
      if (active === child) active = null;
      reject(new MiraError('tts_failed', `say spawn: ${e.message}`));
    });
    child.on('close', () => {
      if (active === child) active = null;
      resolve();
    });
  });
}

export function cancel(): void {
  if (active) {
    try {
      active.kill('SIGTERM');
    } catch {
      // ignore
    }
    active = null;
  }
}
