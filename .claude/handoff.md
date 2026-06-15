# Handoff — 2026-06-15, Dialog dissolve (mountTarget)

## What just shipped (this branch)

`claude/peaceful-thompson-np2lgv`, draft PR pending. Devlog:
`docs/devlog/0088-dialog-dissolve-mounttarget.md`.

### Phase 5 complete — ASCII dissolve on ALL dialogue modals

The three native `<dialog>` modals that were left out of the 0085
dissolve retrofit now have the same wipe animation:

- **`apps/web/src/Samm.tsx`** — `SammPanel` dissolves in/out.
- **`apps/web/src/AdminConsole.tsx`** — `AdminPanel` dissolves in/out.
- **`apps/web/src/UsernameEditor.tsx`** — `EditorPanel` dissolves in/out.

The fix was a one-line change to `dissolve.ts`:
`opts.mountTarget ?? document.body` for canvas placement. When
`mountTarget = dialog`, the canvas sits inside the top-layer dialog
and renders above its content via `z-index: 1000`.

All five dialogue surfaces now share identical
`DISSOLVE_OPTS = { durationMs: 280, cell: 8, color: '#c0ffd6' }`.

No server change. Pages-only deploy; no Fly redeploy needed.

## Owner visual check required

- Open SAMM (walk up to the machine) — confirm glyph wipe on
  entry and on close (✕ button, Escape, or backdrop click).
- Open the username editor (tap floating name above runner) —
  same wipe in/out.
- Open the admin console (admin accounts only) — same wipe in/out.

## Security findings (this session)

No new findings. No security-sensitive code touched.

## What was NOT done (and why)

**Tether Hop** — mechanics undefined; owner Q&A needed before
any implementation.

**Sub-phase J** — second minigame + Scrape skill-tree expansion.
Owner input still needed on what the second minigame is.

## Roadmap reference

Sub-phases A–I are done. Phase 5 dissolve retrofit is now fully
complete (all 5 modal surfaces). Next roadmap items:

1. **Owner Q&A on Tether Hop** — what does the minigame do?
   (earns "chatter" resource, mechanics undefined)
2. **Sub-phase J** — second minigame + Scrape skill-tree
   (owner input needed on the second minigame)
3. **Dialog dissolve** — all surfaces now done. ✓

## Next suggested work (priority order)

1. **Owner Q&A on Tether Hop / Sub-phase J** — nothing buildable
   for these without mechanics spec.
2. **tether-request double-accept race** (F2 from 0085 handoff) was
   fixed in PR #95 (devlog 0087). Both security findings resolved.
3. **Security / polish pass** — consider a11y audit on the new
   dissolve: ensure `aria-live` regions are not disrupted by the
   canvas overlay (canvas has `pointer-events: none`, so interactive
   elements remain clickable during the wipe).
4. **Server hygiene items** — NPC wander quality, idle-disconnect
   tuning — both small server-only changes.
