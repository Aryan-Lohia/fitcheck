function refererForRetailImage(url: string): string | undefined {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h.includes("myntassets.com") || h.includes("myntra.com")) {
      return "https://www.myntra.com/";
    }
    if (h.includes("jiocdn") || h.includes("ajio.com")) {
      return "https://www.ajio.com/";
    }
    if (h.includes("meesho") || h.includes("meeshocdn")) {
      return "https://www.meesho.com/";
    }
  } catch {
    /* */
  }
  return undefined;
}

const IMG_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const MAX_REMOTE_IMAGE_BYTES = 10 * 1024 * 1024;

/** Fetch a remote image (retail referers when needed). */
export async function fetchRemoteImageBuffer(
  url: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const ref = refererForRetailImage(url);
  const headerSets: Record<string, string>[] = [];
  if (ref) {
    headerSets.push({
      "user-agent": IMG_UA,
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      referer: ref,
    });
  }
  headerSets.push({
    "user-agent": IMG_UA,
    accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  });

  let last: Error | null = null;
  for (const headers of headerSets) {
    try {
      const res = await fetch(url, { cache: "no-store", headers });
      if (!res.ok) throw new Error(`Image fetch failed (${res.status})`);
      const contentType = res.headers.get("content-type") || "image/jpeg";
      if (!contentType.startsWith("image/")) {
        throw new Error("Attachment is not an image");
      }
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length > MAX_REMOTE_IMAGE_BYTES) {
        throw new Error("Image too large");
      }
      return { buffer, mimeType: contentType };
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw last ?? new Error("Image fetch failed");
}

/** Fetch a remote image and return base64 + mime type for Gemini inlineData. */
export async function fetchRemoteImageAsBase64(
  url: string,
): Promise<{ base64: string; mimeType: string }> {
  const { buffer, mimeType } = await fetchRemoteImageBuffer(url);
  return { base64: buffer.toString("base64"), mimeType };
}
