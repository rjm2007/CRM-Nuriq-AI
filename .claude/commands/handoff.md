---
description: Save what this chat did so the next Claude Code chat knows. Run before ending any chat.
---
Write the handoff for this chat.

1. Create `docs/sessions/$(date +%Y-%m-%d)-<short-topic>.md` using this shape:
   ```
   # <topic> — <date>
   ## Goal
   ## Done (files changed)
   ## Decisions (and why)
   ## Not done / in progress (files touched)
   ## Blockers / questions for the team
   ## Next step (exact prompt the next chat can paste)
   ```
2. Update `docs/progress/CURRENT.md`: move items between Done / In progress / Blocked / Next. Keep it under 80 lines.
3. Make sure every folder touched in this chat has an up-to-date `CLAUDE.md`.
4. Show me the summary. Do not commit unless I say so.
