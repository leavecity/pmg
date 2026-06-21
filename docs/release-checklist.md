# Release Checklist

This checklist is for maintainers preparing a PMG package release.

## Local Verification

Run:

```bash
npm run release:check
```

The command runs:

- `npm test`
- `npm run package:check`
- `git diff --check`

It does not publish the package. It is a local readiness check only.

## Manual Checks

Before publishing, confirm:

- The changelog describes repository-visible behavior.
- The package version matches the intended release.
- GitHub Actions is passing on the target branch.
- The package dry run includes `dist`, `templates`, `docs`, examples, README, CHANGELOG, AGENTS, PMG, and LICENSE.
- Any release notes distinguish PMG's memory-governance model from a generic memory bank.

## Publish Boundary

Publishing remains a separate maintainer action. Do not hide publishing behind a health check, migration command, or doctor fix command.
