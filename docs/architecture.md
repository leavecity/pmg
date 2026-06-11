# Architecture

PMG has three layers:

1. Repository files
2. CLI operations
3. Agent conventions

Repository files are the source of truth. They live in `.pmg/`, root compatibility files such as `AGENTS.md`, and project documentation.

The CLI performs deterministic file operations:

- initialize the PMG layout
- report status
- run health checks
- assemble context bundles
- eventually propose, promote, archive, and review memory

Agent conventions define how coding agents consume PMG:

- read the small root entrypoint first
- use task-specific context bundles
- treat memory status as meaningful
- propose memory changes instead of silently polluting durable memory

The MVP intentionally avoids databases, vector stores, background services, and vendor-specific APIs.
