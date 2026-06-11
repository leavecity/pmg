# Context Assembly Rules for This Repository

Context assembly is the central MVP capability.

The command should always include stable entrypoints and then select task-relevant PMG files with bounded output.

Do not change `pmg context build` in a way that loads the entire `.pmg/` tree by default.
