# CLI Design

The CLI should be boring, deterministic, and easy to test.

## Implemented

- `pmg init`: copy the default PMG files into a repository
- `pmg status`: report whether required PMG files exist
- `pmg scan`: discover project guidance, specs, ADRs, and debt markers without writing memory
- `pmg doctor`: run basic health checks
- `pmg context build`: assemble a bounded task-specific context bundle
- `pmg memory propose`: create a pending durable-memory candidate
- `pmg memory promote`: append an approved proposal to a target memory file and keep an audit record
- `pmg memory archive`: retire a memory file or proposal with an archive reason

## Planned

- `pmg memory add`
- `pmg review create`
- `pmg adr create`
- `pmg spec create`

Commands should avoid hidden global state. All meaningful state should live in the repository.
