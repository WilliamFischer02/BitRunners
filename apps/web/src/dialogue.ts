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
  // Mission: Recover an aether's last data (docs/lore/011-physical-missions.md)
  {
    key: 'mission.aether01.opening',
    label: 'Mission: aether01 · opening',
    lines: [
      'fragments. drifting cold here.',
      'a runner ended. data still warm.',
      'someone should carry this.',
    ],
  },
  {
    key: 'mission.aether01.choice_br',
    label: 'Mission: aether01 · BitRunner choice label',
    lines: ['// send the scraps to The Admin'],
  },
  {
    key: 'mission.aether01.choice_corp',
    label: 'Mission: aether01 · Corporate choice label',
    lines: ['// sell the scraps to The Company'],
  },
  {
    key: 'mission.aether01.closing_br',
    label: 'Mission: aether01 · closing (BitRunner)',
    lines: ['the cloud thanks you, runner.', '// route logged.'],
  },
  {
    key: 'mission.aether01.closing_corp',
    label: 'Mission: aether01 · closing (Corporate)',
    lines: ['transaction filed.', '// company acknowledges your contribution.'],
  },
  // ── Mission 02 — dead port audit ─────────────────────────────────────
  {
    key: 'mission.deadport02.opening',
    label: 'Mission: deadport02 · opening',
    lines: [
      'three ports went dark this cycle.',
      'walk them. log what answers back.',
      'ports remember more than runners do.',
    ],
  },
  {
    key: 'mission.deadport02.choice_br',
    label: 'Mission: deadport02 · BitRunner choice',
    lines: ['// hand the audit to The Admin'],
  },
  {
    key: 'mission.deadport02.choice_corp',
    label: 'Mission: deadport02 · Corporate choice',
    lines: ['// file the audit with The Company'],
  },
  {
    key: 'mission.deadport02.closing_br',
    label: 'Mission: deadport02 · closing (BitRunner)',
    lines: ['the admin nods.', '// dead ports stay dead until the cloud says otherwise.'],
  },
  {
    key: 'mission.deadport02.closing_corp',
    label: 'Mission: deadport02 · closing (Corporate)',
    lines: ['company actuaries log the cost.', '// the ports will be reopened on schedule.'],
  },
  // ── Mission 03 — rogue signal ────────────────────────────────────────
  {
    key: 'mission.roguesignal03.opening',
    label: 'Mission: roguesignal03 · opening',
    lines: [
      'a rogue is broadcasting on the runner band.',
      'find where the signal bounces three times.',
      'do not answer it. just locate it.',
    ],
  },
  {
    key: 'mission.roguesignal03.choice_br',
    label: 'Mission: roguesignal03 · BitRunner choice',
    lines: ['// route the coords to The Admin'],
  },
  {
    key: 'mission.roguesignal03.choice_corp',
    label: 'Mission: roguesignal03 · Corporate choice',
    lines: ['// hand the coords to The Company'],
  },
  {
    key: 'mission.roguesignal03.closing_br',
    label: 'Mission: roguesignal03 · closing (BitRunner)',
    lines: [
      'the admin will listen first, then decide.',
      '// rogues sometimes carry useful complaints.',
    ],
  },
  {
    key: 'mission.roguesignal03.closing_corp',
    label: 'Mission: roguesignal03 · closing (Corporate)',
    lines: [
      'company enforcement is dispatched.',
      '// the rogue signal will be quieted by the next shift.',
    ],
  },
  // ── Mission 04 — Company courier loop ────────────────────────────────
  {
    key: 'mission.courier04.opening',
    label: 'Mission: courier04 · opening',
    lines: [
      'the company moves goods between depots in routes.',
      'one route is short three feet today.',
      'walk it. keep your head down.',
    ],
  },
  {
    key: 'mission.courier04.choice_br',
    label: 'Mission: courier04 · BitRunner choice',
    lines: ['// slip a copy of the manifest to The Admin'],
  },
  {
    key: 'mission.courier04.choice_corp',
    label: 'Mission: courier04 · Corporate choice',
    lines: ['// deliver the manifest clean to The Company'],
  },
  {
    key: 'mission.courier04.closing_br',
    label: 'Mission: courier04 · closing (BitRunner)',
    lines: [
      'the admin reads the manifest twice.',
      '// every shipped object teaches the cloud something.',
    ],
  },
  {
    key: 'mission.courier04.closing_corp',
    label: 'Mission: courier04 · closing (Corporate)',
    lines: ['company schedulers credit your run.', '// you have been added to the courier ledger.'],
  },
  // ── Mission 05 — whisper trail ───────────────────────────────────────
  {
    key: 'mission.whisper05.opening',
    label: 'Mission: whisper05 · opening',
    lines: [
      'a whisper crosses the cloud at the edge of hearing.',
      'three crests, then a source.',
      'walk to where it is no longer faint.',
    ],
  },
  {
    key: 'mission.whisper05.choice_br',
    label: 'Mission: whisper05 · BitRunner choice',
    lines: ['// describe it to The Admin'],
  },
  {
    key: 'mission.whisper05.choice_corp',
    label: 'Mission: whisper05 · Corporate choice',
    lines: ['// flag it as a corporate concern'],
  },
  {
    key: 'mission.whisper05.closing_br',
    label: 'Mission: whisper05 · closing (BitRunner)',
    lines: [
      'the admin is quiet for a long second.',
      '// the whisper is older than the cloud. that is all you need to know.',
    ],
  },
  {
    key: 'mission.whisper05.closing_corp',
    label: 'Mission: whisper05 · closing (Corporate)',
    lines: [
      'company audio analysts file it as ambient noise.',
      '// the whisper is not a corporate concern. yet.',
    ],
  },
  // ── Mission 06 — monolith resonance ──────────────────────────────────
  {
    key: 'mission.monolith06.opening',
    label: 'Mission: monolith06 · opening',
    lines: [
      'three monoliths share a chord nobody sang.',
      'stand beside each in turn. let them hear you.',
      'they will know what to do.',
    ],
  },
  {
    key: 'mission.monolith06.choice_br',
    label: 'Mission: monolith06 · BitRunner choice',
    lines: ['// offer the resonance to The Admin'],
  },
  {
    key: 'mission.monolith06.choice_corp',
    label: 'Mission: monolith06 · Corporate choice',
    lines: ['// report the resonance to The Company'],
  },
  {
    key: 'mission.monolith06.closing_br',
    label: 'Mission: monolith06 · closing (BitRunner)',
    lines: [
      'the admin hums the chord back to you.',
      '// the monoliths are not decoration. remember that.',
    ],
  },
  {
    key: 'mission.monolith06.closing_corp',
    label: 'Mission: monolith06 · closing (Corporate)',
    lines: ['company engineers schedule a sweep.', '// the resonance will be measured and filed.'],
  },
  // ── Mission 07 — bit_spekter origin ──────────────────────────────────
  {
    key: 'mission.origin07.opening',
    label: 'Mission: origin07 · opening',
    lines: [
      'bit_spekter shapes are born somewhere.',
      'walk the cradle echoes. find the first one.',
      'you will not like what you find.',
    ],
  },
  {
    key: 'mission.origin07.choice_br',
    label: 'Mission: origin07 · BitRunner choice',
    lines: ['// tell The Admin what you found'],
  },
  {
    key: 'mission.origin07.choice_corp',
    label: 'Mission: origin07 · Corporate choice',
    lines: ['// tell The Company what you found'],
  },
  {
    key: 'mission.origin07.closing_br',
    label: 'Mission: origin07 · closing (BitRunner)',
    lines: ['the admin does not respond.', '// the silence is the answer.'],
  },
  {
    key: 'mission.origin07.closing_corp',
    label: 'Mission: origin07 · closing (Corporate)',
    lines: ['company classifies the cradle data.', '// the bit_spekter line is now archived.'],
  },
  // ── Mission 08 — Server Space breach ─────────────────────────────────
  {
    key: 'mission.breach08.opening',
    label: 'Mission: breach08 · opening',
    lines: [
      'something is leaking through from server space.',
      'three points of pressure. one source.',
      'do not stand directly in front of it.',
    ],
  },
  {
    key: 'mission.breach08.choice_br',
    label: 'Mission: breach08 · BitRunner choice',
    lines: ['// describe the breach to The Admin'],
  },
  {
    key: 'mission.breach08.choice_corp',
    label: 'Mission: breach08 · Corporate choice',
    lines: ['// hand the breach data to The Company'],
  },
  {
    key: 'mission.breach08.closing_br',
    label: 'Mission: breach08 · closing (BitRunner)',
    lines: ['the admin marks the spot in the cloud.', '// runners will know to avoid it. or not.'],
  },
  {
    key: 'mission.breach08.closing_corp',
    label: 'Mission: breach08 · closing (Corporate)',
    lines: [
      'company dispatch will seal the breach by morning.',
      '// containment is a corporate strength.',
    ],
  },
  // ── Mission 09 — echo chamber ────────────────────────────────────────
  {
    key: 'mission.echo09.opening',
    label: 'Mission: echo09 · opening',
    lines: [
      'older runners left echoes here.',
      'three locations remember three voices.',
      'listen carefully. do not interrupt.',
    ],
  },
  {
    key: 'mission.echo09.choice_br',
    label: 'Mission: echo09 · BitRunner choice',
    lines: ['// hand the recordings to The Admin'],
  },
  {
    key: 'mission.echo09.choice_corp',
    label: 'Mission: echo09 · Corporate choice',
    lines: ['// hand the recordings to The Company'],
  },
  {
    key: 'mission.echo09.closing_br',
    label: 'Mission: echo09 · closing (BitRunner)',
    lines: [
      'the admin replays one of the voices for you.',
      '// the cloud is older than it pretends to be.',
    ],
  },
  {
    key: 'mission.echo09.closing_corp',
    label: 'Mission: echo09 · closing (Corporate)',
    lines: [
      'company archivists log the recordings.',
      '// future bit_spekter templates may inherit a phrase or two.',
    ],
  },
  // ── Mission 10 — The Admin's question ────────────────────────────────
  {
    key: 'mission.question10.opening',
    label: 'Mission: question10 · opening',
    lines: [
      'the admin has a question for you.',
      'walk the corridor. it is not long.',
      'when you stand at the obelisk, choose carefully.',
    ],
  },
  {
    key: 'mission.question10.choice_br',
    label: 'Mission: question10 · BitRunner choice',
    lines: ['// answer The Admin honestly'],
  },
  {
    key: 'mission.question10.choice_corp',
    label: 'Mission: question10 · Corporate choice',
    lines: ['// tell The Company what The Admin asked'],
  },
  {
    key: 'mission.question10.closing_br',
    label: 'Mission: question10 · closing (BitRunner)',
    lines: [
      'the admin smiles, briefly.',
      '// you have answered the cloud. the cloud will remember.',
    ],
  },
  {
    key: 'mission.question10.closing_corp',
    label: 'Mission: question10 · closing (Corporate)',
    lines: [
      'company intelligence files your report.',
      '// the admin question is now a corporate asset.',
    ],
  },
];

const byKey = new Map<string, DialogueEntry>(DIALOGUE_DEFAULTS.map((e) => [e.key, e]));
const overrides = new Map<string, string[]>();

// Overrides are cached in localStorage so returning players get the owner's
// edited lines instantly, without a boot-time table fetch (perf P1, 0139).
const CACHE_KEY = 'bitrunners.dialogue.overrides.v1';

function applyRows(rows: ReadonlyMap<string, string[]> | Record<string, unknown>): void {
  const entries = rows instanceof Map ? rows.entries() : Object.entries(rows);
  for (const [key, lines] of entries) {
    if (Array.isArray(lines)) {
      overrides.set(
        key,
        lines.filter((l): l is string => typeof l === 'string'),
      );
    }
  }
}

// Seed from the cache synchronously at module load — cheap, no network.
try {
  const raw = localStorage.getItem(CACHE_KEY);
  if (raw) applyRows(JSON.parse(raw) as Record<string, unknown>);
} catch {
  /* corrupt or unavailable cache — in-code defaults still work */
}

let loadStarted = false;

/** Refresh overrides from Supabase, once per session, in the background.
 *  Triggered lazily by the first dialogue read instead of at boot — the
 *  first read may serve cached (or default) lines while the fetch runs. */
function ensureDialogueLoaded(): void {
  if (loadStarted) return;
  loadStarted = true;
  void (async () => {
    const sb = getSupabase();
    if (!sb) return;
    const { data, error } = await sb.from('dialogue').select('key, lines');
    if (error || !data) return;
    // Replace wholesale so overrides deleted server-side also drop locally.
    overrides.clear();
    const cache: Record<string, unknown> = {};
    for (const row of data as { key: string; lines: unknown }[]) {
      cache[row.key] = row.lines;
    }
    applyRows(cache);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      /* storage unavailable — fetch-per-session still works */
    }
  })();
}

/** Lines for a key: admin override if present, else the in-code default. */
export function getLines(key: string): string[] {
  ensureDialogueLoaded();
  return overrides.get(key) ?? byKey.get(key)?.lines ?? [];
}

/** First line (for single-line entries like SAMM quips). */
export function getLine(key: string): string {
  return getLines(key)[0] ?? '';
}

/** Admin editor: every entry with its current (override-or-default) lines. */
export function listDialogue(): DialogueEntry[] {
  ensureDialogueLoaded();
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
