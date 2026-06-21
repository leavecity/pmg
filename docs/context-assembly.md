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

Agent profiles under `.pmg/profiles/` are eligible for task-specific context selection. They should be included only when the task or agent mode makes them relevant.

When `pmg context build --json` is used, the output includes `excludedSources` for task-relevant files that were omitted by default governance rules. Each excluded source includes a path, score, and reason so users can audit why PMG did not include it in the working context.

`pmg context explain` reports the same selection logic without emitting the full context bundle. Its JSON output includes selected sources, candidate sources with `selected` markers, excluded sources, bounded low-score sources, matched task terms, budget usage, and the active budgets.

Scored sources include `matchedTerms`, a stable list of task words that contributed to the source's relevance score. This makes context scoring auditable without exposing the source content in explain output.

Explain output includes `budgetUsage` so users can distinguish "not relevant" from "relevant but omitted by the current budget." It reports candidate, selected, omitted, excluded, low-score, and reported low-score counts, plus boolean flags for file-budget and low-score-budget truncation.

Use `--no-reviews` or `--no-specs` to temporarily disable review or spec sources. Disabled task-relevant sources appear in `excludedSources` with an explicit filter reason.

Use `--max-low-score-sources <n>` to control how many below-threshold sources appear in explain output. Low-score sources are audit metadata only; PMG does not emit their content and does not include them in the candidate list.

This is intentionally simple. Future versions may add structured indexes, embeddings, graph traversal, or richer profile matching, but none of those are required for v1.
