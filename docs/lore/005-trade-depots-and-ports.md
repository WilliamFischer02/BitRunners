# 005 — Trade depots, ports, and worldbuilding objects

## Question

What are the trade depots? Physical locations or abstract endpoints?

## Answer (canon)

**Physical locations** in the Cloud, styled as **ports** — passages whose interior leads into a wirey background of Server Space.

The visual concept the project owner cited is **Wreck-It-Ralph's portals into the network** — gateways from one realm to another. Not the graphical style (we're ASCII, not 3D Disney), but the *concept*: thresholds, doorways, network endpoints rendered as physical objects.

## Object vocabulary (initial)

| Form | Purpose | Notes |
|---|---|---|
| **Pneumatic-tube kiosks** | Trading | Drop-tokens-in feel; mechanical, retro-futurist |
| **Monoliths** | Quest objectives | Imposing, single-purpose anchors in the world |
| **Command-line terminals** | Social features and menus | Stylized to match the in-fiction language of digital interaction |
| **Vending machines** | Smaller transactions / consumables | Adds texture to the worldbuilding |
| **(More TBD)** | | New objects added on confirmed functionality |

## Style direction

- All objects should read as **artifacts inside a digital world** — they're how the Cloud chose to render its own interfaces. The pneumatic tube isn't a real pneumatic tube; it's the Cloud's metaphor for one.
- Through the port-objects, players should glimpse a "wirey" Server Space behind — the unfinished raw substrate. This reinforces the cosmology from `001`.
- ASCII rendering: depot objects should be denser/heavier glyphs than the surrounding world to read as solid interactables.

## In-game implications

- Asset list (initial sprite/3D-model needs): pneumatic kiosk, monolith, command terminal, vending machine.
- All ports/depots share a common shader treatment that exposes the wirey Server Space backdrop through their interior. This is a tech requirement on the ASCII pipeline — likely a per-object render layer with a different glyph density.
- New depot types are **content-additive**: don't generalize the system before we have 2–3 types working concretely.

## Open questions

- Do depots have keepers (NPCs) or are they silent interactables?
- Are the pneumatic kiosks always available, or do they require Samaritan Status with one of the two factions?
- Does the wirey Server Space backdrop ever become traversable, or is it strictly visual?
