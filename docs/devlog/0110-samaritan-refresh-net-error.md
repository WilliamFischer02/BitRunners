# 0110 — Reputation refresh + readable NET error

## What broke (field report)

Owner's brother reported two things:

1. A status line reading `NET: ERROR · [object XMLHttpRequest...` while
   trying to play.
2. Reputation (Samaritan) for the Admin / Company **not** updating
   after missions, even though badges were correctly being awarded.

## TL;DR

- **Samaritan refresh.** `profile.ts` now refreshes the cached identity
  snapshot whenever a `bitrunners:mission-complete` event fires. The
  `complete_mission` RPC always updated `profiles.samaritan_corporate`
  / `samaritan_bitrunner` on the server — the client just never
  re-fetched. Reputation chips now tick up the moment a mission
  completes.
- **NET error message.** `scene.ts` now formats Colyseus matchmaker
  rejections through a `formatNetError()` helper. Raw XHR rejections
  become `server unreachable (cold start? network blocked?)` or
  `xhr 503 Service Unavailable` instead of `[object XMLHttpRequest]`.
  Doesn't fix the underlying connection failure (probably a Fly
  cold-start race), but makes future bug reports diagnosable.

## Why the Samaritan bug existed

| Channel | Refresh mechanism | Status |
| --- | --- | --- |
| Badges | Realtime subscription on `earned_badges` — fires `BADGE_EARNED_EVENT`, scene + level refresh. | ✅ |
| Samaritan | No realtime channel; refreshed only on auth flip and a handful of UI flows (UsernameEditor, BadgesModal open). | ❌ |

`MissionDialogue.tsx` fires a `bitrunners:mission-complete` event after
the RPC returns. Adding one window listener in `profile.ts` is the
cheapest fix — keeps the concern in the identity module and lets any
future Samaritan-mutating flow piggyback by firing the same event.

## Why the NET error message was unreadable

```ts
// before
const msg = (err as Error)?.message ?? String(err);
setNet(`net: error · ${msg.slice(0, 80)}`, 'error');
```

When Colyseus's matchmaker XHR fails outright (status 0, network
unreachable), it rejects the promise with the raw `XMLHttpRequest`
instance. That has no `message` property, so the code falls through to
`String(err)` → `[object XMLHttpRequest]`.

The new `formatNetError()` checks `instanceof XMLHttpRequest` first and
maps `status === 0` to `server unreachable (cold start? network
blocked?)`, which is the actual signal the user needs.

## Files touched

- `apps/web/src/profile.ts` — extend `startIdentity()` to listen for
  `bitrunners:mission-complete` and call `refreshIdentity()`.
- `apps/web/src/scene.ts` — new `formatNetError()` helper; the
  multiplayer connect catch block now routes through it.

No migration, no server change.

## What I didn't do

- **Server cold-start.** Fly auto-stops `bitrunners.fly.dev` after
  idle. The first request after a cold start can race the boot and
  drop the connection. Mitigations (warm-up ping, keep-warm cron,
  larger memory tier) are policy calls — out of scope for this fix.
- **Samaritan realtime channel.** A Supabase realtime subscription on
  `profiles` for the local user would make refresh push-driven instead
  of event-driven, but it's higher cost and we don't have any other
  flow that mutates Samaritan without firing the event. Deferred.
- **Other Samaritan-mutating flows.** `adminGrantSamaritan` (admin
  console) updates someone else's profile, not the local user's —
  irrelevant here.
