import { type RawProductData, emptyRawProduct } from "./types";

function extractOgTag(html: string, property: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const altRe = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${property}["']`,
    "i",
  );
  return re.exec(html)?.[1] ?? altRe.exec(html)?.[1];
}

function extractMetaTag(html: string, name: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const altRe = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`,
    "i",
  );
  return re.exec(html)?.[1] ?? altRe.exec(html)?.[1];
}

function extractJsonLd(html: string): Record<string, unknown> | null {
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      const parsed: unknown = JSON.parse(match[1]);
      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        (parsed as Record<string, unknown>)["@type"] === "Product"
      ) {
        return parsed as Record<string, unknown>;
      }
      if (Array.isArray(parsed)) {
        const product = parsed.find(
          (item: unknown) =>
            item &&
            typeof item === "object" &&
            (item as Record<string, unknown>)["@type"] === "Product",
        );
        if (product) return product as Record<string, unknown>;
      }
    } catch {
      // skip invalid JSON-LD blocks
    }
  }
  return null;
}

function extractImages(html: string): string[] {
  const images: string[] = [];
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const src = match[1];
    if (src && !src.includes("data:image/") && !src.includes("pixel")) {
      images.push(src);
    }
  }
  return images;
}

function extractSizeChart(html: string): string | undefined {
  const re = /<table[^>]*class=["'][^"']*size[^"']*["'][^>]*>[\s\S]*?<\/table>/gi;
  const match = re.exec(html);
  if (match) return match[0];

  const genericTable =
    /<table[^>]*>[\s\S]*?<\/table>/gi;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = genericTable.exec(html)) !== null) {
    const tableContent = tableMatch[0].toLowerCase();
    if (
      tableContent.includes("chest") ||
      tableContent.includes("waist") ||
      tableContent.includes("hip") ||
      tableContent.includes("shoulder")
    ) {
      return tableMatch[0];
    }
  }
  return undefined;
}

function extractSizes(html: string): string[] {
  const sizes: string[] = [];
  const sizePatterns = [
    /<(?:option|button|span|a)[^>]*>[\s]*(XXS|XS|S|M|L|XL|XXL|XXXL|\d{2,3})[\s]*<\//gi,
    /data-size=["']([^"']+)["']/gi,
    /size["']?\s*:\s*["']([^"']+)["']/gi,
  ];

  for (const pattern of sizePatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const size = match[1].trim();
      if (size && !sizes.includes(size)) {
        sizes.push(size);
      }
    }
  }
  return sizes;
}

function extractColors(html: string): string[] {
  const colors: string[] = [];
  const colorPatterns = [
    /data-colou?r=["']([^"']+)["']/gi,
    /colou?r["']?\s*:\s*["']([^"']+)["']/gi,
  ];

  for (const pattern of colorPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const color = match[1].trim();
      if (color && !colors.includes(color)) {
        colors.push(color);
      }
    }
  }
  return colors;
}

export function extract(html: string): RawProductData {
  const data = emptyRawProduct();
  const jsonLd = extractJsonLd(html);

  data.title =
    (jsonLd?.name as string | undefined) ?? extractOgTag(html, "title");
  data.brand =
    (jsonLd?.brand as Record<string, string> | undefined)?.name ??
    extractMetaTag(html, "brand");

  const ogDescription = extractOgTag(html, "description") ?? "";
  const categoryPatterns = /(?:category|department)\s*[:=]\s*["']?([^"',<]+)/i;
  const catMatch = categoryPatterns.exec(html);
  data.category = catMatch?.[1]?.trim();

  const genderPatterns = /(?:gender|for)\s*[:=]\s*["']?(men|women|unisex|male|female|boys|girls)/i;
  const genderMatch = genderPatterns.exec(html) ?? genderPatterns.exec(ogDescription);
  data.genderTarget = genderMatch?.[1];

  const ogImage = extractOgTag(html, "image");
  const allImages = extractImages(html);
  if (ogImage) allImages.unshift(ogImage);
  data.images = [...new Set(allImages)];

  data.sizes = extractSizes(html);
  data.colors = extractColors(html);

  const priceStr =
    (jsonLd?.offers as Record<string, string> | undefined)?.price ??
    extractMetaTag(html, "product:price:amount") ??
    extractMetaTag(html, "price");
  if (priceStr) data.price = String(priceStr);

  if (jsonLd?.material) data.material = String(jsonLd.material);

  data.sizeChartHtml = extractSizeChart(html);

  if (jsonLd) {
    const desc = String(jsonLd.description ?? "");
    const fitMatch = /\b(slim|regular|relaxed|oversized|tailored)\s*fit/i.exec(desc);
    if (fitMatch) data.fitType = fitMatch[1].toLowerCase();
  }

  return data;
}
