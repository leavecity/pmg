import { contextCommand } from "../commands/context.js";
import { doctorCommand } from "../commands/doctor.js";
import { initCommand } from "../commands/init.js";
import { scanCommand } from "../commands/scan.js";
import { statusCommand } from "../commands/status.js";

const HELP = `Project Memory Governance (pmg)

Usage:
  pmg init [path] [--force]
  pmg status [path] [--json]
  pmg scan [path] [--json]
  pmg doctor [path]
  pmg context build --task <task> [--output context.md]

MVP command status:
  implemented: init, status, scan, doctor, context build
  planned: memory add/propose/promote/archive, spec create, adr create, review create
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
    case "context":
      await contextCommand(rest, cwd);
      return;
    case "memory":
    case "spec":
    case "adr":
    case "review":
      throw new Error(`${command} subcommands are planned after the MVP foundation.`);
    default:
      throw new Error(`Unknown command: ${command}. Run pmg help.`);
  }
}
