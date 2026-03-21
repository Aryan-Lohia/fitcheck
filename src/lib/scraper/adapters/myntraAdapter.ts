import { type RawProductData, emptyRawProduct } from "./types";
import { extract as genericExtract } from "./genericAdapter";
import { parseScriptJsonFromPrefixes } from "@/lib/scraper/extract-script-json";

type MyntraRatings = {
  averageRating?: number;
  totalRatings?: number;
  totalRatingsCount?: number;
  count?: number;
};

function coercePriceNumber(v: unknown): number | undefined {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, ""));
    if (!Number.isNaN(n)) return n;
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const cand =
      o.effectivePrice ??
      o.sellingPrice ??
      o.discounted ??
      o.value ??
      o.price;
    return coercePriceNumber(cand);
  }
  return undefined;
}

type MyntraAlbumImage = { imageURL?: string; src?: string; url?: string };

type MyntraProductData = {
  name?: string;
  brand?: { name?: string };
  analytics?: { brand?: string; masterCategory?: string; gender?: string };
  baseColour?: string;
  colours?: { colorValue?: string }[];
  media?: { albums?: { name?: string; images?: MyntraAlbumImage[] }[] };
  sizes?: { label?: string; sizeRepresentation?: string }[];
  articleAttributes?: Record<string, string>;
  mrp?: number | unknown;
  price?: number | unknown;
  discount?: number;
  discountLabel?: string;
  ratings?: MyntraRatings;
  rating?: { value?: number; count?: number };
  productDisplayName?: string;
  masterCategory?: { typeName?: string };
  subCategory?: { typeName?: string };
  gender?: string;
};

function extractOgOrTwitterImage(html: string): string[] {
  const out: string[] = [];
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m?.[1] && !out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

function extractJsonLdImages(html: string): string[] {
  const out: string[] = [];
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      const parsed: unknown = JSON.parse(match[1]!);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const o = node as Record<string, unknown>;
        const img = o.image;
        if (typeof img === "string") out.push(img);
        else if (Array.isArray(img)) {
          for (const u of img) if (typeof u === "string") out.push(u);
        }
      }
    } catch {
      // skip
    }
  }
  return out;
}

function pushUniqueImages(images: string[], url: string) {
  const t = url.trim().replace(/^http:\/\//i, "https://");
  if (t && !images.includes(t)) images.push(t);
}

function ensureMinProductImages(images: string[], html: string, min = 3) {
  for (const u of extractOgOrTwitterImage(html)) {
    if (images.length >= min) break;
    pushUniqueImages(images, u);
  }
  if (images.length < min) {
    for (const u of extractJsonLdImages(html)) {
      if (images.length >= min) break;
      pushUniqueImages(images, u);
    }
  }
}

function parseMeasurementsFromAttributes(
  attrs: Record<string, string> | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!attrs) return out;
  const measureKeys = /chest|waist|hip|shoulder|length|inseam|sleeve/i;
  for (const [k, v] of Object.entries(attrs)) {
    if (!measureKeys.test(k)) continue;
    const num = parseFloat(String(v).replace(/[^\d.]/g, ""));
    if (!Number.isNaN(num)) out[k.toLowerCase().trim()] = num;
  }
  return out;
}

function formatPriceDisplay(pdp: MyntraProductData): {
  price?: string;
  mrp?: string;
} {
  const selling = coercePriceNumber(pdp.price);
  const mrp = coercePriceNumber(pdp.mrp);
  if (
    selling !== undefined &&
    mrp !== undefined &&
    mrp > selling
  ) {
    return {
      price: `₹${selling.toLocaleString("en-IN")} (MRP ₹${mrp.toLocaleString("en-IN")})`,
      mrp: String(mrp),
    };
  }
  if (selling !== undefined) {
    return { price: `₹${selling.toLocaleString("en-IN")}` };
  }
  if (mrp !== undefined) {
    return { price: `₹${mrp.toLocaleString("en-IN")}` };
  }
  return {};
}

function ratingStrings(pdp: MyntraProductData): { rating?: string; reviewCount?: string } {
  const r = pdp.ratings ?? (pdp.rating ? { averageRating: pdp.rating.value, count: pdp.rating.count } : undefined);
  if (!r) return {};
  const avg = r.averageRating;
  const cnt =
    r.totalRatings ?? r.totalRatingsCount ?? r.count;
  return {
    rating:
      avg !== undefined ? String(Math.round(avg * 10) / 10) : undefined,
    reviewCount: cnt !== undefined ? String(cnt) : undefined,
  };
}

function extractOgTitle(html: string): string | undefined {
  const m =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  return m?.[1]?.trim();
}

function albumImageUrl(img: MyntraAlbumImage): string | undefined {
  const u = img.imageURL ?? img.src ?? img.url;
  return typeof u === "string" && u.trim() ? u.trim() : undefined;
}

function extractMyntraJson(html: string): MyntraProductData | null {
  const root = parseScriptJsonFromPrefixes<{ pdpData?: MyntraProductData } & MyntraProductData>(
    html,
    [
      "window.__myx = ",
      "window.__myx=",
      "window['__myx'] = ",
      'window["__myx"] = ',
    ],
  );
  if (!root) return null;

  const pdp = root.pdpData ?? root;
  if (!pdp || typeof pdp !== "object") return null;
  if (!pdp.name && !pdp.productDisplayName && !pdp.media) return null;

  return pdp as MyntraProductData;
}

export function extract(html: string): RawProductData {
  const myntraData = extractMyntraJson(html);

  if (!myntraData) {
    return genericExtract(html);
  }

  const data = emptyRawProduct();

  data.title = myntraData.productDisplayName ?? myntraData.name;
  data.brand =
    myntraData.brand?.name ?? myntraData.analytics?.brand;
  data.category =
    myntraData.masterCategory?.typeName ??
    myntraData.subCategory?.typeName ??
    myntraData.analytics?.masterCategory;
  data.genderTarget =
    myntraData.gender ?? myntraData.analytics?.gender;

  if (myntraData.media?.albums) {
    for (const album of myntraData.media.albums) {
      if (album.images) {
        for (const img of album.images) {
          const u = albumImageUrl(img);
          if (u) pushUniqueImages(data.images, u);
        }
      }
    }
  }

  if (myntraData.sizes) {
    data.sizes = myntraData.sizes
      .map((s) => s.label ?? s.sizeRepresentation ?? "")
      .filter(Boolean);
  }

  if (myntraData.baseColour) {
    data.colors.push(myntraData.baseColour);
  }
  if (myntraData.colours) {
    for (const c of myntraData.colours) {
      if (c.colorValue && !data.colors.includes(c.colorValue)) {
        data.colors.push(c.colorValue);
      }
    }
  }

  const priceFmt = formatPriceDisplay(myntraData);
  if (priceFmt.price) data.price = priceFmt.price;
  if (priceFmt.mrp) data.mrp = priceFmt.mrp;
  data.currency = "INR";

  const rs = ratingStrings(myntraData);
  if (rs.rating) data.rating = rs.rating;
  if (rs.reviewCount) data.reviewCount = rs.reviewCount;

  if (myntraData.articleAttributes) {
    if (myntraData.articleAttributes["Fabric"])
      data.material = myntraData.articleAttributes["Fabric"];
    if (myntraData.articleAttributes["Fit"])
      data.fitType = myntraData.articleAttributes["Fit"].toLowerCase();
    Object.assign(
      data.measurements,
      parseMeasurementsFromAttributes(myntraData.articleAttributes),
    );
  }

  ensureMinProductImages(data.images, html, 3);

  if (data.images.length === 0 || !data.title) {
    const generic = genericExtract(html);
    if (!data.title) data.title = generic.title ?? extractOgTitle(html);
    if (data.images.length === 0) data.images = generic.images;
    ensureMinProductImages(data.images, html, 3);
  }

  if (!data.price) {
    const metaPrice = priceFromMetaRs(html);
    if (metaPrice) data.price = metaPrice;
  }

  return data;
}

function priceFromMetaRs(html: string): string | undefined {
  const desc =
    html.match(/content="[^"]*Rs\.\s*([\d,]+)/i)?.[1] ??
    html.match(/Rs\.\s*([\d,]+)/i)?.[1];
  if (!desc) return undefined;
  const n = desc.replace(/,/g, "");
  return `₹${Number(n).toLocaleString("en-IN")}`;
}
