import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
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

test("pmg init writes operational memory governance instructions", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-init-instructions-"));

  await runPmg(["init", target]);

  const agents = await readFile(path.join(target, "AGENTS.md"), "utf8");

  assert.match(agents, /pmg context build --task "<task>"/);
  assert.match(agents, /pmg doctor/);
  assert.match(agents, /pmg memory cleanup propose/);
  assert.match(agents, /deprecated or archived memory should not guide implementation/i);
});

test("pmg init writes default agent profiles", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-init-profiles-"));

  await runPmg(["init", target]);

  const profiles = ["codex", "claude-code", "cursor", "cline", "roo-code", "windsurf"];

  for (const profile of profiles) {
    const content = await readFile(path.join(target, ".pmg", "profiles", `${profile}.md`), "utf8");

    assert.match(content, /pmg context build/);
    assert.match(content, /pmg doctor/);
    assert.match(content, /pmg memory propose/);
  }
});

test("pmg init can write a project language profile", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-init-language-"));

  const { stdout } = await runPmg(["init", target, "--language", "zh-CN"]);
  const languageProfile = await readFile(path.join(target, ".pmg", "profiles", "language.md"), "utf8");

  assert.match(stdout, /Updated PMG language profile: zh-CN/);
  assert.match(languageProfile, /Project-Language: zh-CN/);
  assert.match(languageProfile, /Conversation-Language: zh-CN/);
  assert.match(languageProfile, /Agent-Response-Language: zh-CN/);
  assert.match(languageProfile, /Formal-Docs-Language: en/);
  assert.match(languageProfile, /Machine-Metadata-Language: en/);
});

test("pmg init writes PMG local state rules to git info exclude", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-init-git-"));

  await mkdir(path.join(target, ".git", "info"), { recursive: true });
  await writeFile(path.join(target, ".gitignore"), "node_modules/\n", "utf8");

  const { stdout } = await runPmg(["init", target]);

  assert.match(stdout, /Updated local Git ignore rules/);
  assert.match(await readFile(path.join(target, ".git", "info", "exclude"), "utf8"), /\.pmg\//);
  assert.match(await readFile(path.join(target, ".git", "info", "exclude"), "utf8"), /PMG\.md/);
  assert.equal(await readFile(path.join(target, ".gitignore"), "utf8"), "node_modules/\n");
});

test("pmg init does not duplicate PMG local state ignore rules", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-init-git-idempotent-"));

  await mkdir(path.join(target, ".git", "info"), { recursive: true });

  await runPmg(["init", target]);
  const second = await runPmg(["init", target]);

  const exclude = await readFile(path.join(target, ".git", "info", "exclude"), "utf8");

  assert.match(second.stdout, /Local Git ignore rules already include PMG local state/);
  assert.equal(exclude.match(/^\.pmg\/$/gm)?.length, 1);
  assert.equal(exclude.match(/^PMG\.md$/gm)?.length, 1);
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

test("pmg context build excludes deprecated and archived memory by default", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-context-hygiene-"));

  await runPmg(["init", target]);
  await writeFile(
    path.join(target, ".pmg", "memory", "current-auth.md"),
    "# Current Auth\n\nStatus: confirmed\n\nLogin pages must avoid leaking auth tokens.\n",
    "utf8"
  );
  await writeFile(
    path.join(target, ".pmg", "memory", "old-auth.md"),
    "# Old Auth\n\nStatus: deprecated\n\nDeprecated auth token guidance should not be used.\n",
    "utf8"
  );
  await writeFile(
    path.join(target, ".pmg", "memory", "archived-auth.md"),
    "# Archived Auth\n\nStatus: archived\n\nArchived auth token guidance should not be used.\n",
    "utf8"
  );

  const { stdout } = await runPmg([
    "context",
    "build",
    "--path",
    target,
    "--task",
    "implement auth token handling",
    "--max-files",
    "12"
  ]);

  assert.match(stdout, /current-auth\.md/);
  assert.doesNotMatch(stdout, /old-auth\.md/);
  assert.doesNotMatch(stdout, /archived-auth\.md/);
  assert.doesNotMatch(stdout, /Deprecated auth token guidance/);
  assert.doesNotMatch(stdout, /Archived auth token guidance/);
});

test("pmg context build excludes memory archive audit records by default", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-context-archive-"));

  await runPmg(["init", target]);
  await mkdir(path.join(target, ".pmg", "memory", "archive", "promoted"), { recursive: true });
  await writeFile(
    path.join(target, ".pmg", "memory", "current-auth.md"),
    "# Current Auth\n\nStatus: confirmed\n\nUse the current auth token handling rule.\n",
    "utf8"
  );
  await writeFile(
    path.join(target, ".pmg", "memory", "archive", "promoted", "old-auth.md"),
    "# Memory Proposal: Old Auth\n\nStatus: promoted\n\nOld archived auth token audit content should not guide implementation.\n",
    "utf8"
  );

  const { stdout } = await runPmg([
    "context",
    "build",
    "--path",
    target,
    "--task",
    "implement auth token handling",
    "--max-files",
    "12"
  ]);

  assert.match(stdout, /current-auth\.md/);
  assert.doesNotMatch(stdout, /archive\/promoted\/old-auth\.md/);
  assert.doesNotMatch(stdout, /Old archived auth token audit content/);
});

test("pmg context build excludes pending memory proposals by default", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-context-proposals-"));

  await runPmg(["init", target]);
  await writeFile(
    path.join(target, ".pmg", "memory", "current-auth.md"),
    "# Current Auth\n\nStatus: confirmed\n\nUse the current auth token handling rule.\n",
    "utf8"
  );
  await writeFile(
    path.join(target, ".pmg", "memory", "proposals", "unapproved-auth.md"),
    "# Memory Proposal: Unapproved Auth\n\nStatus: pending\n\nUnapproved auth token proposal should not guide implementation.\n",
    "utf8"
  );

  const { stdout } = await runPmg([
    "context",
    "build",
    "--path",
    target,
    "--task",
    "implement auth token handling",
    "--max-files",
    "12"
  ]);

  assert.match(stdout, /current-auth\.md/);
  assert.doesNotMatch(stdout, /proposals\/unapproved-auth\.md/);
  assert.doesNotMatch(stdout, /Unapproved auth token proposal/);
});

test("pmg context build excludes pending memory files by default", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-context-pending-"));

  await runPmg(["init", target]);
  await writeFile(
    path.join(target, ".pmg", "memory", "current-auth.md"),
    "# Current Auth\n\nStatus: confirmed\n\nUse the current auth token handling rule.\n",
    "utf8"
  );
  await writeFile(
    path.join(target, ".pmg", "memory", "unconfirmed-auth.md"),
    "# Unconfirmed Auth\n\nStatus: pending\n\nPending auth token memory should not guide implementation.\n",
    "utf8"
  );

  const { stdout } = await runPmg([
    "context",
    "build",
    "--path",
    target,
    "--task",
    "implement auth token handling",
    "--max-files",
    "12"
  ]);

  assert.match(stdout, /current-auth\.md/);
  assert.doesNotMatch(stdout, /unconfirmed-auth\.md/);
  assert.doesNotMatch(stdout, /Pending auth token memory/);
});

test("pmg context build json explains excluded memory sources", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-context-excluded-json-"));

  await runPmg(["init", target]);
  await mkdir(path.join(target, ".pmg", "memory", "archive", "promoted"), { recursive: true });
  await writeFile(
    path.join(target, ".pmg", "memory", "current-zephyr.md"),
    "# Current Zephyr\n\nStatus: confirmed\n\nUse the current zephyr handling rule.\n",
    "utf8"
  );
  await writeFile(
    path.join(target, ".pmg", "memory", "unconfirmed-zephyr.md"),
    "# Unconfirmed Zephyr\n\nStatus: pending\n\nPending zephyr memory should not guide implementation.\n",
    "utf8"
  );
  await writeFile(
    path.join(target, ".pmg", "memory", "old-zephyr.md"),
    "# Old Zephyr\n\nStatus: deprecated\n\nDeprecated zephyr memory should not guide implementation.\n",
    "utf8"
  );
  await writeFile(
    path.join(target, ".pmg", "memory", "proposals", "unapproved-zephyr.md"),
    "# Memory Proposal: Unapproved Zephyr\n\nStatus: pending\n\nUnapproved zephyr proposal should not guide implementation.\n",
    "utf8"
  );
  await writeFile(
    path.join(target, ".pmg", "memory", "archive", "promoted", "audit-zephyr.md"),
    "# Memory Proposal: Audit Zephyr\n\nStatus: promoted\n\nArchived zephyr audit content should not guide implementation.\n",
    "utf8"
  );

  const { stdout } = await runPmg([
    "context",
    "build",
    "--path",
    target,
    "--task",
    "implement zephyr handling",
    "--max-files",
    "12",
    "--json"
  ]);
  const payload = JSON.parse(stdout);
  const excludedPaths = payload.excludedSources.map((source) => source.path).sort();

  assert.ok(payload.selectedSources.some((source) => source.path === ".pmg/memory/current-zephyr.md"));
  assert.deepEqual(excludedPaths, [
    ".pmg/memory/archive/promoted/audit-zephyr.md",
    ".pmg/memory/old-zephyr.md",
    ".pmg/memory/proposals/unapproved-zephyr.md",
    ".pmg/memory/unconfirmed-zephyr.md"
  ]);
  assert.equal(
    payload.excludedSources.find((source) => source.path === ".pmg/memory/unconfirmed-zephyr.md").reason,
    "pending memory is excluded from default context"
  );
  assert.equal(
    payload.excludedSources.find((source) => source.path === ".pmg/memory/old-zephyr.md").reason,
    "deprecated memory is excluded from default context"
  );
  assert.equal(
    payload.excludedSources.find((source) => source.path === ".pmg/memory/proposals/unapproved-zephyr.md").reason,
    "pending proposal file is excluded from default context"
  );
  assert.equal(
    payload.excludedSources.find((source) => source.path === ".pmg/memory/archive/promoted/audit-zephyr.md").reason,
    "memory archive audit record is excluded from default context"
  );
});

test("pmg context build can include task-relevant agent profiles", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-context-profiles-"));

  await runPmg(["init", target]);

  const { stdout } = await runPmg([
    "context",
    "build",
    "--path",
    target,
    "--task",
    "codex agent profile should run doctor and propose memory",
    "--max-files",
    "12"
  ]);

  assert.match(stdout, /\.pmg\/profiles\/codex\.md/);
  assert.match(stdout, /Codex/);
  assert.match(stdout, /pmg doctor/);
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

test("pmg memory promote marks an existing pending target as confirmed", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-memory-promote-visible-"));

  await runPmg(["init", target]);
  const propose = await runPmg([
    "memory",
    "propose",
    "--path",
    target,
    "--title",
    "Zephyr session rule",
    "--domain",
    "security",
    "--observation",
    "Zephyr sessions must not leak raw tokens.",
    "--knowledge",
    "Zephyr sessions must keep raw tokens out of logs."
  ]);
  const proposalId = propose.stdout.match(/proposals\/(.+\.md)/)?.[1]?.replace(/\.md$/, "");

  assert.ok(proposalId);

  await runPmg(["memory", "promote", proposalId, "--path", target, "--target", "security"]);

  const securityMemory = await readFile(path.join(target, ".pmg", "memory", "security.md"), "utf8");
  assert.match(securityMemory, /Status: confirmed/);

  const { stdout } = await runPmg([
    "context",
    "build",
    "--path",
    target,
    "--task",
    "implement zephyr session security",
    "--max-files",
    "12"
  ]);

  assert.match(stdout, /\.pmg\/memory\/security\.md/);
  assert.match(stdout, /Zephyr sessions must keep raw tokens out of logs/);
});

test("pmg memory archive refuses files outside the project root", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-archive-outside-"));
  const outsideDirectory = await mkdtemp(path.join(os.tmpdir(), "pmg-outside-archive-"));
  const outsideFile = path.join(outsideDirectory, "outside.md");

  await runPmg(["init", target]);
  await writeFile(outsideFile, "# Outside\n\nStatus: confirmed\n\nMust stay outside PMG.\n", "utf8");

  await assert.rejects(
    runPmg(["memory", "archive", outsideFile, "--path", target]),
    /outside the project root/
  );
  assert.match(await readFile(outsideFile, "utf8"), /Must stay outside PMG/);
});

test("pmg memory promote refuses targets outside the project root", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-promote-outside-"));
  const outsideDirectory = await mkdtemp(path.join(os.tmpdir(), "pmg-outside-promote-"));
  const outsideTarget = path.join(outsideDirectory, "outside.md");

  await runPmg(["init", target]);
  const propose = await runPmg([
    "memory",
    "propose",
    "--path",
    target,
    "--title",
    "Outside write guard",
    "--observation",
    "Memory promotion should stay inside the project.",
    "--knowledge",
    "Memory commands must not write outside the project root."
  ]);
  const proposalId = propose.stdout.match(/proposals\/(.+\.md)/)?.[1]?.replace(/\.md$/, "");

  assert.ok(proposalId);

  await assert.rejects(
    runPmg(["memory", "promote", proposalId, "--path", target, "--target", outsideTarget]),
    /outside the project root/
  );
  await assert.rejects(readFile(outsideTarget, "utf8"), /ENOENT/);
});

test("pmg memory project propose creates a pending current-view update without changing project memory", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-project-propose-"));

  await runPmg(["init", target]);
  const before = await readFile(path.join(target, ".pmg", "memory", "project.md"), "utf8");
  const propose = await runPmg([
    "memory",
    "project",
    "propose",
    "--path",
    target,
    "--title",
    "Clarify PMG purpose",
    "--summary",
    "Update the current project purpose after product positioning work.",
    "--content",
    "# Project Memory: Project\n\nStatus: confirmed\n\n## Purpose\n\nPMG governs agent memory.\n"
  ]);

  assert.match(propose.stdout, /Created project memory update proposal/);
  assert.equal(await readFile(path.join(target, ".pmg", "memory", "project.md"), "utf8"), before);

  const proposals = await readdir(path.join(target, ".pmg", "memory", "proposals"));
  const proposalFile = proposals.find((file) => file.endsWith("clarify-pmg-purpose.md"));

  assert.ok(proposalFile);
  assert.match(
    await readFile(path.join(target, ".pmg", "memory", "proposals", proposalFile), "utf8"),
    /Target: \.pmg\/memory\/project\.md/
  );
});

test("pmg memory project apply replaces current project memory after confirmation and keeps audit records", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-project-apply-"));

  await runPmg(["init", target]);
  const propose = await runPmg([
    "memory",
    "project",
    "propose",
    "--path",
    target,
    "--title",
    "Clarify PMG purpose",
    "--summary",
    "Update the current project purpose after product positioning work.",
    "--content",
    "# Project Memory: Project\n\nStatus: confirmed\n\n## Purpose\n\nPMG governs agent memory.\n"
  ]);
  const proposalId = propose.stdout.match(/proposals\/(.+\.md)/)?.[1]?.replace(/\.md$/, "");

  assert.ok(proposalId);

  const apply = await runPmg([
    "memory",
    "project",
    "apply",
    proposalId,
    "--path",
    target,
    "--reviewer",
    "test",
    "--reason",
    "Approved after review."
  ]);

  assert.match(apply.stdout, /Applied project memory update to \.pmg\/memory\/project\.md/);
  assert.match(apply.stdout, /Saved previous project memory snapshot/);
  assert.match(await readFile(path.join(target, ".pmg", "memory", "project.md"), "utf8"), /PMG governs agent memory/);

  const snapshots = await readdir(path.join(target, ".pmg", "memory", "archive", "project-snapshots"));
  const updates = await readdir(path.join(target, ".pmg", "memory", "archive", "project-updates"));

  assert.equal(snapshots.length, 1);
  assert.equal(updates.length, 1);
  assert.match(
    await readFile(path.join(target, ".pmg", "memory", "archive", "project-updates", updates[0]), "utf8"),
    /Status: applied/
  );
});

test("pmg memory conflict propose creates a pending resolution without changing memory", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-conflict-propose-"));

  await runPmg(["init", target]);
  await writeFile(
    path.join(target, ".pmg", "memory", "auth-conflict.md"),
    "# Auth Conflict\n\nStatus: conflicting\n\nOne source says token storage is allowed, another forbids it.\n",
    "utf8"
  );
  const beforeSource = await readFile(path.join(target, ".pmg", "memory", "auth-conflict.md"), "utf8");
  const beforeTarget = await readFile(path.join(target, ".pmg", "memory", "security.md"), "utf8");

  const propose = await runPmg([
    "memory",
    "conflict",
    "propose",
    "--path",
    target,
    "--title",
    "Resolve auth token storage",
    "--source",
    ".pmg/memory/auth-conflict.md",
    "--target",
    "security",
    "--summary",
    "Resolve contradictory token storage guidance.",
    "--resolution",
    "Authentication memory must forbid storing raw auth tokens.",
    "--evidence",
    "Security review chose the stricter rule."
  ]);

  assert.match(propose.stdout, /Created memory conflict resolution proposal/);
  assert.equal(await readFile(path.join(target, ".pmg", "memory", "auth-conflict.md"), "utf8"), beforeSource);
  assert.equal(await readFile(path.join(target, ".pmg", "memory", "security.md"), "utf8"), beforeTarget);

  const proposals = await readdir(path.join(target, ".pmg", "memory", "proposals"));
  const proposalFile = proposals.find((file) => file.endsWith("resolve-auth-token-storage.md"));

  assert.ok(proposalFile);
  const proposal = await readFile(path.join(target, ".pmg", "memory", "proposals", proposalFile), "utf8");

  assert.match(proposal, /Type: conflict-resolution/);
  assert.match(proposal, /Source: \.pmg\/memory\/auth-conflict\.md/);
  assert.match(proposal, /Target: \.pmg\/memory\/security\.md/);
  assert.match(proposal, /Authentication memory must forbid storing raw auth tokens/);
});

test("pmg memory conflict apply writes resolved memory and archives the conflicting source", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-conflict-apply-"));

  await runPmg(["init", target]);
  await writeFile(
    path.join(target, ".pmg", "memory", "auth-conflict.md"),
    "# Auth Conflict\n\nStatus: conflicting\n\nOne source says token storage is allowed, another forbids it.\n",
    "utf8"
  );

  const propose = await runPmg([
    "memory",
    "conflict",
    "propose",
    "--path",
    target,
    "--title",
    "Resolve auth token storage",
    "--source",
    ".pmg/memory/auth-conflict.md",
    "--target",
    "security",
    "--summary",
    "Resolve contradictory token storage guidance.",
    "--resolution",
    "Authentication memory must forbid storing raw auth tokens.",
    "--evidence",
    "Security review chose the stricter rule."
  ]);
  const proposalId = propose.stdout.match(/proposals\/(.+\.md)/)?.[1]?.replace(/\.md$/, "");

  assert.ok(proposalId);

  const apply = await runPmg([
    "memory",
    "conflict",
    "apply",
    proposalId,
    "--path",
    target,
    "--reviewer",
    "test",
    "--reason",
    "Approved conflict resolution."
  ]);

  assert.match(apply.stdout, /Applied memory conflict resolution/);
  assert.match(apply.stdout, /Archived conflicting memory: \.pmg\/memory\/auth-conflict\.md/);
  assert.match(await readFile(path.join(target, ".pmg", "memory", "security.md"), "utf8"), /Status: confirmed/);
  assert.match(await readFile(path.join(target, ".pmg", "memory", "security.md"), "utf8"), /Authentication memory must forbid storing raw auth tokens/);
  await assert.rejects(readFile(path.join(target, ".pmg", "memory", "auth-conflict.md"), "utf8"), /ENOENT/);

  const archived = await readdir(path.join(target, ".pmg", "memory", "archive", "archived"));
  const conflictAudits = await readdir(path.join(target, ".pmg", "memory", "archive", "conflict-resolutions"));

  assert.ok(archived.find((file) => file.endsWith("auth-conflict.md")));
  assert.equal(conflictAudits.length, 1);
  assert.match(
    await readFile(path.join(target, ".pmg", "memory", "archive", "conflict-resolutions", conflictAudits[0]), "utf8"),
    /Status: applied/
  );
});

test("pmg review create writes a draft review without modifying memory", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-review-create-"));
  const date = new Date().toISOString().slice(0, 10);

  await runPmg(["init", target]);
  const projectMemoryBefore = await readFile(path.join(target, ".pmg", "memory", "project.md"), "utf8");

  const { stdout } = await runPmg([
    "review",
    "create",
    "--path",
    target,
    "--type",
    "security",
    "--title",
    "Auth token review",
    "--scope",
    "Login token handling.",
    "--findings",
    "No token leaks found in the reviewed flow.",
    "--risks",
    "Debug logging could expose tokens later.",
    "--recommended-memory-updates",
    "Remember that auth flows must not log raw tokens.",
    "--related-files",
    "src/auth.ts,docs/security.md"
  ]);

  assert.match(stdout, /Created review/);
  assert.equal(await readFile(path.join(target, ".pmg", "memory", "project.md"), "utf8"), projectMemoryBefore);

  const reviewPath = path.join(target, ".pmg", "reviews", `${date}-auth-token-review.md`);
  const review = await readFile(reviewPath, "utf8");

  assert.match(review, /# Review: Auth token review/);
  assert.match(review, /Type: security/);
  assert.match(review, /Status: draft/);
  assert.match(review, new RegExp(`Date: ${date}`));
  assert.match(review, /## Scope/);
  assert.match(review, /Login token handling/);
  assert.match(review, /## Findings/);
  assert.match(review, /No token leaks found/);
  assert.match(review, /## Recommended Memory Updates/);
  assert.match(review, /Remember that auth flows must not log raw tokens/);
  assert.match(review, /## Related Files/);
  assert.match(review, /- src\/auth\.ts/);
  assert.match(review, /- docs\/security\.md/);
});

test("pmg review create output can enter task context", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-review-context-"));

  await runPmg(["init", target]);
  await runPmg([
    "review",
    "create",
    "--path",
    target,
    "--type",
    "security",
    "--title",
    "Auth token review",
    "--findings",
    "Auth token reviews must check debug logging."
  ]);

  const { stdout } = await runPmg([
    "context",
    "build",
    "--path",
    target,
    "--task",
    "auth token debug logging review",
    "--max-files",
    "12"
  ]);

  assert.match(stdout, /\.pmg\/reviews\/\d{4}-\d{2}-\d{2}-auth-token-review\.md/);
  assert.match(stdout, /Auth token reviews must check debug logging/);
});

test("pmg review memory propose creates a pending memory proposal from review recommendations", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-review-memory-propose-"));
  const date = new Date().toISOString().slice(0, 10);

  await runPmg(["init", target]);
  const securityMemoryBefore = await readFile(path.join(target, ".pmg", "memory", "security.md"), "utf8");
  await runPmg([
    "review",
    "create",
    "--path",
    target,
    "--type",
    "security",
    "--title",
    "Auth token review",
    "--scope",
    "Login token handling.",
    "--findings",
    "Debug logging must stay token-safe.",
    "--recommended-memory-updates",
    "Authentication flows must not log raw tokens."
  ]);

  const { stdout } = await runPmg([
    "review",
    "memory",
    "propose",
    "auth-token-review",
    "--path",
    target
  ]);

  assert.match(stdout, /Created memory proposal from review/);
  assert.equal(await readFile(path.join(target, ".pmg", "memory", "security.md"), "utf8"), securityMemoryBefore);

  const proposalPath = path.join(target, ".pmg", "memory", "proposals", `${date}-auth-token-review-memory-update.md`);
  const proposal = await readFile(proposalPath, "utf8");

  assert.match(proposal, /# Memory Proposal: Auth token review memory update/);
  assert.match(proposal, /Status: pending/);
  assert.match(proposal, /Domain: security/);
  assert.match(proposal, new RegExp(`Source: \\.pmg/reviews/${date}-auth-token-review\\.md`));
  assert.match(proposal, /Authentication flows must not log raw tokens/);
  assert.match(proposal, /Debug logging must stay token-safe/);
});

test("pmg review memory propose refuses reviews without recommendations", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-review-memory-empty-"));

  await runPmg(["init", target]);
  await runPmg([
    "review",
    "create",
    "--path",
    target,
    "--type",
    "security",
    "--title",
    "Empty recommendation review"
  ]);

  await assert.rejects(
    runPmg(["review", "memory", "propose", "empty-recommendation-review", "--path", target]),
    /review has no recommended memory updates/
  );
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

test("pmg doctor json reports a healthy repository", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-doctor-json-ok-"));

  await runPmg(["init", target]);

  const { stdout } = await runPmg(["doctor", "--path", target, "--json"]);
  const payload = JSON.parse(stdout);

  assert.equal(payload.root, target);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.errors, []);
  assert.deepEqual(payload.warnings, []);
  assert.deepEqual(payload.summary, { errorCount: 0, warningCount: 0 });
});

test("pmg doctor json reports errors and warnings", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-doctor-json-findings-"));

  await runPmg(["init", target]);
  await writeFile(
    path.join(target, ".pmg", "registry", "memory-index.json"),
    JSON.stringify({
      version: 1,
      memory: [{ path: ".pmg/memory/missing.md", domain: "missing", status: "confirmed" }]
    }),
    "utf8"
  );
  await writeFile(
    path.join(target, ".pmg", "memory", "deprecated-rule.md"),
    "# Deprecated Rule\n\nStatus: deprecated\n\nOld guidance.\n",
    "utf8"
  );

  const { stdout } = await runPmg(["doctor", "--path", target, "--json"]);
  const payload = JSON.parse(stdout);

  assert.equal(payload.ok, false);
  assert.equal(payload.summary.errorCount, 1);
  assert.equal(payload.summary.warningCount, 1);
  assert.deepEqual(payload.errors[0], {
    severity: "error",
    path: ".pmg/registry/memory-index.json",
    message: "referenced file does not exist: .pmg/memory/missing.md"
  });
  assert.deepEqual(payload.warnings[0], {
    severity: "warning",
    path: ".pmg/memory/deprecated-rule.md",
    message: "deprecated memory should be archived or replaced in current context"
  });
});

test("pmg doctor reports invalid memory proposal types", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-doctor-proposal-type-"));

  await runPmg(["init", target]);
  await writeFile(
    path.join(target, ".pmg", "memory", "proposals", "bad-type.md"),
    "# Bad Proposal\n\nStatus: pending\nType: unknown-proposal\n\n## Summary\n\nInvalid proposal type.\n",
    "utf8"
  );

  const { stdout } = await runPmg(["doctor", target]);

  assert.match(stdout, /Blocking issues found/);
  assert.match(stdout, /\.pmg\/memory\/proposals\/bad-type\.md: unknown proposal Type: unknown-proposal/);
});

test("pmg doctor reports missing conflict proposal contract fields", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-doctor-conflict-contract-"));

  await runPmg(["init", target]);
  await writeFile(
    path.join(target, ".pmg", "memory", "proposals", "bad-conflict.md"),
    "# Bad Conflict Proposal\n\nStatus: pending\nType: conflict-resolution\nTarget: .pmg/memory/security.md\n\n## Summary\n\nMissing source and resolution.\n",
    "utf8"
  );

  const { stdout } = await runPmg(["doctor", target]);

  assert.match(stdout, /Blocking issues found/);
  assert.match(stdout, /\.pmg\/memory\/proposals\/bad-conflict\.md: conflict-resolution proposal missing Source metadata/);
  assert.match(stdout, /\.pmg\/memory\/proposals\/bad-conflict\.md: conflict-resolution proposal missing Resolution Memory section/);
});

test("pmg doctor reports missing conflict proposal references", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-doctor-conflict-reference-"));

  await runPmg(["init", target]);
  await writeFile(
    path.join(target, ".pmg", "memory", "proposals", "bad-conflict-reference.md"),
    "# Bad Conflict Proposal\n\nStatus: pending\nType: conflict-resolution\nSource: .pmg/memory/missing-conflict.md\nTarget: .pmg/memory/security.md\n\n## Summary\n\nMissing source file.\n\n## Resolution Memory\n\nUse the confirmed security memory.\n",
    "utf8"
  );

  const { stdout } = await runPmg(["doctor", target]);

  assert.match(stdout, /Blocking issues found/);
  assert.match(stdout, /\.pmg\/memory\/proposals\/bad-conflict-reference\.md: conflict-resolution proposal Source does not exist: \.pmg\/memory\/missing-conflict\.md/);
});

test("pmg doctor reports malformed cleanup proposals", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-doctor-cleanup-contract-"));

  await runPmg(["init", target]);
  await writeFile(
    path.join(target, ".pmg", "memory", "proposals", "bad-cleanup.md"),
    "# Bad Cleanup Proposal\n\nStatus: pending\nType: memory-cleanup\n\n## Summary\n\nMissing findings.\n",
    "utf8"
  );

  const { stdout } = await runPmg(["doctor", target]);

  assert.match(stdout, /Blocking issues found/);
  assert.match(stdout, /\.pmg\/memory\/proposals\/bad-cleanup\.md: memory-cleanup proposal missing Findings section/);
});

test("pmg doctor validates cleanup proposal finding paths", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-doctor-cleanup-paths-"));

  await runPmg(["init", target]);
  await writeFile(
    path.join(target, ".pmg", "memory", "proposals", "bad-cleanup-paths.md"),
    [
      "# Bad Cleanup Proposal",
      "",
      "Status: pending",
      "Type: memory-cleanup",
      "",
      "## Findings",
      "",
      "- ../outside.md: deprecated memory should be archived or replaced in current context",
      "- .pmg/memory/missing.md: conflicting memory must be resolved before agents rely on it",
      "",
      "## Recommended Actions",
      "",
      "Review each finding."
    ].join("\n"),
    "utf8"
  );

  const { stdout } = await runPmg(["doctor", target]);

  assert.match(stdout, /Blocking issues found/);
  assert.match(stdout, /\.pmg\/memory\/proposals\/bad-cleanup-paths\.md: memory-cleanup finding path resolves outside the project root: \.\.\/outside\.md/);
  assert.match(stdout, /Warnings:/);
  assert.match(stdout, /\.pmg\/memory\/proposals\/bad-cleanup-paths\.md: memory-cleanup finding path does not exist: \.pmg\/memory\/missing\.md/);
});

test("pmg doctor reports applied or promoted audit records left in proposals", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-doctor-proposals-audit-"));

  await runPmg(["init", target]);
  await writeFile(
    path.join(target, ".pmg", "memory", "proposals", "applied-update.md"),
    "# Project Memory Update Proposal: Applied\n\nStatus: applied\nTarget: .pmg/memory/project.md\n\n## Proposed Project Memory\n\nApplied content.\n",
    "utf8"
  );
  await writeFile(
    path.join(target, ".pmg", "memory", "proposals", "promoted-memory.md"),
    "# Memory Proposal: Promoted\n\nStatus: promoted\n\n## Durable Knowledge Candidate\n\nPromoted content.\n",
    "utf8"
  );

  const { stdout } = await runPmg(["doctor", target]);

  assert.match(stdout, /Blocking issues found/);
  assert.match(stdout, /\.pmg\/memory\/proposals\/applied-update\.md: applied proposal audit record must not remain in \.pmg\/memory\/proposals/);
  assert.match(stdout, /\.pmg\/memory\/proposals\/promoted-memory\.md: promoted proposal audit record must not remain in \.pmg\/memory\/proposals/);
});

test("pmg doctor reports audit records in the wrong archive directory", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-doctor-audit-directories-"));

  await runPmg(["init", target]);
  await mkdir(path.join(target, ".pmg", "memory", "archive", "archived"), { recursive: true });
  await mkdir(path.join(target, ".pmg", "memory", "archive", "promoted"), { recursive: true });
  await mkdir(path.join(target, ".pmg", "memory", "archive", "cleanup-applied"), { recursive: true });
  await writeFile(
    path.join(target, ".pmg", "memory", "archive", "archived", "promoted-memory.md"),
    "# Memory Proposal: Promoted\n\nStatus: promoted\n\n## Durable Knowledge Candidate\n\nPromoted content.\n",
    "utf8"
  );
  await writeFile(
    path.join(target, ".pmg", "memory", "archive", "promoted", "applied-cleanup.md"),
    "# Memory Cleanup Proposal: Applied\n\nStatus: applied\nType: memory-cleanup\n\n## Findings\n\n- .pmg/memory/security.md: deprecated memory should be archived or replaced in current context\n",
    "utf8"
  );
  await writeFile(
    path.join(target, ".pmg", "memory", "archive", "promoted", "applied-conflict.md"),
    "# Memory Conflict Resolution Proposal: Applied\n\nStatus: applied\nType: conflict-resolution\n\n## Resolution Memory\n\nResolved content.\n",
    "utf8"
  );
  await writeFile(
    path.join(target, ".pmg", "memory", "archive", "cleanup-applied", "project-update.md"),
    "# Project Memory Update Proposal: Applied\n\nStatus: applied\nTarget: .pmg/memory/project.md\n\n## Proposed Project Memory\n\nApplied content.\n",
    "utf8"
  );

  const { stdout } = await runPmg(["doctor", target]);

  assert.match(stdout, /Blocking issues found/);
  assert.match(stdout, /\.pmg\/memory\/archive\/archived\/promoted-memory\.md: promoted audit record must be stored under \.pmg\/memory\/archive\/promoted\//);
  assert.match(stdout, /\.pmg\/memory\/archive\/promoted\/applied-cleanup\.md: applied memory-cleanup audit record must be stored under \.pmg\/memory\/archive\/cleanup-applied\//);
  assert.match(stdout, /\.pmg\/memory\/archive\/promoted\/applied-conflict\.md: applied conflict-resolution audit record must be stored under \.pmg\/memory\/archive\/conflict-resolutions\//);
  assert.match(stdout, /\.pmg\/memory\/archive\/cleanup-applied\/project-update\.md: applied project memory update audit record must be stored under \.pmg\/memory\/archive\/project-updates\//);
});

test("pmg doctor reports invalid active memory status values", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-doctor-memory-status-"));

  await runPmg(["init", target]);
  await writeFile(
    path.join(target, ".pmg", "memory", "bad-status.md"),
    "# Bad Status\n\nStatus: durable\n\nThis status is not part of the PMG memory lifecycle.\n",
    "utf8"
  );

  const { stdout } = await runPmg(["doctor", target]);

  assert.match(stdout, /Blocking issues found/);
  assert.match(stdout, /\.pmg\/memory\/bad-status\.md: memory Status must be one of: archived, confirmed, conflicting, deprecated, experimental, inferred, pending/);
});

test("pmg doctor reports pending active memory that contains confirmed guidance", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-doctor-pending-confirmed-"));

  await runPmg(["init", target]);
  await writeFile(
    path.join(target, ".pmg", "memory", "security.md"),
    "# Project Memory: Security\n\nStatus: pending\n\n## Promoted: Token handling\n\nStatus: confirmed\n\nDo not log raw tokens.\n",
    "utf8"
  );

  const { stdout } = await runPmg(["doctor", target]);

  assert.match(stdout, /Blocking issues found/);
  assert.match(stdout, /\.pmg\/memory\/security\.md: active memory has pending status but contains confirmed guidance/);
});

test("pmg doctor reports archived memory registered as an active source", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-doctor-archive-registry-"));

  await runPmg(["init", target]);
  await mkdir(path.join(target, ".pmg", "memory", "archive", "archived"), { recursive: true });
  await writeFile(
    path.join(target, ".pmg", "memory", "archive", "archived", "old-security.md"),
    "# Old Security\n\nStatus: archived\n\nOld guidance.\n",
    "utf8"
  );
  await writeFile(
    path.join(target, ".pmg", "registry", "memory-index.json"),
    JSON.stringify({
      version: 1,
      memory: [
        {
          path: ".pmg/memory/archive/archived/old-security.md",
          domain: "security",
          status: "archived"
        }
      ]
    }),
    "utf8"
  );

  const { stdout } = await runPmg(["doctor", target]);

  assert.match(stdout, /Blocking issues found/);
  assert.match(stdout, /\.pmg\/registry\/memory-index\.json: registry must not reference archived memory: \.pmg\/memory\/archive\/archived\/old-security\.md/);
});

test("pmg doctor reports malformed review files", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-doctor-review-contract-"));

  await runPmg(["init", target]);
  await mkdir(path.join(target, ".pmg", "reviews"), { recursive: true });
  await writeFile(
    path.join(target, ".pmg", "reviews", "bad-review.md"),
    "# Review: Bad\n\nStatus: draft\n\n## Findings\n\nMissing metadata and sections.\n",
    "utf8"
  );

  const { stdout } = await runPmg(["doctor", target]);

  assert.match(stdout, /Blocking issues found/);
  assert.match(stdout, /\.pmg\/reviews\/bad-review\.md: review missing Type metadata/);
  assert.match(stdout, /\.pmg\/reviews\/bad-review\.md: review missing Date metadata/);
  assert.match(stdout, /\.pmg\/reviews\/bad-review\.md: review missing Scope section/);
  assert.match(stdout, /\.pmg\/reviews\/bad-review\.md: review missing Risks section/);
  assert.match(stdout, /\.pmg\/reviews\/bad-review\.md: review missing Recommended Memory Updates section/);
  assert.match(stdout, /\.pmg\/reviews\/bad-review\.md: review missing Related Files section/);
});

test("pmg doctor warns about memory cleanup candidates", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-doctor-memory-cleanup-"));

  await runPmg(["init", target]);
  await writeFile(
    path.join(target, ".pmg", "memory", "deprecated-rule.md"),
    "# Deprecated Rule\n\nStatus: deprecated\n\nSuperseded-By: .pmg/memory/missing-new-rule.md\n\nOld guidance.\n",
    "utf8"
  );
  await writeFile(
    path.join(target, ".pmg", "memory", "conflict.md"),
    "# Conflict\n\nStatus: conflicting\n\nTwo rules disagree.\n",
    "utf8"
  );

  const { stdout } = await runPmg(["doctor", target]);

  assert.match(stdout, /Warnings:/);
  assert.match(stdout, /\.pmg\/memory\/deprecated-rule\.md: deprecated memory should be archived or replaced in current context/);
  assert.match(stdout, /\.pmg\/memory\/deprecated-rule\.md: superseded memory points to missing replacement: \.pmg\/memory\/missing-new-rule\.md/);
  assert.match(stdout, /\.pmg\/memory\/conflict\.md: conflicting memory must be resolved before agents rely on it/);
});

test("pmg memory cleanup propose creates a pending cleanup proposal from doctor findings", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-cleanup-propose-"));

  await runPmg(["init", target]);
  await writeFile(
    path.join(target, ".pmg", "memory", "deprecated-rule.md"),
    "# Deprecated Rule\n\nStatus: deprecated\n\nSuperseded-By: .pmg/memory/missing-new-rule.md\n\nOld guidance.\n",
    "utf8"
  );
  await writeFile(
    path.join(target, ".pmg", "memory", "conflict.md"),
    "# Conflict\n\nStatus: conflicting\n\nTwo rules disagree.\n",
    "utf8"
  );

  const { stdout } = await runPmg(["memory", "cleanup", "propose", "--path", target]);

  assert.match(stdout, /Created memory cleanup proposal/);

  const proposals = await readdir(path.join(target, ".pmg", "memory", "proposals"));
  const proposalFile = proposals.find((file) => file.endsWith("memory-cleanup.md"));

  assert.ok(proposalFile);

  const proposal = await readFile(path.join(target, ".pmg", "memory", "proposals", proposalFile), "utf8");

  assert.match(proposal, /Type: memory-cleanup/);
  assert.match(proposal, /\.pmg\/memory\/deprecated-rule\.md/);
  assert.match(proposal, /deprecated memory should be archived or replaced in current context/);
  assert.match(proposal, /\.pmg\/memory\/conflict\.md/);
  assert.match(proposal, /conflicting memory must be resolved before agents rely on it/);
});

test("pmg memory cleanup propose does not create a proposal when there are no cleanup findings", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-cleanup-empty-"));

  await runPmg(["init", target]);

  const { stdout } = await runPmg(["memory", "cleanup", "propose", "--path", target]);
  const proposals = await readdir(path.join(target, ".pmg", "memory", "proposals"));

  assert.match(stdout, /No memory cleanup findings found/);
  assert.equal(proposals.filter((file) => file.endsWith(".md")).length, 0);
});

test("pmg memory cleanup apply archives deprecated memory and leaves conflicting memory for review", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-cleanup-apply-"));

  await runPmg(["init", target]);
  await writeFile(
    path.join(target, ".pmg", "memory", "deprecated-rule.md"),
    "# Deprecated Rule\n\nStatus: deprecated\n\nOld guidance.\n",
    "utf8"
  );
  await writeFile(
    path.join(target, ".pmg", "memory", "conflict.md"),
    "# Conflict\n\nStatus: conflicting\n\nTwo rules disagree.\n",
    "utf8"
  );

  const propose = await runPmg(["memory", "cleanup", "propose", "--path", target]);
  const proposalId = propose.stdout.match(/proposals\/(.+\.md)/)?.[1]?.replace(/\.md$/, "");

  assert.ok(proposalId);

  const apply = await runPmg([
    "memory",
    "cleanup",
    "apply",
    proposalId,
    "--path",
    target,
    "--reviewer",
    "test",
    "--reason",
    "Approved cleanup."
  ]);

  assert.match(apply.stdout, /Applied memory cleanup proposal/);
  assert.match(apply.stdout, /Archived deprecated memory: \.pmg\/memory\/deprecated-rule\.md/);
  assert.match(apply.stdout, /Manual cleanup still required: \.pmg\/memory\/conflict\.md/);
  await assert.rejects(readFile(path.join(target, ".pmg", "memory", "deprecated-rule.md"), "utf8"), /ENOENT/);
  assert.match(await readFile(path.join(target, ".pmg", "memory", "conflict.md"), "utf8"), /Status: conflicting/);

  const archived = await readdir(path.join(target, ".pmg", "memory", "archive", "archived"));
  const cleanupAudits = await readdir(path.join(target, ".pmg", "memory", "archive", "cleanup-applied"));

  assert.ok(archived.find((file) => file.endsWith("deprecated-rule.md")));
  assert.equal(cleanupAudits.length, 1);
  assert.match(
    await readFile(path.join(target, ".pmg", "memory", "archive", "cleanup-applied", cleanupAudits[0]), "utf8"),
    /Status: applied/
  );
});

test("pmg memory cleanup apply keeps conflict-only proposals as audit records", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-cleanup-apply-conflict-"));

  await runPmg(["init", target]);
  await writeFile(
    path.join(target, ".pmg", "memory", "conflict.md"),
    "# Conflict\n\nStatus: conflicting\n\nTwo rules disagree.\n",
    "utf8"
  );

  const propose = await runPmg(["memory", "cleanup", "propose", "--path", target]);
  const proposalId = propose.stdout.match(/proposals\/(.+\.md)/)?.[1]?.replace(/\.md$/, "");

  assert.ok(proposalId);

  const apply = await runPmg(["memory", "cleanup", "apply", proposalId, "--path", target]);

  assert.match(apply.stdout, /No automatically applicable cleanup actions found/);
  assert.match(await readFile(path.join(target, ".pmg", "memory", "conflict.md"), "utf8"), /Status: conflicting/);

  const cleanupAudits = await readdir(path.join(target, ".pmg", "memory", "archive", "cleanup-applied"));

  assert.equal(cleanupAudits.length, 1);
});

test("pmg memory cleanup apply refuses findings outside the project root", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-cleanup-apply-outside-"));

  await runPmg(["init", target]);
  await writeFile(
    path.join(target, ".pmg", "memory", "proposals", "outside-cleanup.md"),
    [
      "# Outside Cleanup Proposal",
      "",
      "Status: pending",
      "Type: memory-cleanup",
      "",
      "## Findings",
      "",
      "- ../outside.md: deprecated memory should be archived or replaced in current context",
      "",
      "## Recommended Actions",
      "",
      "Review each finding."
    ].join("\n"),
    "utf8"
  );

  await assert.rejects(
    runPmg(["memory", "cleanup", "apply", "outside-cleanup", "--path", target]),
    /memory cleanup finding resolves outside the project root/
  );
});

test("pmg doctor warns when PMG local state is not ignored by host git", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-doctor-git-ignore-"));

  await runPmg(["init", target]);
  await mkdir(path.join(target, ".git", "info"), { recursive: true });

  const { stdout } = await runPmg(["doctor", target]);

  assert.match(stdout, /Warnings:/);
  assert.match(stdout, /\.git\/info\/exclude: PMG local state is not ignored by host Git repository/);
});
