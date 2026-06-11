export type FlagValue = boolean | string;

export interface ParsedArgs {
  positional: string[];
  flags: Map<string, FlagValue>;
}

export function parseArgs(args: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags = new Map<string, FlagValue>();

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === "--") {
      positional.push(...args.slice(index + 1));
      break;
    }

    if (token.startsWith("--")) {
      const withoutPrefix = token.slice(2);
      const equalsIndex = withoutPrefix.indexOf("=");

      if (equalsIndex >= 0) {
        flags.set(withoutPrefix.slice(0, equalsIndex), withoutPrefix.slice(equalsIndex + 1));
        continue;
      }

      const next = args[index + 1];
      if (next && !next.startsWith("-")) {
        flags.set(withoutPrefix, next);
        index += 1;
      } else {
        flags.set(withoutPrefix, true);
      }
      continue;
    }

    if (token.startsWith("-") && token.length > 1) {
      for (const shortFlag of token.slice(1)) {
        flags.set(shortFlag, true);
      }
      continue;
    }

    positional.push(token);
  }

  return { positional, flags };
}

export function getStringFlag(args: ParsedArgs, name: string): string | undefined {
  const value = args.flags.get(name);
  return typeof value === "string" ? value : undefined;
}

export function getNumberFlag(args: ParsedArgs, name: string, fallback: number): number {
  const value = getStringFlag(args, name);
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }

  return parsed;
}

export function hasFlag(args: ParsedArgs, name: string): boolean {
  return args.flags.has(name);
}
