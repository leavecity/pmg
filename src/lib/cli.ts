import { contextCommand } from "../commands/context.js";
import { diffCommand } from "../commands/diff.js";
import { doctorCommand } from "../commands/doctor.js";
import { initCommand } from "../commands/init.js";
import { memoryCommand } from "../commands/memory.js";
import { publishCommand } from "../commands/publish.js";
import { reviewCommand } from "../commands/review.js";
import { scanCommand } from "../commands/scan.js";
import { statusCommand } from "../commands/status.js";

const HELP = `Project Memory Governance (pmg)

Usage:
  pmg init [path] [--force] [--language <tag>]
  pmg status [path] [--json]
  pmg scan [path] [--json]
  pmg doctor [path]
  pmg diff [path] [--json]
  pmg context build --task <task> [--output context.md]
  pmg context explain --task <task> [--json] [--no-reviews] [--no-specs] [--max-low-score-sources <n>]
  pmg memory propose --title <title> --observation <text>
  pmg memory promote <proposal> [--target <domain-or-path>]
  pmg memory archive <path-or-id> [--reason <reason>]
  pmg memory project propose --title <title> --summary <text> --content <markdown>
  pmg memory project apply <proposal> [--reviewer <name>]
  pmg memory cleanup propose
  pmg memory cleanup apply <proposal> [--reviewer <name>]
  pmg publish plan [path] [--json]
  pmg review create --type <type> --title <title>
  pmg review memory propose <review>

MVP command status:
  implemented: init, status, scan, doctor, diff, context build, memory propose/promote/archive, memory project propose/apply, memory cleanup propose/apply, publish plan, review create, review memory propose
  planned: memory add, spec create, adr create
`;

export async function runCli(args: string[], cwd: string): Promise<void> {
  const [command, ...rest] = args;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(HELP);
    return;
  }

  switch (command) {
    case "init":
      await initCommand(rest, cwd);
      return;
    case "status":
      await statusCommand(rest, cwd);
      return;
    case "scan":
      await scanCommand(rest, cwd);
      return;
    case "doctor":
      await doctorCommand(rest, cwd);
      return;
    case "diff":
      await diffCommand(rest, cwd);
      return;
    case "context":
      await contextCommand(rest, cwd);
      return;
    case "memory":
      await memoryCommand(rest, cwd);
      return;
    case "publish":
      await publishCommand(rest, cwd);
      return;
    case "review":
      await reviewCommand(rest, cwd);
      return;
    case "spec":
    case "adr":
      throw new Error(`${command} subcommands are planned after the MVP foundation.`);
    default:
      throw new Error(`Unknown command: ${command}. Run pmg help.`);
  }
}
