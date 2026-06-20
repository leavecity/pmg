# Project Memory Governance

This repository has a PMG workspace in `.pmg/`.

PMG exists to help AI coding agents preserve and use long-term project knowledge safely.

Important rules:

- Root `AGENTS.md` is only an entrypoint.
- `.pmg/constitution.md` defines memory governance rules.
- `.pmg/memory/` stores durable and pending project knowledge.
- `.pmg/specs/` stores planned work.
- `.pmg/adr/` stores architectural decisions.
- `.pmg/reviews/` stores review artifacts.
- `.pmg/profiles/` stores agent-specific operating profiles.
- `.pmg/governance/` stores lifecycle, confidence, promotion, conflict, and context rules.
- `.pmg/registry/` stores indexes and skill registry data.

Agents should build a task-specific context bundle before non-trivial work:

```bash
pmg context build --task "<task>"
```
