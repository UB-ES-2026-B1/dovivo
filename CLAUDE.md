@AGENTS.md

## Claude Code specifics
- Role-specific subagents live in `.claude/agents/` (`backend`, `frontend`, `devops`, `qa`). Delegate to the matching one, or ask Claude to "act as the frontend agent".
- Shared permissions are in `.claude/settings.json`; put personal overrides in `.claude/settings.local.json` (gitignored).
