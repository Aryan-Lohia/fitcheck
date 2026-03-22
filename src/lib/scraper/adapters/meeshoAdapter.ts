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

const MAX_DEEP_DEPTH = 14;

function deepFindProductData(node: unknown, depth = 0): MeeshoProductData | null {
  if (depth > MAX_DEEP_DEPTH || node === null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const x of node) {
      const r = deepFindProductData(x, depth + 1);
      if (r) return r;
    }
    return null;
  }
  const o = node as Record<string, unknown>;
  const pd = o.productData;
  if (pd && typeof pd === "object") {
    const p = pd as Record<string, unknown>;
    if (
      typeof p.name === "string" ||
      typeof p.product_name === "string" ||
      Array.isArray(p.images) ||
      p.catalog_info
    ) {
      return pd as MeeshoProductData;
    }
  }
  for (const v of Object.values(o)) {
    const r = deepFindProductData(v, depth + 1);
    if (r) return r;
  }
  return null;
}

/** Full `__NEXT_DATA__` payload — regex-based parse often truncates nested JSON. */
function extractNextDataRoot(html: string): Record<string, unknown> | null {
  const m = html.match(/id=["']__NEXT_DATA__["'][^>]*>/i);
  if (!m || m.index === undefined) return null;
  const startIdx = m.index + m[0].length;
  const endIdx = html.indexOf("</script>", startIdx);
  if (endIdx === -1) return null;
  const jsonStr = html.slice(startIdx, endIdx).trim();
  if (jsonStr.length < 10) return null;
  try {
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function productDataFromNextRoot(root: Record<string, unknown>): MeeshoProductData | null {
  const props = root.props;
  if (props && typeof props === "object") {
    const pageProps = (props as Record<string, unknown>).pageProps as
      | Record<string, unknown>
      | undefined;
    if (pageProps?.productData && typeof pageProps.productData === "object") {
      return pageProps.productData as MeeshoProductData;
    }
    const deep = deepFindProductData(pageProps, 0);
    if (deep) return deep;
  }
  if (root.productData && typeof root.productData === "object") {
    return root.productData as MeeshoProductData;
  }
  return deepFindProductData(root, 0);
}

function extractMeeshoJson(html: string): MeeshoProductData | null {
  const nextRoot = extractNextDataRoot(html);
  if (nextRoot) {
    const fromTree = productDataFromNextRoot(nextRoot);
    if (fromTree) return fromTree;
  }

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

function extractOgImage(html: string): string | undefined {
  const m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const u = m?.[1]?.trim();
  return u || undefined;
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

  if (meeshoData.images?.length) {
    data.images = [...meeshoData.images];
  } else if (meeshoData.catalog_info?.images?.length) {
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

  if (data.images.length === 0) {
    const og = extractOgImage(html);
    if (og) data.images = [og];
  }

  return data;
}
