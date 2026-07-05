# 0130 — Auth status card under NET

## TL;DR

- New `.auth-status` card paired with the NET card. Guests see a loud
  two-line `NOT LOGGED IN / PROGRESS NOT SAVED` warning (red, gentle
  pulse, reduced-motion safe); signed-in users see a quiet
  `logged in · progress saved`.
- Driven by `subscribeAuth` in `scene.ts` right where the NET card is
  built; cleaned up with the existing `standbyCleanups` dispose path.
- Placement: phone top-left stack puts it DIRECTLY BELOW the net card
  (owner spec). Desktop keeps the pair bottom-center with auth stacked
  on top of net — there is no room below the net card at bottom:12px;
  flagged as the one deviation.

## Why

A user kept reporting scrape-progress resets. Root causes under
investigation (likely playing signed-out / unverified), but the first
gap is that the game never TELLS you saving is off. Now it does,
permanently and visibly, on every surface.
