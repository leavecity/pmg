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

test("pmg doctor warns when PMG local state is not ignored by host git", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "pmg-doctor-git-ignore-"));

  await runPmg(["init", target]);
  await mkdir(path.join(target, ".git", "info"), { recursive: true });

  const { stdout } = await runPmg(["doctor", target]);

  assert.match(stdout, /Warnings:/);
  assert.match(stdout, /\.git\/info\/exclude: PMG local state is not ignored by host Git repository/);
});
