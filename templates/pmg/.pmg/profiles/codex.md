# Agent Profile: Codex

Use this profile when a Codex-style coding agent works in this repository.

## Entry Points

- Read `AGENTS.md`.
- Read `PMG.md`.
- Build task context with `pmg context build --task "<task>"`.

## Health Checks

- Run `pmg doctor` before work that depends on project memory.
- Use `pmg doctor --json` when a script or CI gate needs structured output.

## Memory Discipline

- Use `pmg memory propose` for durable knowledge candidates.
- Do not directly promote memory without review.
- Use `pmg memory cleanup propose` when stale or conflicting memory appears.

## Review Discipline

- Use `pmg review create` for security, architecture, dependency, performance, or debt findings.
- Use `pmg review memory propose` only when a review contains explicit recommended memory updates.
