import path from "node:path";
import { getStringFlag, parseArgs } from "../lib/args.js";
import { listMarkdownFiles, pathExists, readText, toPosixPath, writeText } from "../lib/fs.js";
import { getTitle, readMetadata } from "../lib/markdown.js";
import { slugify, today } from "../lib/slug.js";

export async function reviewCommand(rawArgs: string[], cwd: string): Promise<void> {
  const [subcommand, ...rest] = rawArgs;

  switch (subcommand) {
    case "create":
      await createReview(rest, cwd);
      return;
    case "memory":
      await reviewMemory(rest, cwd);
      return;
    default:
      throw new Error("Usage: pmg review <create|memory>");
  }
}

async function reviewMemory(rawArgs: string[], cwd: string): Promise<void> {
  const [subcommand, ...rest] = rawArgs;

  switch (subcommand) {
    case "propose":
      await proposeMemoryFromReview(rest, cwd);
      return;
    default:
      throw new Error("Usage: pmg review memory propose <review>");
  }
}

async function createReview(rawArgs: string[], cwd: string): Promise<void> {
  const args = parseArgs(rawArgs);
  const root = path.resolve(cwd, getStringFlag(args, "path") ?? ".");

  if (!(await pathExists(path.join(root, ".pmg")))) {
    throw new Error("No .pmg directory found. Run pmg init first.");
  }

  const title = requireFlag(args, "title");
  const type = getStringFlag(args, "type") ?? "general";
  const scope = getStringFlag(args, "scope") ?? "Pending.";
  const findings = getStringFlag(args, "findings") ?? "No findings yet.";
  const risks = getStringFlag(args, "risks") ?? "Pending.";
  const recommendedMemoryUpdates = getStringFlag(args, "recommended-memory-updates") ?? "Pending.";
  const relatedFiles = parseRelatedFiles(getStringFlag(args, "related-files"));
  const date = today();
  let outputPath = path.join(root, ".pmg", "reviews", `${date}-${slugify(title)}.md`);
  let suffix = 2;

  while (await pathExists(outputPath)) {
    outputPath = path.join(root, ".pmg", "reviews", `${date}-${slugify(title)}-${suffix}.md`);
    suffix += 1;
  }

  await writeText(outputPath, renderReview({
    title,
    type,
    date,
    scope,
    findings,
    risks,
    recommendedMemoryUpdates,
    relatedFiles
  }));

  console.log(`Created review: ${toPosixPath(path.relative(root, outputPath))}`);
}

async function proposeMemoryFromReview(rawArgs: string[], cwd: string): Promise<void> {
  const args = parseArgs(rawArgs);
  const root = path.resolve(cwd, getStringFlag(args, "path") ?? ".");

  if (!(await pathExists(path.join(root, ".pmg")))) {
    throw new Error("No .pmg directory found. Run pmg init first.");
  }

  const selector = args.positional[0];
  if (!selector) {
    throw new Error("pmg review memory propose requires a review path or id");
  }

  const reviewPath = await resolveReviewFile(root, selector);
  const reviewContent = await readText(reviewPath);
  const metadata = readTopLevelMetadata(reviewContent);
  const reviewTitle = getTitle(reviewContent).replace(/^Review:\s*/i, "");
  const recommendation = extractSection(reviewContent, "Recommended Memory Updates");

  if (recommendation === "Pending.") {
    throw new Error("review has no recommended memory updates");
  }

  const date = today();
  const title = getStringFlag(args, "title") ?? `${reviewTitle} memory update`;
  const domain = getStringFlag(args, "domain") ?? metadata.type ?? "general";
  const source = toPosixPath(path.relative(root, reviewPath));
  let outputPath = path.join(root, ".pmg", "memory", "proposals", `${date}-${slugify(title)}.md`);
  let suffix = 2;

  while (await pathExists(outputPath)) {
    outputPath = path.join(root, ".pmg", "memory", "proposals", `${date}-${slugify(title)}-${suffix}.md`);
    suffix += 1;
  }

  await writeText(outputPath, renderMemoryProposalFromReview({
    title,
    domain,
    source,
    created: new Date().toISOString(),
    observation: `Review recommended durable memory updates for ${reviewTitle}.`,
    knowledge: recommendation,
    evidence: renderReviewEvidence(source, reviewContent)
  }));

  console.log(`Created memory proposal from review: ${toPosixPath(path.relative(root, outputPath))}`);
}

function requireFlag(args: ReturnType<typeof parseArgs>, name: string): string {
  const value = getStringFlag(args, name);
  if (!value?.trim()) {
    throw new Error(`--${name} is required`);
  }
  return value;
}

function parseRelatedFiles(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderReview(input: {
  title: string;
  type: string;
  date: string;
  scope: string;
  findings: string;
  risks: string;
  recommendedMemoryUpdates: string;
  relatedFiles: string[];
}): string {
  return `# Review: ${input.title}

Type: ${input.type}
Status: draft
Date: ${input.date}

## Scope

${input.scope}

## Findings

${input.findings}

## Risks

${input.risks}

## Recommended Memory Updates

${input.recommendedMemoryUpdates}

## Related Files

${renderRelatedFiles(input.relatedFiles)}
`;
}

function renderRelatedFiles(files: string[]): string {
  if (files.length === 0) {
    return "Pending.";
  }

  return files.map((file) => `- ${file}`).join("\n");
}

function renderMemoryProposalFromReview(input: {
  title: string;
  domain: string;
  source: string;
  created: string;
  observation: string;
  knowledge: string;
  evidence: string;
}): string {
  return `# Memory Proposal: ${input.title}

Status: pending
Confidence: inferred
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

function renderReviewEvidence(source: string, reviewContent: string): string {
  return `Review: ${source}

Findings:
${extractSection(reviewContent, "Findings")}

Risks:
${extractSection(reviewContent, "Risks")}`;
}

async function resolveReviewFile(root: string, selector: string): Promise<string> {
  const directPath = path.resolve(root, selector);
  assertInsideProjectRoot(root, directPath, "review selector");

  if (await pathExists(directPath)) {
    return directPath;
  }

  const reviewsPath = path.resolve(root, ".pmg", "reviews", selector);
  assertInsideProjectRoot(root, reviewsPath, "review selector");

  if (await pathExists(reviewsPath)) {
    return reviewsPath;
  }

  const files = await listMarkdownFiles(path.join(root, ".pmg", "reviews"));
  const matches = files.filter((file) => {
    const base = path.basename(file, ".md");
    return base === selector || base.includes(selector) || file.endsWith(selector);
  });

  if (matches.length === 0) {
    throw new Error(`Could not find review file matching: ${selector}`);
  }

  if (matches.length > 1) {
    throw new Error(`Review selector is ambiguous: ${selector}`);
  }

  return matches[0];
}

function assertInsideProjectRoot(root: string, candidatePath: string, label: string): void {
  const relativePath = path.relative(root, candidatePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`${label} resolves outside the project root: ${candidatePath}`);
  }
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

function readTopLevelMetadata(content: string): Record<string, string> {
  const topLevelContent = content.split(/^##\s+/m)[0] ?? content;
  return readMetadata(topLevelContent);
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
