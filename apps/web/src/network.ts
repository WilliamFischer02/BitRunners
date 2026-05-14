import { Client, type Room } from 'colyseus.js';

export interface RemotePlayer {
  id: string;
  className: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
}

export interface NetworkCallbacks {
  onJoin?(p: RemotePlayer): void;
  onLeave?(id: string): void;
  onUpdate?(p: RemotePlayer): void;
}

export interface NetworkSession {
  sessionId: string;
  sendMove(x: number, z: number, rotY: number): void;
  setClass(name: string): void;
  dispose(): Promise<void>;
}

interface PlayerLike {
  id: string;
  className: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  onChange?: (cb: () => void) => void;
}

function snapshot(p: PlayerLike): RemotePlayer {
  return { id: p.id, className: p.className, x: p.x, y: p.y, z: p.z, rotY: p.rotY };
}

/**
 * Connect to a Colyseus sphere room. Pass the server URL — when missing, callers
 * should skip calling this entirely and run in single-player mode.
 */
export async function joinSphere(
  serverUrl: string,
  className: string,
  callbacks: NetworkCallbacks = {},
): Promise<NetworkSession> {
  const client = new Client(serverUrl);
  const room: Room = await client.joinOrCreate('sphere', { className });

  // Subscribe to the players map. Schema callbacks API varies slightly across
  // @colyseus/schema versions; we use the generic state.players.onAdd/.onRemove
  // pattern that has been stable since 0.15.
  const players = (room.state as { players: Map<string, PlayerLike> }).players;

  if (typeof (players as unknown as { onAdd?: unknown }).onAdd === 'function') {
    (players as unknown as { onAdd: (cb: (p: PlayerLike, id: string) => void) => void }).onAdd(
      (p, id) => {
        if (id === room.sessionId) return;
        callbacks.onJoin?.(snapshot(p));
        if (typeof p.onChange === 'function') {
          p.onChange(() => callbacks.onUpdate?.(snapshot(p)));
        }
      },
    );
  }
  if (typeof (players as unknown as { onRemove?: unknown }).onRemove === 'function') {
    (
      players as unknown as { onRemove: (cb: (_p: PlayerLike, id: string) => void) => void }
    ).onRemove((_p, id) => {
      if (id === room.sessionId) return;
      callbacks.onLeave?.(id);
    });
  }

  return {
    sessionId: room.sessionId,
    sendMove(x, z, rotY) {
      room.send('move', { x, z, rotY });
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
