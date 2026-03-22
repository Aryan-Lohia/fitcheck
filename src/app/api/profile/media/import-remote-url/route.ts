import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { fetchRemoteImageBuffer } from "@/lib/ai/remote-image-base64";
import { requireAuth } from "@/lib/auth/rbac";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/prisma/client";
import { checkStorageQuota } from "@/lib/s3/quota";
import { s3Bucket, s3Client } from "@/lib/s3/client";

const bodySchema = z.object({
  imageUrl: z.string().url(),
  titleHint: z.string().max(200).optional(),
});

function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

function safeFileStem(hint: string): string {
  const s = hint
    .trim()
    .slice(0, 80)
    .replace(/[/\\?%*:|"<>]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length > 0 ? s : "shop-product";
}

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if ("status" in session) return session;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  }

  let fetched: { buffer: Buffer; mimeType: string };
  try {
    fetched = await fetchRemoteImageBuffer(parsed.data.imageUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch image";
    return fail(msg, 502);
  }

  const quota = await checkStorageQuota(session.userId, fetched.buffer.length);
  if (quota.isOverLimit) return fail("Storage quota exceeded", 409);

  const ext = extFromMime(fetched.mimeType);
  const id = randomUUID();
  const s3Key = `users/${session.userId}/photos/${id}.${ext}`;
  const stem = parsed.data.titleHint
    ? safeFileStem(parsed.data.titleHint)
    : "shop-product";
  const fileName = `${stem}.${ext}`;

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: s3Bucket,
        Key: s3Key,
        Body: fetched.buffer,
        ContentType: fetched.mimeType,
      }),
    );
  } catch {
    return fail("Failed to store image", 502);
  }

  const media = await prisma.userMedia.create({
    data: {
      userId: session.userId,
      s3Key,
      fileName,
      mimeType: fetched.mimeType,
      fileSize: BigInt(fetched.buffer.length),
      category: "photos",
    },
  });

  return ok({ mediaId: media.id, quota });
}
