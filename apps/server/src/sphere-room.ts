import { TICK_HZ } from '@bitrunners/game-core';
import {
  DWELLER_ARCHETYPES,
  EMOTE_GLYPHS,
  PLATFORM_HALF,
  PLATFORM_SIZE,
  TETHER_RATE_LIMIT_PER_MIN,
  TETHER_REQUEST_RATE_LIMIT_PER_MIN,
  WS_CLOSE_SESSION_SUPERSEDED,
  clampLevel,
  isValidBadgeKey,
  isValidDisplayName,
  isValidEmote,
  isValidNameTint,
  isValidNameWeight,
  isValidTetherBody,
  isValidThemeKey,
  isValidUserId,
} from '@bitrunners/shared';
import { type Client, Room } from '@colyseus/core';
import { recordAudit } from './audit.js';
import { classifyTetherBody } from './profanity.js';
import { registerSession, unregisterSession } from './session-registry.js';
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

// Bot tether dialogue (mega-batch 4.11). Dwellers accept tether requests and
// chatter so the tether system can be smoke-tested without a second human.
// Lines are lore-safe, ASCII, and ≤ TETHER_MAX_CHARS so isValidTetherBody
// passes. Each archetype has its own voice (robot = clipped/system-y,
// husk = corroded/fragmentary, spirit = drifting/cryptic).
const BOT_LINES: Record<string, readonly string[]> = {
  'dweller.robot': [
    'PING. node online.',
    'status: nominal',
    'ack. signal clear.',
    'runtime stable.',
    'query received.',
    '// end transmission',
  ],
  'dweller.husk': [
    'co..corrupted..',
    'i was.. a runner',
    'bits.. rotting',
    'static.. so cold',
    'memory.. gone',
    '..who are you..',
  ],
  'dweller.spirit': [
    'the cloud hums',
    'do you hear it?',
    'we drift, friend',
    'tokens whisper',
    'i recall light..',
    'the space sings',
  ],
};
const BOT_ACCEPT_MIN_MS = 1500;
const BOT_ACCEPT_MAX_MS = 3000;
const BOT_SAY_MIN_MS = 8000;
const BOT_SAY_MAX_MS = 15000;

function isNpcId(id: string): boolean {
  return id.startsWith('npc:');
}
function botLinesFor(className: string): readonly string[] {
  return BOT_LINES[className] ?? BOT_LINES['dweller.robot'] ?? [];
}
function botName(className: string): string {
  return className.replace('dweller.', '');
}
function randMs(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min));
}

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
  // F1: per-sender sliding window for NEW tether-request fan-out (a flood
  //     gate distinct from the in-tether send rate). Sessions remain in the
  //     map until their window expires; cleared on disconnect.
  private requestRate = new Map<string, TetherRate>();
  // F2: sessionId → the target sessionId this sender is currently waiting
  //     on an accept/decline from. Used to reject concurrent outgoing
  //     requests (the double-accept race surfaced in the handoff).
  private pendingFrom = new Map<string, string>();
  // sessionId → authenticated user id, for the single-live-session registry.
  private userIdBySession = new Map<string, string>();
  // npcId → its pending auto-accept / active chatter timer (one per NPC, since
  // an NPC tethers at most one peer at a time). Cleared on tether end + dispose.
  private botTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
        msg: {
          displayName?: unknown;
          equippedBadge?: unknown;
          equippedTheme?: unknown;
          nameWeight?: unknown;
          nameTint?: unknown;
          level?: unknown;
        },
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
        if (msg?.nameWeight !== undefined) {
          if (msg.nameWeight === '' || isValidNameWeight(msg.nameWeight)) {
            p.nameWeight = msg.nameWeight as string;
          }
        }
        if (msg?.nameTint !== undefined) {
          if (msg.nameTint === '' || isValidNameTint(msg.nameTint)) {
            p.nameTint = msg.nameTint as string;
          }
        }
        if (msg?.level !== undefined) {
          p.level = clampLevel(msg.level);
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
      // F2: reject a second outgoing invite while the first is still in
      //     flight. Without this, two targets accepting simultaneously
      //     could both write to activeTethers and overwrite each other.
      if (this.pendingFrom.has(client.sessionId)) return;
      // F1: per-sender sliding-window flood gate. Reset on each new
      //     minute boundary so a runner can't burst-flood between checks.
      const now = Date.now();
      const slot = this.requestRate.get(client.sessionId) ?? { windowStart: now, count: 0 };
      if (now - slot.windowStart > 60_000) {
        slot.windowStart = now;
        slot.count = 0;
      }
      if (slot.count >= TETHER_REQUEST_RATE_LIMIT_PER_MIN) return;
      slot.count++;
      this.requestRate.set(client.sessionId, slot);
      this.pendingRequests.set(target, client.sessionId);
      this.pendingFrom.set(client.sessionId, target);
      // Dweller NPC target: no Client to notify — the server auto-accepts on
      // its behalf after a short randomized delay, then starts chattering.
      if (isNpcId(target)) {
        this.scheduleBot(target, randMs(BOT_ACCEPT_MIN_MS, BOT_ACCEPT_MAX_MS), () =>
          this.botAccept(target, client.sessionId),
        );
        return;
      }
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
      this.pendingFrom.delete(from);
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
      this.pendingFrom.delete(from);
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
    this.pendingFrom.delete(a);
    this.pendingFrom.delete(b);
    this.tetherRate.delete(pairKey(a, b));
    const peer = this.findClient(boundA === b ? b : a);
    if (peer && peer.sessionId !== a) {
      peer.send('tether-ended', { from: a });
    }
    // Stop any dweller chatter loop on either side.
    this.clearBot(a);
    this.clearBot(b);
  }

  // ── Bot tether dialogue (mega-batch 4.11) ─────────────────────────────────
  private scheduleBot(npcId: string, ms: number, fn: () => void): void {
    this.clearBot(npcId);
    this.botTimers.set(
      npcId,
      setTimeout(() => {
        this.botTimers.delete(npcId);
        fn();
      }, ms),
    );
  }

  private clearBot(npcId: string): void {
    const t = this.botTimers.get(npcId);
    if (t) {
      clearTimeout(t);
      this.botTimers.delete(npcId);
    }
  }

  /** Server-side accept on behalf of an NPC. Re-checks the handshake is still
   *  valid (the requester may have cancelled / left in the meantime). */
  private botAccept(npcId: string, requesterId: string): void {
    if (this.pendingRequests.get(npcId) !== requesterId) return; // cancelled
    if (!this.state.players.has(npcId)) return; // npc gone
    const requester = this.findClient(requesterId);
    if (!requester) {
      // requester left before we accepted — drop the pending handshake
      this.pendingRequests.delete(npcId);
      this.pendingFrom.delete(requesterId);
      return;
    }
    this.pendingRequests.delete(npcId);
    this.pendingFrom.delete(requesterId);
    this.activeTethers.set(npcId, requesterId);
    this.activeTethers.set(requesterId, npcId);
    const npc = this.state.players.get(npcId);
    requester.send('tether-accepted', {
      from: npcId,
      name: botName(npc?.className ?? 'dweller.robot'),
    });
    // Start the chatter loop.
    this.scheduleBot(npcId, randMs(BOT_SAY_MIN_MS, BOT_SAY_MAX_MS), () =>
      this.botSay(npcId, requesterId),
    );
  }

  /** Emit one lore-safe line from the NPC, then reschedule. Stops when the
   *  tether is gone or the peer has left. */
  private botSay(npcId: string, requesterId: string): void {
    if (this.activeTethers.get(npcId) !== requesterId) return; // tether ended
    const requester = this.findClient(requesterId);
    if (!requester) {
      this.endTether(npcId, requesterId);
      return;
    }
    const npc = this.state.players.get(npcId);
    const pool = botLinesFor(npc?.className ?? 'dweller.robot');
    const body = pool[Math.floor(Math.random() * pool.length)];
    if (body && isValidTetherBody(body)) {
      requester.send('tether-message', { from: npcId, body, isEmote: false });
    }
    this.scheduleBot(npcId, randMs(BOT_SAY_MIN_MS, BOT_SAY_MAX_MS), () =>
      this.botSay(npcId, requesterId),
    );
  }

  /** Kick a stale client whose account just connected from a newer tab.
   *  Sends a notice first so the client can show a "session moved" overlay and
   *  suppress its auto-reconnect, then closes with the superseded code. */
  private supersedeClient(client: Client): void {
    try {
      client.send('session-superseded', {});
    } catch {
      // socket may already be closing — the close code below still informs it
    }
    try {
      client.leave(WS_CLOSE_SESSION_SUPERSEDED);
    } catch {
      // already gone
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
          nameWeight?: string;
          nameTint?: string;
          level?: number;
          userId?: string;
        }
      | undefined,
  ): void {
    // Single live session per account: if this user already has a live
    // connection (this or another sphere), supersede the older one so it
    // stops haunting its room as an AFK ghost.
    if (isValidUserId(options?.userId)) {
      const userId = options.userId;
      this.userIdBySession.set(client.sessionId, userId);
      const previous = registerSession(userId, {
        sessionId: client.sessionId,
        supersede: () => this.supersedeClient(client),
      });
      if (previous) previous.supersede();
    }

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
    if (options?.nameWeight && isValidNameWeight(options.nameWeight)) {
      p.nameWeight = options.nameWeight;
    }
    if (options?.nameTint && isValidNameTint(options.nameTint)) {
      p.nameTint = options.nameTint;
    }
    if (options?.level !== undefined) {
      p.level = clampLevel(options.level);
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
        this.pendingFrom.delete(requester);
        // Cancel a pending NPC auto-accept whose requester just left.
        if (isNpcId(target)) this.clearBot(target);
        const survivor = this.findClient(target === client.sessionId ? requester : target);
        if (survivor) {
          survivor.send('tether-declined', { from: client.sessionId });
        }
      }
    }
    this.pendingFrom.delete(client.sessionId);
    this.requestRate.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.lastSeen.delete(client.sessionId);
    // Release the single-session registry slot — but only if this client is
    // still the live one (a session that was superseded must not evict the
    // newer connection when it finally closes).
    const userId = this.userIdBySession.get(client.sessionId);
    if (userId) {
      this.userIdBySession.delete(client.sessionId);
      unregisterSession(userId, client.sessionId);
    }
  }

  override onDispose(): void {
    // Clear any outstanding dweller-chatter timers so a disposed room leaves
    // no dangling callbacks.
    for (const t of this.botTimers.values()) clearTimeout(t);
    this.botTimers.clear();
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
