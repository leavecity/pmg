# Agent Integration

PMG is agent-neutral.

Recommended integration pattern:

1. Agent reads root `AGENTS.md`.
2. `AGENTS.md` points to `PMG.md` and `.pmg/constitution.md`.
3. Agent or user runs `pmg context build --task "<task>"`.
4. Agent uses the generated bundle as task context.
5. Agent proposes memory updates instead of silently editing confirmed memory.

Examples are provided for Codex, Claude Code, Cursor, Cline, Roo Code, and Windsurf under `examples/`.
