# Context Explain JSON Schema

`pmg context explain --json` reports context selection decisions without emitting the full context bundle content.

The schema is intentionally small, deterministic, and file-based. It is an audit surface for agents and users, not a general search API.

## Top-level object

| Field | Type | Meaning |
| --- | --- | --- |
| `task` | string | Task string used for scoring and selection. |
| `root` | string | Absolute project root used by PMG. |
| `budgets` | object | Active file, character, and low-score reporting budgets. |
| `filters` | object | Source filters active for this explanation. |
| `budgetUsage` | object | Counts that explain whether relevant candidates were omitted by budgets. |
| `selectedSources` | source summary[] | Sources selected for the context bundle. |
| `candidateSources` | candidate summary[] | All task-relevant candidate sources, with `selected` markers. |
| `excludedSources` | source summary[] | Task-relevant sources excluded by governance or filter policy. |
| `lowScoreSources` | source summary[] | Below-threshold sources reported for audit only. |

The JSON output must not include a `content` field. Use `pmg context build` when bundle content is needed.

## `budgets`

| Field | Type | Meaning |
| --- | --- | --- |
| `maxFiles` | number | Maximum selected source count for the context bundle. |
| `maxCharsPerFile` | number | Maximum content excerpt size used by context bundle rendering. |
| `maxLowScoreSources` | number | Maximum low-score source summaries reported by explain output. |

## `filters`

| Field | Type | Meaning |
| --- | --- | --- |
| `reviews` | boolean | Whether review sources are eligible for context selection. |
| `specs` | boolean | Whether spec sources are eligible for context selection. |

## `budgetUsage`

| Field | Type | Meaning |
| --- | --- | --- |
| `candidateSourceCount` | number | Count of task-relevant candidate sources. |
| `selectedSourceCount` | number | Count of sources selected for the bundle. |
| `omittedCandidateSourceCount` | number | Candidate count omitted by the file budget. |
| `excludedSourceCount` | number | Count of task-relevant sources excluded by governance or filters. |
| `lowScoreSourceCount` | number | Count of below-threshold sources discovered during collection. |
| `reportedLowScoreSourceCount` | number | Count of low-score sources included in explain output. |
| `omittedLowScoreSourceCount` | number | Low-score count omitted by the low-score reporting budget. |
| `maxFilesReached` | boolean | Whether any candidate source was omitted by the file budget. |
| `maxLowScoreSourcesReached` | boolean | Whether any low-score source was omitted by the low-score reporting budget. |

## Source summaries

All source summaries include:

| Field | Type | Meaning |
| --- | --- | --- |
| `path` | string | POSIX-style project-relative path. |
| `score` | number | Relevance score used for sorting or reporting. |
| `reason` | string | Human-readable reason for the source state. |
| `matchedTerms` | string[] | Task terms that contributed to source relevance. |

Candidate summaries also include:

| Field | Type | Meaning |
| --- | --- | --- |
| `selected` | boolean | Whether the candidate entered the selected source set. |

## Stability rules

- Field names are machine-facing and should remain stable across templates and languages.
- Human-facing `reason` text may evolve before 1.0, but it should remain concise and audit-friendly.
- Explain output must not expose file content.
- Low-score sources are audit metadata only and must not become candidates unless they pass the relevance threshold.
- Excluded sources are reported only when they are task-relevant enough to explain.
