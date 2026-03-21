import { type RawProductData, emptyRawProduct } from "./types";
import { extract as genericExtract } from "./genericAdapter";

type MeeshoProductData = {
  name?: string;
  product_name?: string;
  brand?: string;
  category?: string;
  gender?: string;
  images?: string[];
  variations?: {
    size?: string;
    color?: string;
    price?: number;
  }[];
  price?: number;
  material?: string;
  fabric?: string;
  fit?: string;
  catalog_info?: {
    images?: string[];
  };
};

function extractMeeshoJson(html: string): MeeshoProductData | null {
  const patterns = [
    /__NEXT_DATA__[^>]*>\s*(\{[\s\S]*?\})\s*<\/script>/,
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\s*(?:<\/script>|\n)/,
    /"productData"\s*:\s*(\{[\s\S]*?\})\s*[,}]/,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]) as Record<string, unknown>;

        if (parsed.props && typeof parsed.props === "object") {
          const pageProps = (parsed.props as Record<string, unknown>)
            .pageProps as Record<string, unknown> | undefined;
          if (pageProps?.productData) {
            return pageProps.productData as MeeshoProductData;
          }
        }

        if (parsed.productData) {
          return parsed.productData as MeeshoProductData;
        }

        if (parsed.name || parsed.product_name) {
          return parsed as unknown as MeeshoProductData;
        }
      } catch {
        // try next pattern
      }
    }
  }

  return null;
}

export function extract(html: string): RawProductData {
  const meeshoData = extractMeeshoJson(html);

  if (!meeshoData) {
    return genericExtract(html);
  }

  const data = emptyRawProduct();

  data.title = meeshoData.product_name ?? meeshoData.name;
  data.brand = meeshoData.brand;
  data.category = meeshoData.category;
  data.genderTarget = meeshoData.gender;

  if (meeshoData.images) {
    data.images = [...meeshoData.images];
  } else if (meeshoData.catalog_info?.images) {
    data.images = [...meeshoData.catalog_info.images];
  }

  const sizes: string[] = [];
  const colors: string[] = [];

  if (meeshoData.variations) {
    for (const v of meeshoData.variations) {
      if (v.size && !sizes.includes(v.size)) sizes.push(v.size);
      if (v.color && !colors.includes(v.color)) colors.push(v.color);
    }
  }
  data.sizes = sizes;
  data.colors = colors;

  if (meeshoData.price) {
    data.price = String(meeshoData.price);
  } else if (meeshoData.variations?.[0]?.price) {
    data.price = String(meeshoData.variations[0].price);
  }

  data.material = meeshoData.material ?? meeshoData.fabric;
  if (meeshoData.fit) data.fitType = meeshoData.fit.toLowerCase();

  if (data.images.length === 0 || !data.title) {
    const fallback = genericExtract(html);
    if (!data.title) data.title = fallback.title;
    if (data.images.length === 0) data.images = fallback.images;
  }

  return data;
}
