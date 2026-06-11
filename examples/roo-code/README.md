# Roo Code Integration

Recommended workflow:

1. Read root `AGENTS.md`.
2. Use `PMG.md` as the PMG entrypoint.
3. Build context:

   ```bash
   pmg context build --task "<task>"
   ```

4. Use PMG skills under `.pmg/skills/` when the task touches architecture, dependencies, security, performance, or technical debt.
5. Write uncertain findings to pending memory or review artifacts.
