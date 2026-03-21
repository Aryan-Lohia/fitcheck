const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  mdash: "-",
  ndash: "-",
};

export function decodeHtmlEntities(input: string): string {
  if (!input || !input.includes("&")) return input;

  return input.replace(
    /&(#\d+|#x[\da-fA-F]+|[a-zA-Z]+);/g,
    (full, entity: string) => {
      if (entity.startsWith("#x") || entity.startsWith("#X")) {
        const code = Number.parseInt(entity.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : full;
      }
      if (entity.startsWith("#")) {
        const code = Number.parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : full;
      }
      const named = NAMED_ENTITIES[entity];
      return named ?? full;
    },
  );
}

