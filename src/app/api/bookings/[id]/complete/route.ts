import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireRole(["FREELANCE_USER"]);
  if ("status" in session) return session;

  const { id } = await params;

  const fp = await prisma.freelancerProfile.findUnique({
    where: { userId: session.userId },
  });
  if (!fp) return fail("Freelancer profile not found", 404);

  const booking = await prisma.bookingRequest.findUnique({ where: { id } });
  if (!booking) return fail("Booking not found", 404);

  if (booking.freelancerId !== fp.id) {
    return fail("Forbidden", 403);
  }

  const updated = await prisma.bookingRequest.update({
    where: { id },
    data: { status: "completed", completedAt: new Date() },
  });

  return ok({ booking: updated });
}
