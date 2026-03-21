/**
 * Myntra listing JSON from GET /gateway/v4/search/{slug}?...
 * @see myntra format file.txt — products include landingPageUrl, product, brand, price, mrp, images.
 */

const MYNTRA_ORIGIN = "https://www.myntra.com";

export type MyntraListingSummary = {
  sourceUrl: string;
  title: string;
  brand: string;
  price: string;
  imageUrl: string;
  genderTarget?: string;
  category?: string;
};

function slugFromSearchQuery(query: string): string {
  const s = query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return (s.length > 0 ? s : "tshirts").slice(0, 96);
}

function slugFallbacks(query: string): string[] {
  const primary = slugFromSearchQuery(query);
  const words =
    query
      .trim()
      .toLowerCase()
      .match(/[a-z0-9]{3,}/g) ?? [];
  const variants = [primary];
  if (words.length >= 2) {
    variants.push(`${words[0]}-${words[1]}`.slice(0, 96));
  }
  return [...new Set(variants)].slice(0, 3);
}

function httpsify(url: string): string {
  if (!url) return "";
  return url.trim().replace(/^http:\/\//i, "https://");
}

function formatInr(n: number): string {
  if (!Number.isFinite(n)) return "";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function collectMyntraListingProducts(
  node: unknown,
  out: MyntraListingSummary[],
  seen: Set<string>,
  limit: number,
): void {
  if (out.length >= limit || node === null || node === undefined) return;

  if (Array.isArray(node)) {
    for (const item of node) {
      collectMyntraListingProducts(item, out, seen, limit);
      if (out.length >= limit) return;
    }
    return;
  }

  if (typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  const lp = o.landingPageUrl;

  if (typeof lp === "string" && /\/\d{5,}\/buy\/?$/i.test(lp)) {
    const path = lp.trim();
    const sourceUrl = path.startsWith("http")
      ? httpsify(path)
      : `${MYNTRA_ORIGIN}/${path.replace(/^\/+/, "")}`;
    const key = sourceUrl.toLowerCase();
    if (!seen.has(key)) {
      const title =
        (typeof o.product === "string" ? o.product : "") ||
        (typeof o.productName === "string" ? o.productName : "") ||
        "";
      let brand = "";
      if (typeof o.brand === "string") brand = o.brand;
      else if (o.brand && typeof o.brand === "object") {
        const bn = (o.brand as { name?: string }).name;
        if (typeof bn === "string") brand = bn;
      }
      const priceN = typeof o.price === "number" ? o.price : undefined;
      const mrpN = typeof o.mrp === "number" ? o.mrp : undefined;
      let priceStr = "";
      if (priceN != null && Number.isFinite(priceN)) {
        priceStr =
          mrpN != null && Number.isFinite(mrpN) && mrpN > priceN
            ? `${formatInr(priceN)} (MRP ${formatInr(mrpN)})`
            : formatInr(priceN);
      }
      let imageUrl = "";
      if (typeof o.searchImage === "string") imageUrl = httpsify(o.searchImage);
      else if (typeof o.image === "string") imageUrl = httpsify(o.image);
      else if (typeof o.thumbnail === "string") imageUrl = httpsify(o.thumbnail);
      else if (Array.isArray(o.images) && o.images.length > 0) {
        const first = o.images[0] as { src?: string; url?: string } | string;
        if (typeof first === "string") imageUrl = httpsify(first);
        else if (typeof first?.src === "string") imageUrl = httpsify(first.src);
        else if (typeof first?.url === "string") imageUrl = httpsify(first.url);
      }
      const genderTarget = typeof o.gender === "string" ? o.gender : undefined;
      const category =
        typeof o.category === "string"
          ? o.category
          : typeof o.masterCategory === "object" &&
            o.masterCategory &&
            typeof (o.masterCategory as { typeName?: string }).typeName === "string"
            ? (o.masterCategory as { typeName: string }).typeName
            : undefined;

      if (title.trim()) {
        seen.add(key);
        out.push({
          sourceUrl,
          title: title.trim(),
          brand,
          price: priceStr,
          imageUrl,
          genderTarget,
          category,
        });
      }
    }
  }

  for (const v of Object.values(o)) {
    collectMyntraListingProducts(v, out, seen, limit);
    if (out.length >= limit) return;
  }
}

async function fetchMyntraGatewayJsonForSlug(
  slug: string,
  rowLimit: number,
): Promise<unknown | null> {
  const params = new URLSearchParams({
    rows: String(Math.min(rowLimit, 50)),
    o: "0",
    p: "1",
    plaEnabled: "true",
    xdEnabled: "false",
    isFacet: "false",
  });
  const url = `${MYNTRA_ORIGIN}/gateway/v4/search/${encodeURIComponent(slug)}?${params}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18_000);
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        accept: "application/json,text/plain,*/*;q=0.8",
        "accept-language": "en-IN,en;q=0.9",
        referer: `${MYNTRA_ORIGIN}/`,
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.trim()) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Rich listing rows — no PDP HTML fetch required. */
export async function fetchMyntraGatewayProductSummaries(
  query: string,
  opts?: { limit?: number },
): Promise<MyntraListingSummary[]> {
  const limit = opts?.limit ?? 40;
  const slugs = slugFallbacks(query);
  const out: MyntraListingSummary[] = [];
  const seen = new Set<string>();

  for (const slug of slugs) {
    const data = await fetchMyntraGatewayJsonForSlug(slug, limit);
    if (!data) continue;
    collectMyntraListingProducts(data, out, seen, limit);
    if (out.length >= limit) break;
  }

  return out.slice(0, limit);
}

export async function fetchMyntraGatewayPdpUrls(
  query: string,
  opts?: { limit?: number },
): Promise<string[]> {
  const summaries = await fetchMyntraGatewayProductSummaries(query, opts);
  return summaries.map((s) => s.sourceUrl);
}
