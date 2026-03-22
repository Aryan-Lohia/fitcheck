/**
 * Meesho text search via official JSON API (same endpoint the site uses).
 * @see POST https://www.meesho.com/api/v1/products/search
 *
 * Env: `MEESHO_SEARCH_API` — set to `0`, `false`, or `off` to disable calls (default: enabled).
 */

import { logger } from "@/lib/logger";

const MEESHO_ORIGIN = "https://www.meesho.com";
const SEARCH_URL = `${MEESHO_ORIGIN}/api/v1/products/search`;

export type MeeshoListingSummary = {
  sourceUrl: string;
  title: string;
  brand: string;
  price: string;
  imageUrl: string;
  category?: string;
};

function meeshoSearchApiEnabled(): boolean {
  const v = process.env.MEESHO_SEARCH_API?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  return true;
}

function httpsify(url: string): string {
  const u = url.trim();
  if (!u) return "";
  if (u.startsWith("//")) return `https:${u}`;
  if (u.startsWith("/")) return `${MEESHO_ORIGIN}${u}`;
  return u.replace(/^http:\/\//i, "https://");
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function catalogIdString(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "number" && Number.isFinite(raw)) return String(Math.trunc(raw));
  if (typeof raw === "string") {
    const t = raw.trim();
    if (/^[a-z0-9_-]+$/i.test(t) && t.length >= 3) return t;
  }
  return "";
}

function formatPriceFromObject(o: Record<string, unknown>): string {
  const candidates = [
    o.price,
    o.low_price,
    o.lowest_price,
    o.final_price,
    o.discounted_price,
    o.selling_price,
    o.mrp,
    o.min_price,
    o.max_price,
  ];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c) && c > 0) {
      return `₹${Math.round(c).toLocaleString("en-IN")}`;
    }
    if (typeof c === "string" && c.trim()) {
      const t = c.trim();
      if (/^[\d.,\s₹$]+$/.test(t) || t.includes("₹")) return t;
    }
  }
  const nested = o.price_fields;
  if (nested && typeof nested === "object") {
    return formatPriceFromObject(nested as Record<string, unknown>);
  }
  return "";
}

function firstImageFromObject(o: Record<string, unknown>): string {
  const direct = pickString(o, ["image", "thumbnail", "hero_image", "primary_image", "catalog_image"]);
  if (direct) return httpsify(direct);

  const arrays = [o.images, o.catalog_images, o.product_images, o.media, o.gallery];
  for (const arr of arrays) {
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const first = arr[0];
    if (typeof first === "string" && first.trim()) return httpsify(first);
    if (first && typeof first === "object") {
      const u = pickString(first as Record<string, unknown>, [
        "url",
        "src",
        "image",
        "imageUrl",
        "link",
      ]);
      if (u) return httpsify(u);
    }
  }
  return "";
}

function normalizeMeeshoPdpUrl(raw: string): string {
  try {
    const u = new URL(raw.startsWith("http") ? raw : `${MEESHO_ORIGIN}${raw}`);
    if (!u.hostname.toLowerCase().includes("meesho.com")) return "";
    const path = u.pathname.replace(/\/+$/, "");
    if (/\/pl\//i.test(path)) return "";
    if (path.includes("/product/") || /\/p\/[a-z0-9_-]+$/i.test(path)) {
      return `${MEESHO_ORIGIN}${path}`;
    }
  } catch {
    /* ignore */
  }
  return "";
}

function tryRowToSummary(
  o: Record<string, unknown>,
  seen: Set<string>,
): MeeshoListingSummary | null {
  const title = pickString(o, [
    "name",
    "product_name",
    "title",
    "catalog_name",
    "productName",
    "display_name",
  ]);
  if (!title) return null;

  const slug = pickString(o, ["slug", "seo_slug", "url_slug", "product_slug", "permalink"]).replace(
    /^\/+|\/+$/g,
    "",
  );
  const cid = catalogIdString(
    o.catalog_id ?? o.catalogId ?? o.product_id ?? o.productId ?? o.pid,
  );

  let sourceUrl = "";
  const link = pickString(o, ["link", "url", "product_url", "deeplink", "share_url", "canonical_url"]);
  if (link) {
    const normalized = normalizeMeeshoPdpUrl(link);
    if (normalized) sourceUrl = normalized;
  }
  if (!sourceUrl && slug && cid) {
    sourceUrl = `${MEESHO_ORIGIN}/${slug}/p/${cid}`;
  }
  if (!sourceUrl) return null;

  const key = sourceUrl.toLowerCase();
  if (seen.has(key)) return null;
  seen.add(key);

  return {
    sourceUrl,
    title,
    brand: pickString(o, ["brand", "brand_name", "supplier_name"]),
    price: formatPriceFromObject(o),
    imageUrl: firstImageFromObject(o),
    category: pickString(o, ["category", "category_name", "vertical", "department"]),
  };
}

const MAX_JSON_WALK_NODES = 8000;

function walkAndCollect(node: unknown, out: MeeshoListingSummary[], seen: Set<string>, state: { n: number }) {
  if (state.n > MAX_JSON_WALK_NODES) return;
  state.n += 1;

  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const x of node) walkAndCollect(x, out, seen, state);
    return;
  }
  if (typeof node !== "object") return;

  const o = node as Record<string, unknown>;
  const row = tryRowToSummary(o, seen);
  if (row) out.push(row);

  for (const v of Object.values(o)) walkAndCollect(v, out, seen, state);
}

function parseSearchResponse(json: unknown, limit: number): MeeshoListingSummary[] {
  const seen = new Set<string>();
  const out: MeeshoListingSummary[] = [];
  const state = { n: 0 };
  walkAndCollect(json, out, seen, state);
  return out.slice(0, limit);
}

export type MeeshoSearchOpts = {
  limit?: number;
  /** Extra pages (1-based). Page 1 is always fetched. */
  maxPage?: number;
};

/**
 * Returns listing rows suitable for live shop cards. Empty if API blocked or shape unknown.
 */
export async function fetchMeeshoSearchSummaries(
  query: string,
  opts?: MeeshoSearchOpts,
): Promise<MeeshoListingSummary[]> {
  if (!meeshoSearchApiEnabled()) return [];

  const q = query.trim().replace(/\s+/g, " ");
  if (q.length < 2) return [];

  const perPageLimit = Math.min(Math.max(opts?.limit ?? 24, 8), 40);
  const maxPage = Math.min(Math.max(opts?.maxPage ?? 2, 1), 3);
  const referer = `${MEESHO_ORIGIN}/search?q=${encodeURIComponent(q)}`;

  const all: MeeshoListingSummary[] = [];
  const seen = new Set<string>();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 16_000);

  try {
    for (let page = 1; page <= maxPage; page++) {
      const offset = (page - 1) * perPageLimit;
      const body = {
        query: q,
        type: "text_search",
        page,
        offset,
        limit: perPageLimit,
        selected_filters: [] as string[],
        selectedFilterIds: [] as number[],
        cursor: null as string | null,
        search_session_id: null as string | null,
        sort_option: null as string | null,
      };

      const res = await fetch(SEARCH_URL, {
        method: "POST",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          accept: "application/json, text/plain, */*",
          "accept-language": "en-IN,en;q=0.9",
          "content-type": "application/json",
          origin: MEESHO_ORIGIN,
          referer,
          "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
          "sec-ch-ua-mobile": "?0",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      if (!res.ok) {
        logger.warn("Meesho search API non-OK", {
          status: res.status,
          queryPreview: q.slice(0, 80),
          bodyPreview: text.slice(0, 120),
        });
        break;
      }

      if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) {
        logger.warn("Meesho search API returned non-JSON", {
          queryPreview: q.slice(0, 80),
          preview: text.slice(0, 160),
        });
        break;
      }

      let json: unknown;
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        logger.warn("Meesho search API JSON parse failed", { queryPreview: q.slice(0, 80) });
        break;
      }

      const batch = parseSearchResponse(json, perPageLimit + 10);
      for (const row of batch) {
        const k = row.sourceUrl.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        all.push(row);
        if (all.length >= perPageLimit * maxPage) break;
      }

      if (batch.length === 0) break;
      if (all.length >= perPageLimit * maxPage) break;
    }
  } catch (e) {
    logger.warn("Meesho search API request failed", {
      queryPreview: q.slice(0, 80),
      error: e instanceof Error ? e.message : String(e),
    });
  } finally {
    clearTimeout(timer);
  }

  return all.slice(0, perPageLimit * maxPage);
}
