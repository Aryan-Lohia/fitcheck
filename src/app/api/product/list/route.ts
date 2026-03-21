import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok } from "@/lib/http";

export async function GET() {
  const session = await requireAuth();
  if ("status" in session) return session;

  const imports = await prisma.productImport.findMany({
    where: { userId: session.userId },
    include: { images: { take: 1 } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return ok({ imports });
}
