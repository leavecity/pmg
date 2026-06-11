# Skill Registry

PMG can describe reusable project-specific agent skills without binding to one vendor.

The MVP stores skills in:

```text
.pmg/skills/
.pmg/registry/skills.json
```

Each skill should define:

- name
- purpose
- when to use it
- required inputs
- expected outputs
- related governance module

Future versions may generate agent-specific skill files from the registry.
