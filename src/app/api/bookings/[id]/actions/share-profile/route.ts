import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";
import { canPostChatMessage, findBookingAsParticipant } from "@/lib/booking/participant";
import { serializeBookingMessage } from "@/lib/booking/serialize";

function summarizeProfileForShare(profile: {
  gender: string | null;
  skinTone: string | null;
  preferredFit: string | null;
  measurementsJson: unknown;
  fashionProfileJson: unknown;
}) {
  const lines: string[] = [];
  if (profile.gender) lines.push(`Gender: ${profile.gender}`);
  if (profile.skinTone) lines.push(`Skin tone: ${profile.skinTone}`);
  if (profile.preferredFit) lines.push(`Preferred fit: ${profile.preferredFit}`);
  if (profile.measurementsJson && typeof profile.measurementsJson === "object") {
    const m = profile.measurementsJson as { versions?: { values?: Record<string, unknown> }[] };
    const latest = m.versions?.[m.versions.length - 1]?.values;
    if (latest && typeof latest === "object") {
      lines.push(`Measurements: ${JSON.stringify(latest)}`);
    }
  }
  if (profile.fashionProfileJson && typeof profile.fashionProfileJson === "object") {
    lines.push(`Style profile: ${JSON.stringify(profile.fashionProfileJson)}`);
  }
  return lines.length ? lines.join("\n") : "Profile details shared (no structured fields filled yet).";
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if ("status" in session) return session;
  const { id } = await params;

  const booking = await findBookingAsParticipant(id, session.userId);
  if (!booking) return fail("Not found", 404);

  if (booking.userId !== session.userId) return fail("Only the client can share their profile", 403);

  if (!canPostChatMessage(booking.status, booking.freelancerId)) {
    return fail("Chat is not open for this booking", 409);
  }

  const [profile, user] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId: session.userId } }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true },
    }),
  ]);

  const summary = summarizeProfileForShare({
    gender: profile?.gender ?? null,
    skinTone: profile?.skinTone ?? null,
    preferredFit: profile?.preferredFit ?? null,
    measurementsJson: profile?.measurementsJson ?? null,
    fashionProfileJson: profile?.fashionProfileJson ?? null,
  });

  const body = `${user?.name ?? "Client"} shared profile details:\n\n${summary}`;

  const msg = await prisma.bookingMessage.create({
    data: {
      bookingId: id,
      authorUserId: session.userId,
      role: "USER",
      kind: "profile_share",
      body,
      metadataJson: {
        sharedByUserId: session.userId,
        profileSnapshot: {
          gender: profile?.gender,
          skinTone: profile?.skinTone,
          preferredFit: profile?.preferredFit,
        },
      },
    },
  });

  return ok({ message: serializeBookingMessage(msg) }, 201);
}
