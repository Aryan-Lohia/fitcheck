import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";
import { generatePresignedDownloadUrl } from "@/lib/s3/presign";
import { runTryOnGeneration } from "@/lib/try-on/run-try-on";

const tryOnSchema = z.object({
  frontMediaId: z.string().min(1),
  backMediaId: z.string().min(1),
  selectedProductImageUrl: z.string().url().optional(),
  fitStyle: z.enum(["snug", "true-to-size", "relaxed"]).default("true-to-size"),
  backgroundStyle: z.enum(["original", "studio"]).default("original"),
  detailLevel: z.enum(["balanced", "high"]).default("high"),
  customPrompt: z.string().max(600).optional(),
});

type TryOnLabel = "front" | "back" | "zoomed";

const TRY_ON_KEY_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(front|back|zoomed)\./i;

type TryOnRow = { id: string; s3Key: string; createdAt: Date };

function pickLatestCompleteTryOnRun(
  productId: string,
  userId: string,
  items: TryOnRow[],
): { runId: string; byLabel: Record<TryOnLabel, TryOnRow> } | null {
  const prefix = `users/${userId}/try-on/${productId}/`;
  const runs = new Map<string, Partial<Record<TryOnLabel, TryOnRow>>>();

  for (const m of items) {
    if (!m.s3Key.startsWith(prefix)) continue;
    const suffix = m.s3Key.slice(prefix.length);
    const match = suffix.match(TRY_ON_KEY_RE);
    if (!match) continue;
    const runId = match[1];
    const label = match[2].toLowerCase() as TryOnLabel;
    const cur = runs.get(runId) ?? {};
    cur[label] = m;
    runs.set(runId, cur);
  }

  let best: { runId: string; latest: Date; byLabel: Record<TryOnLabel, TryOnRow> } | null = null;

  for (const [runId, map] of runs) {
    if (!map.front || !map.back || !map.zoomed) continue;
    const latest = [map.front.createdAt, map.back.createdAt, map.zoomed.createdAt].reduce(
      (a, b) => (a > b ? a : b),
      map.front.createdAt,
    );
    if (!best || latest > best.latest) {
      best = {
        runId,
        latest,
        byLabel: { front: map.front, back: map.back, zoomed: map.zoomed },
      };
    }
  }

  return best ? { runId: best.runId, byLabel: best.byLabel } : null;
}

/** Returns the latest saved try-on run for this product with fresh download URLs. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if ("status" in session) return session;

  const { id } = await params;

  const product = await prisma.productImport.findFirst({
    where: { id, userId: session.userId },
    select: { id: true },
  });
  if (!product) return fail("Product not found", 404);

  const prefix = `users/${session.userId}/try-on/${id}/`;
  const items = await prisma.userMedia.findMany({
    where: {
      userId: session.userId,
      isDeleted: false,
      category: "try-on",
      s3Key: { startsWith: prefix },
    },
    orderBy: { createdAt: "desc" },
    take: 120,
    select: { id: true, s3Key: true, createdAt: true },
  });

  const picked = pickLatestCompleteTryOnRun(id, session.userId, items);
  if (!picked) {
    return ok({ runId: null, variations: [] });
  }

  const order: TryOnLabel[] = ["front", "back", "zoomed"];
  const variations = await Promise.all(
    order.map(async (label) => {
      const row = picked.byLabel[label];
      const downloadUrl = await generatePresignedDownloadUrl(row.s3Key);
      return {
        id: row.id,
        label,
        s3Key: row.s3Key,
        downloadUrl,
      };
    }),
  );

  return ok({ runId: picked.runId, variations });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if ("status" in session) return session;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = tryOnSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  }

  const product = await prisma.productImport.findFirst({
    where: { id, userId: session.userId },
    include: { images: true },
  });
  if (!product) return fail("Product not found", 404);

  try {
    const result = await runTryOnGeneration({
      userId: session.userId,
      productImportId: product.id,
      product: {
        id: product.id,
        title: product.title,
        brand: product.brand,
        images: product.images.map((img) => ({
          imageUrl: img.imageUrl,
          s3Key: img.s3Key,
        })),
      },
      frontMediaId: parsed.data.frontMediaId,
      backMediaId: parsed.data.backMediaId,
      selectedProductImageUrl: parsed.data.selectedProductImageUrl,
      fitStyle: parsed.data.fitStyle,
      backgroundStyle: parsed.data.backgroundStyle,
      detailLevel: parsed.data.detailLevel,
      customPrompt: parsed.data.customPrompt,
    });
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Try-on generation failed";
    return fail(`Try-on generation failed: ${message}`, 502);
  }
}
