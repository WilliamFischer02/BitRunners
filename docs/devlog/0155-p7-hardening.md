# 0155 — P7/P8 hardening from adversarial review

**⚠️ SERVER CHANGE — merging triggers a Fly redeploy** (visit sweep +
slot-relative clamp ride the same deploy as 0153).

Ran a multi-agent adversarial review over the P7A→P8 diff (two of four
review dimensions completed before hitting the session token limit —
netcode and persistence; state-machine and render-perf were covered by
manual reasoning only, noted in the handoff). 13 findings triaged;
10 fixed here, 3 accepted as documented design.

## Fixed

1. **Idle-kick in frozen plot mode** (house-invariant violation, the
   worst one): the outbound-move gate suppressed the 10 s keepalive
   while in a plot with no live zone (deploy-window skew or the
   plotIndex −1 degrade path), so an open-ended build session went
   fully silent and the 120 s idle sweep kicked the builder. Frozen
   modes (maze included) now ping the PARKED coords every 10 s —
   frozen ≠ silent.
2. **Stranded guests on slot reuse** (server): a host leaving never
   evicted visitors from their plot zone, and `assignPlotIndex` hands
   the freed index to the next joiner — leaving strangers rendering
   inside (and consuming the guest cap of) the next owner's plot.
   `onLeave` now sweeps zone-mates back to `'cloud'` and sends
   `visit-ended`; the client exits the visit cleanly.
3. **Stale visit grant ghosting**: the recovery path sent
   `zone='cloud'` even when the player was in their OWN plot, which
   would wrap their sky coords onto the torus as a cloud ghost. Now
   restores the actual current zone.
4. **Guest hosts / failed fetches**: the server now denies visits to
   hosts with no account (`no-build`) instead of echoing an empty
   uid, and the client aborts (zone back to cloud + tether notice)
   when the host build can't be fetched — no more walking through
   walls the host renders as solid, and no more "working" visits
   against an unapplied migration.
5. **HUD deadlock**: opening data_base from the void/maze mounted an
   overlay whose exit depended on a mode that never engaged.
   `enterPlot`'s guard now answers with `plot-exit` so the HUD closes.
6. **Store merge races**: `voxel-plot-store` gained economy-sync's
   `loading` guard (a debounced/hidden flush can no longer push the
   pre-merge grid over the account row mid-fetch) and now
   distinguishes fetch ERROR / no row / undecodable row — a transient
   RPC failure no longer lets a 1-block guest grid clobber a
   500-block account build.
7. **JSONB cap was 3× too small**: my 64 KB estimate was computed on
   JSON text; JSONB stores ~12 bytes/number, so a legal worst-case
   grid is ~221 KB and intricate legit builds (~2,700 runs) would
   have been silently un-syncable. Cap raised to 256 KB (0019 is
   unapplied, so the file edit is free).
8. **Slot-relative move clamp** (server): plot-zone positions were
   clamped to the whole ±248 sky-grid square, letting a modded client
   hover over other pads while zoned to its own. Now clamped to the
   claimed slot's origin ± 32.
9. **Non-canonical plot zones**: `parsePlotZone` accepted `plot:07`,
   which passes validation but fails every string-equality zone
   comparison (self-hiding lever). Canonical digits required.
10. **Ghost shards** (P8): shard visibility was computed once at
    startScene, so an async economy adopt could leave a visible-but-
    uncollectable shard (or a hidden collectable one). Visibility now
    refreshes on the coalesced economy events.

## Accepted as designed (documented in code)

- Equal-count local rework loses to the account row on sign-in
  (countBlocks can't see rearrangement; comment added).
- Shard meshes don't render on wrap clones (pickup is wrap-aware).
- An actively-editing device saving over the account row remains
  possible — plots have no monotonic progress metric for a
  save_economy-style server guard; erasing blocks is legitimate.

Gates: biome · typecheck 8/8 · test 85/85 · build 5/5 · bundle OK.
