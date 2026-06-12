import path from "node:path";
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
    default:
      throw new Error("Usage: pmg memory <propose|promote|archive>");
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
  const content = await readText(sourcePath);
  const archivedContent = `${upsertMetadata(content, {
    status: "archived",
    archived: new Date().toISOString(),
    "archive-reason": reason
  }).trim()}\n`;
  await writeText(sourcePath, archivedContent);

  const archivePath = await uniqueArchivePath(root, "archived", path.basename(sourcePath));
  await moveFile(sourcePath, archivePath);

  console.log(`Archived memory file to ${toPosixPath(path.relative(root, archivePath))}`);
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
