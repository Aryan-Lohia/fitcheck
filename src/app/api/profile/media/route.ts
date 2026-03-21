import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok } from "@/lib/http";

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if ("status" in session) return session;
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || undefined;
  const media = await prisma.userMedia.findMany({
    where: { userId: session.userId, isDeleted: false, ...(category ? { category } : {}) },
    orderBy: { createdAt: "desc" },
  });
  const totalBytes = media.reduce((sum, m) => sum + Number(m.fileSize), 0);
  const normalizedMedia = media.map((item) => ({
    ...item,
    fileSize: Number(item.fileSize),
  }));
  return ok({ media: normalizedMedia, totalBytes, maxBytes: 1073741824 });
}
