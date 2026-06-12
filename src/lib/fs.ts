import { constants } from "node:fs";
import { access, copyFile, mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface CopyResult {
  copied: string[];
  skipped: string[];
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readText(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

export async function writeText(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

export async function moveFile(source: string, target: string): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true });
  await rename(source, target);
}

export async function copyTree(source: string, target: string, force: boolean): Promise<CopyResult> {
  const result: CopyResult = { copied: [], skipped: [] };

  async function visit(currentSource: string, currentTarget: string): Promise<void> {
    const entryStat = await stat(currentSource);

    if (entryStat.isDirectory()) {
      await mkdir(currentTarget, { recursive: true });
      const entries = await readdir(currentSource, { withFileTypes: true });
      for (const entry of entries) {
        await visit(path.join(currentSource, entry.name), path.join(currentTarget, entry.name));
      }
      return;
    }

    if (!entryStat.isFile()) {
      return;
    }

    if (!force && (await pathExists(currentTarget))) {
      result.skipped.push(currentTarget);
      return;
    }

    await mkdir(path.dirname(currentTarget), { recursive: true });
    await copyFile(currentSource, currentTarget);
    result.copied.push(currentTarget);
  }

  await visit(source, target);
  return result;
}

export async function listMarkdownFiles(directory: string): Promise<string[]> {
  if (!(await pathExists(directory))) {
    return [];
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

export function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}
