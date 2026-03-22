/** Client- and server-safe: detect iOS / Photos HEIC without importing converters. */
export function isHeicLikeFile(file: Pick<File, "name" | "type">): boolean {
  const m = (file.type || "").toLowerCase().trim();
  if (m === "image/heic" || m === "image/heif") return true;
  if (/\.(heic|heif)$/i.test(file.name)) return true;
  if (!m || m === "application/octet-stream") {
    return /\.(heic|heif)$/i.test(file.name);
  }
  return false;
}
