import path from "node:path";
import { fileURLToPath } from "node:url";

export function packageRoot(): string {
  const fileName = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(fileName), "../..");
}

export function defaultTemplateRoot(): string {
  return path.join(packageRoot(), "templates", "pmg");
}
