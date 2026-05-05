# 006 — The runner lifecycle: upload, login, logout, aether

## Questions covered

- B. Where do runners come from?
- C. What happens at logout / disconnect?

## Answer (canon)

### Upload (account creation)

A new player creates a **virtual scan** of themselves and uploads it into **Server Space** (`server-env.space`). The player IRL is the **external operator**, but they are *plugged in*: their mind is already digital, and signing in is just **connecting** to a server they're already part of.

This frames the IRL/in-game boundary as **physical-to-digital tethering**, not a leap of consciousness. The player isn't "becoming" a runner — they're **already** a runner, and login plugs them back in.

### Login (each session)

Player connects → arrives in the Cloud → prompted to **select a class** (see `003-classes-origins.md`). Class persists for the session.

### Logout / disconnect — "Imposed aether"

When a player goes offline, the Env **reclaims** the runner to stay alive. **Logout is imposed, not voluntary.** The Cloud needs the runner's energy/data to keep itself running for those who remain.

Felt experience:
- Logging out **hurts a bit** for the digital body.
- The runner's body **dissolves into aether** — a passive drifting decorative entity in the world (see `CLAUDE.md` "Offline-as-aether").
- IRL: the disconnect tugs the player's physical body back toward the Cloud. There's a low-grade pull to return.

This is **sinister-leaning** but not malicious — the Cloud is feeding off the runner because it has to, not because it wants to harm them. Like dialysis, not vampirism.

### Aether

Mechanically: a passive drifting NPC representation of the offline runner. Snapshot of last outfit + position. Stored in Redis with TTL.

Lore-wise: the runner's body has been *partially absorbed* into the Cloud's substrate. When they log back in, the aether is reconstituted into a full runner.

## In-game implications

- **Login UX**: present as "connecting" / "plug in" language, not "creating" or "spawning". The runner already exists.
- **Logout UX**: brief glitch-ASCII transition (matches `01-ascii-glitch-face` reference). Slightly uncomfortable, *not* celebratory. No "see you tomorrow!" cheer.
- **Aether visuals**: runner's last outfit is preserved but de-saturated, drifting, semi-transparent in glyph density.
- **Onboarding** must explain (gently) that logging out has a cost — sets up the "you'll feel pulled to come back" hook without being manipulative.
- **Ethics flag**: "draw the physical body to return when not playing" is strong language. We should design the loop to be compelling but **not coercive**. No streak-shame, no fear-of-missing-out timers, no aggressive notifications. The lore says the pull is *imposed* in-fiction, but the actual product must respect the player's time. Lore color, not retention dark pattern.

## Open questions

- Does the aether persist forever, or is there a TTL after which it fully dissolves? (Engineering: Redis TTL is the lever; lore: how long does the Cloud "hold onto" a missing runner?)
- Can other players interact with an aether (touch, harvest, decorate)?
- When a runner logs back in, do they spawn at the aether's drift position, or at a fixed reentry point?
