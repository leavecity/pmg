# Agent Instructions

This repository uses Project Memory Governance (PMG).

Read these files before making project-level assumptions:

- `PMG.md`
- `.pmg/constitution.md`
- `.pmg/governance/context-assembly.md`
- `.pmg/memory/project.md`

Before non-trivial work, use task-specific context instead of loading all memory:

```bash
pmg context build --task "<task>"
```

Check memory health when project assumptions may have drifted:

```bash
pmg doctor
```

If cleanup is needed, create a reviewable proposal instead of rewriting memory silently:

```bash
pmg memory cleanup propose
```

Deprecated or archived memory should not guide implementation unless the task explicitly asks for historical analysis.

Do not silently promote observations into confirmed memory. Put uncertain or newly discovered knowledge in `.pmg/memory/pending.md` or propose a memory entry for review.
