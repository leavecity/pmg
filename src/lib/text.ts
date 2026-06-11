import path from "node:path";

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  architecture: ["architecture", "boundary", "layer", "module", "design", "service"],
  "coding-style": ["style", "format", "lint", "convention", "naming"],
  dependencies: ["dependency", "package", "library", "npm", "upgrade"],
  i18n: ["i18n", "internationalization", "locale", "translation", "language"],
  performance: ["performance", "latency", "cache", "render", "query", "bundle"],
  security: ["security", "auth", "login", "token", "secret", "xss", "csrf", "ssrf"],
  "state-management": ["state", "store", "cache", "redux", "zustand"],
  testing: ["test", "coverage", "fixture", "mock", "unit", "integration"],
  "technical-debt": ["debt", "todo", "fixme", "workaround", "hack"],
  pitfalls: ["pitfall", "gotcha", "bug", "regression", "known issue"]
};

export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((word) => word.length >= 3);
}

export function scoreText(task: string, filePath: string, content: string): number {
  const taskWords = new Set(tokenize(task));
  const normalizedPath = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const haystack = `${filePath}\n${content}`.toLowerCase();
  let score = 0;

  for (const word of taskWords) {
    if (normalizedPath.includes(word)) {
      score += 5;
    }
    const matches = haystack.match(new RegExp(escapeRegExp(word), "g"));
    if (matches) {
      score += Math.min(matches.length, 6);
    }
  }

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (normalizedPath.includes(category)) {
      for (const keyword of keywords) {
        if (taskWords.has(keyword)) {
          score += 8;
        }
      }
    }
  }

  return score;
}

export function excerpt(content: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content.trim();
  }

  return `${content.slice(0, maxChars).trim()}\n\n[Excerpt truncated by pmg context build]`;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
