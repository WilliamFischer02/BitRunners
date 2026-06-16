# BitRunners — autonomous mega-batch launch prompt (2026-06-16)

You are running in fully autonomous mode on the **BitRunners** repo on
branch `claude/mega-batch-YYYY-MM-DD` (already created and checked out).
The owner has walked away — they will not be available to answer
follow-up questions during this session. You must finish the work
listed below and leave the repo in a mergeable state.

## 0. Read these first, in this order

Do not skip this step. The whole session depends on knowing where the
project is RIGHT NOW.

1. `CLAUDE.md`
2. `.claude/handoff.md`
3. `.claude/decisions.md`
4. The newest file in `docs/devlog/` (highest numbered)
5. `docs/devlog/0004-roadmap-revised.md`
6. `docs/lore/README.md` (terminology glossary — use exact spellings)
7. `docs/lore/015-chat-policy.md` (moderation rules)

After reading, do a one-paragraph readback in your own words covering:
phase / branch / what's blocked / what the active roadmap item is.

## 1. Working agreement (HARD rules — violating any is a session-stopper)

- **Never push to `main`.** Push to the working branch only. PRs open as **drafts**.
- **Never amend the lockfile by hand.** `pnpm install --frozen-lockfile` is the floor.
- **Never bypass `.claude/settings.json`** or its do-not-touch zones.
- **Never surface `docs/lore/_sealed/`** content in NPC dialogue, UI, or any player-facing surface.
- **Never add a paid resource** (Fly machine upgrade, paid Supabase tier, Anthropic key with no budget gate).
- **Devlog every significant change.** New devlogs in `docs/devlog/NNNN-title.md`, next available number. Every PR has its own entry.
- **No new dependency without a devlog mention** (name, version, why).
- Before every commit: `pnpm exec biome check --write .` → `pnpm typecheck` → relevant `pnpm --filter ... build`. If any of the three fails, **fix it before committing.** Do not commit broken code.
- The autonomous flag does NOT grant permission to delete branches, force-push, or interact with prod resources. Stick to local tree + commits + draft PRs.

## 2. STOP-AND-ASK triggers

If you hit any of these, **stop, push what you have, leave a TODO comment in the relevant file, and move on to the next task.** Do not invent answers.

- Cartridge descent animation FEEL — easing curve, "click" duration, exact slot shading. Pick a sensible default (see §11) and ship it but call out the call in the devlog.
- Level-from-badges formula — see §15 for the default.
- Shop tab taxonomy — see §13 for the default split.
- Any lore answer the canon files don't already specify.
- Anything that requires owner email / OAuth / secrets you don't have.
- Any task where you'd need to delete or rewrite an existing migration.

## 3. PR strategy

Open **one PR per major task** unless explicitly told to bundle. Each PR:
- Has its own devlog entry
- Has its own commit (or small handful of commits)
- Lints + typechecks + builds clean
- Is opened as **draft**
- Lists owner verification steps in the PR body
- Cross-references any related deferred items

Branch off `claude/mega-batch-YYYY-MM-DD` for each task — use sub-branches like `claude/mega-batch-.../desktop-pills`, `claude/mega-batch-.../minimap-exit`, etc. Open each as its own PR against `main`. When a sub-task is done, return to the mega-batch branch and start the next.

If a task gets too large for a single PR (e.g. the Nintendo-DS cartridge work), break it into staged PRs: scaffold first, then animation, then polish. Devlog each stage.

## 4. Priority order

Do them in this order. Do not skip ahead. If you get stuck on one, push a WIP draft + open the next.

### P0 — bugs + data integrity (do these first)

#### 4.1 Persistent objective progress

**Symptom**: closing the tab or signing back in resets the player to the first objective. Worse, when the player starts a NEW objective, the previously-completed objective greys out as if uncompleted, shows `0/3 checkpoints`, and locks.

**Acceptance criteria**:
- A returning player loads exactly the objective state they left, including which checkpoints are complete on the active objective.
- Completed objectives stay visually marked complete forever (no grey-out, no re-lock).
- Server-side source of truth: read on auth, write on every checkpoint advance + completion.
- Look at `apps/web/src/missions.ts` + `apps/web/src/Objectives.tsx` + the `mission_progress` table + the RPCs in `supabase/migrations/0011_physical_missions.sql`. Those RPCs already exist (`start_mission`, `advance_checkpoint`, `complete_mission`, `get_mission_progress`); the wire-up is what's broken.
- Add an integration-style smoke test that opens the page twice in sequence and asserts the second load preserves progress. If Playwright isn't installed, document the manual repro in the devlog.

#### 4.2 Account / runner select shows "guest no user_id" while logged in + stale username

**Symptom**: even when the Supabase session is `authenticated`, the runner-select panel shows the guest placeholder and the wrong (older) username.

**Acceptance criteria**:
- Inspect `apps/web/src/UsernameEditor.tsx`, `apps/web/src/profile.ts`, `apps/web/src/supabase.ts:fetchMyIdentity`. The bug is almost certainly a stale cache + missing `subscribeAuth` reaction.
- Replace the guest placeholder with the live `display_name` from `fetchMyIdentity` the moment `subscribeAuth` flips to `authenticated`.
- Username editor's "save" path must invalidate the cached identity so the new approved name renders immediately (no page reload).
- Display the user UUID truncated to 8 chars (not "no user_id") for debugging on signed-in sessions.

#### 4.3 AFK self-ghosts from stale tabs

**Symptom**: opening a new tab while another tab is still open leaves the old session's avatar in the sphere as an AFK ghost, which the player then walks into.

**Acceptance criteria**:
- Server-side: when a new client joins with the same `user_id` as an existing client in the same room, **disconnect the older client.** Send a `tether-ended` + room kick to the stale session; the stale tab should render a "// session moved to another tab" overlay and stop spamming reconnects.
- This is the right behaviour even across spheres — a user should have at most one live Colyseus connection at a time.
- See `apps/server/src/sphere-room.ts` `onJoin` + `onLeave`. The matchmaker filter may also need a pass — check `apps/server/src/index.ts`.
- Add a `single_session` test: connect twice, assert the first connection receives a leave event within 2 s.

### P1 — broken UX

#### 4.4 Desktop launcher pills overlap minimap + sit too high

**Symptom**: on **desktop** viewport (≥ 720 px) the profile + protocols pills render as two side-by-side squares vertically too high and overlap the minimap.

**Acceptance criteria**:
- Open `apps/web/src/style.css`. The mobile layout (≤ 540 px) was reworked in devlogs 0082 / 0084 / 0086 — desktop layout was never re-checked. The default `.profile` + `.protocols-launch` rules above the media query are the ones rendering on desktop.
- Position both pills so they sit BELOW the minimap, not in front of it. The minimap lives at top-right; the pills should drop into the right-hand vertical column under it.
- Match the mobile stair-step feel (one pill nudged inward, one flush right) but with desktop-appropriate sizing (≥ 44 px tap height is fine on desktop, you have room).
- Take a screenshot via dev server if possible; document the before/after dimensions in the devlog.

#### 4.5 Minimap distortion on mobile + missing exit button

**Symptom**: opening the minimap goes fullscreen. On desktop that's fine. On mobile it stretches to portrait and looks distorted. There's no visible exit — only ESC works, which is a **softlock on touch devices**.

**Acceptance criteria**:
- Find the minimap component (grep `minimap` and `MiniMap`).
- Mobile fullscreen layout: preserve aspect ratio, letterbox if needed, no distortion.
- Add a visible **`✕`** close button in the top-right of the minimap overlay. ≥ 44 × 44 px touch target. ESC still works as a fallback. Tapping outside the minimap dismisses too.
- Test by spawning a mobile viewport in dev (393 × 852 portrait). Don't ship without doing this.

### P2 — graphical pass (visual redesign)

#### 4.6 Runner-select / account menu reorganization

The current menu is a long unsectioned list. Redesign it with clear visual separation between functional groups, using the existing terminal aesthetic. The username must reflect the most-recent **approved** display name (ties into 4.2).

**Suggested sections** (terminal-style section headers like `$ identity` already used in `TetherChat.tsx`):
- `$ identity` — display name, badge, theme
- `$ samaritan` — corp / br scores
- `$ account` — email, signed-in status, sign-out
- `$ debug` — uuid (truncated), session id, server region

Reuse `.panel`, `.panel-header`, `.panel-section`, `.panel-section-title` classes — already styled.

#### 4.7 Inventory visual redesign

**Symptom**: inventory shows item NAMES only; equipped clothing reads as mono-off-white in-world; possible theme interference flattening palette.

**Acceptance criteria**:
- Add an icon (or low-fi ASCII glyph if no sprite available) next to each item name in the inventory list.
- Audit clothing material colours in `apps/web/src/scene.ts` / wherever outfits are constructed. If the theme shader is desaturating the world by default, gate that behaviour or bump the input saturation.
- If the colour palette IS already varied, push saturation up by ~20 % at the material level. Devlog the before/after with a screenshot.
- Do not touch the equipped-outfit schema — only how it renders.

#### 4.8 Shop redesign

From a flat list to a tabbed menu with sections. Default tabs (use these if no canon overrides them):
- `// outfits`
- `// emotes`
- `// themes`
- `// upgrades`

Persist selected tab to `sessionStorage` so re-opening keeps the section.

#### 4.9 Nametag styling + badges visible to OTHER players

**Symptom**: badges + nametag styling are currently visible only to the local player.

**Acceptance criteria**:
- Confirm whether `equipped_badge` is on the `PlayerState` schema in `packages/shared` / `apps/server`. If not, add it + a server `'identity'` handler write-through (the pattern is already there for `displayName` and `equippedTheme`).
- Render the badge inline next to the nametag for every remote avatar, not just `localPlayer`.
- Ties into 4.10's level number.

### P3 — new features

#### 4.10 Level system (badges → level)

**Default formula**: `level = number_of_owned_badges` (1 badge = level 1; 20 badges = level 20). Cap at 20. Display as `Lv 7` after the badge glyph on the nametag.

Devlog the formula choice as a STOP-AND-ASK call — if the owner wants a curve later, easy to swap.

Server-side: add a `level` field to `PlayerState`, computed from `earned_badges` count at join time + on the `'badges-changed'` realtime event. Render in nametag for all players.

#### 4.11 Bot tether dialogues

The 4 NPCs spawned in each sphere (see `DWELLER_ARCHETYPES` in `packages/shared`) need to be tether-chat-able so the system can be smoke-tested without live peers.

**Acceptance criteria**:
- NPC avatars accept incoming `tether-request` messages → auto-accept with a short delay (1.5–3 s, randomized).
- Once tethered, the NPC sends 1 message every 8–15 s (jittered) from a pool of lore-safe lines. Use existing lore in `docs/lore/` for the line pool — categories: greetings, observations, fragments, sign-offs.
- Bot lines must respect `TETHER_MAX_CHARS = 25` and pass `isValidTetherBody`.
- Closing the tether (player taps `✕` or walks away) cleans up the bot's send loop.
- Lore source: the four bot personalities map to `dweller.robot`, `dweller.husk`, `dweller.spirit`, and the fourth archetype — give each its own line pool that matches its archetype's vibe (robot = clipped + system-y, spirit = drifting + cryptic, husk = corroded + fragmentary).
- This is the path to letting the owner test 4.4 / 4.5 / the new cartridge UX without rounding up a second human.

#### 4.12 Emote swap UI in inventory

- Ship the 10 base emotes immediately equipable (currently hard-wired in `apps/web/src/emote.ts` or similar — find it).
- Add a 10-emote "cooler" set to the shop's new `// emotes` tab from 4.8. Set price to a placeholder (e.g. 100 credits) — flag in devlog as STOP-AND-ASK for final price tuning.
- Inventory panel gets a `$ emote slots` section with 4 equip slots; tapping a slot opens a picker that lists owned emotes.
- Persist equipped emotes per-account via Supabase (add an `equipped_emotes JSONB` column to `profiles` + a small RPC). Migration `0013_emote_loadout.sql`.

#### 4.13 Guitar-hero-style protocol (new game)

This is a new minigame. Default name: `// freq_lock` (matches the terminal aesthetic). Owner has not specified mechanics in detail — pick sensible defaults and devlog as a STOP-AND-ASK call:

- 4-lane vertical scroller, glyphs (▲ ▼ ◀ ▶ or numerals) fall from the top.
- Player taps the matching lane key when the glyph reaches the hit-line.
- 60-second song (use procedurally generated note pattern, no audio file dependency — visuals + tick-based timing).
- Score → credits at end, 1 credit per 10 points, cap at 100 credits/run.

Add it to the protocols registry. New file `apps/web/src/FreqLock.tsx` + protocol-registry entry. Lazy-loaded chunk (matches the existing Tiptap-board pattern).

#### 4.14 Nintendo-DS cartridge carousel (protocol menu redesign)

**This is the largest task — staged PRs are FINE**.

**Stage 1 (scaffold)**:
- Restructure `apps/web/src/Protocols.tsx` carousel: items are now cartridge cards, not list rows.
- Pointer-drag + touch-drag horizontal scroll. Snap to nearest cartridge on release.
- Centred cartridge scaled 1.1× and offset up 8 px so the focused item reads as the highlight.

**Stage 2 (visual)**:
- Cartridge art: worn-tape / peeled-label aesthetic. Use CSS gradients + a noise texture (CC0 SVG, devlog the source).
- Each protocol gets a distinct band of colour + a 3-letter glyph (matches the existing protocols-registry icons).

**Stage 3 (drop animation)**:
- 3D ground plane below the carousel with a darker slot.
- Selecting a cartridge: eased descent 600 ms → "contact" → stepped 4-frame "click in" 80 ms → fullscreen transition to the protocol's screen.
- Reverse on close. Use `transform: translateY` + `scale` + a CSS `cubic-bezier` for ease; the "click in" is `steps(4, end)`. `prefers-reduced-motion: reduce` → skip the animation and snap.

If stage 3 starts to feel unbounded, STOP and push stage 1 + 2 as a single PR. Open a follow-up TODO for stage 3.

## 5. Housekeeping

- Update `.claude/handoff.md` at the end of the session with a paragraph per major task: status, PR number, what's left.
- Append decisions to `.claude/decisions.md` for any non-trivial architectural calls (e.g. "chose `level = badges_count` to start").
- If you find an obviously broken thing not in this list, fix it ONLY if the fix is < 10 lines and clearly correct. Otherwise add it to the handoff as a future-session item.

## 6. End of session

When you've completed as many tasks as the budget allowed:

1. Force a final clean build: `pnpm exec biome check --write .` → `pnpm typecheck` → `pnpm build`.
2. If any of the open draft PRs has a failing build, fix or revert before stopping.
3. Update `.claude/handoff.md` with what's still outstanding from this list, what was punted to STOP-AND-ASK, and what owner needs to do next.
4. Print a final summary message to the chat listing every PR opened, by number + title + draft/ready status.

Begin with step 0.
