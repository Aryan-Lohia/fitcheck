import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok } from "@/lib/http";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const s = await requireRole(["ADMIN"]);
  if ("status" in s) return s;

  const action = req.nextUrl.searchParams.get("action");
  const days = parseInt(req.nextUrl.searchParams.get("days") || "7");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(action ? { action } : {}),
      createdAt: { gte: since },
    },
    include: { actor: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return ok({ logs });
}
