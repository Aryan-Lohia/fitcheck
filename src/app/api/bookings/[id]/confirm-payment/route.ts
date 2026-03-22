import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";
import { findBookingAsParticipant, isBookingParticipant } from "@/lib/booking/participant";
import { serializeBookingMessage } from "@/lib/booking/serialize";
import { BookingStatus } from "@prisma/client";
import { createMeetForBooking } from "@/lib/google/calendar-meet";
import { sendEmail } from "@/lib/email/sender";
import { bookingMeetReadyForRecipient } from "@/lib/email/templates/bookingMeetReady";

function formatSessionTime(preferredTime: Date | null, durationMinutes: number): string {
  const start =
    preferredTime && preferredTime.getTime() > Date.now()
      ? preferredTime
      : new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return `${start.toLocaleString()} – ${end.toLocaleTimeString()}`;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if ("status" in session) return session;
  const { id } = await params;

  const booking = await findBookingAsParticipant(id, session.userId);
  if (!booking) return fail("Not found", 404);

  const role = isBookingParticipant(booking, session.userId);
  if (role !== "freelancer") return fail("Only the expert can confirm payment", 403);

  if (booking.status === BookingStatus.meeting_link_sent && booking.meetingLink) {
    return ok({
      alreadyCompleted: true,
      booking: {
        id: booking.id,
        status: booking.status,
        meetingLink: booking.meetingLink,
      },
    });
  }

  if (booking.status !== BookingStatus.payment_submitted) {
    return fail("Payment must be submitted before confirmation", 409);
  }

  if (booking.quoteAmountMinor == null || booking.quoteAmountMinor <= 0) {
    return fail("Booking is missing quote amount", 422);
  }

  const userEmail = booking.user.email;
  const expertEmail = booking.freelancer?.user.email;
  if (!expertEmail) return fail("Expert profile incomplete", 422);

  let hangoutLink: string;
  try {
    const meet = await createMeetForBooking({
      topic: booking.topic,
      preferredTime: booking.preferredTime,
      durationMinutes: booking.durationMinutes,
      attendeeEmails: [userEmail, expertEmail],
    });
    hangoutLink = meet.hangoutLink;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create Google Meet";
    return fail(msg, 502);
  }

  const timeLabel = formatSessionTime(booking.preferredTime, booking.durationMinutes);

  const [systemPay, systemMeet, updated] = await prisma.$transaction(async (tx) => {
    const p = await tx.bookingMessage.create({
      data: {
        bookingId: id,
        authorUserId: null,
        role: "SYSTEM",
        kind: "system",
        body: "Payment confirmed by the expert. Creating your Google Meet…",
        metadataJson: {
          event: "payment_confirmed",
          status: BookingStatus.payment_confirmed,
        },
      },
    });

    const m = await tx.bookingMessage.create({
      data: {
        bookingId: id,
        authorUserId: null,
        role: "SYSTEM",
        kind: "system",
        body: `Google Meet is ready: ${hangoutLink}`,
        metadataJson: {
          event: "meeting_created",
          status: BookingStatus.meeting_link_sent,
          meetingLink: hangoutLink,
        },
      },
    });

    const payment = await tx.payment.findFirst({ where: { bookingId: id } });
    if (payment) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          amount: booking.quoteAmountMinor!,
          currency: booking.quoteCurrency || "INR",
          status: "captured",
        },
      });
    } else {
      await tx.payment.create({
        data: {
          bookingId: id,
          provider: "manual",
          amount: booking.quoteAmountMinor!,
          currency: booking.quoteCurrency || "INR",
          status: "captured",
        },
      });
    }

    const b = await tx.bookingRequest.update({
      where: { id },
      data: {
        status: BookingStatus.meeting_link_sent,
        meetingLink: hangoutLink,
        paymentConfirmedAt: new Date(),
        paymentStatus: "captured",
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        freelancer: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });

    return [p, m, b] as const;
  });

  const userName = booking.user.name;
  const expertName = booking.freelancer?.user.name ?? "Your expert";

  const userTmpl = bookingMeetReadyForRecipient({
    recipientName: userName,
    otherPartyName: expertName,
    topic: booking.topic,
    meetingLink: hangoutLink,
    startTimeLabel: timeLabel,
  });
  const expertTmpl = bookingMeetReadyForRecipient({
    recipientName: expertName,
    otherPartyName: userName,
    topic: booking.topic,
    meetingLink: hangoutLink,
    startTimeLabel: timeLabel,
  });

  await Promise.all([
    sendEmail(userEmail, userTmpl.subject, userTmpl.html, userTmpl.text),
    sendEmail(expertEmail, expertTmpl.subject, expertTmpl.html, expertTmpl.text),
  ]);

  return ok({
    messages: [serializeBookingMessage(systemPay), serializeBookingMessage(systemMeet)],
    booking: {
      id: updated.id,
      status: updated.status,
      meetingLink: updated.meetingLink,
      paymentStatus: updated.paymentStatus,
    },
  });
}
