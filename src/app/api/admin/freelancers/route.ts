import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok } from "@/lib/http";

export async function GET() {
  const s = await requireRole(["ADMIN"]);
  if ("status" in s) return s;

  const freelancers = await prisma.freelancerProfile.findMany({
    include: { user: { select: { name: true, email: true, createdAt: true } } },
    orderBy: { approvedAt: "desc" },
  });

  return ok({ freelancers });
}
