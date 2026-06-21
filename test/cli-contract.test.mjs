import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "dist", "cli.js");

const implementedCommands = [
  "pmg init",
  "pmg status",
  "pmg scan",
  "pmg doctor",
  "pmg diff",
  "pmg context build",
  "pmg context explain",
  "pmg memory propose",
  "pmg memory promote",
  "pmg memory archive",
  "pmg memory project propose",
  "pmg memory project apply",
  "pmg memory cleanup propose",
  "pmg memory cleanup apply",
  "pmg memory conflict propose",
  "pmg memory conflict apply",
  "pmg migrate",
  "pmg publish plan",
  "pmg review create",
  "pmg review memory propose"
];

async function runPmgHelp() {
  const { stdout } = await execFileAsync(process.execPath, [cliPath, "help"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NO_COLOR: "1"
    }
  });

  return stdout;
}

test("pmg help lists every implemented command surface", async () => {
  const help = await runPmgHelp();

  for (const command of implementedCommands) {
    assert.match(help, new RegExp(escapeRegExp(command)));
  }
});

test("pmg help shows doctor structured and dry-run flags", async () => {
  const help = await runPmgHelp();

  assert.match(help, /pmg doctor \[path\] \[--json\] \[--fix-dry-run\]/);
});

test("CLI design docs list every implemented command surface", async () => {
  const cliDesign = await readFile(path.join(repoRoot, "docs", "cli-design.md"), "utf8");

  for (const command of implementedCommands) {
    assert.match(cliDesign, new RegExp(`\`${escapeRegExp(command)}`));
  }
});

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
