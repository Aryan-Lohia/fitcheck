/**
 * Ajio search / PLP responses embed `products[]` with `name`, relative `url`, prices, images.
 * @see ajioformatfile.txt
 */

import { parseScriptJsonFromPrefixes } from "@/lib/scraper/extract-script-json";

const AJIO_ORIGIN = "https://www.ajio.com";

export type AjioListingSummary = {
  sourceUrl: string;
  name: string;
  brand: string;
  price: string;
  imageUrl: string;
};

function httpsify(url: string): string {
  if (!url) return "";
  return url.trim().replace(/^http:\/\//i, "https://");
}

function priceFromAjioProduct(r: Record<string, unknown>): string {
  const offer = r.offerPrice as Record<string, unknown> | undefined;
  if (offer && typeof offer.displayformattedValue === "string") {
    return offer.displayformattedValue.trim();
  }
  const price = r.price as Record<string, unknown> | undefined;
  if (price && typeof price.displayformattedValue === "string") {
    return price.displayformattedValue.trim();
  }
  if (price && typeof price.formattedValue === "string") {
    return price.formattedValue.trim();
  }
  return "";
}

function brandFromAjioProduct(r: Record<string, unknown>): string {
  const fnl = r.fnlColorVariantData as Record<string, unknown> | undefined;
  if (fnl && typeof fnl.brandName === "string") return fnl.brandName.trim();
  if (typeof r.brandName === "string") return r.brandName.trim();
  if (typeof r.brandTypeName === "string") return r.brandTypeName.trim();
  return "";
}

function firstHttpsString(v: unknown): string {
  if (typeof v !== "string" || !/^https?:\/\//i.test(v)) return "";
  return httpsify(v);
}

function imageFromAjioProduct(r: Record<string, unknown>): string {
  const direct = firstHttpsString(r.image) || firstHttpsString(r.thumbnailImage);
  if (direct) return direct;

  const images = r.images as unknown;
  if (Array.isArray(images) && images.length > 0) {
    const el = images[0];
    if (typeof el === "string") {
      const u = firstHttpsString(el);
      if (u) return u;
    }
    if (el && typeof el === "object" && typeof (el as { url?: string }).url === "string") {
      return httpsify((el as { url: string }).url);
    }
  }

  const fnl = r.fnlColorVariantData;
  if (fnl && typeof fnl === "object") {
    for (const v of Object.values(fnl as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const nested = v as { images?: { url?: string }[]; image?: string };
      if (Array.isArray(nested.images) && typeof nested.images[0]?.url === "string") {
        return httpsify(nested.images[0].url);
      }
      const u = firstHttpsString(nested.image);
      if (u) return u;
    }
  }

  return "";
}

/** PRELOADED_STATE may use relative paths or full https://www.ajio.com/... URLs. */
function normalizeAjioListingPath(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      if (!u.hostname.toLowerCase().includes("ajio.com")) return null;
      const p = u.pathname || "/";
      return (p.startsWith("/") ? p : `/${p}`).split("?")[0] ?? p;
    } catch {
      return null;
    }
  }
  if (t.startsWith("/")) return t.split("?")[0] ?? t;
  return null;
}

/** Slug may contain hyphens, underscores, or trailing hyphen before `/p/`. */
const AJIO_PDP_PATH_RE = /^\/[a-z0-9][a-z0-9\-_/]{0,320}\/p\/[a-z0-9_]+$/i;

function titleFromAjioProduct(
  r: Record<string, unknown>,
  pathOnly: string,
): string {
  const fromFields =
    (typeof r.name === "string" && r.name.trim()) ||
    (typeof r.productName === "string" && r.productName.trim()) ||
    (typeof r.displayName === "string" && r.displayName.trim()) ||
    (typeof r.title === "string" && r.title.trim()) ||
    "";
  if (fromFields) return fromFields;
  const seg = pathOnly.split("/").filter(Boolean)[0] ?? "";
  if (!seg) return "";
  return seg
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function tryPushAjioProduct(
  r: Record<string, unknown>,
  out: AjioListingSummary[],
  seen: Set<string>,
  limit: number,
): void {
  if (out.length >= limit) return;
  const url = r.url;
  if (typeof url !== "string") return;
  const pathOnly = normalizeAjioListingPath(url);
  if (!pathOnly || !AJIO_PDP_PATH_RE.test(pathOnly)) return;

  const name = titleFromAjioProduct(r, pathOnly);
  if (!name) return;

  const fullUrl = `${AJIO_ORIGIN}${pathOnly}`;
  const key = fullUrl.toLowerCase().split("?")[0] ?? fullUrl.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);

  out.push({
    sourceUrl: fullUrl,
    name,
    brand: brandFromAjioProduct(r),
    price: priceFromAjioProduct(r),
    imageUrl: imageFromAjioProduct(r),
  });
}

/**
 * When PRELOADED_STATE walk misses rows but the HTML still embeds PDP paths (regex),
 * build minimal listing rows so catalog RAG works without PDP HTML (often 403).
 */
export function ajioListingSummariesFromPdpUrls(
  urls: string[],
  limit?: number,
): AjioListingSummary[] {
  const cap = limit ?? 40;
  const out: AjioListingSummary[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    if (out.length >= cap) break;
    const pathOnly = normalizeAjioListingPath(raw);
    if (!pathOnly || !AJIO_PDP_PATH_RE.test(pathOnly)) continue;
    const fullUrl = httpsify(`${AJIO_ORIGIN}${pathOnly}`);
    const key = fullUrl.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const name = titleFromAjioProduct({}, pathOnly) || "Product";
    out.push({
      sourceUrl: fullUrl,
      name,
      brand: "",
      price: "",
      imageUrl: "",
    });
  }
  return out;
}

/** `/p/469756970_navy` → match keys appearing in Ajio asset filenames. */
function ajioImageMatchKeysFromPdpUrl(url: string): string[] {
  try {
    const path = new URL(url).pathname;
    const m = path.match(/\/p\/([a-z0-9_]+)\/?$/i);
    if (!m?.[1]) return [];
    const full = m[1].toLowerCase();
    const keys = new Set<string>([full]);
    const parts = full.split("_");
    if (parts.length >= 2 && parts[0]) {
      keys.add(`${parts[0]}-${parts.slice(1).join("-")}`);
      keys.add(parts[0]);
    }
    return [...keys];
  } catch {
    return [];
  }
}

function scrapeAjioProductImageUrlsFromSearchHtml(html: string): string[] {
  const patterns = [
    /https:\/\/assets\.ajio\.com\/medias\/sys_master\/[^"'\\\s<>]+?\.(?:jpg|jpeg|webp|png)/gi,
    /https:\/\/assets-jiocdn\.ajio\.com\/[^"'\\\s<>]*medias\/sys_master\/[^"'\\\s<>]+?\.(?:jpg|jpeg|webp|png)/gi,
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const u = httpsify(m[0]);
      if (!seen.has(u)) {
        seen.add(u);
        out.push(u);
      }
    }
  }
  return out;
}

/**
 * Fills `imageUrl` on listing rows using embedded product shots in search HTML
 * (needed when PDP fetch is blocked or regex-only fallback rows were built).
 */
export function enrichAjioListingSummariesWithImagesFromHtml(
  html: string,
  summaries: AjioListingSummary[],
): void {
  if (!html.trim() || summaries.length === 0) return;
  const candidates = scrapeAjioProductImageUrlsFromSearchHtml(html);
  if (candidates.length === 0) return;

  for (const s of summaries) {
    if (s.imageUrl) continue;
    const keys = ajioImageMatchKeysFromPdpUrl(s.sourceUrl);
    if (keys.length === 0) continue;
    const lowerKeys = keys.map((k) => k.toLowerCase());
    const hit = candidates.find((u) => {
      const low = u.toLowerCase();
      return lowerKeys.some((k) => low.includes(k));
    });
    if (hit) s.imageUrl = hit;
  }
}

function walkAjioState(node: unknown, out: AjioListingSummary[], seen: Set<string>, limit: number, depth: number): void {
  if (out.length >= limit || depth > 24) return;
  if (!node || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const item of node) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        tryPushAjioProduct(item as Record<string, unknown>, out, seen, limit);
      }
      walkAjioState(item, out, seen, limit, depth + 1);
      if (out.length >= limit) return;
    }
    return;
  }

  for (const v of Object.values(node as object)) {
    walkAjioState(v, out, seen, limit, depth + 1);
    if (out.length >= limit) return;
  }
}

export function extractAjioListingSummariesFromSearchHtml(
  html: string,
  opts?: { limit?: number },
): AjioListingSummary[] {
  const limit = opts?.limit ?? 36;
  const out: AjioListingSummary[] = [];
  const seen = new Set<string>();

  const state = parseScriptJsonFromPrefixes<unknown>(html, [
    "window.__PRELOADED_STATE__ = ",
    "window.__PRELOADED_STATE__=",
    "window['__PRELOADED_STATE__'] = ",
    'window["__PRELOADED_STATE__"] = ',
  ]);
  if (state) {
    walkAjioState(state, out, seen, limit, 0);
  }

  const slice = out.slice(0, limit);
  enrichAjioListingSummariesWithImagesFromHtml(html, slice);
  return slice;
}
