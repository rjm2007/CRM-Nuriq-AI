# Setup

1. Fork https://github.com/makeplane/plane → clone your fork → rename the repo to `neuric-ai-crm` if you like.
2. Copy everything in this kit into the repo root (CLAUDE.md, .claude/, docs/). Plane's own AGENTS.md stays; our CLAUDE.md imports it.
3. Start Plane locally following AGENTS.md / CONTRIBUTING.md (`./setup.sh`, Docker, `pnpm dev`).
4. Open Claude Code in the repo: `claude`
5. Type `/start`. It reads team progress and proposes Step 0.
6. End every chat with `/handoff`.

Commands: `/start`, `/handoff`, `/claude-md <path>`
Agents: researcher, backend-builder, frontend-builder, ui-reviewer, cloud-reviewer, claude-md-writer
