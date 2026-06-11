# Project Memory: Architecture

Status: confirmed

The CLI uses small command modules under `src/commands/` and shared helpers under `src/lib/`.

Templates copied by `pmg init` live under `templates/pmg/`.

The CLI should avoid hidden global state. Repository files are the source of truth.
