import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/rbac";
import { checkStorageQuota } from "@/lib/s3/quota";
import { generatePresignedUploadUrl } from "@/lib/s3/presign";
import { ok, fail } from "@/lib/http";
import { resolvePresignMimeType } from "@/lib/media/resolve-presign-mime";

/** Browsers often send empty `mimeType`; we infer from `fileName` for a valid S3 signature. */
const presignBodySchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().optional().default(""),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
  category: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if ("status" in session) return session;
  const parsed = presignBodySchema.safeParse(await req.json());
  if (!parsed.success) return fail(parsed.error.message, 422);

  const allowPdf = parsed.data.category !== "booking_payment";
  const resolved = resolvePresignMimeType(
    parsed.data.fileName,
    parsed.data.mimeType,
    { allowPdf },
  );
  if (!resolved.ok) return fail(resolved.reason, 422);

  const contentType = resolved.mime;

  const quota = await checkStorageQuota(session.userId, parsed.data.sizeBytes);
  if (quota.isOverLimit) return fail("Storage quota exceeded", 409);

  const ext = parsed.data.fileName.split(".").pop() || "bin";
  const id = randomUUID();
  const s3Key = `users/${session.userId}/${parsed.data.category}/${id}.${ext}`;
  const uploadUrl = await generatePresignedUploadUrl(s3Key, contentType);
  /** Row is created in confirm-upload after S3 PUT + HeadObject so the vault never lists missing objects. */
  return ok({ uploadUrl, s3Key, contentType, quota });
}

