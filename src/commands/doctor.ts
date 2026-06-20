import { createStatusReport } from "./status.js";
import { parseArgs, getStringFlag } from "../lib/args.js";
import path from "node:path";
import { listMarkdownFiles, pathExists, readText } from "../lib/fs.js";
import { getPmgLocalStateIgnoreStatus } from "../lib/git.js";
import { readMetadata } from "../lib/markdown.js";

export interface DoctorFinding {
  severity: "error" | "warning";
  path: string;
  message: string;
}

export async function doctorCommand(rawArgs: string[], cwd: string): Promise<void> {
  const args = parseArgs(rawArgs);
  const root = path.resolve(cwd, getStringFlag(args, "path") ?? args.positional[0] ?? ".");
  const report = await createStatusReport(root);
  const findings = await createDoctorFindings(root);

  console.log(`PMG doctor for ${root}`);

  if (report.ok && findings.every((finding) => finding.severity !== "error")) {
    console.log("No blocking issues found.");
  } else {
    console.log("Blocking issues found:");
    for (const check of report.checks.filter((item) => item.required && !item.ok)) {
      console.log(`- ${check.path}`);
    }
    for (const finding of findings.filter((item) => item.severity === "error")) {
      console.log(`- ${finding.path}: ${finding.message}`);
    }
  }

  const warnings = findings.filter((finding) => finding.severity === "warning");
  if (warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const warning of warnings) {
      console.log(`- ${warning.path}: ${warning.message}`);
    }
  }

  console.log("");
  console.log("Next checks planned for future releases:");
  console.log("- stale memory detection");
  console.log("- template drift detection");
}

export async function createDoctorFindings(root: string): Promise<DoctorFinding[]> {
  const findings: DoctorFinding[] = [];

  await checkJsonRegistry(root, ".pmg/registry/memory-index.json", "memory", findings);
  await checkJsonRegistry(root, ".pmg/registry/skills.json", "skills", findings);
  await checkMemoryStatus(root, findings);
  await checkMemoryProposalContracts(root, findings);
  await checkPmgLocalStateIgnored(root, findings);

  return findings;
}

async function checkPmgLocalStateIgnored(root: string, findings: DoctorFinding[]): Promise<void> {
  const status = await getPmgLocalStateIgnoreStatus(root);

  if (!status.repository || status.missingRules.length === 0) {
    return;
  }

  findings.push({
    severity: "warning",
    path: path.relative(root, status.repository.infoExcludePath).split(path.sep).join("/"),
    message: "PMG local state is not ignored by host Git repository"
  });
}

async function checkJsonRegistry(
  root: string,
  relativePath: string,
  key: "memory" | "skills",
  findings: DoctorFinding[]
): Promise<void> {
  const absolutePath = path.join(root, relativePath);

  if (!(await pathExists(absolutePath))) {
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readText(absolutePath));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    findings.push({ severity: "error", path: relativePath, message: `invalid JSON: ${message}` });
    return;
  }

  if (!isRecord(parsed)) {
    findings.push({ severity: "error", path: relativePath, message: "registry must be a JSON object" });
    return;
  }

  const entries = parsed[key];
  if (!Array.isArray(entries)) {
    findings.push({ severity: "error", path: relativePath, message: `missing ${key} array` });
    return;
  }

  for (const entry of entries) {
    if (!isRecord(entry) || typeof entry.path !== "string") {
      findings.push({ severity: "error", path: relativePath, message: "registry entry missing path" });
      continue;
    }

    if (!(await pathExists(path.join(root, entry.path)))) {
      findings.push({
        severity: "error",
        path: relativePath,
        message: `referenced file does not exist: ${entry.path}`
      });
    }
  }
}

async function checkMemoryStatus(root: string, findings: DoctorFinding[]): Promise<void> {
  const memoryRoot = path.join(root, ".pmg", "memory");
  const files = await listMarkdownFiles(memoryRoot);

  for (const filePath of files) {
    const relativePath = path.relative(root, filePath).split(path.sep).join("/");
    const metadata = readMetadata(await readText(filePath));

    if (!metadata.status) {
      findings.push({
        severity: "warning",
        path: relativePath,
        message: "memory file has no Status metadata"
      });
      continue;
    }

    const status = metadata.status.toLowerCase();

    if (status === "deprecated") {
      findings.push({
        severity: "warning",
        path: relativePath,
        message: "deprecated memory should be archived or replaced in current context"
      });
    }

    if (status === "conflicting") {
      findings.push({
        severity: "warning",
        path: relativePath,
        message: "conflicting memory must be resolved before agents rely on it"
      });
    }

    const supersededBy = metadata["superseded-by"];
    if (supersededBy && !(await pathExists(path.join(root, supersededBy)))) {
      findings.push({
        severity: "warning",
        path: relativePath,
        message: `superseded memory points to missing replacement: ${supersededBy}`
      });
    }
  }
}

async function checkMemoryProposalContracts(root: string, findings: DoctorFinding[]): Promise<void> {
  const proposalsRoot = path.join(root, ".pmg", "memory", "proposals");
  const files = await listMarkdownFiles(proposalsRoot);

  for (const filePath of files) {
    const relativePath = path.relative(root, filePath).split(path.sep).join("/");
    const content = await readText(filePath);
    const metadata = readMetadata(content);
    const type = metadata.type?.toLowerCase();

    if (!type) {
      continue;
    }

    if (type !== "memory-cleanup" && type !== "conflict-resolution") {
      findings.push({
        severity: "error",
        path: relativePath,
        message: `unknown proposal Type: ${metadata.type}`
      });
      continue;
    }

    if (type === "conflict-resolution") {
      await checkConflictResolutionProposal(root, relativePath, content, metadata, findings);
    }
  }
}

async function checkConflictResolutionProposal(
  root: string,
  relativePath: string,
  content: string,
  metadata: Record<string, string>,
  findings: DoctorFinding[]
): Promise<void> {
  await checkProjectRelativeMetadataPath(root, relativePath, metadata.source, "Source", findings);
  await checkProjectRelativeMetadataPath(root, relativePath, metadata.target, "Target", findings);

  if (!hasMarkdownSection(content, "Resolution Memory")) {
    findings.push({
      severity: "error",
      path: relativePath,
      message: "conflict-resolution proposal missing Resolution Memory section"
    });
  }
}

async function checkProjectRelativeMetadataPath(
  root: string,
  proposalPath: string,
  value: string | undefined,
  fieldName: "Source" | "Target",
  findings: DoctorFinding[]
): Promise<void> {
  if (!value) {
    findings.push({
      severity: "error",
      path: proposalPath,
      message: `conflict-resolution proposal missing ${fieldName} metadata`
    });
    return;
  }

  const absolutePath = path.resolve(root, value);
  const relativePath = path.relative(root, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    findings.push({
      severity: "error",
      path: proposalPath,
      message: `conflict-resolution proposal ${fieldName} resolves outside the project root: ${value}`
    });
    return;
  }

  if (!(await pathExists(absolutePath))) {
    findings.push({
      severity: "error",
      path: proposalPath,
      message: `conflict-resolution proposal ${fieldName} does not exist: ${value}`
    });
  }
}

function hasMarkdownSection(content: string, heading: string): boolean {
  const pattern = new RegExp(`^## ${escapeRegExp(heading)}\\s*$`, "im");
  return pattern.test(content);
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
