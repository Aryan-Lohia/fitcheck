import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";
import { findBookingAsParticipant, isBookingParticipant } from "@/lib/booking/participant";
import { serializeBookingMessage } from "@/lib/booking/serialize";
import { BookingStatus } from "@prisma/client";
import { generatePresignedDownloadUrl } from "@/lib/s3/presign";
import { s3Bucket, s3Client } from "@/lib/s3/client";
import { inferImageMimeType } from "@/lib/media/infer-image-mime";
import { checkStorageQuota } from "@/lib/s3/quota";
import { getBlobAndNameFromFormData } from "@/lib/http/form-file";

const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Upload payment screenshot server → S3 (avoids browser PUT CORS and empty File.type / signature mismatch).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if ("status" in session) return session;
  const { id } = await params;

  if (!s3Bucket.trim()) {
    return fail("File storage is not configured (S3_BUCKET_NAME)", 503);
  }

  const booking = await findBookingAsParticipant(id, session.userId);
  if (!booking) return fail("Not found", 404);

  const role = isBookingParticipant(booking, session.userId);
  if (role !== "user") return fail("Only the client can submit payment proof", 403);

  if (booking.status !== BookingStatus.awaiting_payment) {
    return fail("Payment proof is not expected for this booking state", 409);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Invalid form data", 422);
  }

  const parsed = getBlobAndNameFromFormData(form, "file");
  if (!parsed || parsed.blob.size === 0) {
    return fail("Missing file", 422);
  }

  if (parsed.blob.size > MAX_BYTES) {
    return fail("Image must be 10MB or smaller", 422);
  }

  const quota = await checkStorageQuota(session.userId, parsed.blob.size);
  if (quota.isOverLimit) return fail("Storage quota exceeded", 409);

  const reportedType = parsed.blob instanceof File ? parsed.blob.type : parsed.blob.type || "";
  const inferred = inferImageMimeType(parsed.fileName, reportedType);
  if (!inferred.ok) return fail(inferred.reason, 422);

  const mimeType = inferred.mime;
  if (!IMAGE_MIME.has(mimeType)) {
    return fail("Payment proof must be a JPEG, PNG, or WebP image", 422);
  }

  const nameExt = parsed.fileName.split(".").pop()?.toLowerCase();
  const extFromMime =
    mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const ext =
    nameExt && ["jpg", "jpeg", "png", "webp"].includes(nameExt)
      ? nameExt === "jpeg"
        ? "jpg"
        : nameExt
      : extFromMime;

  const s3Key = `users/${session.userId}/booking_payment/${randomUUID()}.${ext}`;
  const buf = Buffer.from(await parsed.blob.arrayBuffer());

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

  const media = await prisma.userMedia.create({
    data: {
      userId: session.userId,
      s3Key,
      fileName: parsed.fileName,
      mimeType,
      fileSize: BigInt(parsed.blob.size),
      category: "booking_payment",
    },
  });

  const imageUrl = await generatePresignedDownloadUrl(media.s3Key);

  const [proofMsg, systemMsg] = await prisma.$transaction(async (tx) => {
    const p = await tx.bookingMessage.create({
      data: {
        bookingId: id,
        authorUserId: session.userId,
        role: "USER",
        kind: "payment_proof",
        body: "Payment screenshot shared.",
        metadataJson: {
          mediaId: media.id,
          imageUrl,
          fileName: media.fileName,
        },
      },
    });

    const s = await tx.bookingMessage.create({
      data: {
        bookingId: id,
        authorUserId: null,
        role: "SYSTEM",
        kind: "system",
        body: "Payment proof received. The expert will confirm once verified.",
        metadataJson: { event: "payment_submitted", status: BookingStatus.payment_submitted },
      },
    });

    await tx.bookingRequest.update({
      where: { id },
      data: {
        status: BookingStatus.payment_submitted,
        paymentProofMediaId: media.id,
      },
    });

    return [p, s] as const;
  });

  return ok(
    {
      messages: [serializeBookingMessage(proofMsg), serializeBookingMessage(systemMsg)],
      booking: { status: BookingStatus.payment_submitted, paymentProofMediaId: media.id },
    },
    201,
  );
}
