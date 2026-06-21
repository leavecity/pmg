import path from "node:path";
import { parseArgs, getStringFlag, hasFlag } from "../lib/args.js";
import { pathExists, writeText } from "../lib/fs.js";
import { createLayoutMarker, PMG_LAYOUT_PATH, readLayoutMarker, TARGET_LAYOUT_VERSION } from "../lib/layout.js";

interface MigrationAction {
  path: string;
  description: string;
  applied: boolean;
}

interface MigrationReport {
  root: string;
  mode: "dry-run" | "apply";
  currentLayoutVersion: number | null;
  targetLayoutVersion: number;
  actions: MigrationAction[];
  writes: string[];
}

export async function migrateCommand(rawArgs: string[], cwd: string): Promise<void> {
  const args = parseArgs(rawArgs);
  const root = path.resolve(cwd, getStringFlag(args, "path") ?? args.positional[0] ?? ".");

  if (!(await pathExists(path.join(root, ".pmg")))) {
    throw new Error("No .pmg directory found. Run pmg init first.");
  }

  const report = await createMigrationReport(root, hasFlag(args, "apply"));

  if (hasFlag(args, "json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(renderMigrationReport(report));
}

async function createMigrationReport(root: string, apply: boolean): Promise<MigrationReport> {
  const marker = await readLayoutMarker(root);
  const currentLayoutVersion = marker?.layoutVersion ?? null;
  if (currentLayoutVersion !== null && currentLayoutVersion > TARGET_LAYOUT_VERSION) {
    throw new Error("PMG layout marker is newer than this tool supports.");
  }

  const needsLayoutMarker = currentLayoutVersion !== TARGET_LAYOUT_VERSION;
  const mode = apply ? "apply" : "dry-run";
  const actions: MigrationAction[] = [];
  const writes: string[] = [];

  if (needsLayoutMarker) {
    const action = {
      path: PMG_LAYOUT_PATH,
      description: "create layout version marker",
      applied: apply
    };
    actions.push(action);

    if (apply) {
      await writeText(path.join(root, PMG_LAYOUT_PATH), `${JSON.stringify(createLayoutMarker(), null, 2)}\n`);
      writes.push(PMG_LAYOUT_PATH);
    }
  }

  return {
    root,
    mode,
    currentLayoutVersion,
    targetLayoutVersion: TARGET_LAYOUT_VERSION,
    actions,
    writes
  };
}

function renderMigrationReport(report: MigrationReport): string {
  const lines: string[] = [];

  lines.push(`PMG migrate for ${report.root}`);
  lines.push(`Mode: ${report.mode}`);
  lines.push(`Current Layout: ${report.currentLayoutVersion ?? "missing"}`);
  lines.push(`Target Layout: ${report.targetLayoutVersion}`);
  lines.push("");
  lines.push(`Planned Actions (${report.actions.length})`);
  if (report.actions.length === 0) {
    lines.push("- none");
  } else {
    for (const action of report.actions) {
      lines.push(`- ${action.path}: ${action.description}`);
    }
  }
  lines.push("");
  if (report.writes.length === 0) {
    lines.push("No files were modified.");
  } else {
    lines.push("Writes");
    for (const writePath of report.writes) {
      lines.push(`- ${writePath}`);
    }
  }

  return lines.join("\n");
}
