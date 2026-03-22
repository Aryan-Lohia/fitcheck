import type { BookingMessage } from "@prisma/client";
import type { BookingWithParticipants } from "@/lib/booking/participant";

export function serializeBooking(b: BookingWithParticipants) {
  return {
    id: b.id,
    userId: b.userId,
    freelancerId: b.freelancerId,
    status: b.status,
    topic: b.topic,
    notes: b.notes,
    preferredTime: b.preferredTime?.toISOString() ?? null,
    durationMinutes: b.durationMinutes,
    meetingLink: b.meetingLink,
    paymentStatus: b.paymentStatus,
    quoteAmountMinor: b.quoteAmountMinor,
    quoteCurrency: b.quoteCurrency,
    quotedAt: b.quotedAt?.toISOString() ?? null,
    quoteNotes: b.quoteNotes,
    paymentProofMediaId: b.paymentProofMediaId,
    paymentConfirmedAt: b.paymentConfirmedAt?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
    acceptedAt: b.acceptedAt?.toISOString() ?? null,
    completedAt: b.completedAt?.toISOString() ?? null,
    user: b.user,
    freelancer: b.freelancer
      ? {
        id: b.freelancer.id,
        bio: b.freelancer.bio,
        expertiseTagsJson: b.freelancer.expertiseTagsJson,
        upiVpa: b.freelancer.upiVpa,
        user: b.freelancer.user,
      }
      : null,
  };
}

export function serializeBookingMessage(m: BookingMessage) {
  return {
    id: m.id,
    bookingId: m.bookingId,
    authorUserId: m.authorUserId,
    role: m.role,
    kind: m.kind,
    body: m.body,
    metadataJson: m.metadataJson,
    createdAt: m.createdAt.toISOString(),
  };
}

export type SerializedBooking = ReturnType<typeof serializeBooking>;
