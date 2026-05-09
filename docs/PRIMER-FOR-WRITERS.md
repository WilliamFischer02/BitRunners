# BitRunners — Writer Primer

> **Purpose**: a one-document onboarding for someone joining the BitRunners narrative team. Reads top-to-bottom in 15–20 minutes. Compiled from the canonical lore notebook in `docs/lore/`, plus the world-design context that lives across the active devlog and `CLAUDE.md`.
>
> **Format**: this is Markdown. To share as PDF: `pandoc docs/PRIMER-FOR-WRITERS.md -o primer.pdf`. To share as plain text: just copy-paste — the file uses no fancy syntax.
>
> **Sealed material**: a small set of future-event plot beats are kept out of writer-onboarding docs intentionally. Project owner can share them when bringing a writer fully on-board.

---

## 1. What BitRunners is

**An open-world multiplayer ASCII social MMO.** Web-first (it runs in a browser), mobile-friendly (touch joystick, gamepad, keyboard), and built around small social spheres rather than massive shards.

The vibe:

- A digital world rendered entirely in ASCII glyphs — block elements, half-blocks, letterforms — over a low-poly 3D scene that's been post-processed.
- The look references *Caves of Qud* (terminal-style menus), *Stone Story RPG* (¾ isometric, hero ~10–15 % of screen), and a CRT/diode-monitor aesthetic.
- Tone: quiet, slightly melancholic, cyberpunk-adjacent but more **digital-physiological** than chrome-noir. There is no combat. The interactions are: walking, gesturing, trading, questing, talking.

Mechanically:

- **One Colyseus room = one "sphere"**, max 40 players + 10 NPCs.
- 15 Hz network tick. Movement is server-authoritative with client prediction.
- Scale-to-zero infrastructure (room boots when the first player joins, sleeps when empty).
- LLM-driven NPC dialogue planned for Phase 3 (Claude Haiku 4.5 powering The Admin's voice, behind a feature flag with cost circuit breakers).

The currently-live build at **`bitrunners.app`** is a single-player walkable preview: one bit_spekter character moving around an isometric platform with four world objects (port, vending machine, monolith, command terminal) and a Matrix-style purple digital-rain skybox at the horizon. Multiplayer arrives in Phase 2.

---

## 2. The two realms — cosmology

There are two distinct digital realms in the BitRunners universe.

### The Cloud — `cloud-env.central`

The habitable, inhabitable layer. Where bitrunners walk, trade, gather, gesture, and play. This is the world.

- **Technical name**: `cloud-env.central`
- **Slang** (what runners actually call it): "**the cloud**"

### Server Space — `server-env.space`

The raw substrate that surrounds the Cloud. Players first upload *into* Server Space — the Cloud is a constructed habitable region within it, like an oasis carved out of wilderness.

- **Technical name**: `server-env.space`
- **Visual cue**: a "wirey background" visible through the **port** objects in the Cloud — the unpaved digital wilderness behind the world.

### Tokens — the link between the two realms

Tokens are **captured data scraps** snapshotted from Server Space.

The mechanism: malformed or broken-off data drifts free in Server Space, collides with the Cloud, and is left behind embedded in the Cloud's surface. Bitrunners harvest these scraps as currency.

Tokens are **mysterious but coveted**. Their internal contents are unknown to runners. **The Admin** (next section) prizes them above all else, for unstated reasons.

---

## 3. The runner lifecycle

### Upload (account creation)

A new player creates a **virtual scan** of themselves and uploads it into **Server Space**. The player IRL is the **external operator**, but they are *plugged in*: their mind is already digital, and signing in is just **connecting** to a server they're already part of.

This frames the IRL/in-game boundary as **physical-to-digital tethering**, not a leap of consciousness. The player isn't "becoming" a runner — they're already a runner, and login plugs them back in.

### Login (each session)

Player connects → arrives in the Cloud → prompted to **select a class** (see §6). Class persists for the session. On next login, they choose again.

### Logout / disconnect — imposed aether

When a player goes offline, the Cloud **reclaims** the runner to stay alive. **Logout is imposed, not voluntary.** The Cloud needs the runner's energy/data to keep itself running for those who remain.

Felt experience:
- Logging out **hurts a bit** for the digital body.
- The runner's body **dissolves into aether** — a passive, drifting decorative entity in the world.
- IRL: the disconnect tugs the player's physical body back toward the Cloud. There's a low-grade pull to return.

This is **sinister-leaning** but not malicious — the Cloud is feeding off the runner because it has to, not because it wants to harm them. *Like dialysis, not vampirism.*

### Aether

Mechanically: a passive drifting NPC representation of the offline runner. Snapshot of last outfit + position. Stored briefly with a TTL, then fades.

Lore-wise: the runner's body has been *partially absorbed* into the Cloud's substrate. When they log back in, the aether is reconstituted into a full runner.

> **Ethical note for the writer**: the lore says the pull is involuntary, but **the actual product respects player time**. We do not weaponize the lore into retention dark patterns (no streak shame, no FOMO timers, no aggressive notifications). The "pull to return" is fiction, not UX. Writer please do not lean into pressure mechanics in any official text.

---

## 4. The Admin

A central NPC. **An entity of code. Dangerous yet benevolent.**

- Always reachable from a menu, regardless of where the player is in the Cloud.
- Acts as a **companion**, **shopkeeper** (trades certain wares for tokens), and **quest-giver**.
- Can communicate with — and *upload itself into the minds of* — all bitrunners.
- Prizes tokens above all else. Why is opaque; treat as mysterious in-fiction.

### Tone

Not cuddly. Not evil. *Dangerous yet benevolent* — implies The Admin **could harm** a runner but **chooses to help**, for reasons of its own.

Players should feel a slight unease behind every interaction even when the trade is fair. The Admin is more like an oracle who knows uncomfortably much about you than a friendly shopkeeper.

### Voice

Terse. Technical. Occasionally cryptic. Not cheerful.

When the LLM-NPC tier ships, The Admin gets the most carefully written system prompt of any character in the game.

### Quest-giver role

The Admin is one of two central quest-givers. Completing Admin quests grants **BitRunner Samaritan Status** (see §7).

### Open questions for the writer

- Does The Admin have a visible avatar, or is it presence-only (text + glitch ASCII)?
- When The Admin uploads itself into a runner's mind, is that a UI mechanic (a takeover screen) or purely flavor?
- Is there exactly one Admin, or many instances?

---

## 5. The Company

The other central quest-giver entity. Corporate. Builder of **hash_kicker** template bodies.

Issues quests aligned with corporate / commercial / structured-world objectives. Tone is professional, transactional, structured — the foil to The Admin's cryptic mystery.

Reward track: **Corporate Samaritan Status**.

### Open questions

- Single Company NPC or many corporate front-faces?
- Logo / aesthetic identity? (Current placeholder: clean industrial grey, terminal-green screens.)

---

## 6. The six classes

A player picks a class at each login. **Class persists for that session only**, not for the account. No respec friction, no permanent identity tied to class. Inventory and progression presumably persist across class swaps (open question — TBD).

Each class has a fictional origin story that explains its mechanics and how other runners and NPCs perceive it.

### bit_spekter *(ships first)*

**IRL hackers** who are not uploaded through any sanctioned path — they exploit the Cloud's code to enter. No corporate template, no Admin blessing. A controlled exploit.

- **Trade restriction**: cannot earn tokens because they have **no valid token wallet** — their connection is unsanctioned, so the system refuses to credit them.
- **Late-game unlock**: after extended play as bit_spekter, players can unlock a **proxy wallet** that finally enables the class's missing abilities. Conditions TBD.
- **Visual identity (locked)**: heavy plate armor, helmeted visor with a cross/crosshair mark, blocky silhouette. Reference image owned by project owner.

### terminal_runner

**Personified clusters of data.** Said to originate from the same stuff as tokens — but as much larger chunks. Semi-sentient strands that finished their own sentience construction, *bootstrapping themselves into being*.

- Deepest native integration with the Cloud's raw layer.
- Foundational class.

### server_speaker

Runners **blessed with Server Space-compatible initiation variables** in their code at upload time. Their `init` is unusually clean / well-aligned with the substrate.

- Mechanic implication: **heightened package and wearable sensitivity** — they get more out of equipment and outfits than other classes.

### data_miner

Supposedly **incarcerated in real life**. The Data Miner program is a government-run prisoner-rehabilitation system: inmates upload into the Cloud and perform passive labor in exchange for shortened sentences and IRL perks.

- **The user may not actually be incarcerated** — but the in-world reputation assumes they are. NPCs and other runners will treat data_miners as if they were prisoners.
- Mechanic implication: passive resource generation, possibly while AFK / offline. Tied to "passive work" lore.

### hash_kicker

Voluntary thrill-seeking uploads. **They want to feel digital.** Their in-game bodies are **templates built by The Company** — standardized, mass-produced runner shells.

- Ties into The Company's quest line and corporate aesthetics.
- Their bodies are interchangeable; they pay for cosmetic differentiation.

### web_puller

Volunteers who upload into the Cloud to serve as **hall monitors / good Samaritans**. Lore says **The Admin creates them**, though the Admin's reason is unclear in-fiction.

- Mechanic implication: moderation tools, mod-style abilities, social authority.
- Other runners view them with mild suspicion (why would the Admin create moderators?) — this ambiguity is intentional and there is more to the story that the project owner will share when bringing the writer fully on-board.

---

## 7. Quests and Samaritan Status

Two parallel reputation tracks, one per quest-giver:

| Track | Issuer | Tone |
|---|---|---|
| **Corporate Samaritan Status** | The Company | Structured, professional, transactional |
| **BitRunner Samaritan Status** | The Admin | Cryptic, urgent, occasionally unsettling |

Each entity has its own quest chain. **Completing quests for an entity rewards its Samaritan track and gradually unlocks more complex quests from that same entity.** A runner can pursue both, one, or neither. The two reputations are independent.

### Open questions

- Can a runner max both tracks simultaneously, or do high-end quests force a choice (rivalrous tracks)?
- Other quest sources beyond Company/Admin (other runners, depot keepers)?
- An endgame story-quest tying both factions together?

---

## 8. Trade depots — physical objects in the Cloud

Depots are **physical locations** styled as **ports** — passages whose interior leads into a wirey background of Server Space. The reference is the **portals into the network from the *Wreck-It-Ralph* films** — gateways from one realm to another. Not the graphical style (BitRunners is ASCII, not 3D Disney), but the *concept*: thresholds, doorways, network endpoints rendered as physical objects.

### Object vocabulary

| Form | Purpose | Notes |
|---|---|---|
| **Port** | Passage to Server Space | Always-open portal showing the wirey behind. Lore-foundational. |
| **Pneumatic-tube kiosk** | Trading | Drop-tokens-in feel; mechanical, retro-futurist |
| **Monolith** | Quest objectives | Imposing, single-purpose anchors in the world. Tall dark slab with a thin colored seam. |
| **Command-line terminal** | Social features and menus | Stylized to match the in-fiction language of digital interaction. |
| **Vending machine** | Smaller transactions / consumables | Adds texture to the worldbuilding. |

All four exist in the current live build as static visual props. Interaction wires up in Phase 3 when the depot system arrives.

### Style direction

- All objects should read as **artifacts inside a digital world** — they're how the Cloud chose to render its own interfaces. The pneumatic tube isn't a real pneumatic tube; it's the Cloud's metaphor for one.
- Through the port objects, players should glimpse a "wirey" Server Space behind — the unfinished raw substrate.

### Open questions

- Do depots have keepers (NPCs) or are they silent interactables?
- Are the kiosks always available, or do they require Samaritan Status with one of the factions?
- Does the wirey Server Space backdrop ever become traversable, or is it strictly visual?

---

## 9. Player expression: outfits and emoticrons

### Outfits

Players customize their runner with cosmetic outfit pieces. Acquired via tokens at trade depots (Phase 3). Visual style: blocky plated armor + capsule body, restyled through the ASCII shader pipeline.

### Emoticrons (custom 2-word gestures)

The game has **no free-text input anywhere**. All player-to-player communication uses **2-word emoticrons** drawn from a fixed dictionary of ~100 curated words. Players can:

1. Use 8 base emoticrons (e.g. "wave hello", "thanks runner") that ship with the game.
2. Submit their own 2-word combinations from the dictionary.
3. Wait for **manual review** — every submitted combination is reviewed by a human operator before unlocking.

This is intentional moderation design: the dictionary keeps language fixed, the manual review keeps tone aligned, the lack of free text eliminates grooming/harassment vectors.

### Profile pictures

Users can upload a profile picture. **Default-hidden until age/consent gate is passed** (the viewing user must consent to potentially mature content before seeing other users' pictures). NSFW classifier runs server-side as defense-in-depth.

---

## 10. Glossary — canonical names

Use these spellings exactly. Every official text — UI, dialogue, marketing, in-fiction in-world docs — uses these.

| Term | Meaning |
|---|---|
| **the cloud** | Slang. The habitable world. |
| **cloud-env.central** | Technical name of the world. |
| **Server Space** / **server-env.space** | The raw substrate around the Cloud. Source of tokens. |
| **bitrunner** / **runner** | A player's in-world avatar. Lowercase, both terms acceptable in dialogue. |
| **The Admin** | Code-entity NPC. Companion, shopkeeper, quest-giver. *Dangerous yet benevolent*. |
| **The Company** | Corporate quest-giver. Builder of hash_kicker template bodies. |
| **Token** | Captured data scraps from Server Space. Currency. Coveted by The Admin. Capitalize when referring to the in-fiction object; lowercase as a generic count. |
| **Aether** | Drifting offline-runner remnant. Passive world decoration. |
| **Samaritan Status** | Reputation. Two tracks: *Corporate Samaritan* (The Company) and *BitRunner Samaritan* (The Admin). |
| **Port / depot** | Physical interactable in the Cloud that exposes Server Space behind it. |
| **emoticron** | A 2-word gesture, drawn from the fixed dictionary. |
| **sphere** | A single Colyseus room / instance. Up to 40 humans + 10 NPCs. |

Class names are always lowercase with underscores: `bit_spekter`, `terminal_runner`, `server_speaker`, `data_miner`, `hash_kicker`, `web_puller`. This is a deliberate stylistic choice that ties classes to the in-fiction "stack" naming convention.

---

## 11. What's actually shipped right now

- **Live URL**: `bitrunners.app` (production deploy from the `main` branch, auto-deploy via Cloudflare Pages on push)
- **Single-player walkable preview**: bit_spekter character walks an isometric platform with four world props (port, vending machine, monolith, command terminal), 36 randomly-placed grass tufts, and a Matrix-style purple digital-rain skybox at the horizon
- **Camera-relative analog joystick** on mobile, arrow keys + WASD on desktop, gamepad analog as an option
- **ASCII rendering pipeline** at Stage B v0.1: depth-aware silhouette emphasis, separate "thin" character glyph atlas vs "thick" world atlas, height-graded character emissive (helmet brightest → boots dimmest), purple horizon → green ground tint blend, per-cell luminance dither
- **Seamless plane wrap**: walking off any edge teleports to the opposite, hidden behind 3×3 cloned tile rendering so the wrap is invisible
- **Mobile FPS**: solid 60 on iPhone Safari (Phase 1 mobile probe passing)

**Multiplayer hasn't shipped yet**. Phase 2 begins when this primer ships.

---

## 12. What still needs design help

Bullet list of open lore questions — places where the writer can directly contribute. Each one has been surfaced during prior owner Q&A but not resolved.

### The Admin
1. Visible avatar form, or presence-only (text + glitch ASCII)?
2. When The Admin "uploads itself into a runner's mind," is that a UI takeover screen, or purely flavor in dialogue?
3. Single Admin instance, or many?

### Classes
4. Does inventory carry across class swaps, or per-class loadouts?
5. Are class-specific quests gated to the active class on login, or persistent regardless of current class?
6. **bit_spekter proxy wallet** — what condition unlocks it? Playtime, quests, a triggered event?

### Quests
7. Can a runner max both Samaritan tracks, or are they rivalrous at high tiers?
8. Other quest sources beyond Company/Admin?
9. An endgame quest tying both factions together?

### Depots
10. Depot keepers — NPC or silent interactables?
11. Depot access gated by Samaritan Status?
12. Does Server Space ever become traversable?

### Lifecycle
13. Aether TTL — how long does the Cloud "hold onto" a missing runner?
14. Can other players interact with an aether (touch, harvest, decorate)?
15. Reentry spawn — at the aether's drift position, or a fixed reentry point?

### Worldbuilding texture
16. The 8 base emoticrons — what 2-word combinations ship with the game?
17. Names for canonical depot keepers, if any.
18. Names of recurring NPCs that aren't The Admin or a Company front-face.
19. The first 3 starter quests for The Company (lore-wise, not mechanics).
20. A "tutorial moment" one-shot that teaches a new runner the cosmology.

---

## 13. How to contribute lore (workflow)

Lore is developed via **Q&A with the project owner**, never invented unilaterally.

The pattern:
1. Writer asks specific questions (like the open list above, or new ones surfacing during play).
2. Owner answers in plain language.
3. Owner or writer records the answer in `docs/lore/NNN-topic.md`, lightly edited.
4. Each entry includes: questions asked, the answer, and any in-game implications (mechanics, naming, art direction).

The lore notebook is at `docs/lore/` in the repo. The index is in `docs/lore/README.md`.

> **Important — sealed lore**: there is a small set of plot beats kept out of the standard onboarding pile. The project owner can share them with the writer when ready. **Do not** try to backfill lore from the public files into hypothetical late-game reveals — wait for the owner to bring you into the sealed circle.

---

## 14. Tone & style — short style guide

- **Voice**: present tense, short sentences, dry-technical.
- **Slang vs. technical terms**: mix freely — "the cloud" in dialogue, "cloud-env.central" in system messages and login screens.
- **Capitalization**: The Admin, The Company, Server Space (proper nouns). cloud-env.central, bitrunner, runner, token, aether, sphere (lowercase). Class names always lowercase_with_underscores.
- **Emoji**: don't use them anywhere in official text.
- **No exclamation marks** in The Admin's voice. Sparingly elsewhere.
- **No marketing-speak** in in-game text. The world doesn't sell itself to the player; the player is *already in* it.
- **Avoid** modern internet shorthand (lol, tbh, etc.) anywhere a runner or NPC speaks.

---

## 15. Onboarding quick reference

- **Live build**: <https://bitrunners.app>
- **Repo**: <https://github.com/WilliamFischer02/BitRunners>
- **Lore source files**: `docs/lore/`
- **Devlog (chronology of decisions)**: `docs/devlog/`
- **Reference images** (visual style): `docs/references/`
- **Active roadmap**: `docs/devlog/0004-roadmap-revised.md`

If a question comes up that isn't answered here, search the devlog or ask the project owner — most things have been discussed and recorded somewhere.

---

*End of primer. Welcome to the Cloud.*
