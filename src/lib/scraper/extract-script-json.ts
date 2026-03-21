/**
 * Extract a top-level JSON object from HTML after a given prefix (e.g. `window.__myx = `).
 * Uses brace depth with string/escape awareness — avoids broken `\{[\s\S]*?\}` truncation.
 */
export function extractBalancedJsonObject(html: string, prefix: string): string | null {
  const idx = html.indexOf(prefix);
  if (idx === -1) return null;
  let i = idx + prefix.length;
  while (i < html.length && /\s/.test(html[i]!)) i++;
  if (html[i] !== "{") return null;
  const start = i;
  let depth = 0;
  let inString = false;
  let quote: '"' | "'" | null = null;
  let escape = false;

  for (; i < html.length; i++) {
    const c = html[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (quote && c === quote) {
        inString = false;
        quote = null;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      quote = c as '"' | "'";
      continue;
    }
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  return null;
}

export function parseScriptJson<T>(html: string, prefix: string): T | null {
  const raw = extractBalancedJsonObject(html, prefix);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Try several assignment styles (`window.foo = ` vs `window.foo=`). */
export function parseScriptJsonFromPrefixes<T>(
  html: string,
  prefixes: readonly string[],
): T | null {
  for (const prefix of prefixes) {
    const parsed = parseScriptJson<T>(html, prefix);
    if (parsed) return parsed;
  }
  return null;
}
