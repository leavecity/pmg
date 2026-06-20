import path from "node:path";
import { parseArgs, getStringFlag, hasFlag } from "../lib/args.js";
import { copyTree, pathExists, readText, writeText } from "../lib/fs.js";
import { ensurePmgLocalStateIgnored } from "../lib/git.js";
import { upsertMetadata } from "../lib/markdown.js";
import { defaultTemplateRoot } from "../lib/templates.js";

export async function initCommand(rawArgs: string[], cwd: string): Promise<void> {
  const args = parseArgs(rawArgs);
  const target = path.resolve(cwd, args.positional[0] ?? ".");
  const force = hasFlag(args, "force");
  const language = getStringFlag(args, "language");
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

  if (language) {
    await updateLanguageProfile(target, language);
    console.log(`Updated PMG language profile: ${language}`);
  }
}

async function updateLanguageProfile(root: string, language: string): Promise<void> {
  const profilePath = path.join(root, ".pmg", "profiles", "language.md");
  const content = await readLanguageProfile(profilePath);

  await writeText(profilePath, upsertMetadata(content, {
    "project-language": language,
    "conversation-language": language,
    "agent-response-language": language
  }));
}

async function readLanguageProfile(profilePath: string): Promise<string> {
  if (await pathExists(profilePath)) {
    return readText(profilePath);
  }

  return `# Language Profile

Project-Language: en
Conversation-Language: en
Formal-Docs-Language: en
Agent-Response-Language: en
Machine-Metadata-Language: en

## Rules

- Keep command flags, JSON fields, and metadata keys stable.
- Agents should answer in the configured agent response language unless the user asks otherwise.
- Formal documentation may use a separate language from conversation.
`;
}
