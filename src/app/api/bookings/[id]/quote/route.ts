import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";
import { findBookingAsParticipant, isBookingParticipant } from "@/lib/booking/participant";
import { bookingQuoteSchema } from "@/lib/validators/booking-room";
import { serializeBookingMessage } from "@/lib/booking/serialize";
import { BookingStatus } from "@prisma/client";

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
  if (role !== "freelancer") return fail("Only the expert can send a quote", 403);

  if (booking.status !== BookingStatus.accepted) {
    return fail("Quote can only be sent after the booking is accepted", 409);
  }

  if (!booking.freelancer?.upiQrS3Key) {
    return fail("Add your UPI QR in freelancer settings before sending a quote", 422);
  }

  const parsed = bookingQuoteSchema.safeParse(await req.json());
  if (!parsed.success) return fail(parsed.error.message, 422);

  const amountMinor = Math.round(parsed.data.amountRupees * 100);

  const [quoteMsg, systemMsg, updated] = await prisma.$transaction(async (tx) => {
    const q = await tx.bookingMessage.create({
      data: {
        bookingId: id,
        authorUserId: session.userId,
        role: "FREELANCER",
        kind: "quote",
        body: `Quoted ₹${parsed.data.amountRupees.toFixed(2)} INR${parsed.data.notes ? `\n\n${parsed.data.notes}` : ""}`,
        metadataJson: {
          amountRupees: parsed.data.amountRupees,
          amountMinor,
          currency: "INR",
          notes: parsed.data.notes ?? null,
        },
      },
    });

    const s = await tx.bookingMessage.create({
      data: {
        bookingId: id,
        authorUserId: null,
        role: "SYSTEM",
        kind: "system",
        body: "Quote sent. The client can pay via UPI using the QR shown in the booking panel.",
        metadataJson: { event: "quote_sent", status: BookingStatus.awaiting_payment },
      },
    });

    const b = await tx.bookingRequest.update({
      where: { id },
      data: {
        status: BookingStatus.awaiting_payment,
        quoteAmountMinor: amountMinor,
        quoteCurrency: "INR",
        quotedAt: new Date(),
        quoteNotes: parsed.data.notes ?? null,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        freelancer: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });

    return [q, s, b] as const;
  });

  return ok(
    {
      messages: [serializeBookingMessage(quoteMsg), serializeBookingMessage(systemMsg)],
      booking: {
        id: updated.id,
        status: updated.status,
        quoteAmountMinor: updated.quoteAmountMinor,
        quoteCurrency: updated.quoteCurrency,
        quotedAt: updated.quotedAt?.toISOString() ?? null,
        quoteNotes: updated.quoteNotes,
      },
    },
    201,
  );
}
