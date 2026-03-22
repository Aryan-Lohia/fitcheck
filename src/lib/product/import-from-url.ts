import { createHash } from "crypto";
import { fetchPageHtml } from "@/lib/scraper/fetcher";
import { detectDomainType } from "@/lib/scraper/router";
import { normalizeProduct } from "@/lib/scraper/normalizer";
import { PARSER_VERSION } from "@/lib/scraper/parser-version";
import { prisma } from "@/lib/prisma/client";
import { extract as genericExtract } from "@/lib/scraper/adapters/genericAdapter";
import { extract as shopifyExtract } from "@/lib/scraper/adapters/shopifyAdapter";
import { extract as woocommerceExtract } from "@/lib/scraper/adapters/woocommerceAdapter";
import { extract as myntraExtract } from "@/lib/scraper/adapters/myntraAdapter";
import { extract as meeshoExtract } from "@/lib/scraper/adapters/meeshoAdapter";
import { extract as ajioExtract } from "@/lib/scraper/adapters/ajioAdapter";
import type { RawProductData } from "@/lib/scraper/adapters/types";

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

export type ImportProductFromUrlResult = {
  productImportId: string;
  normalized: unknown;
  cached: boolean;
};

/**
 * Shared product page import for /api/product/import and chat try-on.
 */
export async function importProductFromUrl(params: {
  userId: string;
  url: string;
}): Promise<ImportProductFromUrlResult> {
  const { userId, url } = params;

  const html = await fetchPageHtml(url);
  const rawHtmlHash = createHash("sha256").update(html).digest("hex");

  const existing = await prisma.productImport.findFirst({
    where: { userId, rawHtmlHash },
    include: { images: true },
  });

  if (existing) {
    return {
      productImportId: existing.id,
      normalized: existing.normalizedJson,
      cached: true,
    };
  }

  const domainType = detectDomainType(url);
  const rawData = routeToAdapter(domainType, html);
  const normalized = normalizeProduct(rawData);

  const record = await prisma.productImport.create({
    data: {
      userId,
      sourceUrl: url,
      domainType,
      title: normalized.title,
      brand: normalized.brand,
      price: rawData.price,
      rawHtmlHash,
      normalizedJson: JSON.parse(JSON.stringify(normalized)),
      parserVersion: PARSER_VERSION,
      images: {
        create: normalized.images.slice(0, 20).map((imageUrl) => ({
          imageUrl,
          sourceType: domainType,
        })),
      },
    },
    include: { images: true },
  });

  return {
    productImportId: record.id,
    normalized,
    cached: false,
  };
}
