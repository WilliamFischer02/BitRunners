# 0116 — Account-needed nudge (mega-batch 2 · 4.3)

## What

Guests keep all progress in a device-local economy blob (`economy.ts`) — it
only follows them across devices once they make an account and it syncs to
`player_economy`. New players don't know that. Added a small, dismissable
modal that pops the first time a guest hits a moment worth saving and routes
to account creation.

## Pieces

- **`account-nudge.ts`** — the call surface. `nudgeAccount(reason)` fires an
  `ACCOUNT_NUDGE_EVENT` for a fresh reason. Guards: no-op for signed-in
  users, for a reason already shown this session (`Set<NudgeReason>`), and
  when auth isn't configured (nothing to sign up for). `startAccountNudge()`
  watches auth (so the guest/signed-in check is synchronous) and wires the
  badge trigger. Only reads auth + dispatches a DOM event — no React, no
  scene/economy coupling — so it's callable from UI or plain modules.
- **`AccountNudge.tsx`** — the modal. Reuses the `.panel` shell, terminal
  copy, a purple `[ make account ]` primary that dispatches the existing
  `bitrunners:open-profile` event (opens the account panel that already
  hosts sign-up) and a `[ later ]` secondary. ESC, backdrop tap, and both
  buttons dismiss; it never hard-blocks input. Mounted once in `App.tsx`.

## Triggers (guest-only, each once per session)

| Reason | Wired at |
| --- | --- |
| `minigame` | `FreqLock.tsx` after the first credit award (>0) |
| `shop` | `ScrapeMenu.tsx` — outfit `buy`, `purchaseEmote`, `exchangeCreditsForTokens` (all on success) |
| `mission` | `mission-sync.ts` when a mission transitions to `complete` |
| `emote` | `ScrapeMenu.tsx` — `setEmoteSlot` (set + clear) |
| `badge` | `account-nudge.ts` listens for `BADGE_EARNED_EVENT` |

The new `circuit_patch` / `core_run` minigames (4.4 / 4.5, later PRs) will
call `nudgeAccount('minigame')` on their first reward too.

## Note on the badge trigger

`earned_badges` rows are inserted server-side and the realtime monitor
(`badge-notifications.ts`) only runs for an authenticated session — so a
**guest can't earn a badge**, and the `badge` nudge is inert by design (the
signed-in guard short-circuits it). The listener is wired anyway so the
trigger has a source the moment a local/guest badge path ever exists. The
tutorial-end CTA is left untouched (it already handles that moment).

## Verify (owner)

As a **guest** (signed out), each of these should pop the modal once:
- Finish a `freq_lock` run that earns ≥1 credit.
- Buy an outfit item / premium emote / tokens in the shop.
- Complete a mission objective.
- Change an emote loadout slot.

Then: `[ make account ]` opens the account panel; `[ later ]`, ESC, and
tapping outside all dismiss. Repeat the same action → no second pop.
Sign in → none of them ever pop.
