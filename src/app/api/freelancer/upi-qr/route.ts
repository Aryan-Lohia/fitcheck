import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";
import { generatePresignedUploadUrl, generatePresignedDownloadUrl } from "@/lib/s3/presign";
import { inferImageMimeType } from "@/lib/media/infer-image-mime";
import {
  deleteReplacedFreelancerUpiQr,
  freelancerUpiQrKeyPrefix,
  isKeyUnderFreelancerUpiQrPrefix,
} from "@/lib/freelancer/upi-qr-s3";
import { logger } from "@/lib/logger";
import { freelancerUpiPresignSchema, freelancerUpiConfirmSchema } from "@/lib/validators/freelancer-upi";

export async function GET() {
  const session = await requireRole(["FREELANCE_USER"]);
  if ("status" in session) return session;

  const fp = await prisma.freelancerProfile.findUnique({
    where: { userId: session.userId },
  });
  if (!fp) return fail("Freelancer profile not found", 404);

  let previewUrl: string | null = null;
  if (fp.upiQrS3Key) {
    try {
      previewUrl = await generatePresignedDownloadUrl(fp.upiQrS3Key);
    } catch (e) {
      logger.warn("UPI QR presigned download failed (settings)", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return ok({
    upiVpa: fp.upiVpa,
    hasQr: Boolean(fp.upiQrS3Key),
    previewUrl,
  });
}

export async function POST(req: NextRequest) {
  const session = await requireRole(["FREELANCE_USER"]);
  if ("status" in session) return session;

  const fp = await prisma.freelancerProfile.findUnique({
    where: { userId: session.userId },
  });
  if (!fp) return fail("Freelancer profile not found", 404);

  const parsed = freelancerUpiPresignSchema.safeParse(await req.json());
  if (!parsed.success) return fail(parsed.error.message, 422);

  const inferred = inferImageMimeType(parsed.data.fileName, parsed.data.mimeType);
  if (!inferred.ok) return fail(inferred.reason, 422);

  const mimeType = inferred.mime;
  const extFromMime =
    mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const nameExt = parsed.data.fileName.split(".").pop()?.toLowerCase();
  const ext =
    nameExt && ["jpg", "jpeg", "png", "webp"].includes(nameExt)
      ? nameExt === "jpeg"
        ? "jpg"
        : nameExt
      : extFromMime;

  const id = randomUUID();
  const s3Key = `${freelancerUpiQrKeyPrefix(fp.id)}${id}.${ext}`;
  const uploadUrl = await generatePresignedUploadUrl(s3Key, mimeType);

  return ok({ uploadUrl, s3Key, contentType: mimeType });
}

export async function PATCH(req: NextRequest) {
  const session = await requireRole(["FREELANCE_USER"]);
  if ("status" in session) return session;

  const fp = await prisma.freelancerProfile.findUnique({
    where: { userId: session.userId },
  });
  if (!fp) return fail("Freelancer profile not found", 404);

  const parsed = freelancerUpiConfirmSchema.safeParse(await req.json());
  if (!parsed.success) return fail(parsed.error.message, 422);

  if (
    parsed.data.s3Key &&
    !isKeyUnderFreelancerUpiQrPrefix(parsed.data.s3Key, fp.id)
  ) {
    return fail("Invalid upload key", 422);
  }

  const previousKey = fp.upiQrS3Key;
  await prisma.freelancerProfile.update({
    where: { id: fp.id },
    data: {
      ...(parsed.data.s3Key ? { upiQrS3Key: parsed.data.s3Key } : {}),
      ...(parsed.data.upiVpa !== undefined ? { upiVpa: parsed.data.upiVpa || null } : {}),
    },
  });

  if (parsed.data.s3Key) {
    await deleteReplacedFreelancerUpiQr(previousKey, parsed.data.s3Key);
  }

  return ok({ success: true });
}
