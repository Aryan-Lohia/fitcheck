import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok } from "@/lib/http";

export async function GET() {
  const s = await requireRole(["ADMIN"]);
  if ("status" in s) return s;

  const usage = await prisma.storageUsageDaily.findMany({
    orderBy: { date: "desc" },
    take: 100,
    include: { user: { select: { name: true, email: true } } },
  });

  return ok({ usage });
}
