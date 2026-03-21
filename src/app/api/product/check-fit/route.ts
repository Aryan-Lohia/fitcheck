import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { calculateFit } from "@/lib/fit-engine/engine";
import { ok, fail } from "@/lib/http";

const checkFitSchema = z.object({
  productImportId: z.string().min(1, "productImportId is required"),
  selectedSize: z.string().optional().nullable(),
});

type NormalizedProductLike = {
  measurements?: Record<string, number | undefined>;
  variants?: { size?: string[]; color?: string[] };
  sizeChart?: { size: string; measurements: Record<string, number> }[];
};

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if ("status" in session) return session;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const parsed = checkFitSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid request body", 422);
  }

  const { productImportId, selectedSize } = parsed.data;

  const productImport = await prisma.productImport.findUnique({
    where: { id: productImportId },
  });
  if (!productImport) return fail("Product import not found", 404);

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.userId },
  });
  const userPhotosCount = await prisma.userMedia.count({
    where: { userId: session.userId, isDeleted: false, category: "photos" },
  });
  if (userPhotosCount < 2) {
    return fail(
      "Front and back profile photos are mandatory before fit check. Please upload them in Profile or Vault.",
      409,
    );
  }

  const normalized = (productImport.normalizedJson ?? {}) as NormalizedProductLike;
  const safeProduct = {
    measurements: normalized.measurements ?? {},
    variants: {
      size: normalized.variants?.size ?? [],
      color: normalized.variants?.color ?? [],
    },
    sizeChart: normalized.sizeChart ?? [],
  };

  // Respect user size selection by prioritizing it in fallback variant order.
  if (selectedSize && !safeProduct.variants.size.includes(selectedSize)) {
    safeProduct.variants.size = [selectedSize, ...safeProduct.variants.size];
  }

  try {
    const fit = calculateFit(
      profile
        ? JSON.parse(
          JSON.stringify(profile),
        )
        : { measurementsJson: null, preferredFit: "regular" },
      JSON.parse(JSON.stringify(safeProduct)),
    );

    await prisma.productImport.update({
      where: { id: productImport.id },
      data: { fitSummaryJson: JSON.parse(JSON.stringify(fit)) },
    });

    return ok({ fit });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to calculate fit";
    return fail(`Fit calculation failed: ${message}`, 500);
  }
}
