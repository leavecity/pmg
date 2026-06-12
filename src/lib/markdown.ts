export interface MarkdownMetadata {
  [key: string]: string;
}

export function readMetadata(content: string): MarkdownMetadata {
  const metadata: MarkdownMetadata = {};
  const lines = content.split(/\r?\n/g);

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    if (line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^([A-Za-z][A-Za-z0-9 -]*):\s*(.+)$/);
    if (!match) {
      break;
    }

    metadata[normalizeKey(match[1])] = match[2].trim();
  }

  return metadata;
}

export function getTitle(content: string): string {
  const titleLine = content.split(/\r?\n/g).find((line) => line.startsWith("# "));
  return titleLine ? titleLine.replace(/^#\s+/, "").trim() : "Untitled";
}

export function upsertMetadata(content: string, updates: MarkdownMetadata): string {
  const lines = content.split(/\r?\n/g);
  const updatedKeys = new Set<string>();
  const nextLines = lines.map((line) => {
    const match = line.match(/^([A-Za-z][A-Za-z0-9 -]*):\s*(.*)$/);
    if (!match) {
      return line;
    }

    const normalized = normalizeKey(match[1]);
    const update = updates[normalized];
    if (update === undefined) {
      return line;
    }

    updatedKeys.add(normalized);
    return `${match[1]}: ${update}`;
  });

  const missing = Object.entries(updates).filter(([key]) => !updatedKeys.has(normalizeKey(key)));
  if (missing.length === 0) {
    return nextLines.join("\n");
  }

  const insertAt = findMetadataInsertIndex(nextLines);
  const inserted = missing.map(([key, value]) => `${toLabel(key)}: ${value}`);
  nextLines.splice(insertAt, 0, ...inserted);
  return nextLines.join("\n");
}

export function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, "-");
}

function toLabel(key: string): string {
  return key
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function findMetadataInsertIndex(lines: string[]): number {
  let index = 0;

  if (lines[index]?.startsWith("# ")) {
    index += 1;
  }

  while (index < lines.length && lines[index]?.trim() === "") {
    index += 1;
  }

  while (index < lines.length && /^[A-Za-z][A-Za-z0-9 -]*:\s*(.*)$/.test(lines[index] ?? "")) {
    index += 1;
  }

  return index;
}
