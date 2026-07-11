// Zero-dep perf instrumentation + overlay HUD, active ONLY with `?perf=1`.
// Shows fps, JS heap (Chrome), and per-second rates of named counters
// (economy mutations / storage writes / event dispatches) so a regression is
// visible in ten seconds without DevTools. Plain DOM on purpose — no React
// reconciliation cost, no imports, safe to hook from hot paths.
//
// Usage: `perfCount('eco.write')` from instrumented call sites (no-op unless
// enabled), `initPerfHud()` once from main.tsx.

export const PERF_ENABLED: boolean =
  typeof location !== 'undefined' &&
  typeof URLSearchParams !== 'undefined' &&
  new URLSearchParams(location.search).get('perf') === '1';

const counters = new Map<string, number>();

/** Increment a named counter. No-op (one branch) when ?perf=1 is absent. */
export function perfCount(name: string): void {
  if (!PERF_ENABLED) return;
  counters.set(name, (counters.get(name) ?? 0) + 1);
}

interface MemoryInfo {
  usedJSHeapSize: number;
}

function heapMB(): string {
  const mem = (performance as unknown as { memory?: MemoryInfo }).memory;
  return mem ? `${(mem.usedJSHeapSize / 1048576).toFixed(1)} MB` : 'n/a';
}

let inited = false;

/** Mount the overlay + start the 1 Hz sampler. Call once from main.tsx. */
export function initPerfHud(): void {
  if (!PERF_ENABLED || inited || typeof document === 'undefined') return;
  inited = true;

  // Count economy traffic passively — dispatch sites don't need a hook.
  for (const ev of ['bitrunners:economy-changed', 'bitrunners:appearance-changed']) {
    window.addEventListener(ev, () => perfCount(`dispatch ${ev.split(':')[1]}`));
  }

  const el = document.createElement('pre');
  el.id = 'perf-hud';
  el.style.cssText =
    'position:fixed;top:4px;left:4px;z-index:10000;margin:0;padding:4px 6px;' +
    'font:10px/1.4 monospace;color:#7fff9f;background:rgba(0,0,0,0.7);' +
    'pointer-events:none;white-space:pre;border:1px solid #2a4;';
  document.body.appendChild(el);

  let frames = 0;
  const onFrame = (): void => {
    frames++;
    requestAnimationFrame(onFrame);
  };
  requestAnimationFrame(onFrame);

  let last = performance.now();
  window.setInterval(() => {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    const fps = (frames / dt).toFixed(0);
    frames = 0;
    let lines = `perf · fps ${fps} · heap ${heapMB()}`;
    for (const [name, n] of [...counters.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      lines += `\n${name} · ${(n / dt).toFixed(0)}/s`;
      counters.set(name, 0);
    }
    el.textContent = lines;
  }, 1000);
}
