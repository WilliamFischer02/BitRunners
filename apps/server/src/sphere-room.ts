import { TICK_HZ } from '@bitrunners/game-core';
import { type Client, Room } from '@colyseus/core';
import { PlayerState, SphereState } from './state.js';

interface MoveMessage {
  x: number;
  z: number;
  rotY: number;
}

const MAX_HUMANS = 40;
const TICK_MS = 1000 / TICK_HZ;
const PLATFORM_HALF = 9.5;
const PLATFORM_SIZE = PLATFORM_HALF * 2;

function wrapAxis(v: number): number {
  if (v > PLATFORM_HALF) return v - PLATFORM_SIZE;
  if (v < -PLATFORM_HALF) return v + PLATFORM_SIZE;
  return v;
}

export class SphereRoom extends Room<SphereState> {
  override maxClients = MAX_HUMANS;

  override onCreate(_options: unknown): void {
    this.state = new SphereState();
    this.state.tickHz = TICK_HZ;

    this.setSimulationInterval(() => this.tick(), TICK_MS);

    this.onMessage('move', (client: Client, msg: MoveMessage) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (typeof msg?.x !== 'number' || typeof msg?.z !== 'number') return;
      p.x = wrapAxis(msg.x);
      p.z = wrapAxis(msg.z);
      p.rotY = typeof msg.rotY === 'number' ? msg.rotY : p.rotY;
    });

    this.onMessage('class', (client: Client, msg: { name?: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (typeof msg?.name === 'string' && msg.name.length <= 32) {
        p.className = msg.name;
      }
    });
  }

  override onJoin(client: Client, options: { className?: string } | undefined): void {
    const p = new PlayerState();
    p.id = client.sessionId;
    if (options?.className && options.className.length <= 32) {
      p.className = options.className;
    }
    this.state.players.set(client.sessionId, p);
  }

  override onLeave(client: Client): void {
    // Phase 2: snapshot to Upstash with aether TTL before removing.
    this.state.players.delete(client.sessionId);
  }

  private tick(): void {
    // Reserved for: NPC movement, server-side ambient drift, aether spawn on stale disconnects.
  }
}
