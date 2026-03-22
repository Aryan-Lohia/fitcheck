import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok } from "@/lib/http";

export async function GET() {
  const session = await requireRole(["FREELANCE_USER"]);
  if ("status" in session) return session;

  const fp = await prisma.freelancerProfile.findUnique({
    where: { userId: session.userId },
  });

  if (!fp) return ok({ pending: 0, upcoming: 0, completed: 0 });

  const [pending, upcoming, completed] = await Promise.all([
    prisma.bookingRequest.count({ where: { status: "requested" } }),
    prisma.bookingRequest.count({
      where: {
        freelancerId: fp.id,
        status: {
          in: [
            "accepted",
            "awaiting_payment",
            "payment_submitted",
            "payment_confirmed",
            "meeting_link_sent",
            "in_progress",
          ],
        },
      },
    }),
    prisma.bookingRequest.count({
      where: { freelancerId: fp.id, status: "completed" },
    }),
  ]);

  return ok({ pending, upcoming, completed });
}
