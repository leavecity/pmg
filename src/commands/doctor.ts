import { createStatusReport } from "./status.js";
import { parseArgs, getStringFlag } from "../lib/args.js";
import path from "node:path";

export async function doctorCommand(rawArgs: string[], cwd: string): Promise<void> {
  const args = parseArgs(rawArgs);
  const root = path.resolve(cwd, getStringFlag(args, "path") ?? args.positional[0] ?? ".");
  const report = await createStatusReport(root);

  console.log(`PMG doctor for ${root}`);

  if (report.ok) {
    console.log("No blocking issues found.");
  } else {
    console.log("Missing required PMG files:");
    for (const check of report.checks.filter((item) => item.required && !item.ok)) {
      console.log(`- ${check.path}`);
    }
  }

  console.log("");
  console.log("Next checks planned for future releases:");
  console.log("- registry schema validation");
  console.log("- stale memory detection");
  console.log("- conflicting memory detection");
  console.log("- template drift detection");
}
