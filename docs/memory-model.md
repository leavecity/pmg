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

`pmg doctor` also reports blocking proposal contract errors, including unknown proposal types, incomplete conflict-resolution proposals, and malformed cleanup proposals.

`pmg memory cleanup propose` turns those hygiene warnings into a pending cleanup proposal under `.pmg/memory/proposals/`. It does not archive, replace, or rewrite memory by itself.

Cleanup proposals must include a `Findings` section whose finding paths resolve inside the governed project. Missing referenced files are reported as stale proposal warnings.

`pmg memory cleanup apply` applies reviewed cleanup proposals conservatively. The MVP can archive deprecated memory and keeps an audit record under `.pmg/memory/archive/cleanup-applied/`. Conflicting memory is not resolved automatically. Cleanup apply refuses finding paths that resolve outside the project root.

`pmg memory conflict propose` creates a pending conflict-resolution proposal. The proposal names the conflicting source, the target memory file, the proposed resolved guidance, and evidence.

`pmg memory conflict apply` applies a reviewed conflict-resolution proposal. It writes the resolved guidance into the target memory file, marks the target as confirmed when needed, archives the conflicting source, and keeps an audit record under `.pmg/memory/archive/conflict-resolutions/`.
