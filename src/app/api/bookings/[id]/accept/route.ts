import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";
import { sendEmail } from "@/lib/email/sender";
import { bookingAccepted } from "@/lib/email/templates/bookingAccepted";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireRole(["FREELANCE_USER"]);
  if ("status" in session) return session;

  const { id } = await params;

  const fp = await prisma.freelancerProfile.findUnique({
    where: { userId: session.userId },
    include: { user: { select: { name: true } } },
  });
  if (!fp) return fail("Freelancer profile not found", 404);

  const { count } = await prisma.bookingRequest.updateMany({
    where: { id, status: "requested" },
    data: {
      status: "accepted",
      freelancerId: fp.id,
      acceptedAt: new Date(),
    },
  });

  if (count === 0) return fail("Already accepted or unavailable", 409);

  const booking = await prisma.bookingRequest.findUnique({
    where: { id },
    include: { user: { select: { name: true, email: true } } },
  });

  if (booking) {
    const tmpl = bookingAccepted({
      userName: booking.user.name,
      expertName: fp.user.name,
      topic: booking.topic,
    });
    sendEmail(booking.user.email, tmpl.subject, tmpl.html, tmpl.text).catch(console.error);
  }

  return ok({ booking });
}
