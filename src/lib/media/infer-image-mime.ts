const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Browsers often leave `File.type` empty (especially mobile). S3 presigned PUTs must use the
 * same Content-Type that was used when signing — return this value from the API and send it on PUT.
 */
export function inferImageMimeType(
  fileName: string,
  reportedType: string,
): { ok: true; mime: string } | { ok: false; reason: string } {
  const t = (reportedType ?? "").trim().toLowerCase();
  if (t === "image/jpg") return { ok: true, mime: "image/jpeg" };
  if (t === "image/jpeg" || t === "image/png" || t === "image/webp") {
    return { ok: true, mime: t };
  }

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "heic" || ext === "heif") {
    return {
      ok: false,
      reason:
        "HEIC photos are not supported here. Export as JPEG or PNG (e.g. share as “Most Compatible” on iPhone).",
    };
  }

  const fromExt = EXT_TO_MIME[ext];
  if (fromExt) return { ok: true, mime: fromExt };

  if (!t && !ext) {
    return {
      ok: false,
      reason: "Could not detect file type. Rename the file with a .jpg, .png, or .webp extension.",
    };
  }

  return {
    ok: false,
    reason: "Unsupported image type. Use JPEG, PNG, or WebP.",
  };
}
