# Agent Profiles

Agent profiles describe how a specific coding agent should apply PMG discipline.

Default profiles live under `.pmg/profiles/` after initialization:

- `codex.md`
- `claude-code.md`
- `cursor.md`
- `cline.md`
- `roo-code.md`
- `windsurf.md`
- `language.md`

Each profile should cover:

- entry points
- `pmg context build` usage
- `pmg doctor` usage
- memory proposal discipline
- cleanup and conflict handling
- review artifact handling

Profiles are guidance, not durable project memory. They can enter task-specific context when a task mentions the agent or profile, but they should not replace the project memory lifecycle.

Future language-profile support should build on this layer without changing stable machine-readable metadata contracts.

## Language Profile

`.pmg/profiles/language.md` stores project language preferences:

- `Project-Language`
- `Conversation-Language`
- `Formal-Docs-Language`
- `Agent-Response-Language`
- `Machine-Metadata-Language`

`pmg init --language <tag>` updates project, conversation, and agent response language fields. Formal documentation and machine-readable metadata can remain in separate languages so tooling stays deterministic.
