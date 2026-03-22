/**
 * Normalize product URLs for deduping and stable card ids (same rules as chat retrieval).
 */
export function canonicalizeProductUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    u.hash = "";
    const keep = new URLSearchParams();
    for (const [k, v] of u.searchParams.entries()) {
      const key = k.toLowerCase();
      if (
        key.startsWith("utm_") ||
        key === "gclid" ||
        key === "fbclid" ||
        key === "irclickid" ||
        key === "source" ||
        key === "affid"
      ) {
        continue;
      }
      keep.set(k, v);
    }
    const search = keep.toString();
    u.search = search ? `?${search}` : "";
    return u.toString();
  } catch {
    return rawUrl.trim();
  }
}
