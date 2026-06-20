# Language Profile

Project-Language: en
Conversation-Language: en
Formal-Docs-Language: en
Agent-Response-Language: en
Machine-Metadata-Language: en

## Rules

- Keep command flags, JSON fields, and metadata keys stable.
- Agents should answer in the configured agent response language unless the user asks otherwise.
- Formal documentation may use a separate language from conversation.
- Human-facing memory and review text may use the project language.
- Machine-readable metadata should remain predictable for tools and tests.
