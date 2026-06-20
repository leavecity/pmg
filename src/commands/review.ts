import path from "node:path";
import { getStringFlag, parseArgs } from "../lib/args.js";
import { pathExists, toPosixPath, writeText } from "../lib/fs.js";
import { slugify, today } from "../lib/slug.js";

export async function reviewCommand(rawArgs: string[], cwd: string): Promise<void> {
  const [subcommand, ...rest] = rawArgs;

  switch (subcommand) {
    case "create":
      await createReview(rest, cwd);
      return;
    default:
      throw new Error("Usage: pmg review create --type <type> --title <title>");
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
