import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { fail } from "@/lib/http";
import { getS3ObjectBuffer } from "@/lib/s3/get-object-buffer";
import { optimizeProfileMediaImage } from "@/lib/media/optimize-profile-media-image";

function clampInt(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Auth-checked, resized WebP derived from S3 originals. Cuts bytes vs redirecting
 * to full-size presigned URLs (faster grid/chat loads).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if ("status" in session) return session;

  const { id } = await params;
  const media = await prisma.userMedia.findFirst({
    where: { id, userId: session.userId, isDeleted: false },
  });
  if (!media) return fail("Not found", 404);

  const searchParams = req.nextUrl.searchParams;
  const w = clampInt(parseInt(searchParams.get("w") ?? "", 10), 32, 2048, 640);
  const q = clampInt(parseInt(searchParams.get("q") ?? "", 10), 40, 92, 78);

  const mime = (media.mimeType ?? "").toLowerCase();
  const isRaster =
    mime.startsWith("image/") &&
    !mime.includes("svg") &&
    mime !== "image/gif";

  if (!isRaster) {
    const dest = new URL(`/api/profile/media/${id}/view`, req.nextUrl);
    dest.search = "";
    return NextResponse.redirect(dest, 302);
  }

  try {
    const raw = await getS3ObjectBuffer(media.s3Key);
    const { buffer, contentType } = await optimizeProfileMediaImage(raw, {
      maxWidth: w,
      quality: q,
    });
    const etag = `"${createHash("sha1").update(buffer).digest("hex").slice(0, 20)}"`;
    const inm = req.headers.get("if-none-match");
    if (inm === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
        ETag: etag,
        Vary: "Cookie",
      },
    });
  } catch {
    const dest = new URL(`/api/profile/media/${id}/view`, req.nextUrl);
    dest.search = "";
    return NextResponse.redirect(dest, 302);
  }
}
