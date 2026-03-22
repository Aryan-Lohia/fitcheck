import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { meetingLinkSchema } from "@/lib/validators/booking";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";
import { sendEmail } from "@/lib/email/sender";
import { meetingLinkShared } from "@/lib/email/templates/meetingLinkShared";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const s = await requireRole(["FREELANCE_USER"]);
  if ("status" in s) return s;
  const p = meetingLinkSchema.safeParse(await req.json());
  if (!p.success) return fail(p.error.message, 422);
  const { id } = await params;

  const fp = await prisma.freelancerProfile.findUnique({
    where: { userId: s.userId },
    include: { user: { select: { name: true } } },
  });
  if (!fp) return fail("Freelancer profile not found", 404);

  const booking = await prisma.bookingRequest.findFirst({
    where: { id, freelancerId: fp.id },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!booking) return fail("Booking not found or not assigned to you", 404);

  const updated = await prisma.bookingRequest.update({
    where: { id },
    data: { meetingLink: p.data.meetingLink, status: "meeting_link_sent" },
  });

  const tmpl = meetingLinkShared({
    userName: booking.user.name,
    expertName: fp.user.name,
    meetingLink: p.data.meetingLink,
    topic: booking.topic,
  });
  sendEmail(booking.user.email, tmpl.subject, tmpl.html, tmpl.text).catch(console.error);

  return ok({ booking: updated });
}
