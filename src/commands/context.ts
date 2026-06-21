import path from "node:path";
import { mkdir } from "node:fs/promises";
import { parseArgs, getNumberFlag, getStringFlag, hasFlag } from "../lib/args.js";
import { listMarkdownFiles, pathExists, readText, toPosixPath, writeText } from "../lib/fs.js";
import { readMetadata } from "../lib/markdown.js";
import { excerpt, scoreTextDetails } from "../lib/text.js";

interface Candidate {
  path: string;
  relativePath: string;
  content: string;
  score: number;
  reason: string;
  matchedTerms: string[];
}

interface ExcludedSource {
  path: string;
  reason: string;
  score: number;
  matchedTerms: string[];
}

interface LowScoreSource {
  path: string;
  reason: string;
  score: number;
  matchedTerms: string[];
}

interface CandidateCollection {
  candidates: Candidate[];
  excludedSources: ExcludedSource[];
  lowScoreSources: LowScoreSource[];
}

interface ContextFilters {
  reviews: boolean;
  specs: boolean;
}

interface BudgetUsage {
  candidateSourceCount: number;
  selectedSourceCount: number;
  omittedCandidateSourceCount: number;
  excludedSourceCount: number;
  lowScoreSourceCount: number;
  reportedLowScoreSourceCount: number;
  omittedLowScoreSourceCount: number;
  maxFilesReached: boolean;
  maxLowScoreSourcesReached: boolean;
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
  ".pmg/profiles",
  ".pmg/skills"
];

const MIN_EXCLUDED_SOURCE_SCORE = 2;
const DEFAULT_MAX_LOW_SCORE_SOURCES = 10;

export async function contextCommand(rawArgs: string[], cwd: string): Promise<void> {
  const args = parseArgs(rawArgs);
  const subcommand = args.positional[0];

  if (subcommand !== "build" && subcommand !== "explain") {
    throw new Error("Usage: pmg context <build|explain> --task <task>");
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
  const maxLowScoreSources = getNumberFlag(args, "max-low-score-sources", DEFAULT_MAX_LOW_SCORE_SOURCES);
  const filters = {
    reviews: !hasFlag(args, "no-reviews"),
    specs: !hasFlag(args, "no-specs")
  };
  const { candidates, excludedSources, lowScoreSources } = await collectCandidates(root, task, filters);
  const selected = selectCandidates(candidates, maxFiles);

  if (subcommand === "explain") {
    const explanation = createContextExplanation({
      task,
      root,
      maxFiles,
      maxCharsPerFile,
      maxLowScoreSources,
      filters,
      candidates,
      selected,
      excludedSources,
      lowScoreSources
    });

    if (hasFlag(args, "json")) {
      console.log(JSON.stringify(explanation, null, 2));
      return;
    }

    console.log(renderContextExplanation(explanation));
    return;
  }

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
      excludedSources,
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

interface ContextExplanation {
  task: string;
  root: string;
  budgets: {
    maxFiles: number;
    maxCharsPerFile: number;
    maxLowScoreSources: number;
  };
  filters: ContextFilters;
  budgetUsage: BudgetUsage;
  selectedSources: Array<{
    path: string;
    score: number;
    reason: string;
    matchedTerms: string[];
  }>;
  candidateSources: Array<{
    path: string;
    score: number;
    reason: string;
    matchedTerms: string[];
    selected: boolean;
  }>;
  excludedSources: ExcludedSource[];
  lowScoreSources: LowScoreSource[];
}

function createContextExplanation(input: {
  task: string;
  root: string;
  maxFiles: number;
  maxCharsPerFile: number;
  maxLowScoreSources: number;
  filters: ContextFilters;
  candidates: Candidate[];
  selected: Candidate[];
  excludedSources: ExcludedSource[];
  lowScoreSources: LowScoreSource[];
}): ContextExplanation {
  const selectedPaths = new Set(input.selected.map((candidate) => candidate.relativePath));

  return {
    task: input.task,
    root: input.root,
    budgets: {
      maxFiles: input.maxFiles,
      maxCharsPerFile: input.maxCharsPerFile,
      maxLowScoreSources: input.maxLowScoreSources
    },
    filters: input.filters,
    budgetUsage: createBudgetUsage(input),
    selectedSources: input.selected.map(toSourceSummary),
    candidateSources: input.candidates.map((candidate) => ({
      ...toSourceSummary(candidate),
      selected: selectedPaths.has(candidate.relativePath)
    })),
    excludedSources: input.excludedSources,
    lowScoreSources: input.lowScoreSources.slice(0, input.maxLowScoreSources)
  };
}

function createBudgetUsage(input: {
  maxLowScoreSources: number;
  candidates: Candidate[];
  selected: Candidate[];
  excludedSources: ExcludedSource[];
  lowScoreSources: LowScoreSource[];
}): BudgetUsage {
  const omittedCandidateSourceCount = Math.max(input.candidates.length - input.selected.length, 0);
  const reportedLowScoreSourceCount = Math.min(input.lowScoreSources.length, input.maxLowScoreSources);
  const omittedLowScoreSourceCount = Math.max(input.lowScoreSources.length - reportedLowScoreSourceCount, 0);

  return {
    candidateSourceCount: input.candidates.length,
    selectedSourceCount: input.selected.length,
    omittedCandidateSourceCount,
    excludedSourceCount: input.excludedSources.length,
    lowScoreSourceCount: input.lowScoreSources.length,
    reportedLowScoreSourceCount,
    omittedLowScoreSourceCount,
    maxFilesReached: omittedCandidateSourceCount > 0,
    maxLowScoreSourcesReached: omittedLowScoreSourceCount > 0
  };
}

function toSourceSummary(candidate: Candidate): { path: string; score: number; reason: string; matchedTerms: string[] } {
  return {
    path: candidate.relativePath,
    score: candidate.score,
    reason: candidate.reason,
    matchedTerms: candidate.matchedTerms
  };
}

function renderContextExplanation(explanation: ContextExplanation): string {
  const lines: string[] = [];

  lines.push("# PMG Context Explanation");
  lines.push("");
  lines.push(`Task: ${explanation.task}`);
  lines.push(`Root: ${explanation.root}`);
  lines.push(`Budget: ${explanation.budgets.maxFiles} file(s), ${explanation.budgets.maxCharsPerFile} chars per file`);
  lines.push(`Budget Usage: ${explanation.budgetUsage.selectedSourceCount}/${explanation.budgetUsage.candidateSourceCount} candidate source(s) selected, ${explanation.budgetUsage.omittedCandidateSourceCount} omitted by file budget`);
  lines.push("");
  lines.push("## Selected Sources");
  lines.push("");
  for (const source of explanation.selectedSources) {
    lines.push(`- ${source.path} (${formatSourceDetails(source.reason, source.score, source.matchedTerms)})`);
  }
  lines.push("");
  lines.push("## Candidate Sources");
  lines.push("");
  for (const source of explanation.candidateSources) {
    const selected = source.selected ? "selected" : "not selected";
    lines.push(`- ${source.path} (${selected}, ${formatSourceDetails(source.reason, source.score, source.matchedTerms)})`);
  }
  lines.push("");
  lines.push("## Excluded Sources");
  lines.push("");
  for (const source of explanation.excludedSources) {
    lines.push(`- ${source.path} (${formatSourceDetails(source.reason, source.score, source.matchedTerms)})`);
  }
  lines.push("");
  lines.push("## Low Score Sources");
  lines.push("");
  for (const source of explanation.lowScoreSources) {
    lines.push(`- ${source.path} (${formatSourceDetails(source.reason, source.score, source.matchedTerms)})`);
  }

  return lines.join("\n");
}

function formatSourceDetails(reason: string, score: number, matchedTerms: string[]): string {
  const terms = matchedTerms.length > 0 ? `, terms ${matchedTerms.join(", ")}` : "";

  return `${reason}, score ${score}${terms}`;
}

async function collectCandidates(root: string, task: string, filters: ContextFilters): Promise<CandidateCollection> {
  const byPath = new Map<string, Candidate>();
  const excludedSources: ExcludedSource[] = [];
  const lowScoreSources: LowScoreSource[] = [];

  for (const item of ALWAYS_INCLUDE) {
    const absolutePath = path.join(root, item.path);
    if (await pathExists(absolutePath)) {
      byPath.set(absolutePath, {
        path: absolutePath,
        relativePath: item.path,
        content: await readText(absolutePath),
        score: item.score,
        reason: item.reason,
        matchedTerms: []
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
      const scoreDetails = scoreTextDetails(task, relativePath, content);
      const baseScore = scoreDetails.score;
      const exclusionReason = sourceFilterExclusionReason(relativePath, filters) ?? defaultContextExclusionReason(relativePath, content);

      if (exclusionReason) {
        if (baseScore >= MIN_EXCLUDED_SOURCE_SCORE) {
          excludedSources.push({
            path: relativePath,
            score: baseScore,
            reason: exclusionReason,
            matchedTerms: scoreDetails.matchedTerms
          });
        }
        continue;
      }

      const score = baseScore > 0 ? baseScore + metadataScore(content) : 0;

      if (score > 0) {
        byPath.set(filePath, {
          path: filePath,
          relativePath,
          content,
          score,
          reason: "matched task keywords",
          matchedTerms: scoreDetails.matchedTerms
        });
      } else {
        lowScoreSources.push({
          path: relativePath,
          score,
          reason: "below relevance threshold",
          matchedTerms: scoreDetails.matchedTerms
        });
      }
    }
  }

  return {
    candidates: [...byPath.values()],
    excludedSources: excludedSources.sort((left, right) => right.score - left.score || left.path.localeCompare(right.path)),
    lowScoreSources: lowScoreSources.sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
  };
}

function sourceFilterExclusionReason(relativePath: string, filters: ContextFilters): string | null {
  if (!filters.reviews && relativePath.startsWith(".pmg/reviews/")) {
    return "review sources disabled by --no-reviews";
  }
  if (!filters.specs && relativePath.startsWith(".pmg/specs/")) {
    return "spec sources disabled by --no-specs";
  }

  return null;
}

function defaultContextExclusionReason(relativePath: string, content: string): string | null {
  if (relativePath.startsWith(".pmg/memory/proposals/")) {
    return "pending proposal file is excluded from default context";
  }
  if (relativePath.startsWith(".pmg/memory/archive/")) {
    return "memory archive audit record is excluded from default context";
  }

  const metadata = readMetadata(content);
  const status = metadata.status?.toLowerCase();

  if (relativePath.startsWith(".pmg/memory/") && status === "pending") {
    return "pending memory is excluded from default context";
  }
  if (status === "deprecated") {
    return "deprecated memory is excluded from default context";
  }
  if (status === "archived") {
    return "archived memory is excluded from default context";
  }

  return null;
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
