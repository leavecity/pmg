import path from "node:path";
import { parseArgs, hasFlag } from "../lib/args.js";
import { copyTree } from "../lib/fs.js";
import { ensurePmgLocalStateIgnored } from "../lib/git.js";
import { defaultTemplateRoot } from "../lib/templates.js";

export async function initCommand(rawArgs: string[], cwd: string): Promise<void> {
  const args = parseArgs(rawArgs);
  const target = path.resolve(cwd, args.positional[0] ?? ".");
  const force = hasFlag(args, "force");
  const result = await copyTree(defaultTemplateRoot(), target, force);

  console.log(`Initialized Project Memory Governance in ${target}`);
  console.log(`Copied ${result.copied.length} file(s).`);

  if (result.skipped.length > 0) {
    console.log(`Skipped ${result.skipped.length} existing file(s). Use --force to overwrite.`);
  }

  const ignoreStatus = await ensurePmgLocalStateIgnored(target);
  if (ignoreStatus.repository) {
    if (ignoreStatus.changed) {
      console.log(`Updated local Git ignore rules in ${ignoreStatus.repository.infoExcludePath}`);
    } else {
      console.log("Local Git ignore rules already include PMG local state.");
    }
  } else {
    console.log("No Git repository detected. PMG local state will not be version-ignored automatically.");
  }
}
