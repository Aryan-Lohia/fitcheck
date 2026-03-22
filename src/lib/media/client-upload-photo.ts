import { isHeicLikeFile } from "@/lib/media/heic-detect";

export type UploadUserMediaPhotoOptions = {
  category?: string;
  /** Stored filename (e.g. profile `front-…-orig.heic` → saved as `.jpg` after conversion). */
  fileName?: string;
};

/**
 * Presigned S3 upload for JPEG/PNG/WebP; server-side HEIC→JPEG for HEIC/HEIF.
 */
export async function uploadUserMediaPhoto(
  file: File,
  options: UploadUserMediaPhotoOptions = {},
): Promise<{ mediaId: string }> {
  const category = options.category ?? "photos";
  const effectiveName = options.fileName ?? file.name;

  if (isHeicLikeFile(file)) {
    const uploadFile =
      options.fileName != null
        ? new File([file], effectiveName, {
          type: file.type || "image/heic",
          lastModified: file.lastModified,
        })
        : file;

    const fd = new FormData();
    fd.append("file", uploadFile);
    fd.append("category", category);

    const res = await fetch("/api/profile/media/upload-heic", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(
        typeof body?.error === "string" ? body.error : "Upload failed",
      );
    }
    return (await res.json()) as { mediaId: string };
  }

  const presignRes = await fetch("/api/profile/media/presign-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: effectiveName,
      mimeType: file.type,
      sizeBytes: file.size,
      category,
    }),
  });
  if (!presignRes.ok) {
    const body = await presignRes.json().catch(() => null);
    throw new Error(
      typeof body?.error === "string" ? body.error : "Failed to get upload URL",
    );
  }
  const { uploadUrl, s3Key, contentType } = (await presignRes.json()) as {
    uploadUrl: string;
    s3Key: string;
    contentType: string;
  };

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || contentType },
    body: file,
  });
  if (!putRes.ok) throw new Error("Upload to storage failed");

  const confirmRes = await fetch("/api/profile/media/confirm-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      s3Key,
      fileName: effectiveName,
      mimeType: contentType,
      category,
    }),
  });
  if (!confirmRes.ok) {
    const body = await confirmRes.json().catch(() => null);
    throw new Error(
      typeof body?.error === "string" ? body.error : "Upload confirmation failed",
    );
  }
  const confirmed = (await confirmRes.json()) as { mediaId: string };

  return { mediaId: confirmed.mediaId };
}
