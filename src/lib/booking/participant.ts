import type { BookingRequest, BookingStatus, FreelancerProfile, User } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";

export type BookingWithParticipants = BookingRequest & {
  user: Pick<User, "id" | "name" | "email">;
  freelancer: (FreelancerProfile & { user: Pick<User, "id" | "name" | "email"> }) | null;
};

const CHAT_ALLOWED: BookingStatus[] = [
  "accepted",
  "awaiting_payment",
  "payment_submitted",
  "payment_confirmed",
  "meeting_link_sent",
  "in_progress",
];

export function isBookingParticipant(
  booking: { userId: string; freelancerId: string | null; freelancer: { userId: string } | null },
  userId: string,
): "user" | "freelancer" | null {
  if (booking.userId === userId) return "user";
  if (booking.freelancer?.userId === userId) return "freelancer";
  return null;
}

export function canPostChatMessage(status: BookingStatus, freelancerId: string | null): boolean {
  if (!freelancerId) return false;
  return CHAT_ALLOWED.includes(status);
}

export async function findBookingAsParticipant(
  bookingId: string,
  userId: string,
): Promise<BookingWithParticipants | null> {
  const booking = await prisma.bookingRequest.findFirst({
    where: {
      id: bookingId,
      OR: [{ userId }, { freelancer: { userId } }],
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      freelancer: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  return booking;
}
