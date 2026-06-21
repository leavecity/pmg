import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { parseArgs, getStringFlag, hasFlag } from "../lib/args.js";
import { pathExists, toPosixPath } from "../lib/fs.js";
import { getPmgLocalStateIgnoreStatus } from "../lib/git.js";

interface DiffGitStatus {
  available: boolean;
  ignoreStatus: "ready" | "missing-rules" | "unavailable";
  infoExcludePath?: string;
  missingRules: string[];
}

interface DiffFileSummary {
  path: string;
  role: "local-state" | "shared-candidate";
}

export interface DiffReport {
  root: string;
  git: DiffGitStatus;
  localStateFiles: DiffFileSummary[];
  sharedCandidateFiles: DiffFileSummary[];
  summary: {
    localStateFileCount: number;
    sharedCandidateFileCount: number;
    missingIgnoreRuleCount: number;
  };
}

const LOCAL_STATE_ENTRIES = [".pmg", "PMG.md"];
const SHARED_CANDIDATE_ENTRIES = ["AGENTS.md"];

export async function diffCommand(rawArgs: string[], cwd: string): Promise<void> {
  const args = parseArgs(rawArgs);
  const root = path.resolve(cwd, getStringFlag(args, "path") ?? args.positional[0] ?? ".");

  if (!(await pathExists(path.join(root, ".pmg")))) {
    throw new Error("No .pmg directory found. Run pmg init first.");
  }

  const report = await createDiffReport(root);

  if (hasFlag(args, "json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(renderDiffReport(report));
}

export async function createDiffReport(root: string): Promise<DiffReport> {
  const [localStateFiles, sharedCandidateFiles, git] = await Promise.all([
    collectExistingFiles(root, LOCAL_STATE_ENTRIES, "local-state"),
    collectExistingFiles(root, SHARED_CANDIDATE_ENTRIES, "shared-candidate"),
    createDiffGitStatus(root)
  ]);

  return {
    root,
    git,
    localStateFiles,
    sharedCandidateFiles,
    summary: {
      localStateFileCount: localStateFiles.length,
      sharedCandidateFileCount: sharedCandidateFiles.length,
      missingIgnoreRuleCount: git.missingRules.length
    }
  };
}

async function createDiffGitStatus(root: string): Promise<DiffGitStatus> {
  const status = await getPmgLocalStateIgnoreStatus(root);

  if (!status.repository) {
    return {
      available: false,
      ignoreStatus: "unavailable",
      missingRules: []
    };
  }

  return {
    available: true,
    ignoreStatus: status.missingRules.length === 0 ? "ready" : "missing-rules",
    infoExcludePath: toPosixPath(path.relative(root, status.repository.infoExcludePath)),
    missingRules: status.missingRules
  };
}

async function collectExistingFiles(
  root: string,
  entries: string[],
  role: DiffFileSummary["role"]
): Promise<DiffFileSummary[]> {
  const files: DiffFileSummary[] = [];

  for (const entry of entries) {
    const entryPath = path.join(root, entry);
    if (!(await pathExists(entryPath))) {
      continue;
    }
    files.push(...(await collectFiles(root, entryPath)).map((filePath) => ({ path: filePath, role })));
  }

  return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function collectFiles(root: string, currentPath: string): Promise<string[]> {
  const currentStat = await stat(currentPath);

  if (currentStat.isFile()) {
    return [toPosixPath(path.relative(root, currentPath))];
  }
  if (!currentStat.isDirectory()) {
    return [];
  }

  const entries = await readdir(currentPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    files.push(...(await collectFiles(root, path.join(currentPath, entry.name))));
  }

  return files;
}

function renderDiffReport(report: DiffReport): string {
  const lines: string[] = [];

  lines.push(`PMG diff for ${report.root}`);
  lines.push(`Git Ignore: ${formatGitIgnoreStatus(report.git)}`);
  lines.push("");
  lines.push(`Local State Files (${report.summary.localStateFileCount})`);
  for (const file of report.localStateFiles) {
    lines.push(`- ${file.path}`);
  }
  lines.push("");
  lines.push(`Shared Candidate Files (${report.summary.sharedCandidateFileCount})`);
  for (const file of report.sharedCandidateFiles) {
    lines.push(`- ${file.path}`);
  }
  if (report.git.missingRules.length > 0) {
    lines.push("");
    lines.push("Missing Ignore Rules");
    for (const rule of report.git.missingRules) {
      lines.push(`- ${rule}`);
    }
  }

  return lines.join("\n");
}

function formatGitIgnoreStatus(git: DiffGitStatus): string {
  if (git.ignoreStatus === "unavailable") {
    return "unavailable (no host Git repository detected)";
  }
  if (git.ignoreStatus === "missing-rules") {
    return `missing rules in ${git.infoExcludePath}`;
  }

  return `ready (${git.infoExcludePath})`;
}
