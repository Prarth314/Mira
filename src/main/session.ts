import { randomUUID } from 'node:crypto';
import { MiraError } from '../types/MiraError';
import { AudioBuffer } from './audio-buffer';

export type VoiceSession = {
  id: string;
  owner: number;
  controller: AbortController;
  audio: AudioBuffer;
  phase: 'recording' | 'processing';
};

export class SessionCoordinator {
  private current: VoiceSession | null = null;

  begin(owner: number): VoiceSession {
    if (this.current) throw new MiraError('action_invalid', 'Another session is active');
    this.current = {
      id: randomUUID(), owner, controller: new AbortController(),
      audio: new AudioBuffer(), phase: 'recording',
    };
    return this.current;
  }

  require(owner: number, id: string): VoiceSession {
    const session = this.current;
    if (!session || session.owner !== owner || session.id !== id || session.controller.signal.aborted) {
      throw new MiraError('action_invalid', 'Session is no longer active in this window');
    }
    return session;
  }

  append(owner: number, id: string, bytes: Buffer): void {
    const session = this.require(owner, id);
    if (session.phase !== 'recording') throw new MiraError('action_invalid', 'Recording has ended');
    session.audio.append(bytes);
  }

  process(owner: number, id: string): VoiceSession {
    const session = this.require(owner, id);
    if (session.phase !== 'recording') throw new MiraError('action_invalid', 'Session is already processing');
    session.phase = 'processing';
    return session;
  }

  cancel(owner: number, id: string): void {
    const session = this.require(owner, id);
    session.controller.abort();
    session.audio.reset();
    this.current = null;
  }

  release(id: string): boolean {
    if (this.current?.id !== id) return false;
    this.current.audio.reset();
    this.current = null;
    return true;
  }

  cancelOwner(owner: number): boolean {
    if (this.current?.owner !== owner) return false;
    this.cancel(owner, this.current.id);
    return true;
  }
}
