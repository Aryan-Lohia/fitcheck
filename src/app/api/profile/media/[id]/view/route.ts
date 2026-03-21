import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { generatePresignedDownloadUrl } from "@/lib/s3/presign";
import { fail } from "@/lib/http";

/**
 * Same-origin image URL for vault thumbnails and previews. Verifies ownership,
 * then redirects to a short-lived S3 presigned URL (avoids exposing URLs via JSON
 * and works reliably in <img> after the browser follows the redirect).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if ("status" in session) return session;
  const { id } = await params;
  const media = await prisma.userMedia.findFirst({
    where: { id, userId: session.userId, isDeleted: false },
  });
  if (!media) return fail("Not found", 404);
  const downloadUrl = await generatePresignedDownloadUrl(media.s3Key);
  return NextResponse.redirect(downloadUrl, 302);
}
