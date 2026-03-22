import { createHash } from "crypto";
import { unstable_cache } from "next/cache";
import { canonicalizeProductUrl } from "@/lib/product/canonicalize-product-url";
import { decodeHtmlEntities } from "@/lib/text/decode-html-entities";
import { fetchMeeshoSearchSummaries } from "@/lib/scraper/retailer-catalog/meesho-search";
import { fetchMyntraGatewayProductSummaries } from "@/lib/scraper/retailer-catalog/myntra-gateway";

/** Fixed listing seeds — apparel-focused for landing grid. */
const SEED_QUERIES = ["tshirts", "dresses", "jeans"] as const;
const PER_SEED_LIMIT = 14;
const MAX_ITEMS = 24;
/** First N rows in the merged list are labeled sponsored (deterministic). */
const SPONSORED_COUNT = 3;
const FETCH_TIMEOUT_MS = 12_000;

export type FeaturedProductRow = {
  id: string;
  title: string;
  brand: string;
  price: string;
  imageUrl: string;
  sourceUrl: string;
  retailer: string;
  sponsored: boolean;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Featured products fetch timed out")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function safeMyntra(query: string) {
  try {
    return await withTimeout(
      fetchMyntraGatewayProductSummaries(query, { limit: PER_SEED_LIMIT }),
      FETCH_TIMEOUT_MS,
    );
  } catch {
    return [];
  }
}

async function safeMeesho(query: string) {
  try {
    return await withTimeout(
      fetchMeeshoSearchSummaries(query, {
        limit: PER_SEED_LIMIT,
        maxPage: 1,
      }),
      FETCH_TIMEOUT_MS,
    );
  } catch {
    return [];
  }
}

function retailerLabel(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("myntra.com")) return "myntra";
  if (lower.includes("meesho.com")) return "meesho";
  if (lower.includes("ajio.com")) return "ajio";
  return "web";
}

function rowFromSummary(
  s: {
    sourceUrl: string;
    title: string;
    brand: string;
    price: string;
    imageUrl: string;
  },
  retailer: string,
): FeaturedProductRow | null {
  const normalizedUrl = canonicalizeProductUrl(s.sourceUrl);
  if (!normalizedUrl || !s.imageUrl?.trim()) return null;
  const id = createHash("sha1").update(normalizedUrl).digest("hex");
  return {
    id,
    title: decodeHtmlEntities(s.title).trim() || "Product",
    brand: decodeHtmlEntities(s.brand).trim(),
    price: decodeHtmlEntities(s.price).trim(),
    imageUrl: s.imageUrl.trim(),
    sourceUrl: normalizedUrl,
    retailer,
    sponsored: false,
  };
}

/**
 * Fetches public listing rows from Myntra + Meesho (no auth, no PDP HTML).
 */
export async function fetchFeaturedProductsUncached(): Promise<FeaturedProductRow[]> {
  const myntraLists = await Promise.all(
    [...SEED_QUERIES].map((q) => safeMyntra(q)),
  );
  const meeshoLists = await Promise.all(
    [...SEED_QUERIES].map((q) => safeMeesho(q)),
  );

  const myntraRows = myntraLists.flat();
  const meeshoRows = meeshoLists.flat();

  const byKey = new Map<string, FeaturedProductRow>();

  const tryAdd = (row: FeaturedProductRow | null) => {
    if (!row) return;
    const k = row.sourceUrl.toLowerCase();
    if (byKey.has(k)) return;
    byKey.set(k, row);
  };

  const maxLen = Math.max(myntraRows.length, meeshoRows.length);
  for (let i = 0; i < maxLen; i++) {
    const m = myntraRows[i];
    if (m) tryAdd(rowFromSummary(m, "myntra"));
    const e = meeshoRows[i];
    if (e) tryAdd(rowFromSummary(e, "meesho"));
  }

  const merged = [...byKey.values()].slice(0, MAX_ITEMS);
  return merged.map((item, index) => ({
    ...item,
    sponsored: index < SPONSORED_COUNT,
  }));
}

export const getCachedFeaturedProducts = unstable_cache(
  async () => fetchFeaturedProductsUncached(),
  ["public-featured-products-v1"],
  { revalidate: 300 },
);

export async function getFeaturedProductById(
  id: string,
): Promise<FeaturedProductRow | null> {
  const trimmed = id.trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/i.test(trimmed)) return null;
  const items = await getCachedFeaturedProducts();
  return items.find((p) => p.id.toLowerCase() === trimmed) ?? null;
}
