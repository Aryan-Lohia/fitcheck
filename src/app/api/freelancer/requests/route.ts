import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok } from "@/lib/http";
import { NextRequest } from "next/server";
import { BookingStatus, Prisma } from "@prisma/client";

const validStatuses = new Set<string>(Object.values(BookingStatus));

export async function GET(req: NextRequest) {
  const session = await requireRole(["FREELANCE_USER"]);
  if ("status" in session) return session;

  const rawStatus = req.nextUrl.searchParams.get("status") || "requested";
  const status = validStatuses.has(rawStatus)
    ? (rawStatus as BookingStatus)
    : BookingStatus.requested;

  const fp = await prisma.freelancerProfile.findUnique({
    where: { userId: session.userId },
  });

  const where: Prisma.BookingRequestWhereInput =
    status === BookingStatus.requested
      ? { status: BookingStatus.requested }
      : { freelancerId: fp?.id, status };

  const requests = await prisma.bookingRequest.findMany({
    where,
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return ok({ requests });
}
