import { WS_CLOSE_SESSION_SUPERSEDED } from '@bitrunners/shared';
import { Client, type Room, getStateCallbacks } from 'colyseus.js';

export interface RemotePlayer {
  id: string;
  className: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  emote: string;
  emoteSeq: number;
  displayName: string;
  equippedBadge: string;
  equippedTheme: string;
}

export interface IdentityUpdate {
  displayName?: string;
  equippedBadge?: string;
  equippedTheme?: string;
}

export interface TetherPeerSummary {
  id: string;
  name: string;
}

export interface NetworkCallbacks {
  onJoin?(p: RemotePlayer): void;
  onLeave?(id: string): void;
  onUpdate?(p: RemotePlayer): void;
  onEmote?(id: string, text: string): void;
  onIdentity?(id: string, p: RemotePlayer): void;
  /** Fired when the server closes the connection unexpectedly (e.g. idle kick). */
  onDisconnect?(code: number): void;
  /** Fired when a newer tab/connection for the same account superseded this
   *  one. The client should show a "session moved" overlay and NOT reconnect. */
  onSuperseded?(): void;
  // Tether chat (PR 87) — server routes the five message types between
  // exactly two consenting peers. Each callback receives the originating
  // sessionId so the client can match against the local tether state.
  onTetherIncoming?(peer: TetherPeerSummary): void;
  onTetherAccepted?(peer: TetherPeerSummary): void;
  onTetherDeclined?(from: string): void;
  onTetherMessage?(from: string, body: string, isEmote: boolean): void;
  onTetherEnded?(from: string): void;
  /** Fired after the server drops our outbound message during moderation. */
  onTetherRejected?(reason: string): void;
}

export interface JoinOptions {
  className: string;
  displayName?: string;
  equippedBadge?: string;
  equippedTheme?: string;
  /** Supabase auth uid — lets the server enforce one live session per account. */
  userId?: string;
}

export interface NetworkSession {
  sessionId: string;
  roomId: string;
  sendMove(x: number, z: number, rotY: number): void;
  sendEmote(text: string): void;
  setClass(name: string): void;
  sendIdentity(update: IdentityUpdate): void;
  sendTetherRequest(target: string): void;
  sendTetherAccept(from: string): void;
  sendTetherDecline(from: string): void;
  sendTetherMessage(target: string, body: string, isEmote: boolean): void;
  sendTetherLeave(target: string): void;
  dispose(): Promise<void>;
}

// Last-joined room id, for the Settings "room code" display (read after connect).
let joinedRoomId = '';
export function getJoinedRoomId(): string {
  return joinedRoomId;
}

interface PlayerSchema {
  id: string;
  className: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  emote: string;
  emoteSeq: number;
  displayName?: string;
  equippedBadge?: string;
  equippedTheme?: string;
}

function snapshot(p: PlayerSchema): RemotePlayer {
  return {
    id: p.id,
    className: p.className,
    x: p.x,
    y: p.y,
    z: p.z,
    rotY: p.rotY,
    emote: p.emote,
    emoteSeq: p.emoteSeq,
    displayName: p.displayName ?? '',
    equippedBadge: p.equippedBadge ?? '',
    equippedTheme: p.equippedTheme ?? '',
  };
}

/**
 * Connect to a Colyseus sphere room. When `serverUrl` is missing, callers should
 * skip calling this entirely and run in single-player mode. Throws if the
 * connection or initial state sync fails.
 */
export async function joinSphere(
  serverUrl: string,
  joinOpts: JoinOptions,
  callbacks: NetworkCallbacks = {},
  roomId?: string,
): Promise<NetworkSession> {
  const client = new Client(serverUrl);
  // Build the join payload — strip undefined keys so legacy servers see the
  // same shape they used to (className only) when identity fields are absent.
  const opts: Record<string, string> = { className: joinOpts.className };
  if (joinOpts.displayName) opts.displayName = joinOpts.displayName;
  if (joinOpts.equippedBadge) opts.equippedBadge = joinOpts.equippedBadge;
  if (joinOpts.equippedTheme) opts.equippedTheme = joinOpts.equippedTheme;
  if (joinOpts.userId) opts.userId = joinOpts.userId;
  // Join a specific room by code (a friend's sphere) when given one; fall back
  // to matchmaking if that room is gone/full so the player still connects.
  let room: Room;
  if (roomId) {
    try {
      room = await client.joinById(roomId, opts);
    } catch {
      room = await client.joinOrCreate('sphere', opts);
    }
  } else {
    room = await client.joinOrCreate('sphere', opts);
  }
  joinedRoomId = room.roomId;

  // Wait for the first state sync so room.state is populated.
  await new Promise<void>((resolve) => {
    room.onStateChange.once(() => resolve());
  });

  // Schema 3.x requires the getStateCallbacks helper for tree-shaking compat.
  // The state shape is opaque to the client compiler (we don't share schema types
  // between server and client yet), so cast through `any` for the callback proxy.
  // biome-ignore lint/suspicious/noExplicitAny: schema callbacks rely on dynamic typing
  const $ = getStateCallbacks(room) as any;
  const playersHandle = $(room.state).players;

  // Last emoteSeq seen per remote player. We fire onEmote only when the
  // counter advances, so a player can repeat the same glyph and still retrigger.
  const lastEmoteSeq = new Map<string, number>();

  if (playersHandle && typeof playersHandle.onAdd === 'function') {
    playersHandle.onAdd((player: PlayerSchema, sessionId: string) => {
      if (sessionId === room.sessionId) return;
      lastEmoteSeq.set(sessionId, player.emoteSeq ?? 0);
      callbacks.onJoin?.(snapshot(player));

      const playerCb = $(player);
      const fireEmote = (seq: number): void => {
        if (seq > (lastEmoteSeq.get(sessionId) ?? 0)) {
          lastEmoteSeq.set(sessionId, seq);
          if (player.emote) callbacks.onEmote?.(sessionId, player.emote);
        }
      };
      const fireUpdate = (): void => callbacks.onUpdate?.(snapshot(player));

      // Schema 3.x: per-field listen() is the reliable way to react to
      // primitive changes on a MapSchema child. Instance-level onChange has
      // been flaky for nested entries across 0.16 builds — the most likely
      // reason remote emotes never reached other clients. Keep onChange as a
      // fallback for any build where listen() is unavailable.
      const fireIdentity = (): void => callbacks.onIdentity?.(sessionId, snapshot(player));
      if (playerCb && typeof playerCb.listen === 'function') {
        playerCb.listen('emoteSeq', (seq: number) => fireEmote(seq ?? 0));
        playerCb.listen('x', fireUpdate);
        playerCb.listen('z', fireUpdate);
        playerCb.listen('rotY', fireUpdate);
        playerCb.listen('displayName', fireIdentity);
        playerCb.listen('equippedBadge', fireIdentity);
        playerCb.listen('equippedTheme', fireIdentity);
      } else if (playerCb && typeof playerCb.onChange === 'function') {
        playerCb.onChange(() => {
          fireEmote(player.emoteSeq ?? 0);
          fireUpdate();
          fireIdentity();
        });
      }
    });
    playersHandle.onRemove((_player: PlayerSchema, sessionId: string) => {
      if (sessionId === room.sessionId) return;
      lastEmoteSeq.delete(sessionId);
      callbacks.onLeave?.(sessionId);
    });
  }

  // Tether chat (PR 87) — server-routed peer-to-peer. The handlers are
  // optional so a build without tether UI is still safe.
  room.onMessage('tether-incoming', (msg: { from?: string; name?: string }) => {
    if (typeof msg?.from !== 'string') return;
    callbacks.onTetherIncoming?.({ id: msg.from, name: msg.name ?? '' });
  });
  room.onMessage('tether-accepted', (msg: { from?: string; name?: string }) => {
    if (typeof msg?.from !== 'string') return;
    callbacks.onTetherAccepted?.({ id: msg.from, name: msg.name ?? '' });
  });
  room.onMessage('tether-declined', (msg: { from?: string }) => {
    if (typeof msg?.from !== 'string') return;
    callbacks.onTetherDeclined?.(msg.from);
  });
  room.onMessage('tether-message', (msg: { from?: string; body?: string; isEmote?: boolean }) => {
    if (typeof msg?.from !== 'string' || typeof msg?.body !== 'string') return;
    callbacks.onTetherMessage?.(msg.from, msg.body, msg.isEmote === true);
  });
  room.onMessage('tether-ended', (msg: { from?: string }) => {
    if (typeof msg?.from !== 'string') return;
    callbacks.onTetherEnded?.(msg.from);
  });
  room.onMessage('tether-rejected', (msg: { reason?: string }) => {
    callbacks.onTetherRejected?.(msg?.reason ?? 'moderation');
  });

  // A newer tab for the same account just connected — the server is closing
  // this socket. Flag it so the close below doesn't trigger a reconnect loop.
  let superseded = false;
  room.onMessage('session-superseded', () => {
    superseded = true;
    callbacks.onSuperseded?.();
  });

  let intentionalLeave = false;
  room.onLeave((code: number) => {
    if (intentionalLeave) return;
    if (superseded) return; // already handled by the session-superseded message
    // The close code is the reliable signal if the message frame didn't flush.
    if (code === WS_CLOSE_SESSION_SUPERSEDED) {
      callbacks.onSuperseded?.();
      return;
    }
    callbacks.onDisconnect?.(code);
  });

  return {
    sessionId: room.sessionId,
    roomId: room.roomId,
    sendMove(x, z, rotY) {
      room.send('move', { x, z, rotY });
    },
    sendEmote(text) {
      room.send('emote', { text });
    },
    setClass(name) {
      room.send('class', { name });
    },
    sendIdentity(update) {
      // Empty object would still fan out a wire frame — skip if nothing set.
      if (
        update.displayName === undefined &&
        update.equippedBadge === undefined &&
        update.equippedTheme === undefined
      ) {
        return;
      }
      room.send('identity', update);
    },
    sendTetherRequest(target) {
      room.send('tether-request', { target });
    },
    sendTetherAccept(from) {
      room.send('tether-accept', { from });
    },
    sendTetherDecline(from) {
      room.send('tether-decline', { from });
    },
    sendTetherMessage(target, body, isEmote) {
      room.send('tether-send', { target, body, isEmote });
    },
    sendTetherLeave(target) {
      room.send('tether-leave', { target });
    },
    async dispose() {
      intentionalLeave = true;
      try {
        await room.leave(true);
      } catch {
        // ignore
      }
    },
  };
}

export function getServerUrl(): string | null {
  const url = import.meta.env.VITE_SERVER_URL;
  return typeof url === 'string' && url.length > 0 ? url : null;
}
