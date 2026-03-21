import { type RawProductData, emptyRawProduct } from "./types";
import { extract as genericExtract } from "./genericAdapter";

function hasWooCommerceMarkers(html: string): boolean {
  return (
    html.includes("woocommerce") ||
    html.includes("product_meta") ||
    html.includes("wc-product")
  );
}

function extractWooTitle(html: string): string | undefined {
  const re = /<h[12][^>]*class=["'][^"']*product[_-]title[^"']*["'][^>]*>([^<]+)<\/h[12]>/i;
  return re.exec(html)?.[1]?.trim();
}

function extractWooImages(html: string): string[] {
  const images: string[] = [];
  const galleryRe =
    /<div[^>]*class=["'][^"']*woocommerce-product-gallery[^"']*["'][^>]*>([\s\S]*?)<\/div>/i;
  const galleryMatch = galleryRe.exec(html);
  if (galleryMatch) {
    const imgRe = /(?:src|data-src|data-large_image)=["']([^"']+)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = imgRe.exec(galleryMatch[1])) !== null) {
      if (match[1] && !images.includes(match[1])) {
        images.push(match[1]);
      }
    }
  }
  return images;
}

function extractWooVariations(html: string): { sizes: string[]; colors: string[] } {
  const sizes: string[] = [];
  const colors: string[] = [];

  const variationRe =
    /<select[^>]*id=["']([^"']*(?:size|pa_size)[^"']*)["'][^>]*>([\s\S]*?)<\/select>/gi;
  let match: RegExpExecArray | null;
  while ((match = variationRe.exec(html)) !== null) {
    const optionRe = /<option[^>]+value=["']([^"']+)["']/gi;
    let optMatch: RegExpExecArray | null;
    while ((optMatch = optionRe.exec(match[2])) !== null) {
      const val = optMatch[1].trim();
      if (val && !sizes.includes(val)) sizes.push(val);
    }
  }

  const colorRe =
    /<select[^>]*id=["']([^"']*(?:color|colour|pa_color|pa_colour)[^"']*)["'][^>]*>([\s\S]*?)<\/select>/gi;
  while ((match = colorRe.exec(html)) !== null) {
    const optionRe = /<option[^>]+value=["']([^"']+)["']/gi;
    let optMatch: RegExpExecArray | null;
    while ((optMatch = optionRe.exec(match[2])) !== null) {
      const val = optMatch[1].trim();
      if (val && !colors.includes(val)) colors.push(val);
    }
  }

  return { sizes, colors };
}

function extractWooPrice(html: string): string | undefined {
  const priceRe =
    /<(?:span|p|ins)[^>]*class=["'][^"']*woocommerce-Price-amount[^"']*["'][^>]*>[^<]*?(\d[\d,.]+)/i;
  return priceRe.exec(html)?.[1];
}

function extractWooMeta(html: string): { brand?: string; category?: string } {
  const meta: { brand?: string; category?: string } = {};
  const brandRe =
    /<span[^>]*class=["'][^"']*posted_in[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i;
  const brandMatch = brandRe.exec(html);
  if (brandMatch) meta.category = brandMatch[1].trim();

  const tagRe =
    /<span[^>]*class=["'][^"']*tagged_as[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i;
  const tagMatch = tagRe.exec(html);
  if (tagMatch) meta.brand = tagMatch[1].trim();

  return meta;
}

export function extract(html: string): RawProductData {
  if (!hasWooCommerceMarkers(html)) {
    return genericExtract(html);
  }

  const data = emptyRawProduct();

  data.title = extractWooTitle(html);
  data.images = extractWooImages(html);

  const { sizes, colors } = extractWooVariations(html);
  data.sizes = sizes;
  data.colors = colors;

  data.price = extractWooPrice(html);

  const meta = extractWooMeta(html);
  data.brand = meta.brand;
  data.category = meta.category;

  if (data.images.length === 0 || !data.title) {
    const fallback = genericExtract(html);
    if (!data.title) data.title = fallback.title;
    if (data.images.length === 0) data.images = fallback.images;
    if (data.sizes.length === 0) data.sizes = fallback.sizes;
    if (data.colors.length === 0) data.colors = fallback.colors;
    if (!data.brand) data.brand = fallback.brand;
    if (!data.category) data.category = fallback.category;
    if (!data.price) data.price = fallback.price;
    if (!data.material) data.material = fallback.material;
    if (!data.fitType) data.fitType = fallback.fitType;
  }

  return data;
}
