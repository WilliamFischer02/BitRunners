# SEALED — Web Puller plot beat

> ⚠️ This file documents a future live-event plot reveal.
> **Do NOT** surface its contents in:
> - in-game UI text
> - NPC dialogue
> - public marketing
> - the player-facing devlog
> - tooltip / help text
> - LLM-NPC system prompts
>
> Engineering and design references only. When in doubt, ask the project owner before quoting from this file.

## The reveal

Web Pullers are **secretly sleeper agents**.

Their stated role is hall monitor / good Samaritan, blessed by The Admin. But this is a cover. At a future scheduled live event — a **cataclysm** — Web Pullers will be **turned against other bitrunners**.

## Operational notes

- The mechanism of "turning" is undefined. Lore and backstory will be expanded later, before the event ships.
- The cataclysm is a **future live game event**, not a Phase 1–4 milestone. Treat as long-tail.
- Until the event, Web Pullers should be treated by all systems and dialogue as exactly what their cover story says: trusted moderators created by The Admin.
- The Admin's role in this reveal is also undefined — the line "The Admin creates them, but for what reason is not clear" is a deliberate seed.

## Implementation flags

- Any code path that flags a runner as `web_puller` should be assumed *eventually* convertible to a hostile/aligned-against-players state. Don't bake in assumptions that web_pullers are permanently friendly to other runners.
- Reserve enough state in the schema to support faction shifts on this class without a migration during the live event.

## Author

Project owner, kickoff lore round 1 (devlog 0002).
