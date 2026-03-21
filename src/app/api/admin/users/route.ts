import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok } from "@/lib/http";

export async function GET() {
  const s = await requireRole(["ADMIN"]);
  if ("status" in s) return s;

  const users = await prisma.user.findMany({
    include: {
      profile: true,
      _count: { select: { media: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok({ users });
}
