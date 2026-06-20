# Agent Profile: Cursor

Use this profile when Cursor or Cursor-like editor agents work in this repository.

## Entry Points

- Read `AGENTS.md`.
- Read `PMG.md`.
- Build task context with `pmg context build --task "<task>"`.

## Health Checks

- Run `pmg doctor` before relying on project memory.
- Use structured output with `pmg doctor --json` for editor automation.

## Memory Discipline

- Use `pmg memory propose` for durable knowledge candidates.
- Keep task-local notes out of confirmed memory.
- Use `pmg memory cleanup propose` for stale memory.

## Review Discipline

- Use `pmg review create` for review artifacts.
- Use `pmg review memory propose` to turn explicit recommendations into pending memory proposals.
