# 012 — Hack-QTE interruption events

## Question

What is the "you are being hacked!" interruption event? Who is attacking, what does the QTE feel like, what are the rewards and penalties?

## Answer (canon — owner Q&A 2026-06-03)

### Attacker identity

The attacker is a **rogue runner / unaffiliated griefer** — an anonymous bitrunner causing trouble in Server Space. **Not The Company**, **not The Admin**, **not a sealed entity**. This keeps the QTE tonally neutral with respect to the two faction arcs (a runner playing a Company-aligned arc shouldn't read The Company as the hacker; a runner playing the BitRunner arc shouldn't read it the other way).

The attacker is never seen, never named beyond a glitchy handle, never spoken to. They are an ambient threat that briefly punches through to your terminal.

### Trigger cadence

- Random interval, jittered between **30 and 90 seconds** of roam time.
- Scheduler runs **only when the local player is roaming** — never during a minigame (Scrape / SAMM / ThemeShop) or an active mission's final dialogue.
- Roughly one QTE every 1–2 minutes of active play. Tunable.

### Interaction

A full-screen overlay drops in with a heavy ASCII glitch border and the line:

> `:// unknown signal detected`
> `:// port breach inbound. tap to repel.`

A **4–6 glyph sequence** appears centred. The runner must **tap the glyphs in order** (NOT swipe — iOS Safari swipe handling on a composite canvas is hostile). Each tap consumes the leftmost glyph and pulses it. Time limit: **4 seconds** for the full sequence.

The glyphs are drawn from the runner's **unlocked emoticron dictionary** — single emote glyphs chosen at random, so the sequence is always recognizable. This implicitly rewards runners who've unlocked more emoticrons (more variety, less repetition).

### Success

- Brief flash, ASCII border collapses, overlay fades.
- Small reward: **+25 credits + small token chance** (10% chance of +1 token).
- Increments `profiles.hack_qte_streak`. Streak bonuses TBD — placeholder mechanic.
- Logged to `hack_qte_attempts` with `result = 'win'`.

### Failure

- Sharper ASCII glitch, "port breach: locked out" message.
- **All minigames lock for 30 seconds.** `ScrapeMenu`, `Samm`, `ThemeShop` short-circuit render and show a "// system lockout — 0:30" countdown.
- **Roam and missions remain available.** The runner can still walk the world, hit checkpoints, talk to NPCs.
- Resets `profiles.hack_qte_streak` to 0.
- Logged to `hack_qte_attempts` with `result = 'fail'`.

### Copy bank

**Pre-QTE prompt** (one randomly):
- *":// unknown signal detected. tap to repel."*
- *":// port breach inbound. clear the buffer."*
- *":// rogue handshake. authenticate or be flooded."*

**Success line** (one randomly):
- *"// signal cleared. token shard recovered."*
- *"// breach repelled. handshake invalidated."*
- *"// port locked. nice swing, runner."*

**Failure line** (one randomly):
- *"// port breach. systems locked 0:30."*
- *"// flood received. credit channels jammed 0:30."*
- *"// you blinked. minigames offline 0:30."*

## In-game implications

- New `apps/web/src/HackQTE.tsx` — full-screen overlay component, mounted in `App.tsx`.
- New `apps/web/src/lockout.ts` — single `getLockoutUntil()` + event bus subscribed by all minigames.
- New SECURITY DEFINER RPC `log_hack_qte(p_result TEXT)` — writes `hack_qte_attempts`, increments/resets `profiles.hack_qte_streak`, queues small economy grant on win via existing `economy_grants` ledger pattern.
- New `profiles.hack_qte_streak INT NOT NULL DEFAULT 0`.
- New `hack_qte_attempts(id BIGSERIAL, user_id UUID, result TEXT, created_at)` audit table.

## Open questions

- **Streak rewards**: at +5, +10 wins should there be a meaningful payout? Suggest defer until live data shows how often players win.
- **First-QTE delay**: should there be a "no QTE in your first 5 minutes of play" grace? Suggest yes; this is a gameplay-feel decision the owner can verify against post-tutorial flow.
- **Owner sign-off needed**: tap-in-order vs swipe input mode. Default = tap (mobile-safe). Flag this if owner wants swipe input despite the iOS risk.
- **Audio cue**: ship silent in v1? Audio system arrives Phase 4 per roadmap 0004.
