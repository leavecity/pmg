# File Formats

PMG v1 uses Markdown and JSON.

## Markdown

Markdown files are used for human-readable project knowledge:

- memory
- specs
- ADRs
- reviews
- governance rules
- skill descriptions
- templates

Markdown files should include enough metadata in plain text to be understood without a parser. Templates use simple fields such as `Status`, `Confidence`, `Domain`, `Source`, and `Date`.

## JSON

JSON files are used for machine-readable registries:

- `.pmg/registry/skills.json`
- `.pmg/registry/memory-index.json`

Registry JSON should remain small and deterministic. It should reference files by repository-relative paths.

## Future formats

YAML front matter, JSON Schema validation, graph exports, and vector indexes may be added later, but they are not required for the MVP.
