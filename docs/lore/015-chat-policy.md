# 015 — Chat policy (canon reversal)

## Question

Can players send each other free-text messages? The original `CLAUDE.md` rule said no.

## Answer (canon — owner decision 2026-06-03; **REVERSES the original rule**)

### What changed

Original rule (CLAUDE.md): *"No free-text input anywhere in the game."*

New rule: **Free-text proximity DM is permitted under a moderation stack.** Chat is the only surface that accepts free text — every other surface (emoticrons, usernames, etc.) remains curated.

This is a deliberate trade-off: free-text chat is valuable enough to social MMO retention to justify the moderation lift, and the BitRunners audience is small enough that a manual-review backstop remains viable.

### Where chat surfaces

**Proximity DM only.** No global chat, no chat channels, no Discord-style rooms. Two runners must be in physical proximity in the same sphere; one taps the other's avatar; a DM panel opens.

DM panel is **console-styled** (terminal aesthetic, matches Caves of Qud / `AdminConsole.tsx` look). Session-scoped history; clears on logout per owner spec.

### Moderation stack

Every DM message passes through these gates **server-side** before broadcast:

1. **Verified account gate** — sender's `profiles.dm_verified = true`. Default false. Toggled on by the owner during the sign-up flow (Sub-Phase I scope).
2. **Age gate** — sender's age confirmed >= the configured threshold (V1: 18 years old, owner can adjust).
3. **Block-list check** — sender not present in target's `profiles.dm_blocked UUID[]`. Block hides messages both directions and persists across sessions.
4. **Profanity filter** — server-side word filter (Sub-Phase I picks the library — likely `bad-words` or similar).
   - `clean` → passes through to target.
   - `flagged` (mild) → passes through but logged for owner review.
   - `blocked` (severe) → dropped, sender receives generic "// channel rejected" notice, audit-logged.
5. **Rate limit** — 30 messages / minute / pair. Exceeded → dropped + brief cooldown.

### Audit trail

Every flagged or blocked message is persisted to `dm_messages` with a `moderation` column. Owner reviews via a `DmReports` section in `AdminConsole`. `clean` messages may or may not persist — V1 ships **session-only memory** (no DB write for clean messages); a future change can flip this if the owner wants moderation playback for clean conversations too.

### Mobile UX

`DmPanel` on mobile must **not be full-viewport** — iOS Safari's soft keyboard interacts badly with full-screen canvas. Use a half-height drawer with the input box anchored to the bottom.

## In-game implications

- New `profiles.dm_verified BOOLEAN NOT NULL DEFAULT false`.
- New `profiles.dm_blocked UUID[] NOT NULL DEFAULT '{}'`.
- New `dm_messages(id, room_id, from_user, to_user, body, moderation, created_at)` audit table — primary key UUID, indexed on `(room_id, created_at)`.
- New `apps/web/src/DmPanel.tsx`, `apps/web/src/dm.ts` (session ring buffer), `apps/server/src/dm-moderation.ts`.
- Updated `apps/server/src/sphere-room.ts` `'dm'` handler runs the gate chain in order; first failure aborts.
- **`CLAUDE.md` updated** — the "No free-text input anywhere in the game" paragraph now reads "No free-text input anywhere in the game except proximity DM, which runs through the moderation stack documented in `docs/lore/015-chat-policy.md`."

## Constraints (mandatory)

- Free-text input is **only** accepted on the DM surface. Emoticrons, usernames, mission dialogue, and admin dialogue remain curated-input only.
- `dm_messages` rows are the only new persistent write at meaningful volume. Rate-limit + verified-account gate keep Supabase free tier safe. A 30-day TTL cron is a recommended follow-up.
- The moderation library version + name lands in the relevant devlog entry per `CLAUDE.md` dependency-tracking rule.

## Open questions

- **Profanity library**: `bad-words` is one option (deprecated upstream but still works). Other options: `obscenity`, `leo-profanity`. Owner to pick; Sub-Phase I records the decision.
- **Age gate threshold**: V1 ships 18+. Owner can adjust; legal counsel recommended if shipping to minors.
- **Block list cap per user**: V1 unlimited. Probably wants a cap (e.g. 256) to bound write amplification.
- **Allow voice / images?** Out of scope for V1. Sealed.
