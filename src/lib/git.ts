import { execFile } from "node:child_process";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { promisify } from "node:util";
import { pathExists, readText, toPosixPath, writeText } from "./fs.js";

export interface GitRepository {
  worktreeRoot: string;
  gitDir: string;
  infoExcludePath: string;
}

export interface IgnoreRuleStatus {
  repository?: GitRepository;
  missingRules: string[];
}

export interface TrackedLocalStateStatus {
  repository?: GitRepository;
  trackedPaths: string[];
}

export interface EnsureIgnoreResult extends IgnoreRuleStatus {
  changed: boolean;
}

const IGNORE_HEADER = "# Project Memory Governance local state";
const execFileAsync = promisify(execFile);

export async function ensurePmgLocalStateIgnored(target: string): Promise<EnsureIgnoreResult> {
  const status = await getPmgLocalStateIgnoreStatus(target);

  if (!status.repository || status.missingRules.length === 0) {
    return { ...status, changed: false };
  }

  const existing = await readOptionalText(status.repository.infoExcludePath);
  const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  const header = existing.includes(IGNORE_HEADER) ? "" : `${IGNORE_HEADER}\n`;
  const addition = `${prefix}${header}${status.missingRules.join("\n")}\n`;

  await writeText(status.repository.infoExcludePath, `${existing}${addition}`);

  return {
    repository: status.repository,
    changed: true,
    missingRules: []
  };
}

export async function getPmgLocalStateIgnoreStatus(target: string): Promise<IgnoreRuleStatus> {
  const repository = await findGitRepository(target);

  if (!repository) {
    return { missingRules: [] };
  }

  const exclude = await readOptionalText(repository.infoExcludePath);
  const rules = pmgIgnoreRules(repository.worktreeRoot, target);
  const missingRules = rules.filter((rule) => !hasIgnoreRule(exclude, rule));

  return {
    repository,
    missingRules
  };
}

export async function getTrackedPmgLocalStateStatus(target: string): Promise<TrackedLocalStateStatus> {
  const repository = await findGitRepository(target);

  if (!repository) {
    return { trackedPaths: [] };
  }

  const rules = pmgIgnoreRules(repository.worktreeRoot, target);
  const queryPaths = rules.map((rule) => rule.endsWith("/") ? rule.slice(0, -1) : rule);

  let stdout = "";
  try {
    const result = await execFileAsync("git", ["ls-files", "--", ...queryPaths], {
      cwd: repository.worktreeRoot
    });
    stdout = result.stdout;
  } catch {
    return {
      repository,
      trackedPaths: []
    };
  }

  const trackedFiles = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const trackedPaths = summarizeTrackedLocalStatePaths(rules, trackedFiles);

  return {
    repository,
    trackedPaths
  };
}

export function pmgIgnoreRules(worktreeRoot: string, target: string): string[] {
  const relativeTarget = toPosixPath(path.relative(worktreeRoot, target));
  const prefix = relativeTarget ? `${relativeTarget}/` : "";

  return [`${prefix}.pmg/`, `${prefix}PMG.md`];
}

function summarizeTrackedLocalStatePaths(rules: string[], trackedFiles: string[]): string[] {
  const tracked = new Set<string>();
  const pmgDirectoryRule = rules.find((rule) => rule.endsWith(".pmg/"));
  const pmgFileRule = rules.find((rule) => rule.endsWith("PMG.md"));

  for (const filePath of trackedFiles) {
    if (pmgDirectoryRule) {
      const pmgDirectoryPath = pmgDirectoryRule.slice(0, -1);
      if (filePath === pmgDirectoryPath || filePath.startsWith(pmgDirectoryRule)) {
        tracked.add(pmgDirectoryRule);
      }
    }

    if (pmgFileRule && filePath === pmgFileRule) {
      tracked.add(pmgFileRule);
    }
  }

  return [...tracked].sort();
}

async function findGitRepository(start: string): Promise<GitRepository | undefined> {
  let current = path.resolve(start);

  while (true) {
    const gitPath = path.join(current, ".git");
    const gitDir = await resolveGitDir(gitPath, current);

    if (gitDir) {
      return {
        worktreeRoot: current,
        gitDir,
        infoExcludePath: path.join(gitDir, "info", "exclude")
      };
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

async function resolveGitDir(gitPath: string, worktreeRoot: string): Promise<string | undefined> {
  try {
    const entry = await stat(gitPath);
    if (entry.isDirectory()) {
      return gitPath;
    }
    if (!entry.isFile()) {
      return undefined;
    }
  } catch {
    return undefined;
  }

  const content = await readFile(gitPath, "utf8");
  const match = content.match(/^gitdir:\s*(.+)\s*$/m);
  if (!match) {
    return undefined;
  }

  return path.resolve(worktreeRoot, match[1]);
}

async function readOptionalText(filePath: string): Promise<string> {
  if (!(await pathExists(filePath))) {
    return "";
  }

  return readText(filePath);
}

function hasIgnoreRule(content: string, rule: string): boolean {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .includes(rule);
}
