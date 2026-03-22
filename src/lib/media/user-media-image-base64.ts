import { getS3ObjectBuffer } from "@/lib/s3/get-object-buffer";

/**
 * Gemini inlineData expects a concrete image/* type (not octet-stream).
 */
export function normalizeImageMimeForGemini(dbMime: string, s3Key: string): string {
  const m = (dbMime || "").toLowerCase().trim().split(";")[0] ?? "";
  if (m.startsWith("image/") && !m.includes("svg")) return m;
  const ext = s3Key.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "image/jpeg";
}

/** Load profile / vault raster from S3 via SDK (avoids presigned GET + fetch 404 quirks). */
export async function getUserMediaAsGeminiInline(params: {
  s3Key: string;
  mimeTypeFromDb: string;
}): Promise<{ base64: string; mimeType: string }> {
  const buf = await getS3ObjectBuffer(params.s3Key);
  return {
    base64: buf.toString("base64"),
    mimeType: normalizeImageMimeForGemini(params.mimeTypeFromDb, params.s3Key),
  };
}
