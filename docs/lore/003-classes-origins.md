# 003 — Class origins

## Question

Are the 6 classes innate or chosen? Can players respec?

## Answer (canon)

**Class is selected at each login.** The chosen class persists for that session. On next login, the player is prompted to choose again. No locked respec; no permanent class identity tied to the account.

Each class has a fictional origin story that explains its mechanics.

---

### server_speaker

Runners **blessed with Server Space-compatible initiation variables** in their code at upload time. Their `init` is unusually clean / well-aligned with the substrate.

- **Mechanic implication**: heightened **package** and **wearable sensitivity** — they get more out of equipment and outfits than other classes.

---

### data_miner

Supposedly **incarcerated in real life**. The Data Miner program is a government-run prisoner-rehabilitation system: inmates upload into the Cloud and perform passive labor in exchange for shortened sentences and IRL perks.

- **The user may not actually be incarcerated** — but the in-world reputation assumes they are. NPCs and other runners will treat data_miners as if they were prisoners.
- **Mechanic implication**: passive resource generation, possibly while AFK / offline. Tied to "passive work" lore.

---

### terminal_runner *(ships first)*

**Personified clusters of data.** Said to originate from the same stuff as tokens — but as much larger chunks. Semi-sentient strands that finished their own sentience construction, *bootstrapping themselves into being*.

- **Mechanic implication**: deepest native integration with the Cloud's raw layer; foundational class for the MVP. Kit details in the active devlog.

---

### hash_kicker

Voluntary thrill-seeking uploads. **They want to feel digital.** Their in-game bodies are **templates built by "The Company"** — standardized, mass-produced runner shells.

- **Mechanic implication**: ties into The Company's quest line and corporate aesthetics.

---

### web_puller

Volunteers who upload into the Cloud to serve as **hall monitors / good Samaritans**. Lore says **The Admin creates them**, though the Admin's reason is unclear in-fiction.

- **Mechanic implication**: moderation tools, mod-style abilities, social authority.
- **Sealed plot beat**: see `_sealed/web-pullers.md` — do not surface in player-facing UI or NPC dialogue without project owner approval.

---

### bit_spekter

**IRL hackers** who are not uploaded through any sanctioned path — they exploit / "manipulate" the Cloud's code to enter. No corporate template, no Admin blessing. A controlled exploit.

- **Trade restriction**: cannot earn tokens because they have **no valid token wallet** — their connection is unsanctioned, so the system refuses to credit them.
- **Late-game unlock**: after extended play as bit_spekter, players can unlock a **proxy wallet** that finally enables the class's missing abilities. (Unlock conditions TBD.)

---

## In-game implications

- Class-select screen shown on every login. Stylized terminal prompt.
- Class persistence is per-session, not per-account. Inventory and progression presumably persist across classes (open question).
- Reputation systems should account for the data_miner social stigma.
- Bit_spekter trade UX must clearly explain *why* trading is restricted — players will hit this wall and need to understand it's lore, not a bug.

## Open questions

- Does inventory carry across class swaps, or does each class have its own loadout slot?
- Are class-specific quests gated to the right class on that login, or persistent across logins regardless of current class?
- What unlocks the bit_spekter proxy wallet — playtime, quests, tokens spent, or a specific event?
