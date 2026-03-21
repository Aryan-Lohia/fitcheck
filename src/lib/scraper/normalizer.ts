import type { RawProductData } from "./adapters/types";
import { decodeHtmlEntities } from "@/lib/text/decode-html-entities";
import { dedupeImageUrls } from "@/lib/scraper/image-dedupe";

export type NormalizedProduct = {
  title: string;
  brand: string;
  category: string;
  genderTarget: string;
  images: string[];
  variants: { size: string[]; color: string[] };
  measurements: Record<string, number | undefined>;
  material: string;
  fitType: string;
  confidence: number;
  price?: string;
  mrp?: string;
  currency?: string;
  rating?: string;
  reviewCount?: string;
};

const FIELD_WEIGHTS: Record<string, number> = {
  title: 0.14,
  brand: 0.09,
  category: 0.05,
  images: 0.14,
  sizes: 0.22,
  colors: 0.05,
  measurements: 0.12,
  material: 0.05,
  fitType: 0.05,
  price: 0.05,
  rating: 0.04,
};

function deduplicateImages(images: string[]): string[] {
  return dedupeImageUrls(images);
}

function computeConfidence(raw: RawProductData): number {
  let score = 0;
  let totalWeight = 0;

  for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
    totalWeight += weight;
    switch (field) {
      case "title":
        if (raw.title) score += weight;
        break;
      case "brand":
        if (raw.brand) score += weight;
        break;
      case "category":
        if (raw.category) score += weight;
        break;
      case "images":
        if (raw.images.length > 0) score += weight;
        break;
      case "sizes":
        if (raw.sizes.length > 0) score += weight;
        break;
      case "colors":
        if (raw.colors.length > 0) score += weight;
        break;
      case "measurements":
        if (Object.keys(raw.measurements).length > 0) score += weight;
        break;
      case "material":
        if (raw.material) score += weight;
        break;
      case "fitType":
        if (raw.fitType) score += weight;
        break;
      case "price":
        if (raw.price) score += weight;
        break;
      case "rating":
        if (raw.rating) score += weight;
        break;
    }
  }

  return totalWeight > 0 ? Math.round((score / totalWeight) * 100) / 100 : 0;
}

export function normalizeProduct(raw: RawProductData): NormalizedProduct {
  const measurements: Record<string, number | undefined> = {};
  for (const [key, value] of Object.entries(raw.measurements)) {
    measurements[key.toLowerCase().trim()] = value;
  }

  return {
    title: decodeHtmlEntities(raw.title?.trim() || "Unknown Product"),
    brand: decodeHtmlEntities(raw.brand?.trim() || "Unknown"),
    category: decodeHtmlEntities(raw.category?.trim() || "fashion"),
    genderTarget: decodeHtmlEntities(raw.genderTarget?.trim() || "unisex"),
    images: deduplicateImages(raw.images.map((img) => decodeHtmlEntities(img))),
    variants: {
      size: [...new Set(raw.sizes.map((size) => decodeHtmlEntities(size.trim())))],
      color: [...new Set(raw.colors.map((color) => decodeHtmlEntities(color.trim())))],
    },
    measurements,
    material: decodeHtmlEntities(raw.material?.trim() || "NA"),
    fitType: decodeHtmlEntities(raw.fitType?.trim() || "regular"),
    confidence: computeConfidence(raw),
    price: raw.price ? decodeHtmlEntities(raw.price.trim()) : undefined,
    mrp: raw.mrp ? decodeHtmlEntities(raw.mrp.trim()) : undefined,
    currency: raw.currency?.trim(),
    rating: raw.rating ? decodeHtmlEntities(raw.rating.trim()) : undefined,
    reviewCount: raw.reviewCount
      ? decodeHtmlEntities(raw.reviewCount.trim())
      : undefined,
  };
}
