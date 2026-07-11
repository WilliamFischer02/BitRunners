ultracode

# BitRunners — mega-batch 3 launch prompt (transmission face · VFX tune ·
# appearance sync · void netcode · scrape tutorial · asset pipeline ·
# Data Base voxel plots · RAMHATTAN)

You are a highly experienced lead developer of an online multiplayer web
game, fully autonomous on this repo (branch cut by the launcher). Work
at maximum effort; orchestrate subagents freely. The recon facts below
came from a live survey of THIS tree — re-verify each line number
before editing, then trust the shape.

## 0. Read first (mandatory)
`CLAUDE.md`, `.claude/handoff.md`, `.claude/decisions.md`, newest
devlogs, `docs/PERFORMANCE.md` if the perf pass landed it. One-paragraph
readback. ALL house rules apply: draft PRs only, never push main, devlog
per PR, gates (`pnpm exec biome check --write .` → `pnpm typecheck` →
`pnpm build`) before every commit, no new deps without devlog note
(three/addons GLTFLoader is NOT a new dep), NO migrations applied — 
author proposals in-repo + handoff `## proposed migrations` (0018
pattern). Server changes flag "merging triggers Fly redeploy" in the PR.
Respect the perf house rules (no per-frame allocation, batch economy
mutations, subscribe-with-selector).

## Priority order — one PR per task, smallest blast radius first

### P0 — scrape-glow mask (XS)
`.scrape-glow` (ScrapeMenu.tsx:986; style.css:4492) is a 320×200
absolute sibling that escapes `.scrape-stage` (style.css:4485 —
position:relative, NO overflow) and paints its grid over the section
borders. Fix: `overflow:hidden` (+ matching border-radius) on
`.scrape-stage` so the glow clips to the button's container, staying
visible inside it and never over sibling UI. Verify is-holding /
is-auto / pressed states + reduced-motion still work.

### P1 — VFX softening + double ASCII resolution (S, perf-verify)
Player feedback: effects too strong, "pixels" too big to read
characters.
- CRT: scene.ts:1273 `createCrtPass({scanline:0.1, vignette:0.26,
  aberration:0.05})` → reduce aberration ~0.05→0.02, scanline
  0.1→0.06, vignette 0.26→0.2. Keep `?crt=off` escape hatch; add
  `?crt=strong` restoring old values for A/B.
- Resolution: halve `cellSize: 4 → 2` (fontSize 6 → 3? NO — keep glyph
  legibility: try cellSize 2 with fontSize 6 atlas first; if glyphs
  blur, build atlases at cellSize 3 as the compromise) in the THREE
  buildGlyphAtlas calls at scene.ts:1217-1231. This 4×es ascii-pass
  texel work: verify on a throttled mobile profile with the ?perf=1
  HUD; if fps drops >15% on mobile, ship cellSize 3 and devlog the
  tradeoff. STOP-AND-ASK flag in devlog either way.

### P2 — Admin "transmission" face (M)
Reference vibe: `docs/references/01-ascii-glitch-face.*` (dissolving
pointillist face, hard black/white). AUTHOR the ASCII art yourself:
5 frames, ~44 cols × ~24 rows, chars from `█▓▒░▄▀·:╳*+` — F0 rest
(mouth closed, calm), F1 parted, F2 half, F3 open, F4 wide. Right side
of face solid, left dissolving into scatter + tiny hex/error strings
(match the reference). Store as `const FACE_FRAMES: string[]` in a new
`apps/web/src/transmission-face.ts` (template literals, monospace-safe).
Component `TransmissionFace.tsx`: fixed overlay card (terminal panel
styling, `// transmission` header) that mounts ONLY while AdminDialogue
is mounted. Hook: AdminDialogue.tsx:24 `typing` state (TYPE_MS=38,
typing=true while chars print). While typing: cycle frames in a rove
(F0→1→2→3→4→3→1…, ~170ms per frame — deliberately low-framerate) with
an occasional single-row glitch displacement every ~1.2s. When
typing=false or phase is prompt/closing: settle to F0. Implement the
frame swap by writing `textContent` on a `<pre>` via ref on an interval
— NO React re-render per frame. Reduced-motion: static F0 always.
Position: upper-center-left, doesn't cover the dialogue text box on
phone (test 393×852). Expose typing state to the overlay via a
CustomEvent from AdminDialogue (`bitrunners:admin-typing` {typing}) so
the face component stays decoupled.

### P3 — remote appearance sync (M-L, SERVER — Fly redeploy)
Confirmed gap: appearance is local-only (appearance.ts:27 →
scene.ts:1005-1034 applies to local rig only); wire protocol has NO
outfit fields (network.ts:4, sendIdentity:284); buildRemoteAvatar
(scene.ts:260) renders zero accessories. Fix end-to-end:
1. `apps/server/src/state.ts`: append string fields `equippedHead`,
   `equippedChest`, `equippedLegs`, `equippedPet` (item ids, ≤32 chars)
   to PlayerState (appended fields = no protocol bump, matches level
   precedent).
2. sphere-room.ts: extend the 'identity' handler validation
   (lines 219-264 pattern) to accept + clamp the four ids.
3. network.ts: add the fields to PlayerSchema, snapshot() (line 108),
   join payload, sendIdentity, and per-field listen() registrations
   (line 200 pattern — coalesce, don't add 4 separate fireUpdates if
   the perf pass merged them).
4. Client: send on join + on appearance change (subscribe to the
   existing appearance-changed event). On remotes: extend
   buildRemoteAvatar to apply the same slot geometry/palettes the local
   rig uses — reuse applySkin/pet mesh helpers rather than duplicating;
   validate ids against the shop catalog before rendering (never trust
   the wire).
Acceptance: two browsers, equip a head item + pet on A → B sees both
within a tick; invalid/unknown ids render the base shell.

### P4 — data_scrape interactive tutorial (M)
Lift the `TutorialHighlight` pattern verbatim (Tutorial.tsx:80 — target
CSS selector + pulsing ring; ScrapeMenu has NO ids, use class selectors
`.scrape-btn`, `.scrape-mini`, `.tree-node`, `.scrape-tabbtn`). New
`ScrapeTutorial` inside the scrape panel: triggers on first open when
`!scrapeTutorialSeen`. Steps (interactive — advance on the ACTION, not
just [next], where feasible): 1 welcome/goal; 2 "tap SCRAPE" (wait for
an actual scrape); 3 ladder explanation — 8 bits→1 string→…→passcode,
highlight the tabulate rows as they become ready; 4 "passcodes are the
most valuable unit"; 5 open the tree tab (highlight `.scrape-tabbtn`),
walk their FIRST tree purchase (highlight an affordable `.tree-node`,
note which paths increase passcode generation); 6 close: "cash
passcodes with CALCULATE — that's how you mint credits." Persist
`scrapeTutorialSeen` as an additive economy-blob flag (economy.ts
pattern: field + default + normalize coerce + idempotent setter, per
tutorialDone L77/L139/L242/L571-588) AND add it to the economy-sync
merge score (~economy-sync.ts:55) so it survives cross-device merges.
Skippable at every step; never re-shows once seen (set the flag on
skip too).

### P5 — void netcode + plate polish (M, SERVER — Fly redeploy)
Today the void is a client-local illusion (scene.ts:2144-2239): remote
players see voided players standing near world origin; plate lights are
per-client. Fix:
1. Add `zone: string` ('cloud' | 'void') to PlayerState + an
   'identity'-pattern 'zone' message (validate allowlist). Client sends
   on enterVoid/exitVoid (events already exist:
   'bitrunners:void-enter'/'void-exit').
2. Remote visibility filter: in scene.ts remote-avatar update, hide
   avatars (mesh + nametag) whose zone ≠ local player's zone. Void
   players therefore see each other (same void-local coords work since
   everyone's void is at the same coordinates) and stop seeing cloud
   players; cloud players stop seeing voided ghosts.
3. Compass: the feet/compass arrow (updateFeetArrow, scene.ts:~2316)
   must point at VOID_DOOR while zone==='void' instead of its normal
   targets.
4. Plates (scene.ts:2239 checkVaultPlates, VAULT_PLATES:124-129): add a
   stood-on "press" animation (plate mesh depresses ~0.05 y + emissive
   flash while a player is within trigger dist); keep the sequence
   lights; wrong-order already resets (verify unlight visually);
   unlight all plates when the stepping player teleports to the void.
   Plate lights stay client-local for v1 EXCEPT: fire a plate-step
   server message ONLY IF trivially cheap; otherwise devlog as deferred.
Acceptance: two browsers — A completes plates → A vanishes from B's
cloud view; B follows → both see each other in the void; compass points
door-ward; plates reset cleanly for each.

### P6 — 3D asset pipeline (M) — PREREQ for P7 visuals + P8
First external-asset path in the project (recon: zero GLTFLoader usage,
public/ has no assets dir, CREDITS.md is an empty scaffold).
1. `docs/assets/PIPELINE.md`: the owner's drop-folder workflow — owner
   downloads CC0 sets (Kenney / Quaternius / CC0 Sketchfab per
   CLAUDE.md), drops `.glb` files into `apps/web/public/assets/models/
   <pack>/<name>.glb`, adds a CREDITS.md row (Asset|Source|License|
   Used for), then lists the file in the registry; the next Claude
   session places them.
2. `apps/web/src/assets-registry.ts`: typed manifest (id, path, scale,
   yOffset, collider box?, tint-compat flag) + a lazy `loadModel(id)`
   using GLTFLoader from three/addons with an in-memory cache and
   dispose path. ASCII pass renders whatever geometry it gets — verify
   a test model reads well through the shader (grayscale materials per
   the visual identity; strip textures to luminance if needed).
3. Wire ONE placeholder proof: if any .glb exists in the folder, load
   + place it at a devlog-documented spot; if none, ship the pipeline
   with a `?asset=<id>` dev flag and devlog "awaiting owner drops".
Devlog the GLTFLoader usage (from three/addons — no new package).

### P7 — "Data Base" voxel plots (XL — STAGED PRs)
The flagship. Player-owned voxel plot, edited in-game, persisted
per-account, hosted in a sky-grid above the main world.
- **Stage A — cartridge + local editor.** protocols-registry pattern
  (registry L115: key `data_base`, label `data_base`, glyph `▦` is
  taken by inventory — pick `⌂`, tint `br`, launch event). Opening it
  teleports you (client-side, maze-mode pattern: hide world group,
  reuse setWorldVisibleForMaze) to your plot: default **24×16×24**
  voxels on a flat pad. Two tabs top of a slim HUD: **RegEdit**
  (creative editor) and **Corporeal** (walk mode using the existing rig
  + movement, bounded to the plot AABB).
  RegEdit: orbit/pan/zoom viewport (pointer-drag orbit, wheel/pinch
  zoom — keep touch first-class); voxel cursor via raycast with a
  **selection-depth slider** (depth 0 = nearest voxel layer to camera
  highlighted/selectable, sliding up selects deeper); click/tap places
  the palette block, eraser mode removes; palette of the 5 launch
  blocks: `concrete` (matte rough gray), `neon_panel` (emissive cyan,
  MeshStandardMaterial emissive — verify it glows through the ascii
  pass via uCharacterGlow or brightness), `wood_frame`, `metal_frame`,
  `asphalt` (dark matte, slight sheen). Chunked meshing: ONE
  InstancedMesh per block type (max 24×16×24=9216 instances worst
  case — fine), rebuild-on-edit batched per frame.
- **Stage B — persistence.** Author (DO NOT APPLY) migration
  `supabase/migrations/0019_voxel_plots.sql`: table `voxel_plots`
  (user_id PK ref auth.users, `blocks BYTEA` or JSONB — use
  palette-indexed RLE: flat array index = x+z*W+y*W*D, runs of
  [count, blockId], typically <2 KB for a house; version int;
  updated_at), own-row RLS, `save_voxel_plot(p_blocks, p_version)` +
  `get_voxel_plot(p_user)` RPCs (SECURITY DEFINER, authenticated only,
  size cap ~64 KB, anon revoked — 0013/0014 lockdown pattern). Client:
  encode/decode module with unit tests (round-trip + malformed input);
  save debounced 3s after last edit + on exit; guests get local-only
  plots (localStorage) with the account-nudge fired on first edit.
  Handoff `## proposed migrations` entry per the 0018 pattern; client
  degrades to local-only until the owner applies 0019.
- **Stage C — sky-grid multiplayer (SERVER — Fly redeploy).** Plots
  live in the SAME Colyseus room, offset vertically: plot (i) origin at
  y = +120, grid-spaced (e.g. 64 units apart in x/z, 8×8 grid = 64
  slots ≥ room cap). Server assigns each joining client a plot index
  (append `plotIndex: number` to PlayerState). Entering Data Base =
  client teleports rig to its assigned slot origin + sends
  zone='plot:<idx>' (reuse the P5 zone field — zone visibility filter
  gives plot isolation for free). Corporeal mode clamps movement to
  the plot AABB. Exit button returns to saved cloud position +
  zone='cloud' + disposes plot meshes (smart unload). Visits: a
  'visit' message (target session id, cap 3 guests per plot — server
  validates count) sets the guest's zone to the host's plot zone and
  the client loads the HOST's plot data (fetch via get_voxel_plot).
  V1 guests are read-only. If Stage C timeboxes out, ship A+B solo
  (plot is single-player) and leave C specced in the handoff.

### P8 — RAMHATTAN (XL — gated on P6, LAST, ok to spill over)
Cyberpunk city district filling open map space. V1 scope ONLY: a
`docs/design/ramhattan.md` design doc (street grid layout in the empty
quadrant — pick coords from the doubled map, landmark list, shopkeeper
NPC concept reusing dweller/4V4 patterns, street-thug wander NPCs,
collectables as economy-blob additive array + scene pickups), PLUS the
first buildable slice: block out the district footprint with existing
primitives + any P6 assets present, one shopkeeper NPC with a
dialogue-pattern interaction, 3 collectable pickups that persist via
the blob. Full build-out is the NEXT batch — do not let this task eat
the session; if the earlier tiers consumed the budget, ship the design
doc alone and say so in the handoff.

## Working method
- Re-verify recon line numbers first; the tree moves fast.
- One draft PR per tier (P7 staged A/B/C). Owner-verification steps in
  every PR body. Before→after screenshots/numbers where visual.
- STOP-AND-ASK (note in devlog + pick conservative default): resolution
  cellSize if mobile fps tanks; face art style call; voxel plot
  dimensions; anything touching gameplay rewards.
- Update `.claude/handoff.md` at the end: per-task status, PR numbers,
  proposed-migration section (0019), what P8 needs next batch.

Begin with step 0.
