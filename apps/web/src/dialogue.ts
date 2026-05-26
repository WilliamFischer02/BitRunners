// Editable NPC dialogue registry (admin console phase 2, devlog 0048).
//
// Each entry has a stable key, a label (for the admin editor), and in-code
// default lines. The admin can override the lines; overrides live in the
// `dialogue` table (migration 0004) and are fetched once at startup. Anything
// not overridden falls back to the default here — so the table only holds what
// the owner edited.
//
// NPC components read getLines()/getLine() instead of hardcoded constants. This
// module is the only place dialogue meets Supabase (keeps the NPC modules from
// importing the network layer; samm.ts stays isolated by returning a quipKey).
import { getSupabase } from './supabase.js';

export interface DialogueEntry {
  key: string;
  label: string;
  lines: string[];
}

export const DIALOGUE_DEFAULTS: readonly DialogueEntry[] = [
  {
    key: 'admin.opening',
    label: 'Admin · opening',
    lines: ['so —', 'another shape finds me.', 'i have read you already.'],
  },
  {
    key: 'admin.happy',
    label: 'Admin · reply to happy',
    lines: ['warmth. logged.', 'it will not save you.'],
  },
  {
    key: 'admin.tired',
    label: 'Admin · reply to tired',
    lines: ['rest is a rumor here.', 'the cloud never sleeps.'],
  },
  {
    key: 'admin.okay',
    label: 'Admin · reply to okay',
    lines: ['compliance. noted.', 'we will speak again.'],
  },
  {
    key: 'admin.help',
    label: 'Admin · reply to help',
    lines: ['i am always here.', 'that is the trouble.'],
  },
  {
    key: 'samm.greeting',
    label: 'SAMM · greeting',
    lines: ['GREETINGS, VALUED PARTICIPANT. THE STATE WELCOMES YOUR CONTRIBUTION.'],
  },
  {
    key: 'samm.insufficient',
    label: 'SAMM · insufficient credits',
    lines: ['INSUFFICIENT CREDITS, PARTICIPANT. THE STATE ENCOURAGES THRIFT — THEN RETURN.'],
  },
  {
    key: 'samm.lose',
    label: 'SAMM · loss',
    lines: ['A GENEROUS DONATION TO THE PUBLIC COFFERS. THE STATE THANKS YOU MOST WARMLY.'],
  },
  {
    key: 'samm.small',
    label: 'SAMM · small win',
    lines: ['A MODEST DISBURSEMENT, DULY NOTED IN THE LEDGER. CONGRATULATIONS, CITIZEN.'],
  },
  {
    key: 'samm.big',
    label: 'SAMM · big win',
    lines: ['A BANNER DAY FOR PARTICIPANT AND STATE ALIKE. JUBILATION!'],
  },
  {
    key: 'samm.item',
    label: 'SAMM · item win',
    lines: ['A PHYSICAL PRIZE! PLEASE COLLECT IT FROM YOUR ALLOCATION. HOW DELIGHTFUL.'],
  },
  {
    key: 'samm.token',
    label: 'SAMM · token win',
    lines: ['A TOKEN PRIZE! ADDED TO YOUR WALLET. THE STATE APPLAUDS YOUR FORTUNE.'],
  },
];

const byKey = new Map<string, DialogueEntry>(DIALOGUE_DEFAULTS.map((e) => [e.key, e]));
const overrides = new Map<string, string[]>();

/** Lines for a key: admin override if present, else the in-code default. */
export function getLines(key: string): string[] {
  return overrides.get(key) ?? byKey.get(key)?.lines ?? [];
}

/** First line (for single-line entries like SAMM quips). */
export function getLine(key: string): string {
  return getLines(key)[0] ?? '';
}

/** Fetch admin overrides once at startup. No-op when auth isn't configured. */
export async function initDialogue(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { data, error } = await sb.from('dialogue').select('key, lines');
  if (error || !data) return;
  for (const row of data as { key: string; lines: unknown }[]) {
    if (Array.isArray(row.lines)) {
      overrides.set(
        row.key,
        row.lines.filter((l): l is string => typeof l === 'string'),
      );
    }
  }
}

/** Admin editor: every entry with its current (override-or-default) lines. */
export function listDialogue(): DialogueEntry[] {
  return DIALOGUE_DEFAULTS.map((e) => ({ key: e.key, label: e.label, lines: getLines(e.key) }));
}

/** Admin editor: save an override (admin-gated by RLS). Updates the cache. */
export async function saveDialogue(
  key: string,
  lines: string[],
): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: 'auth not configured' };
  const { error } = await sb
    .from('dialogue')
    .upsert({ key, lines, updated_at: new Date().toISOString() });
  if (!error) overrides.set(key, lines);
  return { error: error?.message ?? null };
}
