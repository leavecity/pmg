# Quick Start

This guide walks through the smallest PMG workflow for a repository.

## 1. Initialize PMG

```bash
npm install
npm run build
node dist/cli.js init /path/to/repo
```

`pmg init` creates repository-local PMG files. When the target is inside a Git repository, PMG writes local-state ignore rules to `.git/info/exclude` instead of modifying tracked `.gitignore`.

## 2. Check Health

```bash
node dist/cli.js status /path/to/repo
node dist/cli.js doctor --path /path/to/repo
```

Use JSON when an agent or script needs structured health data:

```bash
node dist/cli.js doctor --path /path/to/repo --json
```

## 3. Build Task Context

```bash
node dist/cli.js context build --path /path/to/repo --task "implement login page"
```

After package publication, the equivalent command is `pmg context build --path /path/to/repo --task "implement login page"`.

For an auditable selection report without the full bundle content:

```bash
node dist/cli.js context explain --path /path/to/repo --task "implement login page" --json
```

## 4. Review Local State Before Sharing

```bash
node dist/cli.js diff /path/to/repo
node dist/cli.js publish plan --path /path/to/repo
```

Both commands are read-only. They show what is local PMG state and what may become a shared candidate after explicit review.

## 5. Package Check

```bash
npm run package:check
```

The package dry run verifies that the npm package shape includes the CLI, templates, examples, docs, changelog, and entrypoint files.
