# Agent Profile: Cline

Use this profile when Cline works in this repository.

## Entry Points

- Read `AGENTS.md`.
- Read `PMG.md`.
- Build task context with `pmg context build --task "<task>"`.

## Health Checks

- Run `pmg doctor` before non-trivial changes that depend on memory.
- Use `pmg doctor --json` when tool output needs to be parsed.

## Memory Discipline

- Use `pmg memory propose` for durable memory candidates.
- Do not rewrite confirmed memory without a reviewed workflow.
- Use cleanup and conflict commands for stale or contradictory memory.

## Review Discipline

- Use `pmg review create` for structured findings.
- Use `pmg review memory propose` only after a review recommends a durable memory update.
