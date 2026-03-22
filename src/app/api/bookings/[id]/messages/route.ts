import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";
import {
  canPostChatMessage,
  findBookingAsParticipant,
  isBookingParticipant,
} from "@/lib/booking/participant";
import { bookingTextMessageSchema } from "@/lib/validators/booking-room";
import { serializeBookingMessage } from "@/lib/booking/serialize";
import { BookingMessageRole } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if ("status" in session) return session;
  const { id } = await params;

  const booking = await findBookingAsParticipant(id, session.userId);
  if (!booking) return fail("Not found", 404);

  const { searchParams } = new URL(req.url);
  const sinceRaw = searchParams.get("since");
  const since = sinceRaw ? new Date(sinceRaw) : null;
  if (since && Number.isNaN(since.getTime())) return fail("Invalid since", 422);

  const messages = await prisma.bookingMessage.findMany({
    where: {
      bookingId: id,
      ...(since ? { createdAt: { gt: since } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return ok({ messages: messages.map(serializeBookingMessage) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if ("status" in session) return session;
  const { id } = await params;

  const booking = await findBookingAsParticipant(id, session.userId);
  if (!booking) return fail("Not found", 404);

  if (!canPostChatMessage(booking.status, booking.freelancerId)) {
    return fail("Chat is not open for this booking", 409);
  }

  const role = isBookingParticipant(booking, session.userId);
  if (!role) return fail("Forbidden", 403);

  const parsed = bookingTextMessageSchema.safeParse(await req.json());
  if (!parsed.success) return fail(parsed.error.message, 422);

  const prismaRole: BookingMessageRole =
    role === "user" ? BookingMessageRole.USER : BookingMessageRole.FREELANCER;

  const msg = await prisma.bookingMessage.create({
    data: {
      bookingId: id,
      authorUserId: session.userId,
      role: prismaRole,
      kind: "text",
      body: parsed.data.text,
    },
  });

  return ok({ message: serializeBookingMessage(msg) }, 201);
}
