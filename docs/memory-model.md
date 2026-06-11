# Memory Model

PMG memory is durable project knowledge with an explicit status and lifecycle.

## Confidence levels

- `confirmed`: accepted as durable project knowledge
- `inferred`: likely true but not explicitly approved
- `experimental`: temporarily useful but still being evaluated
- `deprecated`: previously valid but no longer recommended
- `conflicting`: known to conflict with other project knowledge

## Lifecycle

```text
Observation -> Extraction -> Classification -> Pending -> Review -> Approval -> Promotion -> Use -> Revision -> Archive
```

Durable memory should be promoted only when policy allows it. One-off observations, temporary task details, and unverified preferences should not become confirmed rules.
