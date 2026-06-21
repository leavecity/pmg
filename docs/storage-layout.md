# Storage Layout

The default initialized layout is:

```text
AGENTS.md
PMG.md
.pmg/
  layout.json
  constitution.md
  memory/
    proposals/
    archive/
  specs/
  adr/
  reviews/
  profiles/
  skills/
  governance/
  registry/
  templates/
```

Root `AGENTS.md` should stay small. It points agents to PMG instead of storing all project memory.

PMG local state should not pollute the host repository by default. The local-state and shared-promotion model is documented in [local-state-model.md](local-state-model.md).

`.pmg/layout.json` stores the PMG layout version marker. `pmg migrate` uses it to identify older local layouts and apply explicit layout-marker migrations.

`.pmg/registry/` stores indexes and skill registry files.

`.pmg/profiles/` stores agent-specific operating profiles for tools such as Codex, Claude Code, Cursor, Cline, Roo Code, and Windsurf.

`.pmg/templates/` stores local templates used by humans and agents.

File format expectations are documented in [file-formats.md](file-formats.md).
