import { readdir } from "node:fs/promises";
import path from "node:path";
import { getNumberFlag, getStringFlag, hasFlag, parseArgs } from "../lib/args.js";
import { pathExists, readText, toPosixPath } from "../lib/fs.js";

interface ScanSignal {
  type: string;
  path: string;
  detail: string;
}

const SKIP_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  "tmp",
  ".next",
  "build"
]);

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".mdx",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".rb",
  ".php",
  ".cs"
]);

const ENTRYPOINT_FILES = new Set(["AGENTS.md", "PMG.md", "README.md", "CONTRIBUTING.md"]);

export async function scanCommand(rawArgs: string[], cwd: string): Promise<void> {
  const args = parseArgs(rawArgs);
  const root = path.resolve(cwd, getStringFlag(args, "path") ?? args.positional[0] ?? ".");
  const maxFiles = getNumberFlag(args, "max-files", 500);
  const signals = await scanRepository(root, maxFiles);

  if (hasFlag(args, "json")) {
    console.log(JSON.stringify({ root, signals }, null, 2));
    return;
  }

  console.log(`PMG scan for ${root}`);
  console.log(`Signals: ${signals.length}`);

  for (const signal of signals) {
    console.log(`- ${signal.type}: ${signal.path} - ${signal.detail}`);
  }
}

export async function scanRepository(root: string, maxFiles: number): Promise<ScanSignal[]> {
  if (!(await pathExists(root))) {
    throw new Error(`Path does not exist: ${root}`);
  }

  const files = await listCandidateFiles(root, maxFiles);
  const signals: ScanSignal[] = [];

  for (const filePath of files) {
    const relativePath = toPosixPath(path.relative(root, filePath));
    const baseName = path.basename(filePath);

    if (ENTRYPOINT_FILES.has(baseName)) {
      signals.push({
        type: "entrypoint",
        path: relativePath,
        detail: "project guidance file"
      });
    }

    if (relativePath.includes("/adr/") || relativePath.includes("/adrs/")) {
      signals.push({
        type: "adr",
        path: relativePath,
        detail: "possible architecture decision record"
      });
    }

    if (relativePath.includes("/spec") || relativePath.includes("/specs/")) {
      signals.push({
        type: "spec",
        path: relativePath,
        detail: "possible spec artifact"
      });
    }

    const content = await readText(filePath);
    const todoMatches = content.match(/\b(TODO|FIXME|HACK|WORKAROUND)\b/gi);

    if (todoMatches) {
      signals.push({
        type: "debt-candidate",
        path: relativePath,
        detail: `${todoMatches.length} marker(s)`
      });
    }

    if (/\b(memory|governance|context assembly|ADR|spec)\b/i.test(content)) {
      signals.push({
        type: "memory-candidate",
        path: relativePath,
        detail: "contains project-memory keywords"
      });
    }
  }

  return signals;
}

async function listCandidateFiles(root: string, maxFiles: number): Promise<string[]> {
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    if (files.length >= maxFiles) {
      return;
    }

    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (files.length >= maxFiles) {
        return;
      }

      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) {
          await visit(path.join(directory, entry.name));
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (TEXT_EXTENSIONS.has(extension) || ENTRYPOINT_FILES.has(entry.name)) {
        files.push(path.join(directory, entry.name));
      }
    }
  }

  await visit(root);
  return files.sort();
}
