# PMG Constitution

## Mission

Preserve, retrieve, govern, and evolve project knowledge for AI coding agents without causing context bloat or memory pollution.

## Core rules

- Load task-specific context, not the entire memory system.
- Treat memory status as meaningful.
- Do not promote uncertain knowledge into confirmed memory without policy support.
- Prefer repository-native files over hidden state.
- Keep all durable memory reviewable in Git.
- Keep the system vendor-neutral.

## Memory lifecycle

```text
Observation -> Extraction -> Classification -> Pending -> Review -> Approval -> Promotion -> Use -> Revision -> Archive
```

## Confidence levels

- `confirmed`: accepted project knowledge
- `inferred`: likely but not explicitly approved
- `experimental`: under evaluation
- `deprecated`: no longer recommended
- `conflicting`: conflicts with other project knowledge

## Anti-pollution rules

Do not store these as confirmed memory:

- one-off implementation details
- temporary task context
- speculative ideas
- emotional reactions
- accidental code patterns
- obsolete assumptions
- unverified user preferences
- low-confidence inference
