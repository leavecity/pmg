# Cursor Integration

Recommended workflow:

1. Add root `AGENTS.md` to repository context.
2. Use `pmg context build --task "<task>"` to create focused context.
3. Attach the generated bundle to Cursor chat when doing architecture-sensitive work.
4. Keep memory updates explicit and reviewable in Git.

Suggested instruction:

```text
Follow PMG governance. Use the generated context bundle for this task. Do not infer broad project rules from a single file unless PMG memory or ADRs support it.
```
