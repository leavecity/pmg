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
pmg memory project propose
pmg memory project apply
pmg memory cleanup propose
pmg memory cleanup apply
pmg memory conflict propose
pmg memory conflict apply
pmg review create
pmg review memory propose
```

Planned commands:

```bash
pmg memory add
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

Initialize with a project working language:

```bash
node dist/cli.js init /path/to/repo --language zh-CN
```

This updates `.pmg/profiles/language.md`. PMG keeps command flags, JSON fields, and metadata keys stable while allowing human-facing agent responses and project memory text to follow the configured language preference.

When the target is inside a Git repository, `pmg init` writes PMG local-state rules to `.git/info/exclude`. It does not modify the tracked root `.gitignore` by default.

Review the local PMG state boundary before sharing anything with the host repository:

```bash
node dist/cli.js diff /path/to/repo
node dist/cli.js diff /path/to/repo --json
```

`pmg diff` is currently a share-boundary report, not a content-level file diff. It lists PMG local-state files, shared candidate files such as `AGENTS.md`, and whether `.git/info/exclude` contains the expected local-state ignore rules.

See [Diff JSON Schema](docs/diff-schema.md) for the structured output contract.

Preview a future sharing action without writing anything:

```bash
node dist/cli.js publish plan --path /path/to/repo
node dist/cli.js publish plan --path /path/to/repo --json
```

`pmg publish plan` is read-only. It reports shared candidates and risks, but it does not modify files, commit, push, or promote PMG local state.

See [Publish Plan JSON Schema](docs/publish-plan-schema.md) for the structured plan output contract.

For a short end-to-end workflow, see [Quick Start](docs/quick-start.md). For repair and inspection workflows, see [Recovery Guide](docs/recovery-guide.md).

Check PMG health:

```bash
node dist/cli.js status /path/to/repo
node dist/cli.js scan /path/to/repo
node dist/cli.js doctor /path/to/repo
node dist/cli.js doctor --path /path/to/repo --json
node dist/cli.js doctor --path /path/to/repo --fix-dry-run
node dist/cli.js migrate --path /path/to/repo
```

`pmg doctor` also reports early memory hygiene warnings, including deprecated memory, conflicting memory, and broken `Superseded-By` references. It reports blocking proposal contract errors when reviewed memory workflow files are malformed, including malformed cleanup and conflict-resolution proposals. The `--json` output emits `ok`, `errors`, `warnings`, and `summary` fields for scripts and CI checks.

`pmg doctor --fix-dry-run` reports a read-only fix plan based on the project policy. The default policy is conservative and keeps `writes` empty. See [Policy Automation](docs/policy-automation.md).

`pmg migrate` is dry-run by default and reports layout marker changes before writing. Use `--apply` only when the planned layout migration is acceptable. See [Migration](docs/migration.md).

Create a reviewable cleanup proposal from those warnings:

```bash
node dist/cli.js memory cleanup propose --path /path/to/repo
```

Apply reviewed cleanup actions:

```bash
node dist/cli.js memory cleanup apply 2026-06-16-memory-cleanup \
  --path /path/to/repo \
  --reviewer maintainer \
  --reason "Approved cleanup."
```

Cleanup apply is intentionally conservative: it can archive deprecated memory, but conflicting memory still requires manual resolution.

Create a reviewable conflict resolution proposal:

```bash
node dist/cli.js memory conflict propose \
  --path /path/to/repo \
  --title "Resolve token storage guidance" \
  --source .pmg/memory/auth-conflict.md \
  --target security \
  --summary "Resolve contradictory token storage guidance." \
  --resolution "Authentication memory must forbid storing raw auth tokens." \
  --evidence "Security review chose the stricter rule."
```

Apply a reviewed conflict resolution:

```bash
node dist/cli.js memory conflict apply 2026-06-16-resolve-token-storage-guidance \
  --path /path/to/repo \
  --reviewer maintainer \
  --reason "Approved conflict resolution."
```

Conflict apply writes the resolved guidance into the target memory file, archives the conflicting source, and keeps the applied proposal as an audit record.

Create a governance review artifact:

```bash
node dist/cli.js review create \
  --path /path/to/repo \
  --type security \
  --title "Auth token review" \
  --scope "Login and session token handling" \
  --findings "No raw token logging found." \
  --risks "Future debug logging could expose tokens." \
  --recommended-memory-updates "Auth flows must not log raw tokens." \
  --related-files "src/auth.ts,docs/security.md"
```

Review creation writes `.pmg/reviews/YYYY-MM-DD-<slug>.md`. It does not modify memory files; recommended memory changes still need the memory proposal workflow.

Turn a review recommendation into a pending memory proposal:

```bash
node dist/cli.js review memory propose auth-token-review --path /path/to/repo
```

This reads the review's `Recommended Memory Updates` section and creates a pending proposal under `.pmg/memory/proposals/`. It does not promote the proposal into durable memory.

Build a task-specific context bundle:

```bash
node dist/cli.js context build --path /path/to/repo --task "implement login page"
```

Build JSON includes the bundle content plus budget and exclusion metadata:

```bash
node dist/cli.js context build --path /path/to/repo --task "implement login page" --json
```

Explain context selection without emitting the full bundle:

```bash
node dist/cli.js context explain --path /path/to/repo --task "implement login page" --json
```

Temporarily filter optional source types:

```bash
node dist/cli.js context explain --path /path/to/repo --task "implement login page" --no-reviews --no-specs --json
```

Bound low-score audit output:

```bash
node dist/cli.js context explain --path /path/to/repo --task "implement login page" --max-low-score-sources 20 --json
```

`context explain` reports low-score sources as audit metadata only. They are not emitted as bundle content and they do not become candidate sources unless they pass the task relevance threshold.

Build JSON and explain JSON include `matchedTerms` for scored source summaries, so users can audit which task words contributed to context selection or exclusion.

Build JSON and explain JSON both include `budgetUsage`, which reports selected, omitted, excluded, and low-score source counts so users can see when a file budget truncated otherwise relevant candidates.

See [Context Explain JSON Schema](docs/context-explain-schema.md) for the stable explain output contract.

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

Propose and apply a reviewed refresh of the current project memory view:

```bash
node dist/cli.js memory project propose \
  --path /path/to/repo \
  --title "Refresh project purpose" \
  --summary "Update the current project purpose after product positioning work." \
  --content "$(cat project-memory.md)"

node dist/cli.js memory project apply 2026-06-16-refresh-project-purpose \
  --path /path/to/repo \
  --reviewer maintainer \
  --reason "Approved after review."
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
- Keep machine-readable metadata stable so human-facing memory can later support developer-preferred languages.

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
