import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok } from "@/lib/http";
import { NextRequest } from "next/server";
import { BookingStatus, Prisma } from "@prisma/client";

const validStatuses = new Set<string>(Object.values(BookingStatus));

/** Bookings assigned to this expert that belong in the workspace (chat / quote / pay / meet). */
const ACTIVE_PIPELINE: BookingStatus[] = [
  BookingStatus.accepted,
  BookingStatus.awaiting_payment,
  BookingStatus.payment_submitted,
  BookingStatus.payment_confirmed,
  BookingStatus.meeting_link_sent,
  BookingStatus.in_progress,
];

export async function GET(req: NextRequest) {
  const session = await requireRole(["FREELANCE_USER"]);
  if ("status" in session) return session;

  const rawStatus = req.nextUrl.searchParams.get("status") || "requested";

  const fp = await prisma.freelancerProfile.findUnique({
    where: { userId: session.userId },
  });

  if (rawStatus !== "requested" && !fp) {
    return ok({ requests: [] });
  }

  let where: Prisma.BookingRequestWhereInput;
  if (rawStatus === "requested") {
    where = { status: BookingStatus.requested };
  } else if (rawStatus === "active" && fp) {
    where = { freelancerId: fp.id, status: { in: ACTIVE_PIPELINE } };
  } else if (fp && validStatuses.has(rawStatus)) {
    where = { freelancerId: fp.id, status: rawStatus as BookingStatus };
  } else {
    where = { freelancerId: fp!.id, status: BookingStatus.accepted };
  }

  const requests = await prisma.bookingRequest.findMany({
    where,
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return ok({ requests });
}
