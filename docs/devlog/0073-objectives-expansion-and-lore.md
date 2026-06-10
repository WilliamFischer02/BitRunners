# 0073 — 10-mission chain + lore delivery + complete-state hydration

Branch: `claude/objectives-expansion-and-lore`. Draft PR pending.

This is PR 81 in the polish push (see `/root/.claude/plans/nested-tickling-reddy.md`).
It tackles category D from the backlog: objectives content + the
re-reward bug.

## What ships

### Mission catalog expansion

- **`apps/web/src/missions.ts`** —
  - `MISSIONS` grows from 1 to 10. Every mission has:
    - 3 checkpoints sprinkled across the doubled world half-extent (±19)
      and routed away from the existing collider props.
    - 5 dialogue keys (opening, two choice labels, two closings).
    - A reward magnitude that climbs gently from 5 → 12 across the chain
      so later missions feel weightier.
  - Mission keys (chain order):
    1. `aether_recovery_01` — "Recover an aether's last data"
    2. `dead_port_audit_02` — "Audit a dead port cluster"
    3. `rogue_signal_03` — "Triangulate a rogue runner's broadcast"
    4. `company_courier_04` — "Run a Company courier loop"
    5. `whisper_trail_05` — "Follow a whisper across the cloud"
    6. `monolith_resonance_06` — "Resonate three monoliths"
    7. `bit_spekter_origin_07` — "Trace the origin of bit_spekter"
    8. `server_space_breach_08` — "Probe a Server Space breach point"
    9. `echo_chamber_09` — "Map an echo chamber of older runners"
    10. `the_admins_question_10` — "Answer The Admin's question"
  - New exports: `MISSION_CHAIN: readonly string[]` and
    `nextMissionKey(completed)` for picking the first unfinished entry.

### Lore delivery via dialogue defaults

- **`apps/web/src/dialogue.ts`** —
  - 45 new `DIALOGUE_DEFAULTS` entries (5 keys × 9 new missions).
  - Each mission's opening fires 3 lore lines establishing the
    situation; the two `closing_*` keys fire 2 lines each describing the
    faction-aligned consequence.
  - Lore introduces: dead ports, rogue runners, Company couriers, the
    Whisper, monolith resonance, the bit_spekter origin, Server Space
    breaches, echo chambers of older runners, and The Admin's question.
  - Defaults remain overridable per-key via the admin console (Supabase
    `dialogue_overrides` table → live broadcast → client cache).

### Device-local progress store

- **`apps/web/src/mission-progress-local.ts`** (new) —
  `localStorage` key `bitrunners.mission-progress.v1`, versioned blob
  shape:
  ```ts
  { v: 1, completed: string[], active: string | null,
    nextIdx: number, activeState: MissionState }
  ```
  Public surface: `getProgress`, `isCompleted`, `setActive`,
  `advanceActiveIdx`, `markCompleted`, `subscribeProgress`.
  Same versioning pattern as `economy.ts`.
- **`apps/web/src/mission-sync.ts`** (new) — one-way bridge from the
  in-memory mission singleton (`missions.ts`) → localStorage.
  Subscribes to `subscribeMissionChanges`. On state `'complete'`,
  marks the mission completed and queues the next chain mission via
  `nextMissionKey(progress.completed)`. On state `'active'` / `'final'`,
  persists `{ active, nextIdx, activeState }`. Idempotent / started
  once.

### Scene & app bootstrap

- **`apps/web/src/scene.ts`** —
  The unconditional `setActiveMission(MISSIONS[0])` bootstrap is
  replaced with a read from `getProgress()`. The scene picks
  `progress.active ?? nextMissionKey(progress.completed)`, restores
  `nextIdx` + `activeState`, and falls back to chain-head only when the
  device has no prior state.
- **`apps/web/src/App.tsx`** — boot block now calls
  `startMissionSync()` alongside the other idempotent subsystem
  starters.

## Why

Before: the scene bootstrap always set `MISSIONS[0]` as the active
mission, so every page reload restarted `aether_recovery` from
checkpoint 0 — and (depending on whether migration 0011 was applied)
re-handed the reputation reward. After migration 0011 the server-side
`complete_mission` RPC is idempotent (FOR UPDATE row lock), but the
client still re-triggered the RPC because in-memory state was reset.

After: completion is sticky on the device. The runner reloads → the
scene jumps to the next unfinished mission in the chain → the
`complete_mission` RPC is never re-invoked for a finished key.

## Architecture decisions

- **Device-local, not server-canonical, for now.** Migration 0011
  already gives us the canonical truth: `mission_progress` rows
  keyed `(user_id, mission_key)`. Wiring the client to hydrate from
  that table is on the roadmap but requires a `select_mission_progress`
  RPC (or RLS-readable view) and a non-trivial migration path for
  guests without auth. localStorage solves the immediate bug for both
  signed-in and guest runners. When server hydration lands it will
  replace (not augment) the localStorage read.
- **Bridge module, not direct localStorage writes in scene.ts.** Keeps
  the scene focused on rendering + checkpoint hit-testing. Same
  pattern as `economy-sync.ts` → `economy.ts`.
- **Chain order = catalog order.** No skill gates, no faction prereqs.
  Lets us tune mission ordering by reordering `MISSIONS` without
  touching the chain helper.
- **No new migration.** All persistence is client-side until the
  server hydration step.
- **Lore baked as DIALOGUE_DEFAULTS, not as hardcoded mission props.**
  Owner can rewrite any line in the admin console without a redeploy,
  matching the existing `mission.aether01.*` workflow.

## Verification

- `pnpm lint` ✓ (81 files, no fixes applied)
- `pnpm typecheck` ✓ (8/8 tasks)
- `pnpm --filter @bitrunners/web build` ✓ (365 modules, 4.23s)
- Manual: `localStorage.setItem('bitrunners.mission-progress.v1',
  JSON.stringify({v:1, completed:['aether_recovery_01'], active:null,
  nextIdx:0, activeState:'inactive'}))` then reload → scene boots
  with `dead_port_audit_02` as active and renders its checkpoints,
  not `aether_recovery_01`'s.
- Manual: with the same fixture and `completed` listing all 10 mission
  keys, scene boots with no active mission (chain exhausted) and the
  Objectives cartridge shows the completion state.

## Owner-tunable values

| What | v1 default | Where |
|---|---|---|
| Mission rewards | 5 → 12 (slope) | `missions.ts` `reward` |
| Trigger distance | 1.6 world units | `missions.ts` `triggerDist` |
| Checkpoint positions | hand-placed | `missions.ts` `checkpoints` |
| Mission titles | one-line | `missions.ts` `title` |
| Opening / closing lore | 3 / 2 lines per mission | `dialogue.ts` `DIALOGUE_DEFAULTS` |
| Choice button labels | one line each | `dialogue.ts` `choice_br` / `choice_corp` |
| Storage key | `bitrunners.mission-progress.v1` | `mission-progress-local.ts` `STORAGE_KEY` |

## Roadmap

- **PR 76** (merged earlier) — Auth verify, password reset, signup grant
- **PR 77** (merged earlier) — Responsive design tokens + label overflow
- **PR 78** (merged earlier) — Persistent credits HUD
- **PR 81 (this PR)** — 10-mission chain + lore + complete-state hydration
- PR 79 — Badges modal extraction + verified-account name styling
- PR 80 — Shop + Inventory unified 2-tab modal
- PR 82 — Bit scraper depth (more upgrades, auto-converter bots, prestige)
- PR 83 — Tether chat protocol
- PR 84 — Debug custom name + emote approval flows
- PR 85 — Minimap detail / legibility on phone

## No new dependencies. No protocol bump. No schema change.
