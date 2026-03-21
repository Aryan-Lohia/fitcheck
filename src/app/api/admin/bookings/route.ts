import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok } from "@/lib/http";

export async function GET() {
  const s = await requireRole(["ADMIN"]);
  if ("status" in s) return s;

  const bookings = await prisma.bookingRequest.findMany({
    include: {
      user: { select: { name: true, email: true } },
      freelancer: { include: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok({ bookings });
}
