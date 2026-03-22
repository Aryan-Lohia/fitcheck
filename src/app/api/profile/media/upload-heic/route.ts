import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { requireAuth } from "@/lib/auth/rbac";
import { checkStorageQuota } from "@/lib/s3/quota";
import { s3Bucket, s3Client } from "@/lib/s3/client";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";
import { logger } from "@/lib/logger";
import { isHeicLikeFile } from "@/lib/media/heic-detect";
import { convertHeicBufferToJpeg } from "@/lib/media/convert-heic";

export const runtime = "nodejs";

/** HEIC decode can exceed default on large files (e.g. Vercel). */
export const maxDuration = 60;

/** Match presign-upload / mediaUploadSchema image cap */
const MAX_BYTES = 10 * 1024 * 1024;

function storedJpegFileName(originalName: string): string {
  const stem =
    originalName.replace(/\.(heic|heif)$/i, "").trim() || "photo";
  const safeStem = stem.length > 180 ? stem.slice(0, 180) : stem;
  return `${safeStem}.jpg`;
}

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if ("status" in session) return session;

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return fail("Expected multipart form data", 400);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e) {
    logger.warn("upload-heic: failed to parse form", { err: String(e) });
    return fail("Invalid multipart body", 400);
  }

  const file = formData.get("file");
  const categoryRaw = formData.get("category");
  const category =
    typeof categoryRaw === "string" && categoryRaw.trim().length > 0
      ? categoryRaw.trim()
      : "photos";

  if (!file || !(file instanceof File)) {
    return fail("Missing file", 400);
  }

  if (!isHeicLikeFile(file)) {
    return fail("File must be HEIC or HEIF", 400);
  }

  if (file.size > MAX_BYTES) {
    return fail("File too large (max 10 MB)", 413);
  }

  const inputBuf = Buffer.from(await file.arrayBuffer());

  let jpegBuf: Buffer;
  try {
    jpegBuf = await convertHeicBufferToJpeg(inputBuf);
  } catch (e) {
    logger.warn("upload-heic: conversion failed", { err: String(e) });
    return fail("Could not convert HEIC image", 422);
  }

  if (jpegBuf.length > MAX_BYTES) {
    return fail("Converted image exceeds size limit", 413);
  }

  const quota = await checkStorageQuota(session.userId, jpegBuf.length);
  if (quota.isOverLimit) {
    return fail("Storage quota exceeded", 409);
  }

  const id = randomUUID();
  const s3Key = `users/${session.userId}/${category}/${id}.jpg`;
  const fileName = storedJpegFileName(file.name);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: s3Key,
      Body: jpegBuf,
      ContentType: "image/jpeg",
    }),
  );

  const media = await prisma.userMedia.create({
    data: {
      userId: session.userId,
      s3Key,
      fileName,
      mimeType: "image/jpeg",
      fileSize: BigInt(jpegBuf.length),
      category,
    },
  });

  return ok({ mediaId: media.id, quota });
}
