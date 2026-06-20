# Agent Profile: Windsurf

Use this profile when Windsurf or Cascade-style agents work in this repository.

## Entry Points

- Read `AGENTS.md`.
- Read `PMG.md`.
- Build task context with `pmg context build --task "<task>"`.

## Health Checks

- Run `pmg doctor` before using PMG memory for implementation decisions.
- Use `pmg doctor --json` for automated health gates.

## Memory Discipline

- Use `pmg memory propose` for durable knowledge candidates.
- Do not promote memory without review.
- Use cleanup and conflict workflows when memory drifts.

## Review Discipline

- Use `pmg review create` for governance review artifacts.
- Use `pmg review memory propose` when a review should become a pending memory proposal.
