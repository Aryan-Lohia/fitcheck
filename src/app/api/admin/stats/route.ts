import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok } from "@/lib/http";

export async function GET() {
  const s = await requireRole(["ADMIN"]);
  if ("status" in s) return s;

  const [users, trials, pendingFreelancers, todayBookings] = await Promise.all([
    prisma.user.count(),
    prisma.trial.count({ where: { endAt: { gte: new Date() } } }),
    prisma.freelancerProfile.count({
      where: { verificationStatus: { in: ["submitted", "under_review"] } },
    }),
    prisma.bookingRequest.count({
      where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
  ]);

  return ok({ users, trials, pendingFreelancers, todayBookings });
}
