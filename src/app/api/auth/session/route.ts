import { getSession } from "@/lib/auth/session";
import { ok } from "@/lib/http";
import { prisma } from "@/lib/prisma/client";

export async function GET() {
  const session = await getSession();
  if (!session) return ok(null);

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });

  return ok({
    userId: session.userId,
    role: session.role,
    email: user?.email ?? null,
  });
}
