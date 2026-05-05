import { TICK_HZ } from '@bitrunners/game-core';
import { PROTOCOL_VERSION } from '@bitrunners/shared';

export const SERVER_INFO = {
  protocol: PROTOCOL_VERSION,
  tickHz: TICK_HZ,
} as const;
