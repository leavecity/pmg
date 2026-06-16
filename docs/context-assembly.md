# Context Assembly

Context assembly is the core PMG behavior.

The command:

```bash
pmg context build --task "implement login page"
```

should produce a bounded context bundle that includes relevant project memory, active specs, ADRs, governance rules, pitfalls, and conventions.

It should exclude unrelated memory.

## MVP behavior

The MVP uses simple keyword scoring over Markdown files. It always includes stable entrypoint files, then selects a bounded number of task-relevant files.

Memory files marked `Status: pending`, `Status: deprecated`, or `Status: archived` are excluded from default context bundles. Files under `.pmg/memory/proposals/` and `.pmg/memory/archive/` are also excluded. PMG keeps pending memory, pending proposals, inactive memory, and audit records available for review, cleanup workflows, and historical analysis, but they should not guide normal agent work.

This is intentionally simple. Future versions may add structured indexes, embeddings, graph traversal, or agent-specific profiles, but none of those are required for v1.
