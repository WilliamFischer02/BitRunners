// In-memory moderation audit ring buffer.
//
// Per chat-policy V1 (docs/lore/015-chat-policy.md):
//   "Every flagged or blocked message is persisted to `dm_messages` with a
//    `moderation` column."
//
// Persistence to Supabase requires the server to gain Supabase-client
// integration, which it does not have today. As an interim we keep the
// last AUDIT_CAP events in memory and expose them via the Fastify route
// `/audit/recent` (token-protected). Fly auto-stops after idle, so the
// ring is naturally cleared on cold-start — acceptable for V1 while the
// owner reviews the chat surface during alpha. A follow-up wires the
// SQL persistence + admin queue.

import type { Moderation } from './profanity.js';

export interface AuditEvent {
  /** Server-wall-clock at the time the message was classified. */
  ts: number;
  /** Sphere room id where it happened. */
  roomId: string;
  fromSessionId: string;
  toSessionId: string;
  /** Sender's displayName at the time of the message (denormalized snapshot). */
  fromName: string;
  /** Raw body — at most TETHER_MAX_CHARS (25). */
  body: string;
  isEmote: boolean;
  moderation: Moderation;
  /** Matched word that triggered the classification, if any. */
  match: string | null;
}

const AUDIT_CAP = 200;
let ring: AuditEvent[] = [];

export function recordAudit(event: AuditEvent): void {
  if (event.moderation === 'clean') return;
  ring.push(event);
  if (ring.length > AUDIT_CAP) ring = ring.slice(-AUDIT_CAP);
}

export function recentAudit(limit = AUDIT_CAP): AuditEvent[] {
  const n = Math.max(1, Math.min(limit, AUDIT_CAP));
  return ring.slice(-n);
}

export function clearAudit(): void {
  ring = [];
}
