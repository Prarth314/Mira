import { describe, expect, it } from 'vitest';
import { SessionCoordinator } from '../../src/main/session';

describe('owned voice sessions', () => {
  it('prevents windows from mixing audio or ending another window session', () => {
    const sessions = new SessionCoordinator();
    const session = sessions.begin(1);
    expect(() => sessions.begin(2)).toThrow();
    expect(() => sessions.append(2, session.id, Buffer.alloc(2))).toThrow();
    expect(() => sessions.process(2, session.id)).toThrow();
    sessions.append(1, session.id, Buffer.from([1, 2]));
    expect([...sessions.process(1, session.id).audio.flush()]).toEqual([1, 2]);
    expect(() => sessions.append(1, session.id, Buffer.alloc(2))).toThrow();
  });
  it('aborts work and invalidates stale tokens', () => {
    const sessions = new SessionCoordinator();
    const first = sessions.begin(1);
    sessions.cancel(1, first.id);
    expect(first.controller.signal.aborted).toBe(true);
    const next = sessions.begin(1);
    expect(sessions.release(first.id)).toBe(false);
    expect(() => sessions.require(1, first.id)).toThrow();
    expect(sessions.require(1, next.id)).toBe(next);
  });
  it('cancels only sessions owned by a destroyed window', () => {
    const sessions = new SessionCoordinator();
    const session = sessions.begin(2);
    expect(sessions.cancelOwner(1)).toBe(false);
    expect(sessions.cancelOwner(2)).toBe(true);
    expect(session.controller.signal.aborted).toBe(true);
  });
});
