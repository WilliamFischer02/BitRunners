// Process-global registry of the single live Colyseus session per account.
//
// The server is a single Node process (one Fly machine), so a module-level
// map is enough to enforce "at most one live connection per user" — even
// across spheres. When a user opens a second tab, the newer connection
// supersedes the older one, which is kicked with a "session moved" close so
// it stops leaving an AFK self-ghost behind.
//
// Kept free of Colyseus types so it can be unit-tested in isolation: each
// session is represented by its sessionId plus a `supersede` closure the
// room binds to the actual client kick.

export interface LiveSession {
  sessionId: string;
  /** Kicks this session (server sends a notice + closes the socket). Bound by
   *  the room to the specific Client at registration time. */
  supersede(): void;
}

const byUser = new Map<string, LiveSession>();

/**
 * Make `session` the live session for `userId` and return the previously-live
 * session if it was a *different* connection (so the caller can supersede it).
 * Returns null when this is the user's first/only session.
 */
export function registerSession(userId: string, session: LiveSession): LiveSession | null {
  const prev = byUser.get(userId);
  byUser.set(userId, session);
  return prev && prev.sessionId !== session.sessionId ? prev : null;
}

/**
 * Drop the user's entry, but only if `sessionId` is still the live one. A
 * superseded session that disconnects *after* the newer one registered must
 * not evict the newer session from the registry.
 */
export function unregisterSession(userId: string, sessionId: string): void {
  const cur = byUser.get(userId);
  if (cur && cur.sessionId === sessionId) byUser.delete(userId);
}

/** Test helper: current live sessionId for a user (or undefined). */
export function liveSessionId(userId: string): string | undefined {
  return byUser.get(userId)?.sessionId;
}

/** Test helper: clear all registry state. */
export function _resetRegistry(): void {
  byUser.clear();
}
