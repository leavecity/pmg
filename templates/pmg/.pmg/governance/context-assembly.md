# Context Assembly Rules

Build the smallest useful context for the task.

Always consider:

- root `AGENTS.md`
- `PMG.md`
- `.pmg/constitution.md`
- project overview memory
- governance rules relevant to the task

Then include only task-relevant:

- memory files
- specs
- ADRs
- review artifacts
- pitfalls
- skill guidance

Avoid loading unrelated memory because it increases token use and can confuse agents.

Exclude memory marked `Status: pending`, `Status: deprecated`, or `Status: archived` from default implementation context. Also exclude files under `.pmg/memory/proposals/` and `.pmg/memory/archive/`; keep them available for review, cleanup, audit, and historical analysis only.
