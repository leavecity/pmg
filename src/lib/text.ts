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

export interface TextScoreDetails {
  score: number;
  matchedTerms: string[];
}

export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((word) => word.length >= 3);
}

export function scoreText(task: string, filePath: string, content: string): number {
  return scoreTextDetails(task, filePath, content).score;
}

export function scoreTextDetails(task: string, filePath: string, content: string): TextScoreDetails {
  const taskWordList = [...new Set(tokenize(task))];
  const taskWords = new Set(taskWordList);
  const matchedTerms = new Set<string>();
  const normalizedPath = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const pathTokens = new Set(tokenize(normalizedPath));
  const contentTokenCounts = countTokens(content);
  let score = 0;

  for (const word of taskWordList) {
    if (pathTokens.has(word)) {
      score += 5;
      matchedTerms.add(word);
    }
    const contentMatches = contentTokenCounts.get(word) ?? 0;
    if (contentMatches > 0) {
      score += Math.min(contentMatches, 6);
      matchedTerms.add(word);
    }
  }

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (normalizedPath.includes(category)) {
      for (const keyword of keywords) {
        if (taskWords.has(keyword)) {
          score += 8;
          matchedTerms.add(keyword);
        }
      }
    }
  }

  return {
    score,
    matchedTerms: taskWordList.filter((word) => matchedTerms.has(word))
  };
}

export function excerpt(content: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content.trim();
  }

  return `${content.slice(0, maxChars).trim()}\n\n[Excerpt truncated by pmg context build]`;
}

function countTokens(input: string): Map<string, number> {
  const counts = new Map<string, number>();

  for (const token of tokenize(input)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return counts;
}
