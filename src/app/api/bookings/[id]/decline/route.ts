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

  const booking = await prisma.bookingRequest.findUnique({ where: { id } });
  if (!booking) return fail("Booking not found", 404);

  if (booking.status !== "requested") {
    return fail("Booking is not in requested state", 409);
  }

  return ok({ success: true });
}
