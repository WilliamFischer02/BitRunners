# 0039 — Sprint roadmap + Chunk A (bug fix + polish)

**Date:** 2026-05-19
**Branch:** `claude/bitrunners-collaboration-EcqBv`

Owner queued a large batch of new work. Broke it into 5 mergeable chunks and
locked 4 design forks via Q&A (recorded in `.claude/decisions.md`). This entry
is the durable roadmap **and** the Chunk A changelog.

## Roadmap (proceed item by item)

- **Chunk A — bug + polish** *(this devlog)*: emote-sync fix · emote backdrop ·
  no-highlight on clicker · menu spacing · SCRAPE green-glow + circuit tendrils.
- **Chunk B — shop & rig**: wire `scene.ts`→`appearance.ts` (primitive
  recolor/scale gear on the bit_spekter rig) · 3 starter pets · catalog
  expansion · shop aesthetic.
- **Chunk C — vending NPC**: new sentient NPC (gambling pulls; Credits in,
  Credits common / items rare / **Tokens rarest but hard-locked behind the
  proxy-wallet** — canon-safe). *Gated on a name/personality lore Q&A.*
- **Chunk D — trade offers**: NPC offer model + review/accept UI **on the
  existing depots/ports** (no new world objects).
- **Chunk E — tutorial + 2nd class**: first-play detector · guided step machine
  (inventory → shop → scrape loop → world nav → tour to the obelisk) · reworked
  Admin opening dialogue · unlock **server_speaker**.

### Q&A decisions locked (sprint planning)

1. Vending machine = **new sentient NPC** (lore Q&A pending for its name);
   Tokens may drop but stay **hard-locked behind proxy-wallet** (canon: bit_spekter
   has no wallet).
2. Trade offers reviewed/accepted at **existing depots/ports** — no new world
   buildings.
3. Tutorial completion unlocks **server_speaker** (origin lore already in
   `003-classes-origins.md`; just needs unlock plumbing).
4. Clothing/pets render via **primitive recolor/scale** from the existing
   `visual` descriptors — first pass, no commissioned art.

## Chunk A — what shipped

- **Multiplayer emote regression.** Root-cause read: the receive path used
  instance-level `$(player).onChange` on a MapSchema child, which is unreliable
  across Colyseus 0.16 / schema 3.x builds — the likely reason remote emotes
  never reached other clients. **Not a regression** (this code is unchanged
  since it first shipped in `b6d34fb`). Switched to per-field `listen()`
  (`emoteSeq` → emote bubble; `x`/`z`/`rotY` → movement), with `onChange` kept
  as a fallback. Added a tagged `console.info` on emote receive so it's
  diagnosable in the field. **Client-only — no server change → Pages-only
  deploy, no Fly.** (Send path + server validation were already correct.)
- **Emote backdrop.** `.emote-float` now has a bordered translucent box so it
  reads over the scene. Additive (no transform change → rise/fade intact);
  applies to local + remote bubbles.
- **No-highlight.** `user-select:none` + `-webkit-touch-callout:none` +
  transparent tap-highlight on the scrape panel/launchers; `touch-action:
  manipulation` on the SCRAPE button. Kills the iOS text-select on fast taps.
- **Menu spacing.** Roomier emote wheel (118/138 → 150px, 126px on phones) so
  the four buttons + centre inv aren't cramped; more right-rail breathing room.
- **SCRAPE press flourish.** Green radial glow + masked circuit-trace tendril
  layer behind the button, flashing on press (`.scrape-glow`, keyed to the
  existing `pressed` state). Reduced-motion safe.

## Honest status

- Gates green: `pnpm lint` clean (44 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.
- **Emote fix is NOT verifiable headless** — it needs a real 2-client test.
  To confirm on the Pages preview: open two browsers, emote in one, watch the
  other; the receiving tab's devtools console logs `[bitrunners] remote emote …`
  when a remote emote arrives. If nothing logs, the break is send/server, not
  receive — the log tells us which.
- **Menu spacing + glow are un-eyeballed** (headless). Tune on the preview.
- The press glow keys off the manual-tap `pressed` state; hold/auto-scrape
  don't glow yet (deliberate first pass).

## Files

`apps/web/src/network.ts` (listen-based receive), `apps/web/src/scene.ts`
(emote diagnostic), `apps/web/src/ScrapeMenu.tsx` (`.scrape-glow` element),
`apps/web/src/style.css` (backdrop, no-highlight, spacing, glow), this devlog,
`.claude/decisions.md`, `.claude/handoff.md`.
