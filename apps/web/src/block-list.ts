// Client-side tether block list (PR 90).
//
// Per docs/lore/015-chat-policy.md the full block list lives in
// `profiles.dm_blocked` and the server enforces it. Until the server
// gains Supabase integration, this module backs the same UX at the
// client level: blocked sessionIds drop incoming tether requests
// silently, and the cartridge refuses to send outgoing requests to
// blocked targets.
//
// Storage: localStorage, versioned blob. Each entry is the last-seen
// displayName + the wall-clock at block time, keyed by sessionId.
// SessionIds churn per Colyseus join, so a block on `Sx0` won't stop
// the same user from coming back as `Sxy`. That's a known V1 gap
// closed when the server persists user-uuid block lists.

const STORAGE_KEY = 'bitrunners.tether-blocks.v1';
const CHANGE_EVENT = 'bitrunners:tether-blocks-changed';

export interface BlockEntry {
  /** Colyseus sessionId snapshot at block time. */
  id: string;
  /** displayName at block time — shown in the BlockedList UI. */
  name: string;
  /** Epoch ms when the block was created. */
  ts: number;
}

interface BlockBlob {
  v: 1;
  entries: BlockEntry[];
}

function load(): BlockBlob {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { v: 1, entries: [] };
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return { v: 1, entries: [] };
    const o = parsed as Record<string, unknown>;
    if (o.v !== 1 || !Array.isArray(o.entries)) return { v: 1, entries: [] };
    const entries: BlockEntry[] = [];
    for (const e of o.entries as unknown[]) {
      if (typeof e !== 'object' || e === null) continue;
      const r = e as Record<string, unknown>;
      if (typeof r.id !== 'string' || typeof r.name !== 'string' || typeof r.ts !== 'number')
        continue;
      entries.push({ id: r.id, name: r.name, ts: r.ts });
    }
    return { v: 1, entries };
  } catch {
    return { v: 1, entries: [] };
  }
}

let cache: BlockBlob = load();

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // storage unavailable — keep the in-memory copy and move on.
  }
}

function emit(): void {
  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // non-DOM env — ignore
  }
}

export function getBlocks(): ReadonlyArray<BlockEntry> {
  return cache.entries;
}

export function isBlocked(id: string): boolean {
  return cache.entries.some((e) => e.id === id);
}

export function addBlock(id: string, name: string): void {
  if (!id) return;
  if (cache.entries.some((e) => e.id === id)) return;
  cache = {
    v: 1,
    entries: [...cache.entries, { id, name: name || '─', ts: Date.now() }],
  };
  save();
  emit();
}

export function removeBlock(id: string): void {
  const next = cache.entries.filter((e) => e.id !== id);
  if (next.length === cache.entries.length) return;
  cache = { v: 1, entries: next };
  save();
  emit();
}

export function subscribeBlocks(cb: (entries: ReadonlyArray<BlockEntry>) => void): () => void {
  const handler = (): void => cb(cache.entries);
  window.addEventListener(CHANGE_EVENT, handler);
  cb(cache.entries);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
