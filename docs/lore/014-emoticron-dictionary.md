# 014 — Emoticron dictionary

## Question

What words can compose a 2-word emoticron? What's the seed dictionary?

## Answer (canon — owner draft 2026-06-03; **owner: review the word list and category tags**)

### Composition rule

Custom emoticrons are exactly two words joined by `.`:

```
<word_a>.<word_b>
```

Both words must exist in `emoticron_dictionary` with appropriate category tags. The owner reviews submissions in the admin console before they appear in any runner's wheel.

### Categories

Every word is tagged with one of:

- **`emote`** — feeling / state words (joy, tired, broken, online, etc.)
- **`object`** — concrete in-world objects (port, depot, token, cache, etc.)
- **`action`** — verbs (run, ping, drop, scrape, etc.)
- **`name`** — usable in usernames AND emoticrons (any noun-shaped word that's safe as a handle)

Composition rules (server-validated):
- A valid emoticron is **any (word_a, word_b)** pair where both words are in the dictionary AND neither is `name`-only.
- Usernames compose from **`name` category words only** (1 or 2 words).

### Seed dictionary (~100 words)

#### emote (32 words)

`happy`, `tired`, `broken`, `online`, `offline`, `cold`, `warm`, `cool`, `bright`, `dark`, `loud`, `quiet`, `sharp`, `dull`, `fast`, `slow`, `dim`, `glowing`, `flickering`, `stable`, `unstable`, `corrupted`, `clean`, `dirty`, `safe`, `risky`, `lucky`, `cursed`, `numb`, `awake`, `drifting`, `humming`

#### object (32 words)

`port`, `depot`, `token`, `cache`, `string`, `serial`, `passcode`, `signal`, `shard`, `pulse`, `node`, `loop`, `mesh`, `wire`, `frame`, `glyph`, `bit`, `byte`, `packet`, `relay`, `ledger`, `vault`, `kiosk`, `obelisk`, `monolith`, `terminal`, `console`, `cursor`, `prompt`, `socket`, `tunnel`, `gate`

#### action (16 words)

`run`, `ping`, `drop`, `scrape`, `kick`, `pull`, `push`, `read`, `write`, `clear`, `flush`, `bounce`, `tag`, `mark`, `seed`, `harvest`

#### name (20 words)

`runner`, `walker`, `seeker`, `keeper`, `breaker`, `maker`, `watcher`, `whisper`, `echo`, `glitch`, `static`, `signal`, `aether`, `bit`, `byte`, `cipher`, `prism`, `vector`, `pulse`, `axis`

### Approval workflow

1. Runner composes a 2-word combo via `EmoticronComposer.tsx` (two-column word picker).
2. Insert into `emoticron_submissions` with `status = 'pending'`.
3. Owner reviews in `AdminConsole` → `EmoticronQueue` (Sub-Phase D).
4. On approve, row inserts into `unlocked_emoticrons` for that user. Supabase Realtime push refreshes the client's allowlist cache.
5. Wheel slot 5–8 (the four custom slots) fills from `unlocked_emoticrons` ordered by `unlocked_at ASC`.

### Username submission

1. Runner picks 1 or 2 words from the `name` category via `UsernameEditor.tsx`.
2. Joined by `_` → `runner_axis` or `aether_echo`.
3. Insert sets `profiles.display_name_status = 'pending'`.
4. Owner reviews in `AdminConsole` → `UsernameQueue` (Sub-Phase B).
5. Until approved: the auto-assigned `runner_XXXXXX` placeholder remains the public-facing name. The requested name is **hidden from the world** to prevent unapproved content leaking.

## In-game implications

- New `emoticron_dictionary(word TEXT PRIMARY KEY, category TEXT)` table seeded by migration 0007.
- Server-side `'identity'` handler validates submitted display name characters against the dictionary.
- Server-side `'emote'` handler validates against per-session cached `unlocked_emoticrons` allowlist (refresh on Supabase Realtime push).

## Open questions

- **Owner: review all 100 words.** These are credible drafts; some may be too on-the-nose or carry unintended connotations.
- Should `name`-category words be **convertible to emoticron-compositions** by tagging them dual-category? Currently no — names compose names only; emoticrons compose `emote`/`object`/`action`. Owner can flip.
- Profanity filter on the dictionary itself: the seed list is curated, but future owner-added words should pass a profanity check. Trivial guard to add.
- **Pluralisation / inflection**: are `string` and `strings` two separate dictionary entries or normalized? V1: separate entries; owner adds plurals where needed.
