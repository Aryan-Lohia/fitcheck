/**
 * Ajio CDN uses different paths per resolution, with size baked into the filename, e.g.
 * `.../folder/-78Wx98H-469625454-blue-MODEL.jpg` vs `.../other/-1117Wx1400H-469625454-blue-MODEL.jpg`.
 * Same catalog shot, three fetches. We dedupe by the stable suffix after the dimension prefix
 * and keep the largest WxH product as the single displayed URL.
 */

function parseAjioCatalogPart(filename: string): { catalog: string; pixels: number } | null {
  const m = filename.match(/^-(\d+)Wx(\d+)H-(.+)$/i);
  if (!m) return null;
  const w = parseInt(m[1], 10);
  const h = parseInt(m[2], 10);
  return { catalog: m[3].toLowerCase(), pixels: w * h };
}

function resolutionPixels(url: string): number {
  try {
    const u = new URL(url.trim().replace(/^http:\/\//i, "https://"));
    if (!u.hostname.toLowerCase().includes("ajio.com")) return 0;
    const last = u.pathname.split("/").pop() ?? "";
    const parsed = parseAjioCatalogPart(last);
    return parsed?.pixels ?? 0;
  } catch {
    return 0;
  }
}

export function productImageDedupeKey(url: string): string {
  const cleaned = url.trim().replace(/^http:\/\//i, "https://");
  try {
    const u = new URL(cleaned);
    const host = u.hostname.toLowerCase();
    if (!host.includes("ajio.com")) return cleaned;

    const last = u.pathname.split("/").pop() ?? "";
    const parsed = parseAjioCatalogPart(last);
    if (parsed) {
      return `${host}/${parsed.catalog}`;
    }
    return `${host}${u.pathname}`.toLowerCase();
  } catch {
    return cleaned;
  }
}

export function dedupeImageUrls(urls: string[]): string[] {
  const bestByKey = new Map<string, string>();
  const keyOrder: string[] = [];

  for (const raw of urls) {
    const cleaned = raw.trim().replace(/^http:\/\//i, "https://");
    if (!cleaned) continue;
    const key = productImageDedupeKey(cleaned);
    const px = resolutionPixels(cleaned);

    if (!bestByKey.has(key)) {
      keyOrder.push(key);
      bestByKey.set(key, cleaned);
      continue;
    }
    const prev = bestByKey.get(key)!;
    if (px > resolutionPixels(prev)) {
      bestByKey.set(key, cleaned);
    }
  }

  return keyOrder.map((k) => bestByKey.get(k)!);
}

export function dedupeProductImageRows<T extends { imageUrl: string }>(rows: T[]): T[] {
  const bestByKey = new Map<string, T>();
  const keyOrder: string[] = [];

  for (const row of rows) {
    const cleaned = row.imageUrl.trim().replace(/^http:\/\//i, "https://");
    if (!cleaned) continue;
    const key = productImageDedupeKey(row.imageUrl);
    const px = resolutionPixels(row.imageUrl);

    if (!bestByKey.has(key)) {
      keyOrder.push(key);
      bestByKey.set(key, row);
      continue;
    }
    const prev = bestByKey.get(key)!;
    if (px > resolutionPixels(prev.imageUrl)) {
      bestByKey.set(key, row);
    }
  }

  return keyOrder.map((k) => bestByKey.get(k)!);
}
