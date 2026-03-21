import { type RawProductData, emptyRawProduct } from "./types";
import { extract as genericExtract } from "./genericAdapter";
import { parseScriptJsonFromPrefixes } from "@/lib/scraper/extract-script-json";

type AjioProductData = {
  name?: string;
  brandName?: string;
  brickCategory?: string;
  gender?: string;
  images?: { url?: string }[];
  fnlColorVariantData?: Record<
    string,
    {
      colorName?: string;
      images?: { url?: string }[];
    }
  >;
  sizeVariants?: { value?: string }[];
  sizes?: string[];
  warehouseInfo?: {
    mrp?: number;
    price?: number;
  };
  price?: { value?: number };
  mrp?: { value?: number };
  productDetails?: { key?: string; value?: string }[];
  rating?: number;
  ratings?: { averageRating?: number; reviewCount?: number };
};

function findAjioProductShape(obj: unknown, depth = 0): AjioProductData | null {
  if (depth > 18 || !obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  const nameOk = typeof rec.name === "string" && rec.name.trim().length > 0;
  const brandOk = typeof rec.brandName === "string" && rec.brandName.trim().length > 0;
  const urlOk =
    typeof rec.url === "string" && /\/p\/[^/]+/i.test(rec.url) && !rec.url.includes("://assets");
  const hasImages = Array.isArray(rec.images) && rec.images.length > 0;
  const hasFnl =
    rec.fnlColorVariantData && typeof rec.fnlColorVariantData === "object";
  const hasOffer = rec.offerPrice && typeof rec.offerPrice === "object";
  const hasWarehouse = rec.warehouseInfo && typeof rec.warehouseInfo === "object";
  const hasDetails =
    Array.isArray(rec.productDetails) && rec.productDetails.length > 0;

  if (
    nameOk &&
    (brandOk || urlOk || hasDetails) &&
    (hasImages ||
      hasFnl ||
      hasOffer ||
      hasWarehouse ||
      hasDetails ||
      rec.sizeVariants ||
      rec.sizes)
  ) {
    return rec as unknown as AjioProductData;
  }
  for (const v of Object.values(rec)) {
    if (v && typeof v === "object") {
      const found = findAjioProductShape(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function extractOgOrTwitterImage(html: string): string[] {
  const out: string[] = [];
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m?.[1] && !out.includes(m[1])) out.push(m[1]);
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
}

type JsonLdOffer = { price?: string | number; priceCurrency?: string };

function extractAjioFromJsonLd(html: string): Partial<AjioProductData> & {
  variantImages?: string[];
  variantSizes?: string[];
} {
  const out: Partial<AjioProductData> & {
    variantImages?: string[];
    variantSizes?: string[];
  } = {};
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
        const t = o["@type"];
        const typeStr = Array.isArray(t) ? t.join(",") : String(t ?? "");
        if (!typeStr.includes("ProductGroup") && !typeStr.includes("Product")) continue;

        if (typeof o.name === "string") out.name = o.name;
        if (typeof o.category === "string") out.brickCategory = o.category;
        const brand = o.brand as Record<string, unknown> | undefined;
        if (brand?.name && typeof brand.name === "string") {
          out.brandName = brand.name as string;
        }
        const offers = o.offers as JsonLdOffer | undefined;
        if (offers?.price !== undefined) {
          out.price = { value: Number(offers.price) };
        }
        const img = o.image;
        if (typeof img === "string") {
          out.images = [{ url: img }];
        }
        const variants = o.hasVariant as unknown[] | undefined;
        if (Array.isArray(variants)) {
          const imgs: string[] = [];
          const sizes: string[] = [];
          for (const v of variants) {
            if (!v || typeof v !== "object") continue;
            const vo = v as Record<string, unknown>;
            if (typeof vo.size === "string") sizes.push(vo.size);
            if (typeof vo.image === "string") imgs.push(vo.image);
            const voff = vo.offers as JsonLdOffer | undefined;
            if (voff?.price !== undefined && !out.price?.value) {
              out.price = { value: Number(voff.price) };
            }
          }
          out.variantImages = imgs;
          out.variantSizes = sizes;
        }
      }
    } catch {
      // skip
    }
  }
  return out;
}

function parseNextData(html: string): Record<string, unknown> | null {
  const m = html.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!m?.[1]) return null;
  try {
    return JSON.parse(m[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractOgTitleAjio(html: string): string | undefined {
  const m =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  return m?.[1]?.trim();
}

function extractAjioJson(html: string): AjioProductData | null {
  const state = parseScriptJsonFromPrefixes<Record<string, unknown>>(html, [
    "window.__PRELOADED_STATE__ = ",
    "window.__PRELOADED_STATE__=",
    "window['__PRELOADED_STATE__'] = ",
    'window["__PRELOADED_STATE__"] = ',
  ]);
  if (state) {
    const found = findAjioProductShape(state);
    if (found) return found;
  }

  const next = parseNextData(html);
  if (next) {
    const found = findAjioProductShape(next);
    if (found) return found;
    const props = (next.props as Record<string, unknown> | undefined)?.pageProps;
    if (props && typeof props === "object") {
      const p = findAjioProductShape(props);
      if (p) return p;
    }
  }

  return null;
}

export function extract(html: string): RawProductData {
  let ajioData = extractAjioJson(html);
  const ld = extractAjioFromJsonLd(html);

  if (!ajioData) {
    if (ld.name || ld.brandName) {
      ajioData = {
        name: ld.name,
        brandName: ld.brandName,
        brickCategory: ld.brickCategory,
        images: ld.images,
        sizeVariants: ld.variantSizes?.map((s) => ({ value: s })),
        price: ld.price,
      } as AjioProductData;
    }
  }

  if (!ajioData) {
    return genericExtract(html);
  }

  const data = emptyRawProduct();

  data.title = ajioData.name ?? ld.name;
  data.brand = ajioData.brandName ?? ld.brandName;
  data.category = ajioData.brickCategory ?? ld.brickCategory;
  data.genderTarget = ajioData.gender;

  if (ajioData.images) {
    data.images = ajioData.images
      .map((img) =>
        img.url?.trim().replace(/^http:\/\//i, "https://"),
      )
      .filter((u): u is string => !!u);
  }
  if (ld.variantImages) {
    for (const u of ld.variantImages) pushUniqueImages(data.images, u);
  }

  if (ajioData.fnlColorVariantData) {
    for (const [, variant] of Object.entries(ajioData.fnlColorVariantData)) {
      if (variant.colorName && !data.colors.includes(variant.colorName)) {
        data.colors.push(variant.colorName);
      }
      if (variant.images) {
        for (const img of variant.images) {
          if (img.url) pushUniqueImages(data.images, img.url);
        }
      }
    }
  }

  if (ajioData.sizeVariants) {
    data.sizes = ajioData.sizeVariants
      .map((s) => s.value ?? "")
      .filter(Boolean);
  } else if (ajioData.sizes) {
    data.sizes = [...ajioData.sizes];
  }
  if (data.sizes.length === 0 && ld.variantSizes?.length) {
    data.sizes = [...new Set(ld.variantSizes)];
  }

  const priceVal =
    ajioData.warehouseInfo?.price ??
    ajioData.price?.value ??
    ld.price?.value ??
    ajioData.warehouseInfo?.mrp ??
    ajioData.mrp?.value;
  const mrpVal =
    ajioData.warehouseInfo?.mrp ?? ajioData.mrp?.value;

  if (priceVal !== undefined) {
    data.price = `₹${Number(priceVal).toLocaleString("en-IN")}`;
    data.currency = "INR";
  }
  if (
    mrpVal !== undefined &&
    priceVal !== undefined &&
    mrpVal > priceVal
  ) {
    data.mrp = String(mrpVal);
    data.price = `₹${Number(priceVal).toLocaleString("en-IN")} (MRP ₹${Number(mrpVal).toLocaleString("en-IN")})`;
  }

  const rt = ajioData.ratings ?? (ajioData.rating != null ? { averageRating: ajioData.rating } : undefined);
  if (rt?.averageRating !== undefined) {
    data.rating = String(rt.averageRating);
  }
  if (rt?.reviewCount !== undefined) {
    data.reviewCount = String(rt.reviewCount);
  }

  if (ajioData.productDetails) {
    for (const detail of ajioData.productDetails) {
      const key = detail.key?.toLowerCase() ?? "";
      if (key.includes("fabric") || key.includes("material")) {
        data.material = detail.value;
      }
      if (key.includes("fit")) {
        data.fitType = detail.value?.toLowerCase();
      }
    }
  }

  ensureMinProductImages(data.images, html, 3);

  if (data.images.length === 0 || !data.title) {
    const generic = genericExtract(html);
    if (!data.title) data.title = generic.title ?? extractOgTitleAjio(html);
    if (data.images.length === 0) data.images = generic.images;
    ensureMinProductImages(data.images, html, 3);
  }

  return data;
}
