# Contributing

Thanks for helping build Project Memory Governance.

## Development setup

```bash
npm install
npm run build
npm test
```

## Contribution principles

- Keep v1 repository-native and file-based.
- Prefer clear file formats over hidden state.
- Document every new command and template.
- Add tests for implemented behavior.
- Keep memory governance explicit: pending knowledge must not silently become confirmed memory.

## Pull request checklist

- The change has a clear user-facing purpose.
- CLI behavior is documented.
- Tests cover the changed behavior.
- New file formats are documented under `docs/`.
- Generated context remains task-specific and bounded.
