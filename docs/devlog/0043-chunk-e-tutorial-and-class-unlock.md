# 0043 — Chunk E: first-play tutorial + server_speaker unlock

**Date:** 2026-05-21
**Branch:** `claude/bitrunners-collaboration-EcqBv`

Fifth sprint chunk (roadmap 0039). A guided first-play walkthrough that ends at
the obelisk and grants the player their second class.

## What shipped

- **`Tutorial.tsx`** (new): a guided overlay shown on first play
  (`!isTutorialDone()`). Six steps — welcome → (a) inventory → (b) shop → (c)
  scrape loop → (d) movement → (e) points of interest / "head to the obelisk."
  Advance via `[ next ▸ ]`; `[ skip ]` anytime. Mounted in `App`'s Game; it
  doesn't block input (informational card, not a modal veil).
- **Finale + reward.** Reaching the obelisk (the existing
  `bitrunners:admin-encounter` event) — or pressing `[ finish ]` on the last
  step — calls `completeTutorial()` and shows a reward card. That unlocks
  **server_speaker**.
- **`economy.ts`** (additive, backward-compatible): `tutorialDone: boolean` +
  `unlocks: string[]`; `isTutorialDone` / `getUnlocks` / `isClassUnlocked` /
  `completeTutorial` (sets done + adds `server_speaker`). Device-local now;
  rides the existing account-migration seam later.
- **`Boot.tsx`:** the class grid now unlocks a tile when
  `isClassUnlocked(id)` — `server_speaker` shows `[ earned ]` and becomes
  selectable once the tutorial is done. (Read at boot; appears at the next
  login after completion.)
- **`AdminDialogue.tsx`:** reworked the placeholder opening + emote responses
  into stronger Admin first-contact copy (dangerous-yet-benevolent voice).
  Lore-safe; no `_sealed/` content. (The reward messaging lives in the tutorial
  card, so the dialogue stays decoupled from tutorial state.)

## Notes / decisions

- **Skip is session-only** (not persisted): skipping hides the tutorial for the
  session but it returns next session until actually completed — so the
  server_speaker reward stays reachable without a separate "replay" control.
  (A settings replay/skip-forever is a possible follow-up.)
- **Reward timing:** the tutorial runs in-game (after class select), so the
  unlocked `server_speaker` appears on the **boot/class grid at the next
  login** (economy persists to localStorage and reloads). This matches "earn a
  second usable character."
- Per the roadmap, unlock is device-local now; it migrates per-account once
  auth lands (same seam as the rest of the economy).

## Honest status

- Gates green: `pnpm lint` clean (48 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.
- **Not verified live (headless).** Eyeball on the Pages preview: the tutorial
  card appears on first play, steps advance, skip works; walking to the obelisk
  (or `[ finish ]`) shows the reward card; after reload, `server_speaker` is
  `[ earned ]` and selectable on the boot grid; the Admin's new opening reads
  right.
- **Tutorial-card placement needs an eyeball** (bottom-centre, lifted above the
  status badges to avoid the top-right launchers it references) — may need
  nudging vs. the emote wheel on small screens.
- First pass: steps advance on `[ next ]` rather than auto-detecting each action
  (robust + not stuck); per-location waypoints/highlights are a polish follow-up.

## Files

`apps/web/src/Tutorial.tsx` (new), `apps/web/src/economy.ts` (tutorial/unlock
flags), `apps/web/src/Boot.tsx` (earned-class unlock), `apps/web/src/App.tsx`
(mount), `apps/web/src/AdminDialogue.tsx` (reworked opening),
`apps/web/src/style.css` (tutorial card), this devlog, `.claude/handoff.md`.
