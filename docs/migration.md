# Migration

PMG layout migration starts with an explicit layout marker.

New repositories initialized by PMG include:

```json
{
  "schemaVersion": 1,
  "layoutVersion": 1
}
```

The marker lives at `.pmg/layout.json`.

## Dry Run

```bash
pmg migrate --path /path/to/repo
```

By default, `pmg migrate` is a dry run. It reports the current layout version, target layout version, planned actions, and confirms that no files were modified.

## Apply

```bash
pmg migrate --path /path/to/repo --apply
```

Apply mode writes missing or outdated layout markers. It is intentionally narrow in the first 0.9 baseline: PMG can identify old local layouts and add the version marker, but it does not rewrite memory content.

## JSON

```bash
pmg migrate --path /path/to/repo --json
pmg migrate --path /path/to/repo --apply --json
```

The JSON output includes:

- `root`
- `mode`
- `currentLayoutVersion`
- `targetLayoutVersion`
- `actions`
- `writes`

## Safety Rules

- Dry run is the default.
- Apply mode must be explicit.
- Migration should not rewrite memory content unless a future migration version documents that behavior.
- Older repositories without `.pmg/layout.json` should remain inspectable.
