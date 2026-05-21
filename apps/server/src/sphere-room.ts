import { TICK_HZ } from '@bitrunners/game-core';
import { EMOTE_GLYPHS, isValidEmote } from '@bitrunners/shared';
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

// Disconnect a client we've heard NOTHING from for this long. A live client
// sends 'move' every tick (~15 Hz) even when standing still, so silence means
// the socket is dead/frozen/backgrounded — not "playing the clicker without
// moving". Clears ghost avatars well before the slow TCP timeout would.
const IDLE_TIMEOUT_MS = 120_000;

// Ambient NPCs per sphere so rooms never feel empty (capacity allows 10).
const NPC_COUNT = 4;
const NPC_SPEED = 2.2; // units / second
const NPC_GLYPHS = Object.values(EMOTE_GLYPHS);

function wrapAxis(v: number): number {
  if (v > PLATFORM_HALF) return v - PLATFORM_SIZE;
  if (v < -PLATFORM_HALF) return v + PLATFORM_SIZE;
  return v;
}

function randCoord(): number {
  return (Math.random() * 2 - 1) * PLATFORM_HALF;
}

interface Npc {
  id: string;
  tx: number;
  tz: number;
  emoteAt: number;
}

export class SphereRoom extends Room<SphereState> {
  override maxClients = MAX_HUMANS;
  private lastSeen = new Map<string, number>();
  private npcs: Npc[] = [];
  private lastTickAt = Date.now();

  override onCreate(_options: unknown): void {
    this.state = new SphereState();
    this.state.tickHz = TICK_HZ;
    this.spawnNpcs();

    this.setSimulationInterval(() => this.tick(), TICK_MS);

    this.onMessage('move', (client: Client, msg: MoveMessage) => {
      this.lastSeen.set(client.sessionId, Date.now());
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (typeof msg?.x !== 'number' || typeof msg?.z !== 'number') return;
      p.x = wrapAxis(msg.x);
      p.z = wrapAxis(msg.z);
      p.rotY = typeof msg.rotY === 'number' ? msg.rotY : p.rotY;
    });

    this.onMessage('emote', (client: Client, msg: { text?: unknown }) => {
      this.lastSeen.set(client.sessionId, Date.now());
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      // Allowlist only — rejects free-text / tampered clients (moderation rule).
      if (!isValidEmote(msg?.text)) return;
      p.emote = msg.text;
      p.emoteSeq++;
    });

    this.onMessage('class', (client: Client, msg: { name?: string }) => {
      this.lastSeen.set(client.sessionId, Date.now());
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
    this.lastSeen.set(client.sessionId, Date.now());
  }

  override onLeave(client: Client): void {
    // Phase 2: snapshot to Upstash with aether TTL before removing.
    this.state.players.delete(client.sessionId);
    this.lastSeen.delete(client.sessionId);
  }

  private spawnNpcs(): void {
    for (let i = 0; i < NPC_COUNT; i++) {
      const id = `npc:${i}`;
      const p = new PlayerState();
      p.id = id;
      p.x = randCoord();
      p.z = randCoord();
      this.state.players.set(id, p);
      this.npcs.push({
        id,
        tx: randCoord(),
        tz: randCoord(),
        emoteAt: Date.now() + 4000 + Math.random() * 8000,
      });
    }
  }

  private tick(): void {
    const now = Date.now();
    const dt = Math.min((now - this.lastTickAt) / 1000, 0.5);
    this.lastTickAt = now;

    // Idle sweep: kick clients that have gone silent (collect first, then leave
    // so we don't mutate this.clients mid-iteration).
    const stale: Client[] = [];
    for (const client of this.clients) {
      if (now - (this.lastSeen.get(client.sessionId) ?? now) > IDLE_TIMEOUT_MS) {
        stale.push(client);
      }
    }
    for (const client of stale) {
      client.leave(1000);
    }

    // NPC wander + occasional emote, so a sphere imitates an active room.
    for (const npc of this.npcs) {
      const p = this.state.players.get(npc.id);
      if (!p) continue;
      const dx = npc.tx - p.x;
      const dz = npc.tz - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.3) {
        npc.tx = randCoord();
        npc.tz = randCoord();
      } else {
        const step = Math.min(NPC_SPEED * dt, dist);
        p.x = wrapAxis(p.x + (dx / dist) * step);
        p.z = wrapAxis(p.z + (dz / dist) * step);
        p.rotY = Math.atan2(dx, dz);
      }
      if (now >= npc.emoteAt) {
        const glyph = NPC_GLYPHS[Math.floor(Math.random() * NPC_GLYPHS.length)];
        if (glyph) {
          p.emote = glyph;
          p.emoteSeq++;
        }
        npc.emoteAt = now + 8000 + Math.random() * 14000;
      }
    }
  }
}
