import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { requireAuth } from "@/lib/auth/rbac";
import { mediaUploadSchema } from "@/lib/validators/media";
import { checkStorageQuota } from "@/lib/s3/quota";
import { generatePresignedUploadUrl } from "@/lib/s3/presign";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if ("status" in session) return session;
  const parsed = mediaUploadSchema.safeParse(await req.json());
  if (!parsed.success) return fail(parsed.error.message, 422);
  const quota = await checkStorageQuota(session.userId, parsed.data.sizeBytes);
  if (quota.isOverLimit) return fail("Storage quota exceeded", 409);
  const ext = parsed.data.fileName.split('.').pop() || 'bin';
  const id = randomUUID();
  const s3Key = `users/${session.userId}/${parsed.data.category}/${id}.${ext}`;
  const uploadUrl = await generatePresignedUploadUrl(s3Key, parsed.data.mimeType);
  const media = await prisma.userMedia.create({ data: { userId: session.userId, s3Key, fileName: parsed.data.fileName, mimeType: parsed.data.mimeType, fileSize: BigInt(parsed.data.sizeBytes), category: parsed.data.category } });
  return ok({ uploadUrl, s3Key, mediaId: media.id, quota });
}

