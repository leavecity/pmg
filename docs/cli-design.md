# CLI Design

The CLI should be boring, deterministic, and easy to test.

## Implemented

- `pmg init`: copy the default PMG files into a repository and maintain local Git ignore rules when possible
- `pmg status`: report whether required PMG files exist
- `pmg scan`: discover project guidance, specs, ADRs, and debt markers without writing memory
- `pmg doctor`: run basic health, registry, local-state, memory hygiene, and proposal contract checks; use `--json` for structured `ok`, `errors`, `warnings`, and `summary` output
- `pmg diff`: report PMG local-state files, shared candidate files, and host Git ignore readiness without emitting file content; use `--json` for the structured boundary report
- `pmg context build`: assemble a bounded task-specific context bundle; `--json` includes bundle content plus matched-term, budget, and exclusion metadata
- `pmg context explain`: explain selected, candidate, excluded, omitted, and bounded low-score context sources without emitting the full context bundle; reports matched task terms, budget usage, and source filters such as `--no-reviews` and `--no-specs`
- `pmg memory propose`: create a pending durable-memory candidate
- `pmg memory promote`: append an approved proposal to a target memory file and keep an audit record
- `pmg memory archive`: retire a memory file or proposal with an archive reason
- `pmg memory project propose`: create a pending replacement for the current project memory view
- `pmg memory project apply`: replace `.pmg/memory/project.md` after confirmation, keeping a previous snapshot and an audit record
- `pmg memory cleanup propose`: create a pending cleanup proposal from memory hygiene warnings without modifying memory files
- `pmg memory cleanup apply`: apply reviewed cleanup proposals conservatively, archiving deprecated memory while leaving conflicts for manual resolution; finding paths must stay inside the governed project
- `pmg memory conflict propose`: create a pending conflict-resolution proposal without modifying memory files
- `pmg memory conflict apply`: apply a reviewed conflict-resolution proposal by writing resolved guidance, archiving the conflicting source, and keeping an audit record
- `pmg review create`: create a draft governance review artifact without modifying memory
- `pmg review memory propose`: create a pending memory proposal from a review recommendation without promoting it

`pmg diff --json` has a documented output contract in [diff-schema.md](diff-schema.md). Changes should preserve its read-only boundary-report semantics.

`pmg context explain --json` has a documented output contract in [context-explain-schema.md](context-explain-schema.md). Changes to that schema should be covered by fixture-backed tests.

## Planned

- `pmg memory add`
- `pmg adr create`
- `pmg spec create`

Commands should avoid hidden global state. All meaningful state should live in the repository.

Commands that accept file selectors or output targets must keep resolved paths inside the target project root. PMG should not read, move, or write arbitrary files outside the repository it is governing.

Commands that create or update PMG files should follow the local-state model documented in [local-state-model.md](local-state-model.md): PMG local state is ignored by the host repository by default, while shared PMG assets require explicit promotion.

Reviewed proposal workflows must move applied or promoted audit records out of `.pmg/memory/proposals/` and into their matching archive directory. `pmg doctor` reports audit records that remain in proposals or appear under the wrong archive kind.

`pmg doctor` should validate active memory state without treating proposal or archive audit records as active memory. Top-level metadata controls lifecycle state; section-level metadata may describe promoted or resolved memory entries inside a file.
