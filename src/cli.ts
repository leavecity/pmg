#!/usr/bin/env node
import { runCli } from "./lib/cli.js";

runCli(process.argv.slice(2), process.cwd()).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`pmg: ${message}`);
  process.exitCode = 1;
});
