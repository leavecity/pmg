import path from "node:path";
import { createDoctorFindings, type DoctorFinding } from "./doctor.js";
import { getStringFlag, parseArgs } from "../lib/args.js";
import { listMarkdownFiles, moveFile, pathExists, readText, toPosixPath, writeText } from "../lib/fs.js";
import { getTitle, readMetadata, upsertMetadata } from "../lib/markdown.js";
import { slugify, today } from "../lib/slug.js";

const VALID_CONFIDENCE = new Set(["confirmed", "inferred", "experimental", "deprecated", "conflicting"]);

export async function memoryCommand(rawArgs: string[], cwd: string): Promise<void> {
  const [subcommand, ...rest] = rawArgs;

  switch (subcommand) {
    case "propose":
      await proposeMemory(rest, cwd);
      return;
    case "promote":
      await promoteMemory(rest, cwd);
      return;
    case "archive":
      await archiveMemory(rest, cwd);
      return;
    case "project":
      await projectMemory(rest, cwd);
      return;
    case "cleanup":
      await cleanupMemory(rest, cwd);
      return;
    default:
      throw new Error("Usage: pmg memory <propose|promote|archive|project|cleanup>");
  }
}

async function projectMemory(rawArgs: string[], cwd: string): Promise<void> {
  const [subcommand, ...rest] = rawArgs;

  switch (subcommand) {
    case "propose":
      await proposeProjectMemory(rest, cwd);
      return;
    case "apply":
      await applyProjectMemory(rest, cwd);
      return;
    default:
      throw new Error("Usage: pmg memory project <propose|apply>");
  }
}

async function cleanupMemory(rawArgs: string[], cwd: string): Promise<void> {
  const [subcommand, ...rest] = rawArgs;

  switch (subcommand) {
    case "propose":
      await proposeMemoryCleanup(rest, cwd);
      return;
    case "apply":
      await applyMemoryCleanup(rest, cwd);
      return;
    default:
      throw new Error("Usage: pmg memory cleanup <propose|apply>");
  }
}

async function proposeMemory(rawArgs: string[], cwd: string): Promise<void> {
  const args = parseArgs(rawArgs);
  const root = resolveRoot(args, cwd);
  await assertPmg(root);

  const title = requireFlag(args, "title");
  const domain = getStringFlag(args, "domain") ?? "general";
  const source = getStringFlag(args, "source") ?? "user or agent observation";
  const confidence = getStringFlag(args, "confidence") ?? "inferred";
  const observation = getStringFlag(args, "observation") ?? args.positional.join(" ");
  const knowledge = getStringFlag(args, "knowledge") ?? observation;
  const evidence = getStringFlag(args, "evidence") ?? "Pending.";

  if (!VALID_CONFIDENCE.has(confidence)) {
    throw new Error(`--confidence must be one of: ${[...VALID_CONFIDENCE].join(", ")}`);
  }

  if (!observation.trim()) {
    throw new Error("pmg memory propose requires --observation or positional text");
  }

  const date = today();
  const fileName = `${date}-${slugify(title)}.md`;
  const proposalPath = path.join(root, ".pmg", "memory", "proposals", fileName);
  let outputPath = proposalPath;
  let suffix = 2;

  while (await pathExists(outputPath)) {
    outputPath = path.join(root, ".pmg", "memory", "proposals", `${date}-${slugify(title)}-${suffix}.md`);
    suffix += 1;
  }

  await writeText(outputPath, renderProposal({
    title,
    domain,
    confidence,
    source,
    created: new Date().toISOString(),
    observation,
    knowledge,
    evidence
  }));

  console.log(`Created memory proposal: ${toPosixPath(path.relative(root, outputPath))}`);
}

async function promoteMemory(rawArgs: string[], cwd: string): Promise<void> {
  const args = parseArgs(rawArgs);
  const root = resolveRoot(args, cwd);
  await assertPmg(root);

  const selector = args.positional[0];
  if (!selector) {
    throw new Error("pmg memory promote requires a proposal path or id");
  }

  const proposalPath = await resolveMemoryFile(root, selector, "proposals");
  const target = getStringFlag(args, "target") ?? inferTargetFromProposal(proposalPath, await readText(proposalPath));
  const reason = getStringFlag(args, "reason") ?? "Promotion policy satisfied.";
  const reviewer = getStringFlag(args, "reviewer") ?? "unspecified";
  const targetPath = resolveMemoryTarget(root, target);
  const proposalContent = await readText(proposalPath);
  const title = getTitle(proposalContent).replace(/^Memory Proposal:\s*/i, "");

  if (!(await pathExists(targetPath))) {
    await writeText(targetPath, `# Project Memory: ${titleCase(path.basename(targetPath, ".md"))}\n\nStatus: confirmed\n`);
  }

  const targetContent = await readText(targetPath);
  await writeText(targetPath, appendPromotedMemory(targetContent, {
    title,
    proposalPath: toPosixPath(path.relative(root, proposalPath)),
    promoted: new Date().toISOString(),
    reason,
    reviewer,
    content: proposalContent
  }));

  const promotedContent = upsertMetadata(proposalContent, {
    status: "promoted",
    promoted: new Date().toISOString(),
    "promoted-to": toPosixPath(path.relative(root, targetPath)),
    reviewer
  });
  await writeText(proposalPath, promotedContent);

  const archivePath = await uniqueArchivePath(root, "promoted", path.basename(proposalPath));
  await moveFile(proposalPath, archivePath);

  console.log(`Promoted memory proposal to ${toPosixPath(path.relative(root, targetPath))}`);
  console.log(`Moved proposal audit record to ${toPosixPath(path.relative(root, archivePath))}`);
}

async function archiveMemory(rawArgs: string[], cwd: string): Promise<void> {
  const args = parseArgs(rawArgs);
  const root = resolveRoot(args, cwd);
  await assertPmg(root);

  const selector = args.positional[0];
  if (!selector) {
    throw new Error("pmg memory archive requires a memory path or proposal id");
  }

  const reason = getStringFlag(args, "reason") ?? "Archived by PMG.";
  const sourcePath = await resolveMemoryFile(root, selector);
  const archivePath = await archiveMemoryPath(root, sourcePath, reason);

  console.log(`Archived memory file to ${toPosixPath(path.relative(root, archivePath))}`);
}

async function proposeProjectMemory(rawArgs: string[], cwd: string): Promise<void> {
  const args = parseArgs(rawArgs);
  const root = resolveRoot(args, cwd);
  await assertPmg(root);

  const title = requireFlag(args, "title");
  const summary = requireFlag(args, "summary");
  const content = requireFlag(args, "content");
  const source = getStringFlag(args, "source") ?? "user or agent proposed project memory refresh";
  const evidence = getStringFlag(args, "evidence") ?? "Pending.";
  const date = today();
  const fileName = `${date}-${slugify(title)}.md`;
  let outputPath = path.join(root, ".pmg", "memory", "proposals", fileName);
  let suffix = 2;

  while (await pathExists(outputPath)) {
    outputPath = path.join(root, ".pmg", "memory", "proposals", `${date}-${slugify(title)}-${suffix}.md`);
    suffix += 1;
  }

  await writeText(outputPath, renderProjectMemoryProposal({
    title,
    summary,
    source,
    created: new Date().toISOString(),
    content,
    evidence
  }));

  console.log(`Created project memory update proposal: ${toPosixPath(path.relative(root, outputPath))}`);
}

async function applyProjectMemory(rawArgs: string[], cwd: string): Promise<void> {
  const args = parseArgs(rawArgs);
  const root = resolveRoot(args, cwd);
  await assertPmg(root);

  const selector = args.positional[0];
  if (!selector) {
    throw new Error("pmg memory project apply requires a proposal path or id");
  }

  const proposalPath = await resolveMemoryFile(root, selector, "proposals");
  const projectPath = path.join(root, ".pmg", "memory", "project.md");
  const reviewer = getStringFlag(args, "reviewer") ?? "unspecified";
  const reason = getStringFlag(args, "reason") ?? "Project memory update approved.";
  const proposalContent = await readText(proposalPath);
  const proposedProjectMemory = extractSectionUntil(proposalContent, "Proposed Project Memory", "Evidence");
  const applied = new Date().toISOString();

  if (!(await pathExists(projectPath))) {
    throw new Error("Missing .pmg/memory/project.md. Run pmg init first.");
  }

  const snapshotPath = await uniqueArchivePath(root, "project-snapshots", `${today()}-project.md`);
  await writeText(snapshotPath, `${await readText(projectPath)}`);
  await writeText(projectPath, `${proposedProjectMemory.trimEnd()}\n`);

  const appliedContent = upsertMetadata(proposalContent, {
    status: "applied",
    applied,
    "applied-to": ".pmg/memory/project.md",
    reviewer,
    reason
  });
  await writeText(proposalPath, appliedContent);

  const auditPath = await uniqueArchivePath(root, "project-updates", path.basename(proposalPath));
  await moveFile(proposalPath, auditPath);

  console.log("Applied project memory update to .pmg/memory/project.md");
  console.log(`Saved previous project memory snapshot to ${toPosixPath(path.relative(root, snapshotPath))}`);
  console.log(`Moved project memory update audit record to ${toPosixPath(path.relative(root, auditPath))}`);
}

async function proposeMemoryCleanup(rawArgs: string[], cwd: string): Promise<void> {
  const args = parseArgs(rawArgs);
  const root = resolveRoot(args, cwd);
  await assertPmg(root);

  const findings = (await createDoctorFindings(root)).filter(isMemoryCleanupFinding);

  if (findings.length === 0) {
    console.log("No memory cleanup findings found.");
    return;
  }

  const title = getStringFlag(args, "title") ?? "Memory Cleanup";
  const date = today();
  let outputPath = path.join(root, ".pmg", "memory", "proposals", `${date}-${slugify(title)}.md`);
  let suffix = 2;

  while (await pathExists(outputPath)) {
    outputPath = path.join(root, ".pmg", "memory", "proposals", `${date}-${slugify(title)}-${suffix}.md`);
    suffix += 1;
  }

  await writeText(outputPath, renderMemoryCleanupProposal({
    title,
    created: new Date().toISOString(),
    findings
  }));

  console.log(`Created memory cleanup proposal: ${toPosixPath(path.relative(root, outputPath))}`);
}

async function applyMemoryCleanup(rawArgs: string[], cwd: string): Promise<void> {
  const args = parseArgs(rawArgs);
  const root = resolveRoot(args, cwd);
  await assertPmg(root);

  const selector = args.positional[0];
  if (!selector) {
    throw new Error("pmg memory cleanup apply requires a proposal path or id");
  }

  const proposalPath = await resolveMemoryFile(root, selector, "proposals");
  const reviewer = getStringFlag(args, "reviewer") ?? "unspecified";
  const reason = getStringFlag(args, "reason") ?? "Memory cleanup approved.";
  const proposalContent = await readText(proposalPath);
  const metadata = readMetadata(proposalContent);

  if (metadata.type !== "memory-cleanup") {
    throw new Error("pmg memory cleanup apply requires a memory-cleanup proposal");
  }

  const findings = parseCleanupFindings(proposalContent);
  const deprecatedPaths = unique(findings
    .filter((finding) => finding.message === "deprecated memory should be archived or replaced in current context")
    .map((finding) => finding.path));
  const manualPaths = unique(findings
    .filter((finding) => !deprecatedPaths.includes(finding.path))
    .map((finding) => finding.path));
  const archivedPaths: string[] = [];

  for (const deprecatedPath of deprecatedPaths) {
    const absolutePath = path.join(root, deprecatedPath);
    if (!(await pathExists(absolutePath))) {
      manualPaths.push(deprecatedPath);
      continue;
    }

    await archiveMemoryPath(root, absolutePath, reason);
    archivedPaths.push(deprecatedPath);
  }

  const appliedContent = upsertMetadata(proposalContent, {
    status: "applied",
    applied: new Date().toISOString(),
    reviewer,
    reason
  });
  await writeText(proposalPath, appliedContent);

  const auditPath = await uniqueArchivePath(root, "cleanup-applied", path.basename(proposalPath));
  await moveFile(proposalPath, auditPath);

  console.log("Applied memory cleanup proposal.");
  if (archivedPaths.length === 0) {
    console.log("No automatically applicable cleanup actions found.");
  }
  for (const archivedPath of archivedPaths) {
    console.log(`Archived deprecated memory: ${archivedPath}`);
  }
  for (const manualPath of unique(manualPaths)) {
    console.log(`Manual cleanup still required: ${manualPath}`);
  }
  console.log(`Moved cleanup audit record to ${toPosixPath(path.relative(root, auditPath))}`);
}

function resolveRoot(args: ReturnType<typeof parseArgs>, cwd: string): string {
  return path.resolve(cwd, getStringFlag(args, "path") ?? ".");
}

async function assertPmg(root: string): Promise<void> {
  if (!(await pathExists(path.join(root, ".pmg")))) {
    throw new Error("No .pmg directory found. Run pmg init first.");
  }
}

function requireFlag(args: ReturnType<typeof parseArgs>, name: string): string {
  const value = getStringFlag(args, name);
  if (!value?.trim()) {
    throw new Error(`--${name} is required`);
  }
  return value;
}

function renderProposal(input: {
  title: string;
  domain: string;
  confidence: string;
  source: string;
  created: string;
  observation: string;
  knowledge: string;
  evidence: string;
}): string {
  return `# Memory Proposal: ${input.title}

Status: pending
Confidence: ${input.confidence}
Domain: ${input.domain}
Source: ${input.source}
Created: ${input.created}

## Observation

${input.observation}

## Durable Knowledge Candidate

${input.knowledge}

## Evidence

${input.evidence}

## Promotion Recommendation

Pending review.
`;
}

function renderProjectMemoryProposal(input: {
  title: string;
  summary: string;
  source: string;
  created: string;
  content: string;
  evidence: string;
}): string {
  return `# Project Memory Update Proposal: ${input.title}

Status: pending
Target: .pmg/memory/project.md
Source: ${input.source}
Created: ${input.created}

## Summary

${input.summary}

## Proposed Project Memory

${input.content.trim()}

## Evidence

${input.evidence}

## Apply Recommendation

Pending review.
`;
}

function renderMemoryCleanupProposal(input: {
  title: string;
  created: string;
  findings: DoctorFinding[];
}): string {
  const findings = input.findings
    .map((finding) => `- ${finding.path}: ${finding.message}`)
    .join("\n");

  return `# Memory Cleanup Proposal: ${input.title}

Status: pending
Type: memory-cleanup
Created: ${input.created}

## Findings

${findings}

## Recommended Actions

Review each finding and decide whether to archive, replace, resolve, or keep the referenced memory.

## Apply Recommendation

Pending review.
`;
}

function isMemoryCleanupFinding(finding: DoctorFinding): boolean {
  return finding.severity === "warning" && finding.path.startsWith(".pmg/memory/");
}

async function archiveMemoryPath(root: string, sourcePath: string, reason: string): Promise<string> {
  const content = await readText(sourcePath);
  const archivedContent = `${upsertMetadata(content, {
    status: "archived",
    archived: new Date().toISOString(),
    "archive-reason": reason
  }).trim()}\n`;
  await writeText(sourcePath, archivedContent);

  const archivePath = await uniqueArchivePath(root, "archived", path.basename(sourcePath));
  await moveFile(sourcePath, archivePath);
  return archivePath;
}

function parseCleanupFindings(content: string): Array<{ path: string; message: string }> {
  const findings = extractSection(content, "Findings");

  if (findings === "Pending.") {
    return [];
  }

  return findings
    .split(/\r?\n/)
    .map((line) => line.match(/^-\s+(.+?):\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({
      path: match[1],
      message: match[2]
    }));
}

function unique(input: string[]): string[] {
  return [...new Set(input)];
}

function inferTargetFromProposal(proposalPath: string, content: string): string {
  const metadata = readMetadata(content);
  return metadata.domain ?? path.basename(proposalPath, ".md");
}

function resolveMemoryTarget(root: string, target: string): string {
  if (target.endsWith(".md") || target.includes("/") || target.includes(path.sep)) {
    return path.resolve(root, target);
  }

  return path.join(root, ".pmg", "memory", `${slugify(target)}.md`);
}

async function resolveMemoryFile(root: string, selector: string, preferredDirectory?: string): Promise<string> {
  const directPath = path.resolve(root, selector);
  if (await pathExists(directPath)) {
    return directPath;
  }

  const pmgRelativePath = path.join(root, ".pmg", "memory", selector);
  if (await pathExists(pmgRelativePath)) {
    return pmgRelativePath;
  }

  const searchRoot = preferredDirectory
    ? path.join(root, ".pmg", "memory", preferredDirectory)
    : path.join(root, ".pmg", "memory");
  const files = await listMarkdownFiles(searchRoot);
  const matches = files.filter((file) => {
    const base = path.basename(file, ".md");
    return base === selector || base.includes(selector) || file.endsWith(selector);
  });

  if (matches.length === 0) {
    throw new Error(`Could not find memory file matching: ${selector}`);
  }

  if (matches.length > 1) {
    throw new Error(`Memory selector is ambiguous: ${selector}`);
  }

  return matches[0];
}

function appendPromotedMemory(targetContent: string, input: {
  title: string;
  proposalPath: string;
  promoted: string;
  reason: string;
  reviewer: string;
  content: string;
}): string {
  const candidate = extractSection(input.content, "Durable Knowledge Candidate");
  const evidence = extractSection(input.content, "Evidence");
  const trimmedTarget = targetContent.trimEnd();

  return `${trimmedTarget}

## Promoted: ${input.title}

Status: confirmed
Source: ${input.proposalPath}
Promoted: ${input.promoted}
Reviewer: ${input.reviewer}
Reason: ${input.reason}

${candidate}

### Evidence

${evidence}
`;
}

function extractSection(content: string, heading: string): string {
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

function extractSectionUntil(content: string, heading: string, nextHeading: string): string {
  const startPattern = new RegExp(`^## ${escapeRegExp(heading)}\\s*$`, "im");
  const startMatch = content.match(startPattern);

  if (!startMatch || startMatch.index === undefined) {
    return "Pending.";
  }

  const start = startMatch.index + startMatch[0].length;
  const rest = content.slice(start);
  const endPattern = new RegExp(`^## ${escapeRegExp(nextHeading)}\\s*$`, "im");
  const endMatch = rest.match(endPattern);
  const section = endMatch?.index === undefined ? rest : rest.slice(0, endMatch.index);

  return section.trim() || "Pending.";
}

async function uniqueArchivePath(root: string, kind: string, fileName: string): Promise<string> {
  const archiveDirectory = path.join(root, ".pmg", "memory", "archive", kind);
  let archivePath = path.join(archiveDirectory, fileName);
  let suffix = 2;

  while (await pathExists(archivePath)) {
    archivePath = path.join(archiveDirectory, `${path.basename(fileName, ".md")}-${suffix}.md`);
    suffix += 1;
  }

  return archivePath;
}

function titleCase(input: string): string {
  return input
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
