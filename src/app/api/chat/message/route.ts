import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { buildWizardProfileContext, buildChatPrompt } from "@/lib/ai/prompts";
import { getGeminiChatModel, getGeminiModel } from "@/lib/ai/client";
import { fetchRemoteImageAsBase64 } from "@/lib/ai/remote-image-base64";
import { generatePresignedDownloadUrl } from "@/lib/s3/presign";
import {
  trimHistory,
  estimateTokens,
  MAX_CONTEXT_TOKENS,
} from "@/lib/ai/token-budget";
import { buildCacheKey, getCache, setCache } from "@/lib/ai/cache";
import { logAiUsage } from "@/lib/usage/meter";
import { ok, fail } from "@/lib/http";
import { logger } from "@/lib/logger";
import { decodeHtmlEntities } from "@/lib/text/decode-html-entities";
import { fetchPageHtml } from "@/lib/scraper/fetcher";
import { extractAjioPdpUrlsFromSearchHtml } from "@/lib/scraper/ajio-search-extract";
import {
  ajioListingSummariesFromPdpUrls,
  enrichAjioListingSummariesWithImagesFromHtml,
  extractAjioListingSummariesFromSearchHtml,
} from "@/lib/scraper/ajio-plp-extract";
import { fetchMyntraGatewayProductSummaries } from "@/lib/scraper/retailer-catalog/myntra-gateway";
import { detectDomainType } from "@/lib/scraper/router";
import { normalizeProduct } from "@/lib/scraper/normalizer";
import { extract as genericExtract } from "@/lib/scraper/adapters/genericAdapter";
import { extract as shopifyExtract } from "@/lib/scraper/adapters/shopifyAdapter";
import { extract as woocommerceExtract } from "@/lib/scraper/adapters/woocommerceAdapter";
import { extract as myntraExtract } from "@/lib/scraper/adapters/myntraAdapter";
import { extract as meeshoExtract } from "@/lib/scraper/adapters/meeshoAdapter";
import { extract as ajioExtract } from "@/lib/scraper/adapters/ajioAdapter";
import type { RawProductData } from "@/lib/scraper/adapters/types";

/** Prefix for grep: `catalog-rag` */
const CATALOG_DBG = "catalog-rag";

interface AiResponse {
  answer: string;
  confidence: number;
  reasons: string[];
  suggestedActions: string[];
}

interface ProductCard {
  id: string;
  title: string;
  brand: string;
  price: string;
  imageUrl: string;
  sourceUrl: string;
  rating?: string;
  reviewCount?: string;
  sizes?: string;
  colors?: string;
  material?: string;
  fitType?: string;
  measurements?: string;
  imageRefs?: string;
  category?: string;
  genderTarget?: string;
  /** myntra | ajio | meesho — helps the model reason about retailer */
  retailer?: "myntra" | "ajio" | "meesho";
  /** Normalized parser confidence 0–1 (richer PDPs rank higher in retrieval) */
  parserConfidence?: number;
}

interface RetrievalDecision {
  useProductRetrieval: boolean;
  query: string;
}

interface ThinkingMeta {
  mode: "complex" | "normal";
  retrievalEnabled: boolean;
  retrievalQuery: string;
  importedMatches: number;
  liveMatches: number;
  finalProducts: number;
  usedCache: boolean;
  confidence: number;
  /** User explicitly enabled suggested picks for this turn */
  suggestedPicksRequested?: boolean;
  /** Vault / upload images included in this turn */
  attachmentCount?: number;
  visionEnabled?: boolean;
}

function hasShoppingIntent(text: string): boolean {
  const lower = text.toLowerCase();
  const terms = [
    "buy",
    "shop",
    "shopping",
    "recommend",
    "suggest",
    "options",
    "best",
    "shirt",
    "tshirt",
    "jeans",
    "jacket",
    "kurta",
    "dress",
    "top",
    "hoodie",
    "outfit",
  ];
  return terms.some((term) => lower.includes(term));
}

function tokenizeQuery(text: string): string[] {
  const stopWords = new Set([
    "for",
    "the",
    "and",
    "with",
    "that",
    "this",
    "from",
    "show",
    "give",
    "best",
    "good",
    "please",
    "need",
    "want",
    "find",
    "buy",
    "shop",
  ]);
  return text
    .toLowerCase()
    .split(/[^a-z0-9#]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !stopWords.has(t));
}

function scoreLinkAgainstQuery(url: string, terms: string[]): number {
  const lower = url.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (lower.includes(term)) score += 3;
  }
  if (isLikelyProductUrl(lower)) score += 2;
  return score;
}

function siteKeyFromUrl(url: string): "myntra" | "ajio" | "meesho" | "other" {
  const lower = url.toLowerCase();
  if (lower.includes("myntra.com")) return "myntra";
  if (lower.includes("ajio.com")) return "ajio";
  if (lower.includes("meesho.com")) return "meesho";
  return "other";
}

const FALLBACK_RESPONSE: AiResponse = {
  answer:
    "I'm having trouble processing your request right now. Please try again in a moment.",
  confidence: 0,
  reasons: ["AI service temporarily unavailable"],
  suggestedActions: ["Try Again", "Book Expert"],
};

function parseRetrievalDecision(raw: string): RetrievalDecision {
  const text = raw.trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { useProductRetrieval: false, query: "" };

  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    return {
      useProductRetrieval: parsed.useProductRetrieval === true,
      query: typeof parsed.query === "string" ? parsed.query.trim() : "",
    };
  } catch {
    return { useProductRetrieval: false, query: "" };
  }
}

function routeToAdapter(domainType: string, html: string): RawProductData {
  switch (domainType) {
    case "shopify":
      return shopifyExtract(html);
    case "woocommerce":
      return woocommerceExtract(html);
    case "myntra-like":
      return myntraExtract(html);
    case "meesho-like":
      return meeshoExtract(html);
    case "ajio-like":
      return ajioExtract(html);
    default:
      return genericExtract(html);
  }
}

function normalizeActionLabel(action: string): string {
  const cleaned = decodeHtmlEntities(action).replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const words = cleaned.split(" ").filter(Boolean);
  return words.slice(0, 5).join(" ");
}

function normalizeSuggestedActions(actions: string[]): string[] {
  const compact = actions
    .map(normalizeActionLabel)
    .filter(Boolean)
    .slice(0, 4);
  const unique: string[] = [];
  for (const action of compact) {
    if (!unique.some((x) => x.toLowerCase() === action.toLowerCase())) {
      unique.push(action);
    }
  }
  return unique.length > 0
    ? unique
    : ["Show top picks", "Find better fit", "Compare with wardrobe"];
}

function productContextSummary(product: ProductCard): string {
  const lines = [
    `- ${product.title}`,
    product.retailer ? `retailer: ${product.retailer}` : "",
    product.brand ? `brand: ${product.brand}` : "",
    product.category ? `category: ${product.category}` : "",
    product.genderTarget ? `gender: ${product.genderTarget}` : "",
    product.price ? `price: ${product.price}` : "",
    product.rating ? `rating: ${product.rating}` : "",
    product.reviewCount ? `reviews: ${product.reviewCount}` : "",
    product.sizes ? `sizes: ${product.sizes}` : "",
    product.colors ? `colors: ${product.colors}` : "",
    product.material ? `material: ${product.material}` : "",
    product.fitType ? `fit: ${product.fitType}` : "",
    product.measurements ? `measurements: ${product.measurements}` : "",
    product.imageRefs ? `images: ${product.imageRefs}` : "",
    product.parserConfidence != null
      ? `data_confidence: ${product.parserConfidence.toFixed(2)}`
      : "",
    `url: ${product.sourceUrl}`,
  ].filter(Boolean);
  return lines.join("\n");
}

function enrichRetrievalQuery(
  rawQuery: string,
  wizardProfileContext: string,
): string {
  let q = rawQuery.trim().replace(/\s+/g, " ");
  if (!q) return q;
  const lower = q.toLowerCase();

  const genderMatch = wizardProfileContext.match(/Gender:\s*([^.]+)\./i);
  const gender = genderMatch?.[1]?.trim().toLowerCase();
  if (
    gender &&
    gender.length >= 3 &&
    !lower.includes(gender) &&
    !/(^|\s)(men|women|man|woman|male|female|unisex)(\s|$)/i.test(lower)
  ) {
    q = `${q} ${gender}`.trim();
  }

  const fitMatch = wizardProfileContext.match(
    /Preferred fit \(wizard\):\s*([^.]+)\./i,
  );
  const fit = fitMatch?.[1]?.trim().toLowerCase();
  if (
    fit &&
    fit.length >= 3 &&
    fit !== "regular" &&
    !lower.includes(fit) &&
    !/(slim|relaxed|oversized|tailored|loose)/i.test(lower)
  ) {
    q = `${q} ${fit} fit`.trim();
  }

  return q.slice(0, 220);
}

/** Lighter variants for listing APIs (avoid over-specific slugs that return zero rows). */
function listingQueryVariants(primary: string): string[] {
  const p = primary.trim().replace(/\s+/g, " ");
  if (!p) return [];
  const variants: string[] = [p];
  const noFitTail = p.replace(/\s+(fit|fits)\s*$/i, "").trim();
  if (noFitTail.length >= 3 && noFitTail !== p) variants.push(noFitTail);
  const words = p
    .split(/\s+/)
    .filter((w) => w.length > 1 && !/^(the|and|for|with|buy|shop)$/i.test(w))
    .slice(0, 6)
    .join(" ");
  if (words.length >= 3 && words !== p) variants.push(words);
  return [...new Set(variants)].slice(0, 4);
}

async function ensureBroadFallbackListings(
  products: ProductCard[],
  pushCard: (c: ProductCard) => void,
  minTarget: number,
): Promise<void> {
  if (products.length >= minTarget) return;
  const slugs = [
    "tshirts",
    "men-tshirts",
    "shirts",
    "jeans",
    "kurta",
    "dresses",
  ];
  for (const slug of slugs) {
    if (products.length >= minTarget) break;
    try {
      const batch = await fetchMyntraGatewayProductSummaries(slug, { limit: 14 });
      for (const s of batch) {
        const normalizedUrl = canonicalizeProductUrl(s.sourceUrl);
        pushCard({
          id: createHash("sha1").update(normalizedUrl).digest("hex"),
          title: decodeHtmlEntities(s.title),
          brand: decodeHtmlEntities(s.brand),
          price: decodeHtmlEntities(s.price),
          imageUrl: s.imageUrl,
          sourceUrl: normalizedUrl,
          category: s.category,
          genderTarget: s.genderTarget,
          retailer: "myntra",
          parserConfidence: 0.45,
        });
      }
    } catch {
      /* ignore */
    }
  }
  if (products.length < minTarget) {
    for (const text of ["shirt", "tshirt", "jeans"]) {
      if (products.length >= minTarget) break;
      try {
        const h = await fetchPageHtml(
          `https://www.ajio.com/search/?text=${encodeURIComponent(text)}`,
        );
        const aj = extractAjioListingSummariesFromSearchHtml(h, { limit: 14 });
        for (const s of aj) {
          const normalizedUrl = canonicalizeProductUrl(s.sourceUrl);
          pushCard({
            id: createHash("sha1").update(normalizedUrl).digest("hex"),
            title: decodeHtmlEntities(s.name),
            brand: decodeHtmlEntities(s.brand),
            price: decodeHtmlEntities(s.price),
            imageUrl: s.imageUrl,
            sourceUrl: normalizedUrl,
            retailer: "ajio",
            parserConfidence: 0.45,
          });
        }
      } catch {
        /* ignore */
      }
    }
  }
}

async function decideWhetherToRetrieveProducts(params: {
  message: string;
  wizardProfileContext: string;
  history: Array<{ role: string; text: string }>;
}): Promise<RetrievalDecision> {
  const latestTurns = params.history.slice(-4);
  const decisionPrompt = [
    "You are a routing assistant for a fashion chat with live catalog search (Myntra, Ajio, Meesho).",
    "Decide if product retrieval is needed for the user's latest message.",
    "Use retrieval when the user wants product ideas, links, shopping options, what to buy, or store-specific picks.",
    "Skip retrieval for pure theory, small talk, profile wizard setup only, or non-shopping topics.",
    "",
    "When useProductRetrieval is true, set `query` to a SHORT web-search phrase (3–12 words), not a full sentence:",
    "- Include garment type, color, style, occasion keywords as appropriate.",
    "- Include gender or fit words if they matter for the request.",
    "- No question marks, no \"I want\", no filler — keyword-style (e.g. \"men slim fit black casual shirt\").",
    "",
    "User profile (ProfileWizard context):",
    params.wizardProfileContext,
    "Recent conversation:",
    ...latestTurns.map((m) => `${m.role}: ${m.text}`),
    `Latest user message: ${params.message}`,
    'Respond with valid JSON only: { "useProductRetrieval": boolean, "query": string }',
  ].join("\n");

  try {
    const model = getGeminiModel(false);
    const result = await model.generateContent(decisionPrompt);
    const raw = result.response.text() || "";
    return parseRetrievalDecision(raw);
  } catch (error) {
    logger.warn("Failed to decide product retrieval usage", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return { useProductRetrieval: false, query: "" };
  }
}

const LIVE_SEARCH_SITES = ["myntra.com", "ajio.com", "meesho.com"] as const;
/** Max product cards returned to the client. */
const MAX_LIVE_LINKS = 8;
/** Pull broad listing rows if the specific query is too sparse. */
const MIN_LISTING_CARDS_BEFORE_RANK = 4;
/** Max PDP HTML fetches to try before giving up (Meesho / enrich). */
const MAX_PDP_FETCH_ATTEMPTS = 28;
/** Listing APIs + PDP fetches need headroom (parallel discovery + batched PDP). */
const LIVE_RAG_TIMEOUT_MS = 45_000;
const PDP_FETCH_CONCURRENCY = 4;

function canonicalizeProductUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    u.hash = "";
    // Drop noisy tracking/search params that create duplicate links.
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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
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

/**
 * True only for product detail pages — never search, shop grids, or collection hubs.
 */
function isLikelyProductUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (
    lower.includes("/search") ||
    lower.includes("search?") ||
    lower.includes("/wishlist") ||
    lower.includes("/cart") ||
    lower.includes("/account") ||
    lower.includes("/category") ||
    lower.includes("/shop/") ||
    lower.includes("/collection") ||
    lower.includes("/collections") ||
    lower.includes("/highlights") ||
    lower.includes("/gift")
  ) {
    return false;
  }

  if (lower.includes("myntra.com")) {
    try {
      const path = new URL(url).pathname;
      // PDP: .../styleId/buy (styleId is typically 5+ digits)
      if (/\/\d{5,}\/buy\/?$/i.test(path)) return true;
      return false;
    } catch {
      return false;
    }
  }
  if (lower.includes("ajio.com")) {
    try {
      const path = new URL(url).pathname;
      if (path.includes("/search")) return false;
      // PDP: .../p/702365815_black
      if (/\/p\/[^/]+/i.test(path)) return true;
      return false;
    } catch {
      return false;
    }
  }
  if (lower.includes("meesho.com")) {
    return (
      lower.includes("/product/") ||
      /meesho\.com\/[^/?#]+\/p\/[a-z0-9]+/i.test(lower)
    );
  }
  return false;
}

function orderPdpLinksForBalancedFetch(
  urls: string[],
  terms: string[],
): string[] {
  const seen = new Set<string>();
  const unique = urls.filter((u) => {
    const k = u.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return isLikelyProductUrl(u);
  });

  const score = (u: string) => scoreLinkAgainstQuery(u, terms);
  const sortByScore = (a: string, b: string) => score(b) - score(a);

  const myntra = unique
    .filter((u) => siteKeyFromUrl(u) === "myntra")
    .sort(sortByScore);
  const ajio = unique
    .filter((u) => siteKeyFromUrl(u) === "ajio")
    .sort(sortByScore);
  const meesho = unique
    .filter((u) => siteKeyFromUrl(u) === "meesho")
    .sort(sortByScore);

  const ordered: string[] = [];
  const push = (u: string) => {
    if (!ordered.includes(u)) ordered.push(u);
  };

  // Interleave: prioritize at least early Myntra + Ajio slots for parallel 2+2 ingestion.
  const maxLen = Math.max(myntra.length, ajio.length, meesho.length);
  for (let i = 0; i < maxLen; i++) {
    if (myntra[i]) push(myntra[i]!);
    if (ajio[i]) push(ajio[i]!);
    if (meesho[i]) push(meesho[i]!);
  }
  for (const u of unique) push(u);

  return ordered;
}

function extractLiveSearchLinks(html: string): string[] {
  const strictLinks: string[] = [];
  const fallbackLinks: string[] = [];
  const re = /href="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const href = match[1];
    if (!href) continue;
    const decoded = href.includes("uddg=")
      ? decodeURIComponent((href.split("uddg=")[1] || "").split("&")[0] || "")
      : href;
    const url = canonicalizeProductUrl(decoded || href);
    if (!url.startsWith("http")) continue;
    if (
      url.includes("myntra.com") ||
      url.includes("ajio.com") ||
      url.includes("meesho.com")
    ) {
      if (isLikelyProductUrl(url)) {
        strictLinks.push(url);
      } else {
        fallbackLinks.push(url);
      }
    }
    if (strictLinks.length + fallbackLinks.length >= 80) break;
  }
  const strict = [...new Set(strictLinks)];
  const fallbackPdps = [...new Set(fallbackLinks)].filter((url) =>
    isLikelyProductUrl(url),
  );
  return [...strict, ...fallbackPdps].slice(0, 50);
}

async function liveSearchProductLinks(query: string): Promise<{
  links: string[];
  ajioSearchHtml: string | null;
}> {
  const linkSet = new Set<string>();
  const terms = tokenizeQuery(query);
  let ajioSearchHtml: string | null = null;

  const addLinks = (
    links: string[],
    siteScope?: (typeof LIVE_SEARCH_SITES)[number],
  ) => {
    for (const link of links) {
      if (siteScope && !link.includes(siteScope)) continue;
      linkSet.add(canonicalizeProductUrl(link));
    }
  };

  await Promise.all(
    LIVE_SEARCH_SITES.map(async (site) => {
      const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(
        `site:${site} ${query}`,
      )}`;
      const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(
        `site:${site} ${query}`,
      )}`;
      const siteSearchUrl =
        site === "myntra.com"
          ? `https://www.myntra.com/${encodeURIComponent(query).replace(/%20/g, "-")}`
          : site === "ajio.com"
            ? `https://www.ajio.com/search/?text=${encodeURIComponent(query)}`
            : `https://www.meesho.com/search?q=${encodeURIComponent(query)}`;

      const [ddg, bing, plp] = await Promise.allSettled([
        fetchPageHtml(searchUrl).then((html) => addLinks(extractLiveSearchLinks(html), site)),
        fetchPageHtml(bingUrl).then((html) => addLinks(extractLiveSearchLinks(html), site)),
        fetchPageHtml(siteSearchUrl).then((html) => {
          if (site === "ajio.com") ajioSearchHtml = html;
          addLinks(extractLiveSearchLinks(html), site);
          if (site === "ajio.com") {
            addLinks(extractAjioPdpUrlsFromSearchHtml(html), site);
          }
        }),
      ]);

      if (ddg.status === "rejected") {
        logger.warn("Live search failed for site", {
          site,
          source: "ddg",
          error: ddg.reason instanceof Error ? ddg.reason.message : "unknown error",
        });
      }
      if (bing.status === "rejected") {
        logger.warn("Bing live search failed for site", {
          site,
          error: bing.reason instanceof Error ? bing.reason.message : "unknown error",
        });
      }
      if (plp.status === "rejected") {
        logger.debug("Site PLP fetch skipped", { site });
      }
    }),
  );

  const all = [...linkSet].filter(isLikelyProductUrl);
  const scored = all
    .map((url) => ({ url, score: scoreLinkAgainstQuery(url, terms) }))
    .sort((a, b) => b.score - a.score);

  const positive = scored.filter((x) => x.score > 0).map((x) => x.url);
  const pool =
    positive.length > 0 ? positive : scored.map((x) => x.url);
  return {
    links: orderPdpLinksForBalancedFetch(pool, terms).slice(0, MAX_PDP_FETCH_ATTEMPTS),
    ajioSearchHtml,
  };
}

async function tryIngestSinglePdpLink(
  link: string,
  opts?: { ajioListingReferer?: string },
): Promise<ProductCard | null> {
  try {
    const html = await fetchPageHtml(link, {
      refererOverride: opts?.ajioListingReferer,
    });
    const domainType = detectDomainType(link);
    const rawData = routeToAdapter(domainType, html);
    const normalized = normalizeProduct(rawData);
    let displayTitle = normalized.title?.trim() ?? "";
    if (!displayTitle || displayTitle === "Unknown Product") {
      const gen = genericExtract(html);
      const gt = gen.title?.trim();
      if (gt && gt !== "Unknown Product") displayTitle = gt;
    }
    if (!displayTitle || displayTitle === "Unknown Product") return null;

    const normalizedUrl = canonicalizeProductUrl(link);
    const imgs = normalized.images.slice(0, 1);
    const measKeys = Object.entries(normalized.measurements).filter(
      ([, v]) => v !== undefined && v !== null,
    );
    const measStr =
      measKeys.length > 0
        ? measKeys
          .slice(0, 6)
          .map(([k, v]) => `${k}:${v}`)
          .join(", ")
        : "";
    const retailer = siteKeyFromUrl(link);
    return {
      id: createHash("sha1").update(normalizedUrl).digest("hex"),
      title: decodeHtmlEntities(displayTitle),
      brand: decodeHtmlEntities(
        normalized.brand === "Unknown" ? "" : normalized.brand,
      ),
      price: decodeHtmlEntities(normalized.price ?? rawData.price ?? ""),
      imageUrl: normalized.images[0] ?? "",
      sourceUrl: normalizedUrl,
      rating: normalized.rating,
      reviewCount: normalized.reviewCount,
      sizes:
        normalized.variants.size.length > 0
          ? normalized.variants.size.slice(0, 24).join(", ")
          : undefined,
      colors:
        normalized.variants.color.length > 0
          ? normalized.variants.color.slice(0, 12).join(", ")
          : undefined,
      material:
        normalized.material && normalized.material !== "NA"
          ? normalized.material
          : undefined,
      fitType:
        normalized.fitType && normalized.fitType !== "regular"
          ? normalized.fitType
          : undefined,
      measurements: measStr || undefined,
      imageRefs: imgs[0] ? imgs[0] : undefined,
      category:
        normalized.category && normalized.category !== "fashion"
          ? normalized.category
          : undefined,
      genderTarget:
        normalized.genderTarget && normalized.genderTarget !== "unisex"
          ? normalized.genderTarget
          : undefined,
      retailer: retailer === "other" ? undefined : retailer,
      parserConfidence: normalized.confidence,
    };
  } catch (error) {
    logger.debug("Live product ingestion failed for URL", {
      url: link,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return null;
  }
}

const MAX_RAW_CATALOG_ROWS = 48;

async function ingestLiveSearchProducts(query: string): Promise<ProductCard[]> {
  const terms = tokenizeQuery(query);
  const listingLimit = 40;
  const rawVariants = listingQueryVariants(query);
  const variants =
    rawVariants.length > 0 ? rawVariants : ["tshirts", "shirts", "jeans"];
  const primaryListingQ = variants[0] ?? "tshirts";

  logger.debug(`${CATALOG_DBG} ingestLiveSearchProducts start`, {
    queryPreview: query.slice(0, 120),
    variantCount: variants.length,
    variantsPreview: variants.slice(0, 5),
    primaryListingQ,
    listingLimit,
    termCount: terms.length,
  });

  const myntraBatches = await Promise.all(
    variants.map((qv) =>
      fetchMyntraGatewayProductSummaries(qv, { limit: listingLimit }),
    ),
  );
  const myntraSummaries = myntraBatches.flat();
  logger.debug(`${CATALOG_DBG} myntra gateway`, {
    batchCount: myntraBatches.length,
    rowCounts: myntraBatches.map((b) => b.length),
    myntraTotal: myntraSummaries.length,
  });

  const searchPack = await liveSearchProductLinks(primaryListingQ);
  const { links: linkPool, ajioSearchHtml } = searchPack;

  logger.debug(`${CATALOG_DBG} liveSearchProductLinks`, {
    linkPoolSize: linkPool.length,
    ajioHtmlLen: ajioSearchHtml?.length ?? 0,
    primaryListingQ,
  });

  let ajioSummaries = ajioSearchHtml
    ? extractAjioListingSummariesFromSearchHtml(ajioSearchHtml, {
      limit: listingLimit,
    })
    : [];

  if (ajioSummaries.length === 0 && ajioSearchHtml) {
    const fromRegex = extractAjioPdpUrlsFromSearchHtml(ajioSearchHtml, listingLimit);
    ajioSummaries = ajioListingSummariesFromPdpUrls(fromRegex, listingLimit);
    if (ajioSummaries.length > 0) {
      logger.debug(`${CATALOG_DBG} ajio listing fallback from embedded PDP URLs`, {
        count: ajioSummaries.length,
      });
    }
  }

  if (ajioSearchHtml && ajioSummaries.length > 0) {
    enrichAjioListingSummariesWithImagesFromHtml(ajioSearchHtml, ajioSummaries);
  }

  logger.debug(`${CATALOG_DBG} ajio listing extract`, {
    ajioSummaryCount: ajioSummaries.length,
  });

  const products: ProductCard[] = [];
  const seenProductUrls = new Set<string>();

  const pushCard = (card: ProductCard) => {
    const k = card.sourceUrl.toLowerCase();
    if (seenProductUrls.has(k)) return;
    seenProductUrls.add(k);
    products.push(card);
  };

  for (const s of myntraSummaries) {
    const normalizedUrl = canonicalizeProductUrl(s.sourceUrl);
    pushCard({
      id: createHash("sha1").update(normalizedUrl).digest("hex"),
      title: decodeHtmlEntities(s.title),
      brand: decodeHtmlEntities(s.brand),
      price: decodeHtmlEntities(s.price),
      imageUrl: s.imageUrl,
      sourceUrl: normalizedUrl,
      category: s.category,
      genderTarget: s.genderTarget,
      retailer: "myntra",
      parserConfidence: 0.52,
    });
  }

  for (const s of ajioSummaries) {
    const normalizedUrl = canonicalizeProductUrl(s.sourceUrl);
    pushCard({
      id: createHash("sha1").update(normalizedUrl).digest("hex"),
      title: decodeHtmlEntities(s.name),
      brand: decodeHtmlEntities(s.brand),
      price: decodeHtmlEntities(s.price),
      imageUrl: s.imageUrl,
      sourceUrl: normalizedUrl,
      retailer: "ajio",
      parserConfidence: 0.52,
    });
  }

  let pdpCandidates = orderPdpLinksForBalancedFetch(
    linkPool.filter((u: string) =>
      !seenProductUrls.has(canonicalizeProductUrl(u).toLowerCase()),
    ),
    terms,
  );

  logger.debug(`${CATALOG_DBG} after listing cards (pre-PDP)`, {
    productCount: products.length,
    pdpCandidateCount: pdpCandidates.length,
  });

  const hasMeesho = products.some((p) => siteKeyFromUrl(p.sourceUrl) === "meesho");
  if (!hasMeesho) {
    const meesho = pdpCandidates.filter((u: string) => siteKeyFromUrl(u) === "meesho");
    const rest = pdpCandidates.filter((u: string) => siteKeyFromUrl(u) !== "meesho");
    pdpCandidates = [...meesho, ...rest];
  }

  const ajioListingReferer = `https://www.ajio.com/search/?text=${encodeURIComponent(primaryListingQ)}`;

  let fetchAttempts = 0;
  for (
    let i = 0;
    i < pdpCandidates.length &&
    fetchAttempts < MAX_PDP_FETCH_ATTEMPTS &&
    products.length < MAX_RAW_CATALOG_ROWS;
    i += PDP_FETCH_CONCURRENCY
  ) {
    const batch = pdpCandidates.slice(i, i + PDP_FETCH_CONCURRENCY);
    fetchAttempts += batch.length;
    const settled = await Promise.all(
      batch.map((link) =>
        tryIngestSinglePdpLink(link, {
          ajioListingReferer: link.toLowerCase().includes("ajio.com")
            ? ajioListingReferer
            : undefined,
        }),
      ),
    );
    for (const card of settled) {
      if (card) pushCard(card);
    }
  }

  logger.debug(`${CATALOG_DBG} after PDP batch loop`, {
    productCount: products.length,
    fetchAttempts,
    pdpCandidateCount: pdpCandidates.length,
  });

  await ensureBroadFallbackListings(
    products,
    pushCard,
    MIN_LISTING_CARDS_BEFORE_RANK,
  );

  logger.debug(`${CATALOG_DBG} after ensureBroadFallbackListings`, {
    productCount: products.length,
  });

  const ranked = products
    .map((item) => {
      const searchable = [
        item.title,
        item.brand,
        item.sourceUrl,
        item.category ?? "",
        item.genderTarget ?? "",
        item.material ?? "",
        item.sizes ?? "",
        item.colors ?? "",
        item.fitType ?? "",
      ]
        .join(" ")
        .toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (searchable.includes(term)) score += 3;
      }
      if (item.imageUrl) score += 1;
      if (item.price) score += 1;
      if (item.sizes) score += 1;
      if (item.rating) score += 1;
      if (item.material) score += 1;
      const conf = item.parserConfidence ?? 0;
      score += Math.min(3, Math.round(conf * 3));
      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  const bySite: Record<"myntra" | "ajio" | "meesho", ProductCard[]> = {
    myntra: [],
    ajio: [],
    meesho: [],
  };
  for (const row of ranked) {
    const sk = siteKeyFromUrl(row.item.sourceUrl);
    if (sk === "other") continue;
    bySite[sk].push(row.item);
  }

  const selected: ProductCard[] = [];
  const picked = new Set<string>();
  const take = (c: ProductCard) => {
    const k = c.sourceUrl.toLowerCase();
    if (picked.has(k)) return;
    picked.add(k);
    selected.push(c);
  };

  const maxRounds = 8;
  for (let r = 0; r < maxRounds && selected.length < MAX_LIVE_LINKS; r++) {
    for (const site of ["myntra", "ajio", "meesho"] as const) {
      const row = bySite[site][r];
      if (row) take(row);
      if (selected.length >= MAX_LIVE_LINKS) break;
    }
  }

  for (const row of ranked) {
    if (selected.length >= MAX_LIVE_LINKS) break;
    take(row.item);
  }

  logger.debug(`${CATALOG_DBG} ingestLiveSearchProducts done`, {
    rankedCount: ranked.length,
    selectedCount: selected.length,
    bySiteCounts: {
      myntra: bySite.myntra.length,
      ajio: bySite.ajio.length,
      meesho: bySite.meesho.length,
    },
  });

  return selected;
}

function mergeProductCards(primary: ProductCard[], live: ProductCard[]): ProductCard[] {
  const merged: ProductCard[] = [];
  const seen = new Set<string>();
  for (const item of [...primary, ...live]) {
    const key = item.sourceUrl.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= 8) break;
  }
  return merged;
}

function parseAiOutput(raw: string): AiResponse {
  const trimmed = raw.trim();

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      return {
        answer: decodeHtmlEntities(
          typeof parsed.answer === "string" ? parsed.answer : trimmed,
        ),
        confidence:
          typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
        reasons: Array.isArray(parsed.reasons)
          ? (parsed.reasons as string[]).map((reason) =>
            decodeHtmlEntities(reason),
          )
          : [],
        suggestedActions: normalizeSuggestedActions(
          Array.isArray(parsed.suggestedActions)
            ? (parsed.suggestedActions as string[])
            : ["Check fit details", "Book style expert"],
        ),
      };
    } catch {
      // fall through to plain-text wrapper
    }
  }

  return {
    answer: decodeHtmlEntities(trimmed || FALLBACK_RESPONSE.answer),
    confidence: 0.5,
    reasons: ["plain text response"],
    suggestedActions: normalizeSuggestedActions(["Check fit details", "Book style expert"]),
  };
}

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if ("status" in session) return session;

  let body: {
    sessionId?: string;
    message?: string;
    attachmentIds?: string[];
    complex?: boolean;
    /** Client toggle: always run catalog retrieval for this message */
    suggestedPicks?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body", 400);
  }

  const { sessionId, message, attachmentIds, complex, suggestedPicks } = body;
  const useComplex = complex === true;
  const forceSuggestedPicks = suggestedPicks === true;
  const userMessageText = typeof message === "string" ? message.trim() : "";
  const attachmentIdList = Array.isArray(attachmentIds)
    ? [
      ...new Set(
        attachmentIds.filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        ),
      ),
    ].slice(0, 6)
    : [];

  if (!sessionId || typeof sessionId !== "string") {
    return fail("sessionId is required", 400);
  }
  if (userMessageText.length === 0 && attachmentIdList.length === 0) {
    return fail("Add a message or attach at least one image", 400);
  }

  const chatSession = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });

  if (!chatSession || chatSession.userId !== session.userId) {
    return fail("Chat session not found", 404);
  }

  type VisionPart = { inlineData: { mimeType: string; data: string } };
  let attachmentImageParts: VisionPart[] = [];

  if (attachmentIdList.length > 0) {
    const mediaRows = await prisma.userMedia.findMany({
      where: {
        id: { in: attachmentIdList },
        userId: session.userId,
        isDeleted: false,
        mimeType: { startsWith: "image/" },
        category: { in: ["photos", "fit-checks", "try-on"] },
      },
    });
    if (mediaRows.length !== attachmentIdList.length) {
      return fail("Invalid or unauthorized image attachment(s)", 422);
    }
    const byId = new Map(mediaRows.map((m) => [m.id, m]));
    const ordered = attachmentIdList.map((id) => byId.get(id)!);
    try {
      const urls = await Promise.all(
        ordered.map((m) => generatePresignedDownloadUrl(m.s3Key)),
      );
      const blobs = await Promise.all(
        urls.map((u) => fetchRemoteImageAsBase64(u)),
      );
      attachmentImageParts = blobs.map((b) => ({
        inlineData: { mimeType: b.mimeType, data: b.base64 },
      }));
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Could not load attachment images";
      return fail(msg, 502);
    }
  }

  const messageForRetrieval = userMessageText || "outfit photo fashion help";
  const promptUserMessage =
    userMessageText ||
    "The user only shared image(s) with no written question — describe what you see and give concise fashion/fit help.";

  logger.debug(`${CATALOG_DBG} POST /api/chat/message`, {
    sessionIdSuffix: sessionId.slice(-10),
    messageLen: userMessageText.length,
    messagePreview: userMessageText.slice(0, 160),
    attachmentCount: attachmentImageParts.length,
    complex: useComplex,
    suggestedPicks: forceSuggestedPicks,
    shoppingIntentHeuristic: hasShoppingIntent(messageForRetrieval),
  });

  const [userProfile, photoRows] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId: session.userId },
    }),
    prisma.userMedia.findMany({
      where: {
        userId: session.userId,
        category: "photos",
        isDeleted: false,
      },
      select: { fileName: true },
      take: 80,
    }),
  ]);

  const wizardProfileContext = buildWizardProfileContext(
    userProfile as Record<string, unknown> | null,
    {
      frontPhotoUploaded: photoRows.some((p) =>
        p.fileName.toLowerCase().startsWith("front-"),
      ),
      backPhotoUploaded: photoRows.some((p) =>
        p.fileName.toLowerCase().startsWith("back-"),
      ),
    },
  );

  const dbMessages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: { senderType: true, contentText: true, contentJson: true },
  });

  const history = dbMessages
    .filter((m) => m.contentText)
    .map((m) => ({
      role: m.senderType === "USER" ? "User" : "Assistant",
      text: m.contentText!,
    }));

  const previouslyShownProductUrls = new Set<string>();
  for (const msg of dbMessages) {
    if (msg.senderType !== "AI") continue;
    const json = msg.contentJson as { products?: Array<{ sourceUrl?: unknown }> } | null;
    const products = json?.products;
    if (!Array.isArray(products)) continue;
    for (const p of products) {
      if (typeof p?.sourceUrl === "string" && p.sourceUrl.trim()) {
        previouslyShownProductUrls.add(p.sourceUrl.trim().toLowerCase());
      }
    }
  }

  const trimmedHistory = trimHistory(history, MAX_CONTEXT_TOKENS);
  const retrievalDecision = forceSuggestedPicks
    ? ({ useProductRetrieval: true, query: "" } satisfies RetrievalDecision)
    : await decideWhetherToRetrieveProducts({
      message: messageForRetrieval,
      wizardProfileContext,
      history: trimmedHistory,
    });
  const effectiveUseRetrieval =
    forceSuggestedPicks ||
    retrievalDecision.useProductRetrieval ||
    hasShoppingIntent(messageForRetrieval);
  const relevantProducts: ProductCard[] = [];
  let liveProducts: ProductCard[] = [];
  let retrievalQueryUsed = "";

  logger.debug(`${CATALOG_DBG} retrieval gate`, {
    effectiveUseRetrieval,
    forceSuggestedPicks,
    llmUseRetrieval: retrievalDecision.useProductRetrieval,
    llmQueryPreview: (retrievalDecision.query || "").slice(0, 100),
  });

  if (effectiveUseRetrieval) {
    const baseQuery = forceSuggestedPicks
      ? messageForRetrieval
      : (retrievalDecision.query || messageForRetrieval).trim();
    retrievalQueryUsed = enrichRetrievalQuery(baseQuery, wizardProfileContext);
    logger.debug(`${CATALOG_DBG} ingest primary`, {
      baseQueryPreview: baseQuery.slice(0, 120),
      retrievalQueryUsedPreview: retrievalQueryUsed.slice(0, 160),
      timeoutMs: LIVE_RAG_TIMEOUT_MS,
    });
    try {
      liveProducts = await withTimeout(
        ingestLiveSearchProducts(retrievalQueryUsed),
        LIVE_RAG_TIMEOUT_MS,
        "Live product retrieval",
      );
      logger.debug(`${CATALOG_DBG} ingest primary done`, {
        liveProductCount: liveProducts.length,
      });
    } catch (error) {
      logger.warn("Live product retrieval skipped or timed out", {
        error: error instanceof Error ? error.message : "unknown error",
      });
      liveProducts = [];
      logger.debug(`${CATALOG_DBG} ingest primary failed`, {
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
    if (liveProducts.length === 0) {
      try {
        const fallbackQ = messageForRetrieval || "men shirt";
        logger.debug(`${CATALOG_DBG} ingest fallback starting`, {
          fallbackQueryPreview: fallbackQ.slice(0, 120),
        });
        liveProducts = await withTimeout(
          ingestLiveSearchProducts(fallbackQ),
          Math.min(LIVE_RAG_TIMEOUT_MS, 28_000),
          "Live product retrieval fallback",
        );
        logger.debug(`${CATALOG_DBG} ingest fallback done`, {
          liveProductCount: liveProducts.length,
        });
      } catch (error) {
        logger.warn("Live product fallback retrieval failed", {
          error: error instanceof Error ? error.message : "unknown error",
        });
        logger.debug(`${CATALOG_DBG} ingest fallback failed`, {
          error: error instanceof Error ? error.message : "unknown error",
        });
      }
    }
  } else {
    logger.debug(`${CATALOG_DBG} retrieval skipped (gate off)`, {
      hint: "Enable Suggested picks toggle or use shopping keywords, or LLM must request retrieval",
    });
  }
  const mergedProductsBase = mergeProductCards(
    relevantProducts,
    liveProducts.map((p) => ({
      ...p,
      sourceUrl: canonicalizeProductUrl(p.sourceUrl),
    })),
  );
  const unseenProducts = mergedProductsBase.filter(
    (p) => !previouslyShownProductUrls.has(p.sourceUrl.toLowerCase()),
  );
  const mergedProducts = (unseenProducts.length > 0
    ? [...unseenProducts, ...mergedProductsBase]
    : mergedProductsBase
  ).slice(0, 8);

  logger.debug(`${CATALOG_DBG} merge`, {
    liveProductCount: liveProducts.length,
    mergedBaseCount: mergedProductsBase.length,
    unseenCount: unseenProducts.length,
    previouslyShownUrls: previouslyShownProductUrls.size,
    mergedOutCount: mergedProducts.length,
  });
  if (mergedProducts.length === 0 && effectiveUseRetrieval) {
    logger.warn(`${CATALOG_DBG} zero products in API response after retrieval`, {
      liveProductCount: liveProducts.length,
      mergedBaseCount: mergedProductsBase.length,
      retrievalQueryUsedPreview: retrievalQueryUsed.slice(0, 120),
    });
  }

  const productRagContext =
    mergedProducts.length > 0
      ? mergedProducts.map(productContextSummary).join("\n")
      : "";

  const prompt = buildChatPrompt({
    wizardProfileContext,
    productSummary: productRagContext
      ? `Relevant catalog products:\n${productRagContext}`
      : undefined,
    history: trimmedHistory,
    message: promptUserMessage,
    suggestedPicksRequested: forceSuggestedPicks,
    attachedImageCount: attachmentImageParts.length,
  });

  const historyFingerprint = createHash("sha256")
    .update(JSON.stringify(trimmedHistory.map((h) => [h.role, h.text])))
    .digest("hex")
    .slice(0, 32);
  const ragFingerprint = productRagContext
    ? createHash("sha256").update(productRagContext).digest("hex").slice(0, 32)
    : "";
  const profileFingerprint = createHash("sha256")
    .update(wizardProfileContext)
    .digest("hex")
    .slice(0, 32);

  const cacheKey = buildCacheKey({
    message: `${promptUserMessage}|img:${attachmentImageParts.length}`,
    profileFp: profileFingerprint,
    complex: useComplex ? "1" : "0",
    ragFp: ragFingerprint,
    histFp: historyFingerprint,
  });

  let aiResult: AiResponse;
  let tokensIn = 0;
  let tokensOut = 0;
  const canUseCache =
    !effectiveUseRetrieval && attachmentImageParts.length === 0;
  const cached = canUseCache ? getCache(cacheKey) : null;
  let usedCache = false;

  if (cached) {
    logger.debug("Chat response served from cache", { sessionId, userId: session.userId });
    aiResult = cached as AiResponse;
    usedCache = true;
  } else {
    try {
      logger.debug("Calling Gemini for chat response", {
        sessionId,
        userId: session.userId,
        visionParts: attachmentImageParts.length,
      });
      const model = getGeminiChatModel({
        complex: useComplex,
        withImages: attachmentImageParts.length > 0,
      });
      const parts: Array<
        { text: string } | { inlineData: { mimeType: string; data: string } }
      > = [{ text: prompt }, ...attachmentImageParts];
      const result = await model.generateContent({
        contents: [{ role: "user", parts }],
      });
      const rawText = result.response.text() || "";

      tokensIn = estimateTokens(prompt);
      tokensOut = estimateTokens(rawText);

      aiResult = parseAiOutput(rawText);
      if (canUseCache) {
        setCache(cacheKey, aiResult);
      }
    } catch (error) {
      logger.error("Gemini generateContent failed in chat message route", {
        sessionId,
        userId: session.userId,
        error: error instanceof Error ? error.message : "unknown error",
      });
      aiResult = { ...FALLBACK_RESPONSE };
      tokensIn = estimateTokens(prompt);
    }
  }

  const thinking: ThinkingMeta = {
    mode: useComplex ? "complex" : "normal",
    retrievalEnabled: effectiveUseRetrieval,
    retrievalQuery: effectiveUseRetrieval
      ? retrievalQueryUsed
      : retrievalDecision.query || messageForRetrieval,
    importedMatches: relevantProducts.length,
    liveMatches: liveProducts.length,
    finalProducts: mergedProducts.length,
    usedCache,
    confidence: aiResult.confidence,
    suggestedPicksRequested: forceSuggestedPicks,
    attachmentCount: attachmentImageParts.length,
    visionEnabled: attachmentImageParts.length > 0,
  };

  const attachmentsPayload =
    attachmentIdList.length > 0 ? attachmentIdList : undefined;

  await prisma.chatMessage.create({
    data: {
      sessionId,
      senderType: "USER",
      contentText:
        userMessageText ||
        (attachmentIdList.length > 0 ? "📷 Shared photos" : ""),
      attachmentsJson: attachmentsPayload ?? undefined,
    },
  });

  await prisma.chatMessage.create({
    data: {
      sessionId,
      senderType: "AI",
      contentText: aiResult.answer,
      contentJson: JSON.parse(
        JSON.stringify({
          confidence: aiResult.confidence,
          reasons: aiResult.reasons,
          suggestedActions: aiResult.suggestedActions,
          products: mergedProducts,
          thinking,
        }),
      ),
    },
  });

  if (tokensIn > 0 || tokensOut > 0) {
    await logAiUsage(session.userId, tokensIn, tokensOut);
  }

  logger.debug(`${CATALOG_DBG} response payload`, {
    productsOut: mergedProducts.length,
    sessionIdSuffix: sessionId.slice(-10),
  });

  return ok({
    answer: aiResult.answer,
    confidence: aiResult.confidence,
    reasons: aiResult.reasons,
    actionButtons: aiResult.suggestedActions,
    products: mergedProducts,
    thinking,
  });
}
