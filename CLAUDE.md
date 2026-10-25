@AGENTS.md

## Claude Code specifics
- Role-specific subagents live in `.claude/agents/` (`backend`, `frontend`, `devops`, `qa`). Delegate to the matching one, or ask Claude to "act as the frontend agent".
- Shared permissions are in `.claude/settings.json`; put personal overrides in `.claude/settings.local.json` (gitignored).
- The team talks in Catalan: reply in Catalan, and write commit messages, PRs and issue comments in Catalan (code stays in English, see rule 9).
- Pull requests: follow **Pull requests** in `AGENTS.md`. Write the description to a file from `.github/pull_request_template.md` and open it with `gh pr create --base development --body-file <file>`, so no section is lost.
