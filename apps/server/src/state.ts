import { MapSchema, Schema, type } from '@colyseus/schema';

export class PlayerState extends Schema {
  @type('string') id = '';
  @type('string') className = 'bit_spekter';
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
  @type('number') rotY = 0;
  // Last emoticron glyph + a monotonic counter. Clients react to emoteSeq
  // increasing (so the same glyph twice still re-triggers the bubble).
  @type('string') emote = '';
  @type('number') emoteSeq = 0;
  // Player-supplied identity (Sub-Phase B, docs/lore/010+016). Server validates
  // shape (length, charset) on the 'identity' message and stores; equipped_*
  // ownership is verified by SECURITY DEFINER RPCs server-side, so the room
  // trusts whatever the authenticated client sends here.
  @type('string') displayName = '';
  @type('string') equippedBadge = '';
  @type('string') equippedTheme = '';
  // Name-tag styling so other clients render a runner's styled name (used to
  // be local-only). Shape-validated on the 'identity' message.
  @type('string') nameWeight = '';
  @type('string') nameTint = '';
  // Runner level (= owned badge count, capped client-side at 20). Rendered as
  // "Lv N" on every player's nametag. Clamped server-side.
  @type('number') level = 0;
  // Reserved fields for Phase 3 (per docs/devlog/0004 schema-reservation principle).
  // Pre-allocating now avoids breaking schema migrations later.
  @type('number') samaritanCorporate = 0;
  @type('number') samaritanBitRunner = 0;
  @type('number') factionState = 0;
  @type('number') wallet = 0;
  // Equipped cosmetics (mega-batch 3 P3) — shop item ids, shape-validated on
  // the 'identity' message (isValidItemId, ≤32 chars). Appended fields = no
  // protocol bump (same precedent as level). Receiving clients validate the
  // ids against the shop catalog before rendering.
  @type('string') equippedHead = '';
  @type('string') equippedChest = '';
  @type('string') equippedLegs = '';
  @type('string') equippedPet = '';
  // Zone presence (mega-batch 3 P5) — 'cloud' | 'void' | 'plot:<idx>'
  // (isValidZone allowlist). Appended field = no protocol bump. Clients hide
  // remote runners whose zone differs from their own; NPCs stay 'cloud'.
  @type('string') zone = 'cloud';
  // data_base sky-grid slot (mega-batch 3 P7C) — assigned per human at join
  // (lowest free of PLOT_SLOTS), -1 for NPCs. Appended = no protocol bump.
  @type('number') plotIndex = -1;
}

export class SphereState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type('number') tickHz = 15;
}
