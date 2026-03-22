import { inferImageMimeType } from "@/lib/media/infer-image-mime";

/**
 * Resolves Content-Type for S3 presigned PUT (must match client PUT header).
 * PDF allowed only when `allowPdf` (e.g. profile docs), not for payment screenshots.
 */
export function resolvePresignMimeType(
  fileName: string,
  reportedType: string,
  options: { allowPdf: boolean },
): { ok: true; mime: string } | { ok: false; reason: string } {
  const t = (reportedType ?? "").trim().toLowerCase();
  const lowerName = fileName.toLowerCase();

  if (options.allowPdf && (t === "application/pdf" || lowerName.endsWith(".pdf"))) {
    return { ok: true, mime: "application/pdf" };
  }

  if (!options.allowPdf && (t === "application/pdf" || lowerName.endsWith(".pdf"))) {
    return { ok: false, reason: "This upload only accepts images (JPEG, PNG, or WebP)." };
  }

  return inferImageMimeType(fileName, reportedType);
}
