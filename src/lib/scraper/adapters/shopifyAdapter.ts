import { type RawProductData, emptyRawProduct } from "./types";
import { extract as genericExtract } from "./genericAdapter";

type ShopifyVariant = {
  title?: string;
  option1?: string;
  option2?: string;
  option3?: string;
  price?: string | number;
  available?: boolean;
};

type ShopifyImage = {
  src?: string;
};

type ShopifyOption = {
  name?: string;
  values?: string[];
};

type ShopifyProduct = {
  title?: string;
  vendor?: string;
  type?: string;
  variants?: ShopifyVariant[];
  images?: ShopifyImage[];
  options?: ShopifyOption[];
  body_html?: string;
  description?: string;
};

function extractShopifyJson(html: string): ShopifyProduct | null {
  const metaPattern = /var\s+meta\s*=\s*(\{[\s\S]*?\});\s*(?:<\/script>|\n)/;
  const metaMatch = metaPattern.exec(html);
  if (metaMatch) {
    try {
      const meta = JSON.parse(metaMatch[1]) as { product?: ShopifyProduct };
      if (meta.product) return meta.product;
    } catch {
      // fall through
    }
  }

  const productJsonPatterns = [
    /product:\s*(\{[\s\S]*?\})\s*,\s*(?:collection|onVariantSelected)/,
    /"product"\s*:\s*(\{[\s\S]*?"variants"[\s\S]*?\})\s*[,}]/,
  ];

  for (const pattern of productJsonPatterns) {
    const match = pattern.exec(html);
    if (match) {
      try {
        return JSON.parse(match[1]) as ShopifyProduct;
      } catch {
        // continue
      }
    }
  }

  const scriptJsonLd =
    /<script[^>]+type=["']application\/json["'][^>]*data-product-json[^>]*>([\s\S]*?)<\/script>/i;
  const jsonLdMatch = scriptJsonLd.exec(html);
  if (jsonLdMatch) {
    try {
      return JSON.parse(jsonLdMatch[1]) as ShopifyProduct;
    } catch {
      // fall through
    }
  }

  return null;
}

function extractSizeChart(html: string): string | undefined {
  const sizeChartRe =
    /<(?:div|section)[^>]*class=["'][^"']*size[-_]?chart[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i;
  const match = sizeChartRe.exec(html);
  return match?.[1];
}

export function extract(html: string): RawProductData {
  const shopifyProduct = extractShopifyJson(html);

  if (!shopifyProduct) {
    return genericExtract(html);
  }

  const data = emptyRawProduct();

  data.title = shopifyProduct.title;
  data.brand = shopifyProduct.vendor;
  data.category = shopifyProduct.type;

  if (shopifyProduct.images) {
    data.images = shopifyProduct.images
      .map((img) => img.src)
      .filter((src): src is string => !!src);
  }

  const sizes: string[] = [];
  const colors: string[] = [];

  if (shopifyProduct.options) {
    for (const option of shopifyProduct.options) {
      const name = option.name?.toLowerCase() ?? "";
      if (name.includes("size") && option.values) {
        sizes.push(...option.values);
      } else if (
        (name.includes("color") || name.includes("colour")) &&
        option.values
      ) {
        colors.push(...option.values);
      }
    }
  }

  if (sizes.length === 0 && shopifyProduct.variants) {
    for (const variant of shopifyProduct.variants) {
      const sizeValue = variant.option1 ?? variant.title;
      if (sizeValue && !sizes.includes(sizeValue)) {
        sizes.push(sizeValue);
      }
    }
  }

  data.sizes = sizes;
  data.colors = colors;

  if (shopifyProduct.variants?.[0]?.price) {
    data.price = String(shopifyProduct.variants[0].price);
  }

  const bodyHtml = shopifyProduct.body_html ?? shopifyProduct.description ?? "";
  const fitMatch = /\b(slim|regular|relaxed|oversized|tailored)\s*fit/i.exec(bodyHtml);
  if (fitMatch) data.fitType = fitMatch[1].toLowerCase();

  const materialMatch = /(?:material|fabric)\s*[:\-]\s*([^<,\n]+)/i.exec(bodyHtml);
  if (materialMatch) data.material = materialMatch[1].trim();

  data.sizeChartHtml = extractSizeChart(html);

  return data;
}
