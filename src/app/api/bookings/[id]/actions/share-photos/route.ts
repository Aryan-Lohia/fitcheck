import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";
import { canPostChatMessage, findBookingAsParticipant } from "@/lib/booking/participant";
import { bookingSharePhotosSchema } from "@/lib/validators/booking-room";
import { serializeBookingMessage } from "@/lib/booking/serialize";
import { generatePresignedDownloadUrl } from "@/lib/s3/presign";

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if ("status" in session) return session;
  const { id } = await params;

  const booking = await findBookingAsParticipant(id, session.userId);
  if (!booking) return fail("Not found", 404);

  if (booking.userId !== session.userId) return fail("Only the client can share photos", 403);

  if (!canPostChatMessage(booking.status, booking.freelancerId)) {
    return fail("Chat is not open for this booking", 409);
  }

  const parsed = bookingSharePhotosSchema.safeParse(await req.json());
  if (!parsed.success) return fail(parsed.error.message, 422);

  const mediaRows = await prisma.userMedia.findMany({
    where: {
      id: { in: parsed.data.userMediaIds },
      userId: session.userId,
      isDeleted: false,
    },
  });

  if (mediaRows.length !== parsed.data.userMediaIds.length) {
    return fail("One or more photos are invalid", 422);
  }

  for (const m of mediaRows) {
    if (!IMAGE_MIME.has(m.mimeType)) {
      return fail("Only image photos can be shared", 422);
    }
  }

  const attachments = await Promise.all(
    mediaRows.map(async (m) => ({
      mediaId: m.id,
      fileName: m.fileName,
      mimeType: m.mimeType,
      url: await generatePresignedDownloadUrl(m.s3Key),
    })),
  );

  const msg = await prisma.bookingMessage.create({
    data: {
      bookingId: id,
      authorUserId: session.userId,
      role: "USER",
      kind: "photos_share",
      body: `Shared ${attachments.length} photo(s) for this session.`,
      metadataJson: { attachments },
    },
  });

  return ok({ message: serializeBookingMessage(msg) }, 201);
}
