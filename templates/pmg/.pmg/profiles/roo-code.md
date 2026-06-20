# Agent Profile: Roo Code

Use this profile when Roo Code works in this repository.

## Entry Points

- Read `AGENTS.md`.
- Read `PMG.md`.
- Build task context with `pmg context build --task "<task>"`.

## Health Checks

- Run `pmg doctor` when project memory or review artifacts may guide implementation.
- Prefer `pmg doctor --json` for structured automation.

## Memory Discipline

- Use `pmg memory propose` for durable project knowledge.
- Keep experimental or inferred knowledge out of confirmed memory until reviewed.
- Use PMG cleanup and conflict workflows for stale guidance.

## Review Discipline

- Use `pmg review create` to capture risks and findings.
- Use `pmg review memory propose` to create pending proposals from explicit recommendations.
