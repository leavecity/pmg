# Codex Integration

Recommended workflow:

1. Read root `AGENTS.md`.
2. Read `PMG.md` and `.pmg/constitution.md`.
3. Before non-trivial work, ask for or run:

   ```bash
   pmg context build --task "<task>"
   ```

4. Use the context bundle as bounded project context.
5. Propose memory updates instead of directly promoting uncertain observations.

Suggested Codex instruction:

```text
Use PMG as the project memory layer. Do not load all .pmg files by default. Build or request a task-specific context bundle, follow confidence levels, and place uncertain durable knowledge into pending memory for review.
```
