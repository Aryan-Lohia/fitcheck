import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok } from "@/lib/http";

export async function POST() {
  const s = await requireAuth();
  if ("status" in s) return s;

  const session = await prisma.chatSession.create({
    data: { userId: s.userId, title: "New chat" },
  });
  return ok({ session });
}

export async function GET() {
  const s = await requireAuth();
  if ("status" in s) return s;

  const rows = await prisma.chatSession.findMany({
    where: { userId: s.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      mode: true,
      createdAt: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { contentText: true, createdAt: true },
      },
    },
  });

  const sessions = rows.map((r) => ({
    id: r.id,
    title: r.title,
    mode: r.mode,
    createdAt: r.createdAt,
    lastMessage: r.messages[0] ?? null,
  }));

  return ok({ sessions });
}
