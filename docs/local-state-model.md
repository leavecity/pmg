# Local State Model

## Purpose

PMG must help agents govern project memory without polluting the host project by default.

The default experience should be local, visible, and reversible. Users should be able to inspect proposed memory changes before PMG writes them into durable files. Shared PMG assets should enter the host repository only after an explicit promotion step.

## Product Principles

- PMG core is a discipline layer, not a document generator.
- PMG local state is ignored by the host repository by default.
- Shared PMG files must be explicitly promoted.
- PMG should operate as plain files even when Git is unavailable.
- Git-aware behavior should improve review and auditability, but should not be required for basic use.
- Memory governance must include both promotion and cleanup. PMG should keep current project memory fresh instead of only accumulating historical notes.

## Default Git Behavior

When `pmg init` runs inside a Git repository, it should prefer writing PMG ignore rules to `.git/info/exclude`, not to the tracked root `.gitignore`.

The default ignore rules should cover local PMG state:

```gitignore
# Project Memory Governance local state
.pmg/
PMG.md
```

This keeps PMG useful during local agent collaboration without adding PMG files to the host project's committed diff.

If the project is not a Git repository, PMG should still initialize its files and report that version tracking is unavailable.

## Shared Asset Promotion

PMG should separate local state from shared assets.

Local state includes:

- `.pmg/` memory, proposals, archives, reviews, registry files, and templates
- generated local entrypoints such as `PMG.md`
- pending changes to the current project memory view

Shared assets may include:

- a root `AGENTS.md` entrypoint
- selected project memory rules
- selected governance rules
- selected templates useful to the whole team

Shared assets should not be written into the tracked repository silently. A future explicit command, such as `pmg publish`, can promote selected local PMG assets into tracked project files after user confirmation.

## Current Memory Updates

Early PMG iterations should not automatically rewrite the current project memory file.

Instead, PMG should generate a proposed change that the user or agent can review. Only after confirmation should the change be written into the current project memory view, such as `.pmg/memory/project.md`.

This keeps the memory governance process visible while the tool and conventions are still maturing.

Future mature modes may support automatic rewriting, but automatic mode should be opt-in.

## Nested Git Repositories

PMG should not create a nested Git repository inside `.pmg/` by default.

A nested `.pmg/.git` would make PMG state harder to reason about because the host repository would not naturally track the actual PMG file contents. It would also force users and agents to manage two Git histories for one project.

If PMG later needs richer local history, it should first prefer explicit audit files or snapshot commands over an embedded Git repository.

## Capability Levels

PMG should support three capability levels:

```text
Level 0: File mode
- No Git dependency
- PMG can initialize and maintain local files
- Users inspect file changes manually

Level 1: Git-aware mode
- Host project has Git
- PMG writes local ignore rules to .git/info/exclude
- PMG can show proposed diffs and support confirmation before writing

Level 2: Git-governed mode
- Future capability
- PMG changes can be bound to commits, reviews, or PR workflows
- Suitable for mature teams and automated governance
```

## Non-Goals

- Do not make Git a hard dependency for basic PMG commands.
- Do not modify tracked `.gitignore` by default.
- Do not commit `.pmg/` state to the host repository by default.
- Do not create `.pmg/.git` by default.
- Do not turn PMG into a general-purpose project journal system.

## Open Implementation Direction

The first implementation slice should update initialization and health checks:

- `pmg init` should detect whether the target is inside a Git repository.
- If Git is available, `pmg init` should append PMG ignore rules to `.git/info/exclude` when missing.
- `pmg doctor` should report whether PMG local state is ignored by the host Git repository.
- Tests should cover Git and non-Git initialization paths.
