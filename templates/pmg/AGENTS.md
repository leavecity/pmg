# Agent Instructions

This repository uses Project Memory Governance (PMG).

Read these files before making project-level assumptions:

- `PMG.md`
- `.pmg/constitution.md`
- `.pmg/governance/context-assembly.md`
- `.pmg/memory/project.md`

Use task-specific context instead of loading all memory:

```bash
pmg context build --task "<task>"
```

Do not silently promote observations into confirmed memory. Put uncertain or newly discovered knowledge in `.pmg/memory/pending.md` or propose a memory entry for review.
