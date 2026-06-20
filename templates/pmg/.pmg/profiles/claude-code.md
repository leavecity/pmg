# Agent Profile: Claude Code

Use this profile when Claude Code works in this repository.

## Entry Points

- Read `AGENTS.md`.
- Read `PMG.md`.
- Build task context with `pmg context build --task "<task>"`.

## Health Checks

- Run `pmg doctor` when memory, proposals, or review artifacts may affect the task.
- Prefer `pmg doctor --json` for automated checks.

## Memory Discipline

- Use `pmg memory propose` for new durable project knowledge.
- Keep uncertain findings pending until reviewed.
- Use cleanup and conflict workflows instead of silently rewriting memory.

## Review Discipline

- Use `pmg review create` to capture quality findings.
- Convert review recommendations with `pmg review memory propose` instead of editing confirmed memory directly.
