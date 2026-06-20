# Agent Profiles

Agent profiles describe how a specific coding agent should apply PMG discipline.

Default profiles live under `.pmg/profiles/` after initialization:

- `codex.md`
- `claude-code.md`
- `cursor.md`
- `cline.md`
- `roo-code.md`
- `windsurf.md`

Each profile should cover:

- entry points
- `pmg context build` usage
- `pmg doctor` usage
- memory proposal discipline
- cleanup and conflict handling
- review artifact handling

Profiles are guidance, not durable project memory. They can enter task-specific context when a task mentions the agent or profile, but they should not replace the project memory lifecycle.

Future language-profile support should build on this layer without changing stable machine-readable metadata contracts.
