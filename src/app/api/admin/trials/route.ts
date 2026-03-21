import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok } from "@/lib/http";

export async function GET() {
  const s = await requireRole(["ADMIN"]);
  if ("status" in s) return s;

  const trials = await prisma.trial.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: { startAt: "desc" },
  });

  return ok({ trials });
}
