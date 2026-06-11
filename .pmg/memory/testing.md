# Project Memory: Testing

Status: confirmed

Tests use the built CLI at `dist/cli.js` through the Node test runner.

Command tests should create temporary repositories and inspect generated files rather than relying on global machine state.
