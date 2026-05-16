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
}

export interface NetworkCallbacks {
  onJoin?(p: RemotePlayer): void;
  onLeave?(id: string): void;
  onUpdate?(p: RemotePlayer): void;
  onEmote?(id: string, text: string): void;
}

export interface NetworkSession {
  sessionId: string;
  sendMove(x: number, z: number, rotY: number): void;
  sendEmote(text: string): void;
  setClass(name: string): void;
  dispose(): Promise<void>;
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
  };
}

/**
 * Connect to a Colyseus sphere room. When `serverUrl` is missing, callers should
 * skip calling this entirely and run in single-player mode. Throws if the
 * connection or initial state sync fails.
 */
export async function joinSphere(
  serverUrl: string,
  className: string,
  callbacks: NetworkCallbacks = {},
): Promise<NetworkSession> {
  const client = new Client(serverUrl);
  const room: Room = await client.joinOrCreate('sphere', { className });

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
      if (playerCb && typeof playerCb.onChange === 'function') {
        playerCb.onChange(() => {
          const seq = player.emoteSeq ?? 0;
          if (seq > (lastEmoteSeq.get(sessionId) ?? 0)) {
            lastEmoteSeq.set(sessionId, seq);
            if (player.emote) callbacks.onEmote?.(sessionId, player.emote);
          }
          callbacks.onUpdate?.(snapshot(player));
        });
      }
    });
    playersHandle.onRemove((_player: PlayerSchema, sessionId: string) => {
      if (sessionId === room.sessionId) return;
      lastEmoteSeq.delete(sessionId);
      callbacks.onLeave?.(sessionId);
    });
  }

  return {
    sessionId: room.sessionId,
    sendMove(x, z, rotY) {
      room.send('move', { x, z, rotY });
    },
    sendEmote(text) {
      room.send('emote', { text });
    },
    setClass(name) {
      room.send('class', { name });
    },
    async dispose() {
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
