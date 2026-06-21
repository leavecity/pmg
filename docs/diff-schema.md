# Diff JSON Schema

`pmg diff --json` reports the local PMG state boundary without emitting file content.

The schema is intentionally read-only. It is a review surface for users and agents before any future shared-promotion command writes files into the host repository.

## Top-level object

| Field | Type | Meaning |
| --- | --- | --- |
| `root` | string | Absolute project root inspected by PMG. |
| `git` | object | Host Git availability and local-state ignore readiness. |
| `localStateFiles` | file summary[] | PMG local-state files that should stay local by default. |
| `sharedCandidateFiles` | file summary[] | Files that may be reviewed for explicit sharing. |
| `summary` | object | Counts for local-state files, shared candidates, and missing ignore rules. |

The output must not include file content.

## `git`

| Field | Type | Meaning |
| --- | --- | --- |
| `available` | boolean | Whether the target is inside a host Git repository. |
| `ignoreStatus` | string | One of `ready`, `missing-rules`, or `unavailable`. |
| `infoExcludePath` | string? | Project-relative path to the host repository's `.git/info/exclude` file when Git is available. |
| `missingRules` | string[] | PMG local-state ignore rules that are missing from `.git/info/exclude`. |

## File summaries

| Field | Type | Meaning |
| --- | --- | --- |
| `path` | string | POSIX-style project-relative path. |
| `role` | string | Either `local-state` or `shared-candidate`. |

## `summary`

| Field | Type | Meaning |
| --- | --- | --- |
| `localStateFileCount` | number | Number of local-state file summaries. |
| `sharedCandidateFileCount` | number | Number of shared candidate file summaries. |
| `missingIgnoreRuleCount` | number | Number of missing local-state ignore rules. |

## Stability rules

- `pmg diff --json` is a boundary report, not a content diff.
- Field names are machine-facing and should remain stable before policy automation uses them.
- The command must remain read-only.
- Missing Git support must be reported structurally, not treated as a command failure.
