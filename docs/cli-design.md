# CLI Design

The CLI should be boring, deterministic, and easy to test.

## Implemented

- `pmg init`: copy the default PMG files into a repository
- `pmg status`: report whether required PMG files exist
- `pmg scan`: discover project guidance, specs, ADRs, and debt markers without writing memory
- `pmg doctor`: run basic health checks
- `pmg context build`: assemble a bounded task-specific context bundle

## Planned

- `pmg memory add`
- `pmg memory propose`
- `pmg memory promote`
- `pmg memory archive`
- `pmg review create`
- `pmg adr create`
- `pmg spec create`

Commands should avoid hidden global state. All meaningful state should live in the repository.
