/**
 * Ajio category/search JSON embedded in HTML exposes product `url` paths like
 * `/slug/p/469625454_blue`. Collect those for PDP discovery.
 */

const AJIO_ORIGIN = "https://www.ajio.com";

/** Keep in sync with `AJIO_PDP_PATH_RE` in ajio-plp-extract (slug may include `_`). */
const PDP_PATH_RE =
  /"url"\s*:\s*"(\/[a-z0-9][a-z0-9\-_/]{0,320}\/p\/[a-z0-9_]+)"/gi;

export function extractAjioPdpUrlsFromSearchHtml(html: string, max = 40): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  PDP_PATH_RE.lastIndex = 0;
  while ((m = PDP_PATH_RE.exec(html)) !== null) {
    const path = m[1];
    if (!path || path.includes("//")) continue;
    const full = `${AJIO_ORIGIN}${path}`;
    const key = full.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(full);
    if (out.length >= max) break;
  }
  return out;
}
