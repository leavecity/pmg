import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "dist", "cli.js");

async function runPmg(args, options = {}) {
  return execFileAsync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    env: {
      ...process.env,
      NO_COLOR: "1"
    }
  });
}

test("pmg init creates the default PMG layout", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-init-"));

  const { stdout } = await runPmg(["init", target]);

  assert.match(stdout, /Initialized Project Memory Governance/);
  assert.match(await readFile(path.join(target, "AGENTS.md"), "utf8"), /Project Memory Governance/);
  assert.match(await readFile(path.join(target, ".pmg", "constitution.md"), "utf8"), /Memory lifecycle/);
  assert.match(await readFile(path.join(target, ".pmg", "registry", "skills.json"), "utf8"), /memory-curator/);
});

test("pmg status reports ready after init", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-status-"));

  await runPmg(["init", target]);
  const { stdout } = await runPmg(["status", target]);

  assert.match(stdout, /Status: ready/);
  assert.match(stdout, /Specs: 0/);
});

test("pmg scan reports entrypoints and debt candidates", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-scan-"));

  await runPmg(["init", target]);
  await writeFile(path.join(target, "work.ts"), "// TODO: replace temporary implementation\n", "utf8");

  const { stdout } = await runPmg(["scan", target]);

  assert.match(stdout, /entrypoint: AGENTS\.md/);
  assert.match(stdout, /debt-candidate: work\.ts/);
});

test("pmg context build includes task-relevant memory", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-context-"));

  await runPmg(["init", target]);
  await writeFile(
    path.join(target, ".pmg", "memory", "security.md"),
    "# Security Memory\n\nStatus: confirmed\n\nLogin pages must avoid leaking auth tokens.\n",
    "utf8"
  );
  await writeFile(
    path.join(target, ".pmg", "memory", "performance.md"),
    "# Performance Memory\n\nStatus: confirmed\n\nLarge reports need pagination.\n",
    "utf8"
  );

  const { stdout } = await runPmg([
    "context",
    "build",
    "--path",
    target,
    "--task",
    "implement login auth page",
    "--max-files",
    "8"
  ]);

  assert.match(stdout, /PMG Context Bundle/);
  assert.match(stdout, /security\.md/);
  assert.match(stdout, /auth tokens/);
});

test("pmg memory propose and promote preserve an audit record", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-memory-"));

  await runPmg(["init", target]);
  const propose = await runPmg([
    "memory",
    "propose",
    "--path",
    target,
    "--title",
    "Login token handling",
    "--domain",
    "security",
    "--observation",
    "Login pages must avoid leaking auth tokens.",
    "--knowledge",
    "Authentication UI must not log raw auth tokens.",
    "--evidence",
    "Security review."
  ]);

  assert.match(propose.stdout, /Created memory proposal/);

  const promote = await runPmg([
    "memory",
    "promote",
    "login-token-handling",
    "--path",
    target,
    "--target",
    "security",
    "--reason",
    "Confirmed by security review.",
    "--reviewer",
    "test"
  ]);

  assert.match(promote.stdout, /Promoted memory proposal/);
  assert.match(
    await readFile(path.join(target, ".pmg", "memory", "security.md"), "utf8"),
    /Authentication UI must not log raw auth tokens/
  );
  const promotedFiles = await readdir(path.join(target, ".pmg", "memory", "archive", "promoted"));
  const promotedFile = promotedFiles.find((file) => file.endsWith("login-token-handling.md"));

  assert.ok(promotedFile);
  assert.match(await readFile(path.join(target, ".pmg", "memory", "archive", "promoted", promotedFile), "utf8"), /Status: promoted/);
});

test("pmg doctor reports broken registry references", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-doctor-"));

  await runPmg(["init", target]);
  await writeFile(
    path.join(target, ".pmg", "registry", "memory-index.json"),
    JSON.stringify({
      version: 1,
      memory: [
        {
          path: ".pmg/memory/missing.md",
          domain: "missing",
          status: "confirmed"
        }
      ]
    }),
    "utf8"
  );

  const { stdout } = await runPmg(["doctor", target]);

  assert.match(stdout, /Blocking issues found/);
  assert.match(stdout, /referenced file does not exist: \.pmg\/memory\/missing\.md/);
});
