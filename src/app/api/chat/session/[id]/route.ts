import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if ("status" in session) return session;

  const { id } = await params;

  const chatSession = await prisma.chatSession.findFirst({
    where: { id, userId: session.userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!chatSession) return fail("Not found", 404);

  return ok({ session: chatSession });
}
