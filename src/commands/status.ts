import path from "node:path";
import { readdir } from "node:fs/promises";
import { parseArgs, getStringFlag, hasFlag } from "../lib/args.js";
import { pathExists } from "../lib/fs.js";

interface StatusCheck {
  name: string;
  path: string;
  ok: boolean;
  required: boolean;
}

interface StatusReport {
  root: string;
  ok: boolean;
  checks: StatusCheck[];
  counts: Record<string, number>;
}

const REQUIRED_PATHS = [
  ".pmg",
  ".pmg/constitution.md",
  ".pmg/memory/project.md",
  ".pmg/governance/context-assembly.md",
  ".pmg/registry/memory-index.json",
  ".pmg/registry/skills.json",
  "AGENTS.md",
  "PMG.md"
];

export async function statusCommand(rawArgs: string[], cwd: string): Promise<void> {
  const args = parseArgs(rawArgs);
  const root = path.resolve(cwd, getStringFlag(args, "path") ?? args.positional[0] ?? ".");
  const report = await createStatusReport(root);

  if (hasFlag(args, "json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`PMG status for ${root}`);
  console.log(report.ok ? "Status: ready" : "Status: incomplete");
  console.log("");

  for (const check of report.checks) {
    const mark = check.ok ? "ok" : check.required ? "missing" : "optional";
    console.log(`- ${mark}: ${check.path}`);
  }

  console.log("");
  console.log(`Specs: ${report.counts.specs}`);
  console.log(`ADRs: ${report.counts.adr}`);
  console.log(`Reviews: ${report.counts.reviews}`);
}

export async function createStatusReport(root: string): Promise<StatusReport> {
  const checks: StatusCheck[] = [];

  for (const relativePath of REQUIRED_PATHS) {
    checks.push({
      name: relativePath,
      path: relativePath,
      ok: await pathExists(path.join(root, relativePath)),
      required: true
    });
  }

  const counts = {
    specs: await countMarkdown(path.join(root, ".pmg", "specs")),
    adr: await countMarkdown(path.join(root, ".pmg", "adr")),
    reviews: await countMarkdown(path.join(root, ".pmg", "reviews"))
  };

  return {
    root,
    ok: checks.every((check) => check.ok || !check.required),
    checks,
    counts
  };
}

async function countMarkdown(directory: string): Promise<number> {
  if (!(await pathExists(directory))) {
    return 0;
  }

  const entries = await readdir(directory, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      count += await countMarkdown(entryPath);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      count += 1;
    }
  }

  return count;
}
