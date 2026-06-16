# Memory Model

PMG memory is durable project knowledge with an explicit status and lifecycle.

## Confidence levels

- `confirmed`: accepted as durable project knowledge
- `inferred`: likely true but not explicitly approved
- `experimental`: temporarily useful but still being evaluated
- `deprecated`: previously valid but no longer recommended
- `conflicting`: known to conflict with other project knowledge

## Lifecycle

```text
Observation -> Extraction -> Classification -> Pending -> Review -> Approval -> Promotion -> Use -> Revision -> Archive
```

Durable memory should be promoted only when policy allows it. One-off observations, temporary task details, and unverified preferences should not become confirmed rules.

## MVP commands

`pmg memory propose` writes a pending proposal under `.pmg/memory/proposals/`.

`pmg memory promote` appends the durable knowledge candidate to a target memory file and moves the proposal to `.pmg/memory/archive/promoted/` as an audit record.

`pmg memory archive` marks a memory file or proposal as archived and moves it to `.pmg/memory/archive/archived/`.

`pmg doctor` warns about memory hygiene issues that can confuse agents:

- deprecated memory that still appears in active memory files
- conflicting memory that needs explicit resolution
- `Superseded-By` references that point to missing replacement files

`pmg memory cleanup propose` turns those hygiene warnings into a pending cleanup proposal under `.pmg/memory/proposals/`. It does not archive, replace, or rewrite memory by itself.
