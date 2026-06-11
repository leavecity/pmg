# Claude Code Integration

Recommended workflow:

1. Keep root `AGENTS.md` short.
2. Point Claude Code to `PMG.md` and `.pmg/constitution.md`.
3. Generate bounded context for the task:

   ```bash
   pmg context build --task "<task>"
   ```

4. Ask Claude Code to preserve memory lifecycle boundaries:

   ```text
   Treat confirmed PMG memory as durable guidance. Treat inferred and pending memory as candidates, not rules. Do not promote memory without approval.
   ```
