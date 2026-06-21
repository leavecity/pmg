import path from "node:path";
import { parseArgs, getStringFlag, hasFlag } from "../lib/args.js";
import { pathExists } from "../lib/fs.js";
import { createDiffReport, type DiffReport } from "./diff.js";

interface PublishPlan {
  mode: "plan";
  readOnly: true;
  root: string;
  diff: DiffReport;
  sharedCandidateFiles: DiffReport["sharedCandidateFiles"];
  risks: string[];
  writes: [];
}

const PLAN_RISKS = [
  "Shared candidates require explicit review before entering the host repository.",
  "PMG local-state files should remain local unless a later publish command promotes selected assets.",
  "This command is read-only and does not commit, push, or modify files."
];

export async function publishCommand(rawArgs: string[], cwd: string): Promise<void> {
  const args = parseArgs(rawArgs);
  const subcommand = args.positional[0];

  if (subcommand !== "plan") {
    throw new Error("Usage: pmg publish plan [path] [--json]");
  }

  const root = path.resolve(cwd, getStringFlag(args, "path") ?? args.positional[1] ?? ".");

  if (!(await pathExists(path.join(root, ".pmg")))) {
    throw new Error("No .pmg directory found. Run pmg init first.");
  }

  const plan = createPublishPlan(await createDiffReport(root));

  if (hasFlag(args, "json")) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  console.log(renderPublishPlan(plan));
}

function createPublishPlan(diff: DiffReport): PublishPlan {
  return {
    mode: "plan",
    readOnly: true,
    root: diff.root,
    diff,
    sharedCandidateFiles: diff.sharedCandidateFiles,
    risks: PLAN_RISKS,
    writes: []
  };
}

function renderPublishPlan(plan: PublishPlan): string {
  const lines: string[] = [];

  lines.push(`PMG publish plan for ${plan.root}`);
  lines.push("Mode: read-only plan");
  lines.push("");
  lines.push(`Shared Candidate Files (${plan.sharedCandidateFiles.length})`);
  for (const file of plan.sharedCandidateFiles) {
    lines.push(`- ${file.path}`);
  }
  lines.push("");
  lines.push("Risks");
  for (const risk of plan.risks) {
    lines.push(`- ${risk}`);
  }
  lines.push("");
  lines.push("No files were modified.");

  return lines.join("\n");
}
