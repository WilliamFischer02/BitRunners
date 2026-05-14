import { MapSchema, Schema, type } from '@colyseus/schema';

export class PlayerState extends Schema {
  @type('string') id = '';
  @type('string') className = 'bit_spekter';
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
  @type('number') rotY = 0;
  // Reserved fields for Phase 3 (per docs/devlog/0004 schema-reservation principle).
  // Pre-allocating now avoids breaking schema migrations later.
  @type('number') samaritanCorporate = 0;
  @type('number') samaritanBitRunner = 0;
  @type('number') factionState = 0;
  @type('number') wallet = 0;
}

export class SphereState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type('number') tickHz = 15;
}
