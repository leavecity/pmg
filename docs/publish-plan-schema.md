# Publish Plan JSON Schema

`pmg publish plan --json` reports a read-only sharing plan. It does not modify files, commit changes, push branches, or promote local PMG state into the host repository.

The command is an inspection step before future explicit publish workflows.

## Top-level object

| Field | Type | Meaning |
| --- | --- | --- |
| `mode` | string | Always `plan` for this command. |
| `readOnly` | boolean | Always `true`; the command must not write files. |
| `root` | string | Absolute project root inspected by PMG. |
| `diff` | object | Embedded `pmg diff --json` boundary report. |
| `sharedCandidateFiles` | file summary[] | Candidate files that may be reviewed for explicit sharing. |
| `risks` | string[] | Human-readable risks and review reminders. |
| `writes` | array | Always empty for plan mode. |

## Stability rules

- `pmg publish plan` is not a publish executor.
- `writes` must remain empty until a separate confirmed write command exists.
- The command should reuse the same local/shared boundary facts as `pmg diff --json`.
- Shared candidates require explicit review before entering the host repository.
