import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok } from "@/lib/http";

export async function GET() {
  const session = await requireAuth();
  if ("status" in session) return session;

  const bookings = await prisma.bookingRequest.findMany({
    where: { userId: session.userId },
    include: { freelancer: { include: { user: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return ok({ bookings });
}

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if ("status" in session) return session;

  const body = await req.json();

  const booking = await prisma.bookingRequest.create({
    data: {
      userId: session.userId,
      topic: body.topic,
      notes: body.notes,
      preferredTime: body.preferredTime ? new Date(body.preferredTime) : null,
      durationMinutes: body.durationMinutes || 30,
      status: "requested",
    },
  });

  return ok({ booking });
}
