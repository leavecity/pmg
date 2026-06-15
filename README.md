# Project Memory Governance

Project Memory Governance (PMG) is a repository-native governance layer for long-lived AI coding work.

It helps AI coding agents preserve, retrieve, review, and evolve project knowledge without turning every session into a full context dump.

PMG is not another coding agent, IDE, memory bank, or cloud platform. It is a small, inspectable system of files, templates, rules, and CLI commands that any agent can use.

## Why PMG exists

Modern AI coding agents are powerful, but they often lose continuity across sessions, models, tools, and conversations. Developers repeatedly explain the same project background, architecture principles, coding conventions, dependency constraints, state ownership rules, i18n requirements, known pitfalls, and historical decisions.

Existing practices solve pieces of this problem:

- `AGENTS.md` gives agents a stable project entrypoint.
- Specs capture feature intent, design, and tasks.
- Memory-bank-style files preserve cross-session context.
- ADRs record durable architectural decisions.
- Review artifacts capture risks and quality checks.
- Skill systems encode reusable workflows.

PMG connects these pieces with a lifecycle:

```text
Observation -> Extraction -> Classification -> Pending -> Review -> Approval -> Promotion -> Use -> Revision -> Archive
```

The goal is not to remember everything. The goal is to govern what becomes durable project knowledge.

## MVP scope

The first version is file-based, human-readable, and git-friendly.

Implemented commands:

```bash
pmg init
pmg status
pmg scan
pmg doctor
pmg context build
pmg memory propose
pmg memory promote
pmg memory archive
```

Planned commands:

```bash
pmg memory add
pmg review create
pmg adr create
pmg spec create
```

## Quick start

Install dependencies and build:

```bash
npm install
npm run build
```

Initialize PMG in a repository:

```bash
node dist/cli.js init /path/to/repo
```

When the target is inside a Git repository, `pmg init` writes PMG local-state rules to `.git/info/exclude`. It does not modify the tracked root `.gitignore` by default.

Check PMG health:

```bash
node dist/cli.js status /path/to/repo
node dist/cli.js scan /path/to/repo
node dist/cli.js doctor /path/to/repo
```

Build a task-specific context bundle:

```bash
node dist/cli.js context build --path /path/to/repo --task "implement login page"
```

Write the bundle to a file:

```bash
node dist/cli.js context build --path /path/to/repo --task "review dependency changes" --output context.md
```

After package publication, the same commands are intended to be available through the `pmg` binary.

Propose and promote durable memory:

```bash
node dist/cli.js memory propose \
  --path /path/to/repo \
  --title "Login token handling" \
  --domain security \
  --observation "Login pages must avoid leaking auth tokens." \
  --knowledge "Authentication UI must not log, render, or persist raw auth tokens."

node dist/cli.js memory promote 2026-06-12-login-token-handling \
  --path /path/to/repo \
  --target security \
  --reason "Confirmed by security review."
```

## Design principles

- Keep the system vendor-neutral.
- Keep long-term memory human-readable.
- Keep repository state git-friendly.
- Avoid unnecessary dependencies.
- Do not require a database in v1.
- Do not load all memory for every task.
- Treat confirmed memory differently from inferred, experimental, deprecated, or conflicting memory.
- Make every promotion into durable memory reviewable.

## Repository layout

```text
docs/                 Project design documents
examples/             Agent integration examples
src/                  TypeScript CLI source
templates/pmg/        Default files copied by pmg init
test/                 Node test runner tests
```

The initialized PMG layout is documented in [docs/storage-layout.md](docs/storage-layout.md), and file formats are documented in [docs/file-formats.md](docs/file-formats.md).

## CI

The repository includes a GitHub Actions workflow at `.github/workflows/ci.yml` that runs install, build, and tests on Node 20 and Node 22.

## License

MIT
