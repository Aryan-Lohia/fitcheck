import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";
import { findBookingAsParticipant, isBookingParticipant } from "@/lib/booking/participant";
import { bookingPaymentProofSchema } from "@/lib/validators/booking-room";
import { serializeBookingMessage } from "@/lib/booking/serialize";
import { BookingStatus } from "@prisma/client";
import { generatePresignedDownloadUrl } from "@/lib/s3/presign";

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if ("status" in session) return session;
  const { id } = await params;

  const booking = await findBookingAsParticipant(id, session.userId);
  if (!booking) return fail("Not found", 404);

  const role = isBookingParticipant(booking, session.userId);
  if (role !== "user") return fail("Only the client can submit payment proof", 403);

  if (booking.status !== BookingStatus.awaiting_payment) {
    return fail("Payment proof is not expected for this booking state", 409);
  }

  const parsed = bookingPaymentProofSchema.safeParse(await req.json());
  if (!parsed.success) return fail(parsed.error.message, 422);

  const media = await prisma.userMedia.findFirst({
    where: {
      id: parsed.data.mediaId,
      userId: session.userId,
      isDeleted: false,
      category: "booking_payment",
    },
  });

  if (!media) return fail("Invalid or missing payment screenshot upload", 422);
  if (!IMAGE_MIME.has(media.mimeType)) return fail("Payment proof must be an image", 422);

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
