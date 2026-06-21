# Changelog

All notable changes to Project Memory Governance are documented here.

This project follows a pre-1.0 development flow. Entries describe repository-visible behavior, not a published package release guarantee.

## Unreleased

### Added

- Added read-only `pmg publish plan` and `pmg publish plan --json`.
- Added `pmg diff --json` structured local-state boundary reporting.
- Added `pmg diff` human-readable local-state and shared-candidate reporting.
- Added matched task terms to `pmg context build --json` selected source summaries.
- Added budget metadata to `pmg context build --json`.
- Added unit coverage for context scoring helpers.
- Added a documented `pmg context explain --json` schema.
- Added fixture-backed tests for stable context explanation output.

### Changed

- Context scoring now matches task words as exact tokens instead of substrings, reducing false positives such as matching `auth` inside `authoring`.

## 0.1.0 - 2026-06-21

### Added

- Added the TypeScript CLI foundation with `pmg init`, `pmg status`, `pmg scan`, `pmg doctor`, and `pmg context build`.
- Added the default `.pmg` template, PMG entrypoint files, and repository-native memory governance documentation.
- Added local-state Git ignore handling so PMG local state does not pollute the host repository by default.
- Added memory proposal, promotion, archive, project-memory replacement, cleanup, and conflict-resolution workflows.
- Added doctor checks for JSON output, proposal contracts, audit record locations, active memory status, review files, and local-state ignore rules.
- Added governance review creation and review-to-memory proposal flows.
- Added default agent profiles for Codex, Claude Code, Cursor, Cline, Roo Code, and Windsurf.
- Added language profile support with `pmg init --language <tag>`.
- Added context explanation output with selected, candidate, excluded, low-score, matched-term, filter, and budget-usage metadata.
- Added CI coverage for Node 20, Node 22, and Node 24.
