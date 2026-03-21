/** Fetch a remote image and return base64 + mime type for Gemini inlineData. */
export async function fetchRemoteImageAsBase64(
  url: string,
): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Image fetch failed (${res.status})`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    throw new Error("Attachment is not an image");
  }
  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return { base64, mimeType: contentType };
}
