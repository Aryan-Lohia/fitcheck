import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";
import { inferImageMimeType } from "@/lib/media/infer-image-mime";
import {
  deleteReplacedFreelancerUpiQr,
  freelancerUpiQrKeyPrefix,
} from "@/lib/freelancer/upi-qr-s3";
import { s3Bucket, s3Client } from "@/lib/s3/client";
import { getBlobAndNameFromFormData } from "@/lib/http/form-file";

const MAX_BYTES = 3 * 1024 * 1024;

/**
 * Upload UPI QR from the browser without a presigned PUT (avoids S3 bucket CORS issues).
 */
export async function POST(req: Request) {
  const session = await requireRole(["FREELANCE_USER"]);
  if ("status" in session) return session;

  if (!s3Bucket.trim()) {
    return fail("File storage is not configured (S3_BUCKET_NAME)", 503);
  }

  const fp = await prisma.freelancerProfile.findUnique({
    where: { userId: session.userId },
  });
  if (!fp) return fail("Freelancer profile not found", 404);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Invalid form data", 422);
  }

  const upiVpaRaw = form.get("upiVpa");
  const parsedFile = getBlobAndNameFromFormData(form, "file");
  if (!parsedFile || parsedFile.blob.size === 0) {
    return fail("Missing file", 422);
  }

  if (parsedFile.blob.size > MAX_BYTES) {
    return fail("Image must be 3MB or smaller", 422);
  }

  const reportedType =
    parsedFile.blob instanceof File ? parsedFile.blob.type : parsedFile.blob.type || "";
  const inferred = inferImageMimeType(parsedFile.fileName, reportedType);
  if (!inferred.ok) return fail(inferred.reason, 422);

  const mimeType = inferred.mime;
  const nameExt = parsedFile.fileName.split(".").pop()?.toLowerCase();
  const extFromMime =
    mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const ext =
    nameExt && ["jpg", "jpeg", "png", "webp"].includes(nameExt)
      ? nameExt === "jpeg"
        ? "jpg"
        : nameExt
      : extFromMime;

  const previousKey = fp.upiQrS3Key;
  const s3Key = `${freelancerUpiQrKeyPrefix(fp.id)}${randomUUID()}.${ext}`;
  const buf = Buffer.from(await parsedFile.blob.arrayBuffer());

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: s3Bucket,
        Key: s3Key,
        Body: buf,
        ContentType: mimeType,
      }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "S3 upload failed";
    return fail(msg, 502);
  }

  const upiVpa =
    typeof upiVpaRaw === "string" && upiVpaRaw.trim() ? upiVpaRaw.trim().slice(0, 100) : undefined;

  await prisma.freelancerProfile.update({
    where: { id: fp.id },
    data: {
      upiQrS3Key: s3Key,
      ...(upiVpa !== undefined ? { upiVpa } : {}),
    },
  });

  await deleteReplacedFreelancerUpiQr(previousKey, s3Key);

  return ok({ success: true }, 201);
}
