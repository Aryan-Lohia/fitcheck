import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if ("status" in session) return session;

  const { id } = await params;

  const booking = await prisma.bookingRequest.findFirst({
    where: { id, userId: session.userId },
    include: { freelancer: { include: { user: { select: { name: true, email: true } } } } },
  });

  if (!booking) return fail("Not found", 404);
  return ok({ booking });
}
