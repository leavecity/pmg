# Policy Automation

PMG policy automation starts conservative.

The default policy lives at `.pmg/policy.json`:

```json
{
  "schemaVersion": 1,
  "mode": "conservative",
  "automation": {
    "doctorFix": "dry-run-only",
    "memoryCleanup": "proposal-required",
    "conflictResolution": "manual"
  }
}
```

## Modes

| Mode | Meaning |
| --- | --- |
| `conservative` | Prefer visibility and explicit review before any write operation. |
| `balanced` | Reserved for future workflows that can apply low-risk audited changes. |
| `autonomous` | Reserved for mature repositories with explicit opt-in automation. |

## Doctor Fix Dry Run

`pmg doctor --fix-dry-run` converts known doctor findings into a read-only fix plan.

The command may suggest actions such as:

- adding missing PMG local-state ignore rules
- creating a reviewed memory cleanup proposal for deprecated memory
- creating a reviewed conflict-resolution proposal for conflicting memory

Dry-run mode does not write files. JSON output includes `fixPlan.writes`, which must remain empty.

```bash
pmg doctor --path /path/to/repo --fix-dry-run
pmg doctor --path /path/to/repo --fix-dry-run --json
```

## Safety Rules

- No automatic fix should bypass proposal, review, or audit records.
- Conflict resolution remains manual in the default policy.
- Cleanup remains proposal-required in the default policy.
- Real `--fix` behavior should be added only after dry-run plans are stable and reviewable.
