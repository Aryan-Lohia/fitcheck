import { NextRequest } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { requireAuth } from "@/lib/auth/rbac";
import { fetchPageHtml } from "@/lib/scraper/fetcher";
import { detectDomainType } from "@/lib/scraper/router";
import { normalizeProduct } from "@/lib/scraper/normalizer";
import { PARSER_VERSION } from "@/lib/scraper/parser-version";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";
import { extract as genericExtract } from "@/lib/scraper/adapters/genericAdapter";
import { extract as shopifyExtract } from "@/lib/scraper/adapters/shopifyAdapter";
import { extract as woocommerceExtract } from "@/lib/scraper/adapters/woocommerceAdapter";
import { extract as myntraExtract } from "@/lib/scraper/adapters/myntraAdapter";
import { extract as meeshoExtract } from "@/lib/scraper/adapters/meeshoAdapter";
import { extract as ajioExtract } from "@/lib/scraper/adapters/ajioAdapter";
import type { RawProductData } from "@/lib/scraper/adapters/types";

const importSchema = z.object({
  url: z.string().url("A valid product URL is required"),
});

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

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if ("status" in session) return session;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body");
  }

  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { url } = parsed.data;

  let html: string;
  try {
    html = await fetchPageHtml(url);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to fetch the product page";
    return fail(
      `Unable to fetch the product page. Source error: ${message}`,
      502,
    );
  }

  const rawHtmlHash = createHash("sha256").update(html).digest("hex");

  const existing = await prisma.productImport.findFirst({
    where: { userId: session.userId, rawHtmlHash },
    include: { images: true },
  });

  if (existing) {
    return ok({
      productImportId: existing.id,
      normalized: existing.normalizedJson,
      cached: true,
    });
  }

  const domainType = detectDomainType(url);
  const rawData = routeToAdapter(domainType, html);
  const normalized = normalizeProduct(rawData);

  const record = await prisma.productImport.create({
    data: {
      userId: session.userId,
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

  return ok({
    productImportId: record.id,
    normalized,
    cached: false,
  });
}
