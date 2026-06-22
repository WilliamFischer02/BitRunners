import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type LiveSession,
  _resetRegistry,
  liveSessionId,
  registerSession,
  unregisterSession,
} from './session-registry.js';

function makeSession(sessionId: string): LiveSession {
  return { sessionId, supersede: vi.fn() };
}

afterEach(() => _resetRegistry());

describe('session-registry (single live session per user)', () => {
  it('first session for a user is not superseded', () => {
    const a = makeSession('a');
    expect(registerSession('u1', a)).toBeNull();
    expect(liveSessionId('u1')).toBe('a');
  });

  it('a second tab supersedes the first and becomes live', () => {
    const a = makeSession('a');
    const b = makeSession('b');
    registerSession('u1', a);
    const superseded = registerSession('u1', b);
    expect(superseded).toBe(a); // caller kicks the old one
    expect(liveSessionId('u1')).toBe('b'); // newer is live
  });

  it('superseding a session disconnects exactly the old connection', () => {
    const a = makeSession('a');
    const b = makeSession('b');
    registerSession('u1', a);
    const old = registerSession('u1', b);
    old?.supersede();
    expect(a.supersede).toHaveBeenCalledTimes(1);
    expect(b.supersede).not.toHaveBeenCalled();
  });

  it('different users do not interfere', () => {
    const a = makeSession('a');
    const b = makeSession('b');
    expect(registerSession('u1', a)).toBeNull();
    expect(registerSession('u2', b)).toBeNull();
    expect(liveSessionId('u1')).toBe('a');
    expect(liveSessionId('u2')).toBe('b');
  });

  it('a superseded session leaving later does not evict the newer one', () => {
    const a = makeSession('a');
    const b = makeSession('b');
    registerSession('u1', a);
    registerSession('u1', b);
    // The old tab 'a' finally closes and unregisters — 'b' must stay live.
    unregisterSession('u1', 'a');
    expect(liveSessionId('u1')).toBe('b');
  });

  it('the live session leaving clears the entry', () => {
    const a = makeSession('a');
    registerSession('u1', a);
    unregisterSession('u1', 'a');
    expect(liveSessionId('u1')).toBeUndefined();
  });
});
