import { createStatusReport } from "./status.js";
import { parseArgs, getStringFlag, hasFlag } from "../lib/args.js";
import path from "node:path";
import { listMarkdownFiles, pathExists, readText } from "../lib/fs.js";
import { getPmgLocalStateIgnoreStatus } from "../lib/git.js";
import { getTitle, readMetadata } from "../lib/markdown.js";
import { readPmgPolicy } from "../lib/policy.js";

export interface DoctorFinding {
  severity: "error" | "warning";
  path: string;
  message: string;
}

const VALID_ACTIVE_MEMORY_STATUSES = [
  "archived",
  "confirmed",
  "conflicting",
  "deprecated",
  "experimental",
  "inferred",
  "pending"
];

export async function doctorCommand(rawArgs: string[], cwd: string): Promise<void> {
  const args = parseArgs(rawArgs);
  const root = path.resolve(cwd, getStringFlag(args, "path") ?? args.positional[0] ?? ".");
  const report = await createStatusReport(root);
  const findings = await createDoctorFindings(root);
  const fixDryRun = hasFlag(args, "fix-dry-run");

  if (hasFlag(args, "json")) {
    const jsonReport = createDoctorJsonReport(root, report, findings);
    if (fixDryRun) {
      console.log(JSON.stringify({
        ...jsonReport,
        fixPlan: await createDoctorFixPlan(root, findings)
      }, null, 2));
      return;
    }

    console.log(JSON.stringify(jsonReport, null, 2));
    return;
  }

  if (fixDryRun) {
    console.log(renderDoctorFixDryRun(root, await createDoctorFixPlan(root, findings)));
    return;
  }

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

type StatusReport = Awaited<ReturnType<typeof createStatusReport>>;

interface DoctorJsonReport {
  root: string;
  ok: boolean;
  errors: DoctorFinding[];
  warnings: DoctorFinding[];
  summary: {
    errorCount: number;
    warningCount: number;
  };
}

interface DoctorFixAction {
  path: string;
  description: string;
  reason: string;
}

interface DoctorFixPlan {
  mode: "dry-run";
  policy: {
    path: string;
    source: "file" | "default";
    mode: string;
  };
  actions: DoctorFixAction[];
  writes: [];
  summary: {
    actionCount: number;
    writeCount: number;
  };
}

function createDoctorJsonReport(root: string, report: StatusReport, findings: DoctorFinding[]): DoctorJsonReport {
  const missingRequiredFiles = report.checks
    .filter((check) => check.required && !check.ok)
    .map((check): DoctorFinding => ({
      severity: "error",
      path: check.path,
      message: "required PMG file is missing"
    }));
  const errors = [...missingRequiredFiles, ...findings.filter((finding) => finding.severity === "error")];
  const warnings = findings.filter((finding) => finding.severity === "warning");

  return {
    root,
    ok: report.ok && errors.length === 0,
    errors,
    warnings,
    summary: {
      errorCount: errors.length,
      warningCount: warnings.length
    }
  };
}

async function createDoctorFixPlan(root: string, findings: DoctorFinding[]): Promise<DoctorFixPlan> {
  const policy = await readPmgPolicy(root);
  const actions = findings.flatMap(toFixActions);

  return {
    mode: "dry-run",
    policy: {
      path: policy.path,
      source: policy.source,
      mode: policy.policy.mode
    },
    actions,
    writes: [],
    summary: {
      actionCount: actions.length,
      writeCount: 0
    }
  };
}

function toFixActions(finding: DoctorFinding): DoctorFixAction[] {
  if (finding.path === ".git/info/exclude" && finding.message === "PMG local state is not ignored by host Git repository") {
    return [{
      path: finding.path,
      description: "Add missing PMG local-state ignore rules",
      reason: finding.message
    }];
  }

  if (finding.message === "deprecated memory should be archived or replaced in current context") {
    return [{
      path: finding.path,
      description: "Create a reviewed memory cleanup proposal",
      reason: finding.message
    }];
  }

  if (finding.message === "conflicting memory must be resolved before agents rely on it") {
    return [{
      path: finding.path,
      description: "Create a reviewed conflict-resolution proposal",
      reason: finding.message
    }];
  }

  return [];
}

function renderDoctorFixDryRun(root: string, plan: DoctorFixPlan): string {
  const lines: string[] = [];

  lines.push(`PMG doctor fix dry run for ${root}`);
  lines.push(`Policy: ${plan.policy.mode}`);
  lines.push("");
  lines.push(`Planned Actions (${plan.summary.actionCount})`);
  if (plan.actions.length === 0) {
    lines.push("- none");
  } else {
    for (const action of plan.actions) {
      lines.push(`- ${action.path}: ${action.description}`);
    }
  }
  lines.push("");
  lines.push("No files were modified.");

  return lines.join("\n");
}

export async function createDoctorFindings(root: string): Promise<DoctorFinding[]> {
  const findings: DoctorFinding[] = [];

  await checkJsonRegistry(root, ".pmg/registry/memory-index.json", "memory", findings);
  await checkJsonRegistry(root, ".pmg/registry/skills.json", "skills", findings);
  await checkMemoryStatus(root, findings);
  await checkMemoryProposalContracts(root, findings);
  await checkMemoryAuditRecordLocations(root, findings);
  await checkReviewContracts(root, findings);
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

    if (key === "memory" && entry.path.replace(/\\/g, "/").startsWith(".pmg/memory/archive/")) {
      findings.push({
        severity: "error",
        path: relativePath,
        message: `registry must not reference archived memory: ${entry.path}`
      });
    }
  }
}

async function checkMemoryStatus(root: string, findings: DoctorFinding[]): Promise<void> {
  const memoryRoot = path.join(root, ".pmg", "memory");
  const files = await listMarkdownFiles(memoryRoot);

  for (const filePath of files) {
    const relativePath = path.relative(root, filePath).split(path.sep).join("/");
    if (isMemoryProposalOrArchiveRecord(relativePath)) {
      continue;
    }

    const content = await readText(filePath);
    const metadata = readTopLevelMetadata(content);

    if (!metadata.status) {
      findings.push({
        severity: "warning",
        path: relativePath,
        message: "memory file has no Status metadata"
      });
      continue;
    }

    const status = metadata.status.toLowerCase();

    if (!VALID_ACTIVE_MEMORY_STATUSES.includes(status)) {
      findings.push({
        severity: "error",
        path: relativePath,
        message: `memory Status must be one of: ${VALID_ACTIVE_MEMORY_STATUSES.join(", ")}`
      });
    }

    if (status === "pending" && hasConfirmedGuidance(content)) {
      findings.push({
        severity: "error",
        path: relativePath,
        message: "active memory has pending status but contains confirmed guidance"
      });
    }

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

function isMemoryProposalOrArchiveRecord(relativePath: string): boolean {
  return relativePath.startsWith(".pmg/memory/proposals/") || relativePath.startsWith(".pmg/memory/archive/");
}

function hasConfirmedGuidance(content: string): boolean {
  return /^##\s+(?:Promoted|Conflict Resolution):.+$/im.test(content) && /^Status:\s*confirmed\s*$/im.test(content);
}

async function checkReviewContracts(root: string, findings: DoctorFinding[]): Promise<void> {
  const reviewsRoot = path.join(root, ".pmg", "reviews");
  const files = await listMarkdownFiles(reviewsRoot);

  for (const filePath of files) {
    const relativePath = path.relative(root, filePath).split(path.sep).join("/");
    const content = await readText(filePath);
    const metadata = readTopLevelMetadata(content);

    for (const field of ["Type", "Status", "Date"]) {
      if (!metadata[field.toLowerCase()]) {
        findings.push({
          severity: "error",
          path: relativePath,
          message: `review missing ${field} metadata`
        });
      }
    }

    for (const section of ["Scope", "Findings", "Risks", "Recommended Memory Updates", "Related Files"]) {
      if (!hasMarkdownSection(content, section)) {
        findings.push({
          severity: "error",
          path: relativePath,
          message: `review missing ${section} section`
        });
      }
    }
  }
}

async function checkMemoryProposalContracts(root: string, findings: DoctorFinding[]): Promise<void> {
  const proposalsRoot = path.join(root, ".pmg", "memory", "proposals");
  const files = await listMarkdownFiles(proposalsRoot);

  for (const filePath of files) {
    const relativePath = path.relative(root, filePath).split(path.sep).join("/");
    const content = await readText(filePath);
    const metadata = readTopLevelMetadata(content);
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

    if (type === "memory-cleanup") {
      await checkMemoryCleanupProposal(root, relativePath, content, findings);
    }
  }
}

async function checkMemoryAuditRecordLocations(root: string, findings: DoctorFinding[]): Promise<void> {
  await checkAppliedOrPromotedProposals(root, findings);
  await checkArchiveAuditDirectories(root, findings);
}

async function checkAppliedOrPromotedProposals(root: string, findings: DoctorFinding[]): Promise<void> {
  const proposalsRoot = path.join(root, ".pmg", "memory", "proposals");
  const files = await listMarkdownFiles(proposalsRoot);

  for (const filePath of files) {
    const relativePath = path.relative(root, filePath).split(path.sep).join("/");
    const metadata = readTopLevelMetadata(await readText(filePath));
    const status = metadata.status?.toLowerCase();

    if (status === "applied" || status === "promoted") {
      findings.push({
        severity: "error",
        path: relativePath,
        message: `${status} proposal audit record must not remain in .pmg/memory/proposals`
      });
    }
  }
}

async function checkArchiveAuditDirectories(root: string, findings: DoctorFinding[]): Promise<void> {
  const archiveRoot = path.join(root, ".pmg", "memory", "archive");
  const files = await listMarkdownFiles(archiveRoot);

  for (const filePath of files) {
    const relativePath = path.relative(root, filePath).split(path.sep).join("/");
    const content = await readText(filePath);
    const expected = getExpectedAuditArchiveDirectory(content);

    if (!expected) {
      continue;
    }

    if (!relativePath.startsWith(`${expected.directory}/`)) {
      findings.push({
        severity: "error",
        path: relativePath,
        message: `${expected.label} must be stored under ${expected.directory}/`
      });
    }
  }
}

function getExpectedAuditArchiveDirectory(content: string): { directory: string; label: string } | undefined {
  const metadata = readTopLevelMetadata(content);
  const status = metadata.status?.toLowerCase();
  const type = metadata.type?.toLowerCase();
  const title = getTitle(content);

  if (status === "promoted") {
    return {
      directory: ".pmg/memory/archive/promoted",
      label: "promoted audit record"
    };
  }

  if (status !== "applied") {
    return undefined;
  }

  if (type === "memory-cleanup") {
    return {
      directory: ".pmg/memory/archive/cleanup-applied",
      label: "applied memory-cleanup audit record"
    };
  }

  if (type === "conflict-resolution") {
    return {
      directory: ".pmg/memory/archive/conflict-resolutions",
      label: "applied conflict-resolution audit record"
    };
  }

  if (/^Project Memory Update Proposal:/i.test(title)) {
    return {
      directory: ".pmg/memory/archive/project-updates",
      label: "applied project memory update audit record"
    };
  }

  return undefined;
}

function readTopLevelMetadata(content: string): Record<string, string> {
  const topLevelContent = content.split(/^##\s+/m)[0] ?? content;
  return readMetadata(topLevelContent);
}

async function checkMemoryCleanupProposal(
  root: string,
  relativePath: string,
  content: string,
  findings: DoctorFinding[]
): Promise<void> {
  if (!hasMarkdownSection(content, "Findings")) {
    findings.push({
      severity: "error",
      path: relativePath,
      message: "memory-cleanup proposal missing Findings section"
    });
    return;
  }

  const cleanupFindings = parseCleanupFindings(content, relativePath, findings);
  if (cleanupFindings.length === 0) {
    findings.push({
      severity: "error",
      path: relativePath,
      message: "memory-cleanup proposal has no findings"
    });
    return;
  }

  for (const cleanupFinding of cleanupFindings) {
    const absolutePath = path.resolve(root, cleanupFinding.path);
    const projectRelativePath = path.relative(root, absolutePath);

    if (projectRelativePath.startsWith("..") || path.isAbsolute(projectRelativePath)) {
      findings.push({
        severity: "error",
        path: relativePath,
        message: `memory-cleanup finding path resolves outside the project root: ${cleanupFinding.path}`
      });
      continue;
    }

    if (!(await pathExists(absolutePath))) {
      findings.push({
        severity: "warning",
        path: relativePath,
        message: `memory-cleanup finding path does not exist: ${cleanupFinding.path}`
      });
    }
  }
}

function parseCleanupFindings(
  content: string,
  proposalPath: string,
  findings: DoctorFinding[]
): Array<{ path: string; message: string }> {
  const section = extractMarkdownSection(content, "Findings");

  if (section === "Pending.") {
    return [];
  }

  const parsed: Array<{ path: string; message: string }> = [];
  for (const line of section.split(/\r?\n/g)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const match = trimmed.match(/^-\s+(.+?):\s+(.+)$/);
    if (!match) {
      findings.push({
        severity: "error",
        path: proposalPath,
        message: `memory-cleanup finding line must use "- <path>: <message>": ${trimmed}`
      });
      continue;
    }

    parsed.push({
      path: match[1],
      message: match[2]
    });
  }

  return parsed;
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

function extractMarkdownSection(content: string, heading: string): string {
  const pattern = new RegExp(`^## ${escapeRegExp(heading)}\\s*$`, "im");
  const match = content.match(pattern);

  if (!match || match.index === undefined) {
    return "Pending.";
  }

  const start = match.index + match[0].length;
  const rest = content.slice(start);
  const nextHeading = rest.search(/^##\s+/m);
  const section = nextHeading >= 0 ? rest.slice(0, nextHeading) : rest;
  return section.trim() || "Pending.";
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
