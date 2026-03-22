import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { ok, fail } from "@/lib/http";
import {
  canPostChatMessage,
  findBookingAsParticipant,
  isBookingParticipant,
} from "@/lib/booking/participant";
import { serializeBooking } from "@/lib/booking/serialize";
import { logger } from "@/lib/logger";
import { generatePresignedDownloadUrl } from "@/lib/s3/presign";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if ("status" in session) return session;

  const { id } = await params;

  const booking = await findBookingAsParticipant(id, session.userId);
  if (!booking) return fail("Not found", 404);

  const myRole = isBookingParticipant(booking, session.userId);
  if (!myRole) return fail("Not found", 404);

  const qrKey = booking.freelancer?.upiQrS3Key ?? null;
  const upiQrConfigured = Boolean(qrKey);
  let upiQrUrl: string | null = null;
  const showUpi =
    qrKey &&
    (booking.status === "awaiting_payment" || booking.status === "payment_submitted");
  if (showUpi && qrKey) {
    try {
      upiQrUrl = await generatePresignedDownloadUrl(qrKey);
    } catch (e) {
      logger.warn("UPI QR presigned download failed (booking)", {
        bookingId: booking.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const canChat = canPostChatMessage(booking.status, booking.freelancerId);
  const canQuote =
    myRole === "freelancer" && booking.status === "accepted";
  const canSubmitProof =
    myRole === "user" && booking.status === "awaiting_payment";
  const canConfirmPayment =
    myRole === "freelancer" && booking.status === "payment_submitted";

  return ok({
    booking: serializeBooking(booking),
    myRole,
    upiQrUrl,
    upiQrConfigured,
    canChat,
    canQuote,
    canSubmitProof,
    canConfirmPayment,
  });
}
