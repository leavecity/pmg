# PMG Project Entry

Project Memory Governance helps coding agents work with durable project knowledge without loading everything all the time.

The key idea is governed memory:

- Knowledge can be pending, confirmed, inferred, experimental, deprecated, or conflicting.
- Durable memory should be promoted through policy, not appended casually.
- Context bundles should be assembled for a task, not copied wholesale from the repository.

For this repository:

- Source code lives in `src/`.
- Default initialized project files live in `templates/pmg/`.
- Design documents live in `docs/`.
- Tests live in `test/`.

When changing the CLI, keep `pmg init`, `pmg status`, `pmg doctor`, and `pmg context build` understandable to a new maintainer reading only this repo.

Memory lifecycle commands now exist for the MVP:

- `pmg memory propose`
- `pmg memory promote`
- `pmg memory archive`
