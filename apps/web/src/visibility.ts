// Page-Visibility / pagehide watcher.
//
// Browsers throttle requestAnimationFrame and timers in backgrounded tabs;
// the project's tick loop normally sends a 'move' to the server every ~67 ms,
// but when the tab is hidden that flow stops without the server learning the
// client is gone (the WebSocket stays open until TCP keepalive fires, which
// can take minutes). Without intervention every browser tab the player ever
// opened piles up as a ghost avatar at the spawn coords.
//
// This watcher emits two events:
//   - bitrunners:standby-enter when the page becomes hidden / about to
//     unload. Subscribers (scene.ts) should `dispose()` the Colyseus
//     session so the server immediately removes the avatar.
//   - bitrunners:standby-exit when the page becomes visible again. The
//     scene re-runs its `connectSphere()` to get a fresh session.
//
// Pagehide is more reliable than visibilitychange on iOS Safari (visibility
// can fire late or not at all when the tab is buried under a system UI), so
// we listen to both. Re-entry is gated on `document.visibilityState ===
// 'visible'` to avoid spurious enter→exit→enter cycles.

const ENTER_EVENT = 'bitrunners:standby-enter';
const EXIT_EVENT = 'bitrunners:standby-exit';

let started = false;
let standby = false;

function fire(name: string): void {
  try {
    window.dispatchEvent(new CustomEvent(name));
  } catch {
    // non-DOM env — ignore
  }
}

function enter(): void {
  if (standby) return;
  standby = true;
  fire(ENTER_EVENT);
}

function exit(): void {
  if (!standby) return;
  standby = false;
  fire(EXIT_EVENT);
}

export function isStandby(): boolean {
  return standby;
}

export function startVisibilityWatcher(): void {
  if (started) return;
  if (typeof document === 'undefined') return;
  started = true;

  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') enter();
    else if (document.visibilityState === 'visible') exit();
  };
  // pagehide fires when the tab is actually being unloaded (or BFCache'd
  // on iOS). It complements visibilitychange — a backgrounded tab that
  // gets killed by the OS still emits pagehide first.
  const onPageHide = (): void => enter();
  // beforeunload as a final guarantee for desktop browsers that don't
  // fire pagehide reliably on tab close.
  const onBeforeUnload = (): void => enter();

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('beforeunload', onBeforeUnload);

  // Initial state. If the page loaded while hidden (rare), reflect that.
  if (document.visibilityState === 'hidden') enter();
}

export const STANDBY_ENTER_EVENT = ENTER_EVENT;
export const STANDBY_EXIT_EVENT = EXIT_EVENT;
