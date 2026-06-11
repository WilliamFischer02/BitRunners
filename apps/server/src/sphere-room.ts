import { TICK_HZ } from '@bitrunners/game-core';
import {
  DWELLER_ARCHETYPES,
  EMOTE_GLYPHS,
  PLATFORM_HALF,
  PLATFORM_SIZE,
  TETHER_RATE_LIMIT_PER_MIN,
  isValidBadgeKey,
  isValidDisplayName,
  isValidEmote,
  isValidTetherBody,
  isValidThemeKey,
} from '@bitrunners/shared';
import { type Client, Room } from '@colyseus/core';
import { recordAudit } from './audit.js';
import { classifyTetherBody } from './profanity.js';
import { PlayerState, SphereState } from './state.js';

interface MoveMessage {
  x: number;
  z: number;
  rotY: number;
}

const MAX_HUMANS = 40;
const TICK_MS = 1000 / TICK_HZ;

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

// Random spawn for a newly-joined human player: random angle, radius in
// [SPAWN_RADIUS_MIN, SPAWN_RADIUS_MAX] world units from origin. Keeps
// newcomers near the spawn ring without stacking exactly on top of each
// other or on top of the existing center decor (obelisk at (5.5, 5.5),
// SAMM at (6.0, -5.5), terminal at (-5.5, 6.5), port at (-6.5, -6.5)
// are all >= 5 units from origin, so a [1.5, 4.0] ring never collides).
const SPAWN_RADIUS_MIN = 1.5;
const SPAWN_RADIUS_MAX = 4.0;
function randomSpawn(): { x: number; z: number } {
  const angle = Math.random() * Math.PI * 2;
  const radius = SPAWN_RADIUS_MIN + Math.random() * (SPAWN_RADIUS_MAX - SPAWN_RADIUS_MIN);
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}

interface Npc {
  id: string;
  tx: number;
  tz: number;
  emoteAt: number;
}

// Tether chat state per sphere. activeTethers maps each engaged sessionId to
// its peer's sessionId (one entry per side, so lookups are O(1) from either
// end). pendingRequests maps target → requester so accept/decline can
// validate the handshake. tetherRate is a sliding window per (a,b) pair.
interface TetherRate {
  windowStart: number;
  count: number;
}
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export class SphereRoom extends Room<SphereState> {
  override maxClients = MAX_HUMANS;
  private lastSeen = new Map<string, number>();
  private npcs: Npc[] = [];
  private lastTickAt = Date.now();
  private activeTethers = new Map<string, string>();
  private pendingRequests = new Map<string, string>();
  private tetherRate = new Map<string, TetherRate>();

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

    // Identity update (Sub-Phase B). Client sends on join + whenever the local
    // user changes their displayName / badge / theme. Ownership of
    // equippedBadge / equippedTheme is enforced server-side by the SECURITY
    // DEFINER RPCs (equip_badge, purchase_theme) that the client called BEFORE
    // sending this message — so we only shape-validate here, then store.
    // Empty string = clear (NULL on the DB side).
    this.onMessage(
      'identity',
      (
        client: Client,
        msg: { displayName?: unknown; equippedBadge?: unknown; equippedTheme?: unknown },
      ) => {
        this.lastSeen.set(client.sessionId, Date.now());
        const p = this.state.players.get(client.sessionId);
        if (!p) return;
        if (msg?.displayName !== undefined) {
          if (msg.displayName === '' || isValidDisplayName(msg.displayName)) {
            p.displayName = msg.displayName as string;
          }
        }
        if (msg?.equippedBadge !== undefined) {
          if (msg.equippedBadge === '' || isValidBadgeKey(msg.equippedBadge)) {
            p.equippedBadge = msg.equippedBadge as string;
          }
        }
        if (msg?.equippedTheme !== undefined) {
          if (msg.equippedTheme === '' || isValidThemeKey(msg.equippedTheme)) {
            p.equippedTheme = msg.equippedTheme as string;
          }
        }
      },
    );

    // ── Tether chat (PR 87) ────────────────────────────────────────────────
    // Server routes the 5 tether messages between exactly two consenting
    // peers and enforces shape + rate limit. Heavy moderation (profanity,
    // block list, audit log) is a follow-up — this is the minimum bar.

    this.onMessage('tether-request', (client: Client, msg: { target?: unknown }) => {
      this.lastSeen.set(client.sessionId, Date.now());
      const target = typeof msg?.target === 'string' ? msg.target : '';
      if (!target || target === client.sessionId) return;
      if (!this.state.players.has(target)) return;
      // Drop if either party is already tethered or has a pending request.
      if (this.activeTethers.has(client.sessionId)) return;
      if (this.activeTethers.has(target)) return;
      if (this.pendingRequests.has(target)) return;
      this.pendingRequests.set(target, client.sessionId);
      const me = this.state.players.get(client.sessionId);
      const peer = this.findClient(target);
      if (peer) {
        peer.send('tether-incoming', {
          from: client.sessionId,
          name: me?.displayName ?? '',
        });
      }
    });

    this.onMessage('tether-accept', (client: Client, msg: { from?: unknown }) => {
      this.lastSeen.set(client.sessionId, Date.now());
      const from = typeof msg?.from === 'string' ? msg.from : '';
      const expected = this.pendingRequests.get(client.sessionId);
      if (!from || from !== expected) return;
      this.pendingRequests.delete(client.sessionId);
      this.activeTethers.set(client.sessionId, from);
      this.activeTethers.set(from, client.sessionId);
      const me = this.state.players.get(client.sessionId);
      const requester = this.findClient(from);
      if (requester) {
        requester.send('tether-accepted', {
          from: client.sessionId,
          name: me?.displayName ?? '',
        });
      }
    });

    this.onMessage('tether-decline', (client: Client, msg: { from?: unknown }) => {
      this.lastSeen.set(client.sessionId, Date.now());
      const from = typeof msg?.from === 'string' ? msg.from : '';
      const expected = this.pendingRequests.get(client.sessionId);
      if (!from || from !== expected) return;
      this.pendingRequests.delete(client.sessionId);
      const requester = this.findClient(from);
      if (requester) {
        requester.send('tether-declined', { from: client.sessionId });
      }
    });

    this.onMessage(
      'tether-send',
      (client: Client, msg: { target?: unknown; body?: unknown; isEmote?: unknown }) => {
        this.lastSeen.set(client.sessionId, Date.now());
        const target = typeof msg?.target === 'string' ? msg.target : '';
        if (!target) return;
        // Only deliver to the bound peer — drop attempts to spray messages.
        const bound = this.activeTethers.get(client.sessionId);
        if (!bound || bound !== target) return;
        if (!isValidTetherBody(msg?.body)) return;
        const isEmote = msg?.isEmote === true;
        const body = msg.body as string;

        // Sliding-window rate limit per pair. Resets on each new minute boundary
        // so a runner can't burst-flood between checks.
        const key = pairKey(client.sessionId, target);
        const now = Date.now();
        const slot = this.tetherRate.get(key) ?? { windowStart: now, count: 0 };
        if (now - slot.windowStart > 60_000) {
          slot.windowStart = now;
          slot.count = 0;
        }
        if (slot.count >= TETHER_RATE_LIMIT_PER_MIN) return;
        slot.count++;
        this.tetherRate.set(key, slot);

        // Moderation gate — classify, audit, and route per outcome.
        // Emote glyphs short-circuit to 'clean' inside classifyTetherBody.
        const verdict = classifyTetherBody(body, isEmote);
        if (verdict.moderation !== 'clean') {
          const sender = this.state.players.get(client.sessionId);
          recordAudit({
            ts: now,
            roomId: this.roomId,
            fromSessionId: client.sessionId,
            toSessionId: target,
            fromName: sender?.displayName ?? '',
            body,
            isEmote,
            moderation: verdict.moderation,
            match: verdict.match,
          });
        }
        if (verdict.moderation === 'blocked') {
          // Sender gets a generic notice; no leak about which word matched.
          client.send('tether-rejected', { reason: 'moderation' });
          return;
        }

        const peer = this.findClient(target);
        if (peer) {
          peer.send('tether-message', {
            from: client.sessionId,
            body,
            isEmote,
          });
        }
      },
    );

    this.onMessage('tether-leave', (client: Client, msg: { target?: unknown }) => {
      this.lastSeen.set(client.sessionId, Date.now());
      const target = typeof msg?.target === 'string' ? msg.target : '';
      if (!target) return;
      this.endTether(client.sessionId, target);
    });
  }

  /** Look up a live Client by sessionId. Linear scan, but `clients` is small
   *  (≤ MAX_HUMANS = 40). Returns null if the peer has already disconnected. */
  private findClient(sessionId: string): Client | null {
    for (const c of this.clients) {
      if (c.sessionId === sessionId) return c;
    }
    return null;
  }

  /** Tear down a tether from either side. Notifies the surviving peer with
   *  'tether-ended' so the chat overlay closes cleanly. Also wipes any
   *  pending-request entries that referenced either side. */
  private endTether(a: string, b: string): void {
    const boundA = this.activeTethers.get(a);
    const boundB = this.activeTethers.get(b);
    if (boundA === b) this.activeTethers.delete(a);
    if (boundB === a) this.activeTethers.delete(b);
    this.pendingRequests.delete(a);
    this.pendingRequests.delete(b);
    this.tetherRate.delete(pairKey(a, b));
    const peer = this.findClient(boundA === b ? b : a);
    if (peer && peer.sessionId !== a) {
      peer.send('tether-ended', { from: a });
    }
  }

  override onJoin(
    client: Client,
    options:
      | {
          className?: string;
          displayName?: string;
          equippedBadge?: string;
          equippedTheme?: string;
        }
      | undefined,
  ): void {
    const p = new PlayerState();
    p.id = client.sessionId;
    if (options?.className && options.className.length <= 32) {
      p.className = options.className;
    }
    if (options?.displayName && isValidDisplayName(options.displayName)) {
      p.displayName = options.displayName;
    }
    if (options?.equippedBadge && isValidBadgeKey(options.equippedBadge)) {
      p.equippedBadge = options.equippedBadge;
    }
    if (options?.equippedTheme && isValidThemeKey(options.equippedTheme)) {
      p.equippedTheme = options.equippedTheme;
    }
    // Scatter spawn coords so newcomers don't all stack at (0,0). The
    // PlayerState schema defaults x/z to 0; without this every avatar
    // remains at origin until the client's first 'move' message arrives,
    // and any tab that goes idle stays there.
    const spawn = randomSpawn();
    p.x = spawn.x;
    p.z = spawn.z;
    this.state.players.set(client.sessionId, p);
    this.lastSeen.set(client.sessionId, Date.now());
  }

  override onLeave(client: Client): void {
    // Phase 2: snapshot to Upstash with aether TTL before removing.
    const bound = this.activeTethers.get(client.sessionId);
    if (bound) this.endTether(client.sessionId, bound);
    // Also notify anyone who had a pending invite to this client, since
    // accept/decline against a gone target would silently no-op otherwise.
    for (const [target, requester] of this.pendingRequests) {
      if (target === client.sessionId || requester === client.sessionId) {
        this.pendingRequests.delete(target);
        const survivor = this.findClient(target === client.sessionId ? requester : target);
        if (survivor) {
          survivor.send('tether-declined', { from: client.sessionId });
        }
      }
    }
    this.state.players.delete(client.sessionId);
    this.lastSeen.delete(client.sessionId);
  }

  private spawnNpcs(): void {
    for (let i = 0; i < NPC_COUNT; i++) {
      const id = `npc:${i}`;
      const p = new PlayerState();
      p.id = id;
      // Cycle dweller archetypes so each spawned NPC has a distinct silhouette
      // on the client (dweller.robot | dweller.husk | dweller.spirit). With
      // NPC_COUNT=4 the cycle is robot,husk,spirit,robot — still mixed.
      p.className = DWELLER_ARCHETYPES[i % DWELLER_ARCHETYPES.length] ?? 'dweller.robot';
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
