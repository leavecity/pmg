# Agent Instructions

This repository builds Project Memory Governance (PMG), a repo-native memory governance layer for AI coding agents.

Start with:

- [PMG.md](PMG.md) for the project entrypoint.
- [docs/architecture.md](docs/architecture.md) for system shape.
- [docs/context-assembly.md](docs/context-assembly.md) for the most important MVP behavior.
- [docs/cli-design.md](docs/cli-design.md) for command scope.

Development rules:

- Keep the MVP file-based and vendor-neutral.
- Do not add a database, vector store, or cloud dependency for v1.
- Keep CLI behavior deterministic and testable.
- Do not treat every observation as durable memory.
- Prefer small, explicit modules over clever abstractions.
- Update tests when changing command behavior.
