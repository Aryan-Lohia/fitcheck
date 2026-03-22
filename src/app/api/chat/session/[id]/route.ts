import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";

const patchSchema = z.object({
  mode: z.enum(["shop", "tryon"]),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if ("status" in session) return session;

  const { id } = await params;

  const row = await prisma.chatSession.findFirst({
    where: { id, userId: session.userId },
    select: {
      id: true,
      title: true,
      mode: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          senderType: true,
          contentText: true,
          contentJson: true,
          attachmentsJson: true,
          createdAt: true,
        },
      },
    },
  });

  if (!row) return fail("Chat session not found", 404);

  return ok({ session: row });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if ("status" in session) return session;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  }

  const existing = await prisma.chatSession.findFirst({
    where: { id, userId: session.userId },
    select: { id: true, _count: { select: { messages: true } } },
  });
  if (!existing) return fail("Chat session not found", 404);

  if (existing._count.messages > 0) {
    return fail("Chat mode is set by your first message and cannot be changed.", 409);
  }

  const updated = await prisma.chatSession.update({
    where: { id },
    data: { mode: parsed.data.mode },
  });

  return ok({ session: updated });
}
