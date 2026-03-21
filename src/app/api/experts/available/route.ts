import { prisma } from "@/lib/prisma/client";
import { ok } from "@/lib/http";
import { requireAuth } from "@/lib/auth/rbac";

export async function GET() {
  const session = await requireAuth();
  if ("status" in session) return session;

  const experts = await prisma.freelancerProfile.findMany({
    where: { verificationStatus: "approved" },
    include: { user: { select: { name: true, email: true } } },
  });

  return ok({ experts });
}
