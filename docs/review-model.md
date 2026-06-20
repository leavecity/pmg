# Review Model

Reviews capture quality checks and risks produced during work.

Review artifacts may cover:

- architecture
- security
- performance
- dependencies
- technical debt

A review may recommend a memory update, but it should not directly convert pending knowledge into confirmed memory without policy approval.

`pmg review create` writes a draft review under `.pmg/reviews/YYYY-MM-DD-<slug>.md`.

Review files use top-level metadata:

- `Type`
- `Status`
- `Date`

Review files should include:

- `Scope`
- `Findings`
- `Risks`
- `Recommended Memory Updates`
- `Related Files`

Recommended memory updates are evidence and intent. They do not update durable memory until a separate memory proposal is reviewed and promoted.

`pmg review memory propose <review>` turns the `Recommended Memory Updates` section into a pending memory proposal. The review file becomes the proposal source and evidence. The command refuses reviews whose recommendation section is empty or still `Pending.`.

This command does not promote memory. It preserves the normal memory lifecycle:

```text
Review recommendation -> Pending memory proposal -> Review -> Promotion
```
