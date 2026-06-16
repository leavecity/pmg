# CLI Design

The CLI should be boring, deterministic, and easy to test.

## Implemented

- `pmg init`: copy the default PMG files into a repository and maintain local Git ignore rules when possible
- `pmg status`: report whether required PMG files exist
- `pmg scan`: discover project guidance, specs, ADRs, and debt markers without writing memory
- `pmg doctor`: run basic health, registry, local-state, and memory hygiene checks
- `pmg context build`: assemble a bounded task-specific context bundle
- `pmg memory propose`: create a pending durable-memory candidate
- `pmg memory promote`: append an approved proposal to a target memory file and keep an audit record
- `pmg memory archive`: retire a memory file or proposal with an archive reason
- `pmg memory project propose`: create a pending replacement for the current project memory view
- `pmg memory project apply`: replace `.pmg/memory/project.md` after confirmation, keeping a previous snapshot and an audit record
- `pmg memory cleanup propose`: create a pending cleanup proposal from memory hygiene warnings without modifying memory files

## Planned

- `pmg memory add`
- `pmg review create`
- `pmg adr create`
- `pmg spec create`

Commands should avoid hidden global state. All meaningful state should live in the repository.

Commands that create or update PMG files should follow the local-state model documented in [local-state-model.md](local-state-model.md): PMG local state is ignored by the host repository by default, while shared PMG assets require explicit promotion.
