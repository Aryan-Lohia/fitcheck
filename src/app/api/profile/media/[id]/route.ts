import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { deleteS3Object, generatePresignedDownloadUrl } from "@/lib/s3/presign";
import { ok, fail } from "@/lib/http";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if ("status" in session) return session;
  const { id } = await params;
  const media = await prisma.userMedia.findFirst({ where: { id, userId: session.userId, isDeleted: false } });
  if (!media) return fail("Not found", 404);
  const downloadUrl = await generatePresignedDownloadUrl(media.s3Key);
  return ok({ downloadUrl });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if ("status" in session) return session;
  const { id } = await params;
  const media = await prisma.userMedia.findFirst({ where: { id, userId: session.userId, isDeleted: false } });
  if (!media) return fail("Not found", 404);
  await deleteS3Object(media.s3Key);
  await prisma.userMedia.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } });
  return ok({ success: true });
}

