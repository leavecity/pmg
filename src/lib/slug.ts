export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "memory-entry";
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
