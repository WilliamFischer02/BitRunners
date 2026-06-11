// Tiny seeded profanity classifier — V1 intermediate moderation.
//
// Per docs/lore/015-chat-policy.md the gate has three outcomes:
//   clean   → forward to peer
//   flagged → forward to peer + log for owner review (mild)
//   blocked → drop + log (severe; sender sees a generic notice)
//
// This is the minimum bar shipped while the full `bad-words` / `obscenity`
// library decision is still open (chat-policy "Open questions"). The seed
// lists below are intentionally small — they catch the worst slurs and a
// short list of common mild profanity. Owner can swap in the real library
// later without changing the call site.

export type Moderation = 'clean' | 'flagged' | 'blocked';

// Severe — slurs / sexual violence. Dropped silently; sender sees only
// "// channel rejected" notice from the server. Kept short on purpose:
// a longer list belongs in a curated wordlist file under a real library.
const BLOCKED_WORDS: ReadonlyArray<string> = [
  'nigger',
  'nigga',
  'faggot',
  'tranny',
  'retard',
  'rape',
  'rapist',
  'kys',
  'kill yourself',
];

// Mild — pass through but get logged for owner review. Tiny seed; the
// real list comes from the picked library in a follow-up.
const FLAGGED_WORDS: ReadonlyArray<string> = [
  'fuck',
  'fucker',
  'fucking',
  'shit',
  'shitty',
  'bitch',
  'asshole',
  'bastard',
  'damn',
];

// Normalize for comparison: lowercase, collapse whitespace, strip punctuation
// between letters. Catches `f-u-c-k` and `f u c k` but leaves the original
// body untouched for audit display.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAny(haystack: string, needles: ReadonlyArray<string>): string | null {
  for (const word of needles) {
    // word boundaries — avoid flagging "classic" because of "ass".
    const re = new RegExp(`\\b${word}\\b`, 'i');
    if (re.test(haystack)) return word;
  }
  return null;
}

export interface ClassifyResult {
  moderation: Moderation;
  match: string | null;
}

export function classifyTetherBody(body: string, isEmote: boolean): ClassifyResult {
  // Emote glyphs are server-curated (EMOTE_GLYPHS allowlist already
  // validated upstream by isValidEmote). Skip the text classifier — they
  // can never carry user-supplied prose.
  if (isEmote) return { moderation: 'clean', match: null };

  const norm = normalize(body);
  const blocked = containsAny(norm, BLOCKED_WORDS);
  if (blocked) return { moderation: 'blocked', match: blocked };
  const flagged = containsAny(norm, FLAGGED_WORDS);
  if (flagged) return { moderation: 'flagged', match: flagged };
  return { moderation: 'clean', match: null };
}
