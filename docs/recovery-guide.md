# Recovery Guide

PMG is file-based, so recovery should start with inspection before mutation.

## PMG Looks Incomplete

Run:

```bash
node dist/cli.js status /path/to/repo
node dist/cli.js doctor --path /path/to/repo
```

If required files are missing, re-run `pmg init` without `--force` first. It will skip existing files and copy missing template files.

After package publication, use `pmg doctor --path /path/to/repo` for the same health check.

## Local State Appears In Git

Run:

```bash
node dist/cli.js diff /path/to/repo
node dist/cli.js doctor --path /path/to/repo --fix-dry-run
```

`pmg diff` shows local-state files and host Git ignore readiness. `doctor --fix-dry-run` reports what PMG would suggest without writing files.

## Memory Context Looks Stale

Run:

```bash
node dist/cli.js doctor --path /path/to/repo
node dist/cli.js memory cleanup propose --path /path/to/repo
```

Cleanup starts as a proposal. Review it before applying changes.

## Context Selection Looks Wrong

Run:

```bash
node dist/cli.js context explain --path /path/to/repo --task "describe the task" --json
```

Check `selectedSources`, `candidateSources`, `excludedSources`, `lowScoreSources`, `matchedTerms`, and `budgetUsage`.

## Publish Plan Looks Risky

Run:

```bash
node dist/cli.js publish plan --path /path/to/repo --json
```

Plan mode is read-only and keeps `writes` empty. Do not share local PMG state until shared candidates have been explicitly reviewed.
