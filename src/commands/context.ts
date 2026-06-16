import path from "node:path";
import { mkdir } from "node:fs/promises";
import { parseArgs, getNumberFlag, getStringFlag, hasFlag } from "../lib/args.js";
import { listMarkdownFiles, pathExists, readText, toPosixPath, writeText } from "../lib/fs.js";
import { readMetadata } from "../lib/markdown.js";
import { excerpt, scoreText } from "../lib/text.js";

interface Candidate {
  path: string;
  relativePath: string;
  content: string;
  score: number;
  reason: string;
}

const ALWAYS_INCLUDE = [
  { path: "AGENTS.md", score: 100, reason: "agent entrypoint" },
  { path: "PMG.md", score: 95, reason: "PMG entrypoint" },
  { path: ".pmg/constitution.md", score: 90, reason: "project memory constitution" },
  { path: ".pmg/memory/project.md", score: 80, reason: "project overview memory" },
  { path: ".pmg/governance/context-assembly.md", score: 75, reason: "context assembly rules" }
];

const SEARCH_DIRS = [
  ".pmg/memory",
  ".pmg/specs",
  ".pmg/adr",
  ".pmg/reviews",
  ".pmg/governance",
  ".pmg/skills"
];

export async function contextCommand(rawArgs: string[], cwd: string): Promise<void> {
  const args = parseArgs(rawArgs);
  const subcommand = args.positional[0];

  if (subcommand !== "build") {
    throw new Error("Usage: pmg context build --task <task>");
  }

  const root = path.resolve(cwd, getStringFlag(args, "path") ?? ".");
  const task = getStringFlag(args, "task") ?? args.positional.slice(1).join(" ");

  if (!task.trim()) {
    throw new Error("pmg context build requires --task <task>");
  }

  if (!(await pathExists(path.join(root, ".pmg")))) {
    throw new Error("No .pmg directory found. Run pmg init first.");
  }

  const maxFiles = getNumberFlag(args, "max-files", 12);
  const maxCharsPerFile = getNumberFlag(args, "max-chars-per-file", 4000);
  const candidates = await collectCandidates(root, task);
  const selected = selectCandidates(candidates, maxFiles);
  const bundle = renderContextBundle(root, task, selected, maxCharsPerFile);
  const output = getStringFlag(args, "output");

  if (hasFlag(args, "json")) {
    console.log(JSON.stringify({
      task,
      root,
      selectedSources: selected.map((candidate) => ({
        path: candidate.relativePath,
        score: candidate.score,
        reason: candidate.reason
      })),
      content: bundle
    }, null, 2));
    return;
  }

  if (output) {
    const outputPath = path.resolve(cwd, output);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeText(outputPath, bundle);
    console.log(`Wrote context bundle to ${outputPath}`);
    return;
  }

  console.log(bundle);
}

async function collectCandidates(root: string, task: string): Promise<Candidate[]> {
  const byPath = new Map<string, Candidate>();

  for (const item of ALWAYS_INCLUDE) {
    const absolutePath = path.join(root, item.path);
    if (await pathExists(absolutePath)) {
      byPath.set(absolutePath, {
        path: absolutePath,
        relativePath: item.path,
        content: await readText(absolutePath),
        score: item.score,
        reason: item.reason
      });
    }
  }

  for (const directory of SEARCH_DIRS) {
    const files = await listMarkdownFiles(path.join(root, directory));
    for (const filePath of files) {
      if (byPath.has(filePath)) {
        continue;
      }

      const content = await readText(filePath);
      const relativePath = toPosixPath(path.relative(root, filePath));

      if (shouldExcludePathFromDefaultContext(relativePath) || shouldExcludeFromDefaultContext(relativePath, content)) {
        continue;
      }

      const baseScore = scoreText(task, relativePath, content);
      const score = baseScore > 0 ? baseScore + metadataScore(content) : 0;

      if (score > 0) {
        byPath.set(filePath, {
          path: filePath,
          relativePath,
          content,
          score,
          reason: "matched task keywords"
        });
      }
    }
  }

  return [...byPath.values()];
}

function shouldExcludePathFromDefaultContext(relativePath: string): boolean {
  return (
    relativePath.startsWith(".pmg/memory/archive/") ||
    relativePath.startsWith(".pmg/memory/proposals/")
  );
}

function shouldExcludeFromDefaultContext(relativePath: string, content: string): boolean {
  const metadata = readMetadata(content);
  const status = metadata.status?.toLowerCase();

  if (status === "deprecated" || status === "archived") {
    return true;
  }

  return relativePath.startsWith(".pmg/memory/") && status === "pending";
}

function metadataScore(content: string): number {
  const metadata = readMetadata(content);
  const status = metadata.status?.toLowerCase();
  const confidence = metadata.confidence?.toLowerCase();

  let score = 0;
  if (status === "confirmed" || status === "accepted" || status === "active") {
    score += 6;
  }
  if (confidence === "confirmed") {
    score += 4;
  }
  if (status === "deprecated" || status === "archived") {
    score -= 4;
  }
  if (status === "conflicting" || confidence === "conflicting") {
    score -= 2;
  }

  return score;
}

function selectCandidates(candidates: Candidate[], maxFiles: number): Candidate[] {
  return candidates
    .sort((left, right) => right.score - left.score || left.relativePath.localeCompare(right.relativePath))
    .slice(0, maxFiles);
}

function renderContextBundle(
  root: string,
  task: string,
  selected: Candidate[],
  maxCharsPerFile: number
): string {
  const lines: string[] = [];

  lines.push("# PMG Context Bundle");
  lines.push("");
  lines.push(`Task: ${task}`);
  lines.push(`Root: ${root}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Use Rules");
  lines.push("");
  lines.push("- Treat confirmed project memory as durable guidance.");
  lines.push("- Pending memory files are excluded from default context bundles.");
  lines.push("- Deprecated and archived memory is excluded from default context bundles.");
  lines.push("- Pending proposal files and archive audit records are excluded from default context bundles.");
  lines.push("- Treat inferred, experimental, and conflicting memory according to its status.");
  lines.push("- Do not promote new long-term memory unless the user approves it or the PMG policy allows it.");
  lines.push("- Prefer task-relevant context over loading the entire repository memory.");
  lines.push("");
  lines.push("## Selected Sources");
  lines.push("");

  for (const candidate of selected) {
    lines.push(`- ${candidate.relativePath} (${candidate.reason}, score ${candidate.score})`);
  }

  for (const candidate of selected) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(`## Source: ${candidate.relativePath}`);
    lines.push("");
    lines.push(excerpt(candidate.content, maxCharsPerFile));
  }

  lines.push("");
  return lines.join("\n");
}
