import { NextRequest } from "next/server";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";
import { checkStorageQuota } from "@/lib/s3/quota";
import { s3Bucket, s3Client } from "@/lib/s3/client";

const MAX_BYTES = 10 * 1024 * 1024;

const confirmBodySchema = z.object({
  s3Key: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  category: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if ("status" in session) return session;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const parsed = confirmBodySchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  }

  const prefix = `users/${session.userId}/`;
  if (!parsed.data.s3Key.startsWith(prefix)) {
    return fail("Invalid upload key", 403);
  }

  let size = 0;
  try {
    const head = await s3Client.send(
      new HeadObjectCommand({ Bucket: s3Bucket, Key: parsed.data.s3Key }),
    );
    size = Number(head.ContentLength ?? 0);
  } catch {
    return fail(
      "Uploaded file not found in storage yet. Finish the upload, then try again.",
      400,
    );
  }

  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
    return fail("Invalid or empty uploaded file", 422);
  }

  const quota = await checkStorageQuota(session.userId, size);
  if (quota.isOverLimit) return fail("Storage quota exceeded", 409);

  const existing = await prisma.userMedia.findFirst({
    where: {
      userId: session.userId,
      s3Key: parsed.data.s3Key,
      isDeleted: false,
    },
  });
  if (existing) {
    return ok({ mediaId: existing.id, quota });
  }

  const media = await prisma.userMedia.create({
    data: {
      userId: session.userId,
      s3Key: parsed.data.s3Key,
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
      fileSize: BigInt(size),
      category: parsed.data.category,
    },
  });

  return ok({ mediaId: media.id, quota });
}
