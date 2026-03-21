import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if ("status" in session) return session;

  const { id } = await params;

  const booking = await prisma.bookingRequest.findUnique({ where: { id } });
  if (!booking) return fail("Booking not found", 404);

  const isOwner = booking.userId === session.userId;

  let isAssignedFreelancer = false;
  if (booking.freelancerId) {
    const fp = await prisma.freelancerProfile.findUnique({
      where: { userId: session.userId },
    });
    isAssignedFreelancer = fp?.id === booking.freelancerId;
  }

  if (!isOwner && !isAssignedFreelancer) {
    return fail("Forbidden", 403);
  }

  const updated = await prisma.bookingRequest.update({
    where: { id },
    data: { status: "cancelled" },
  });

  return ok({ booking: updated });
}
