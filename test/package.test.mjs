import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("package metadata exposes packaging checks and user onboarding docs", async () => {
  const pkg = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

  assert.equal(pkg.bin.pmg, "./dist/cli.js");
  assert.equal(pkg.scripts["package:check"], "npm pack --dry-run");
  assert.ok(pkg.files.includes("docs"));
  assert.ok(pkg.files.includes("templates"));
  assert.ok(pkg.files.includes("CHANGELOG.md"));

  const quickStart = await readFile(path.join(repoRoot, "docs", "quick-start.md"), "utf8");
  const recoveryGuide = await readFile(path.join(repoRoot, "docs", "recovery-guide.md"), "utf8");

  assert.match(quickStart, /pmg init/);
  assert.match(quickStart, /pmg context build/);
  assert.match(recoveryGuide, /pmg doctor/);
  assert.match(recoveryGuide, /pmg diff/);
});
