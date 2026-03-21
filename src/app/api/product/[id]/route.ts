import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";
import { dedupeProductImageRows } from "@/lib/scraper/image-dedupe";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if ("status" in session) return session;

  const { id } = await params;

  const product = await prisma.productImport.findUnique({
    where: { id },
    include: { images: true },
  });
  if (!product) return fail("not found", 404);

  const images = dedupeProductImageRows(product.images);

  return ok({
    product: {
      ...product,
      images,
    },
  });
}
