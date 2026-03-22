import { prisma } from "@/lib/prisma/client";
import { calculateFit } from "@/lib/fit-engine/engine";
import {
  normalizeMeasurementsMapForEngine,
  normalizeSizeChartForEngine,
} from "@/lib/fit-engine/measurement-keys";
import { extractLatestMeasurementValues } from "@/lib/validators/profile";

type FitResult = ReturnType<typeof calculateFit>;

type NormalizedProductLike = {
  measurements?: Record<string, number | undefined>;
  variants?: { size?: string[]; color?: string[] };
  sizeChart?: { size: string; measurements: Record<string, number> }[];
};

export type ComputeFitErrorCode =
  | "not_found"
  | "forbidden"
  | "photos_required"
  | "calc_failed";

export class ComputeFitError extends Error {
  constructor(
    message: string,
    readonly code: ComputeFitErrorCode,
    readonly status: number,
  ) {
    super(message);
    this.name = "ComputeFitError";
  }
}

/**
 * Loads product + profile, enforces vault photo rules, persists fitSummaryJson on the import.
 */
export async function computeFitForProductImport(params: {
  userId: string;
  productImportId: string;
  selectedSize?: string | null;
}): Promise<{ fit: FitResult }> {
  const productImport = await prisma.productImport.findUnique({
    where: { id: params.productImportId },
  });
  if (!productImport) {
    throw new ComputeFitError("Product import not found", "not_found", 404);
  }
  if (productImport.userId !== params.userId) {
    throw new ComputeFitError("Product import not found", "forbidden", 404);
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: params.userId },
  });
  const userPhotosCount = await prisma.userMedia.count({
    where: { userId: params.userId, isDeleted: false, category: "photos" },
  });
  if (userPhotosCount < 2) {
    throw new ComputeFitError(
      "Front and back profile photos are mandatory before fit check. Please upload them in Profile or Vault.",
      "photos_required",
      409,
    );
  }

  const normalized = (productImport.normalizedJson ?? {}) as NormalizedProductLike;
  const safeProduct = {
    measurements: normalizeMeasurementsMapForEngine(normalized.measurements ?? {}),
    variants: {
      size: normalized.variants?.size ?? [],
      color: normalized.variants?.color ?? [],
    },
    sizeChart: normalizeSizeChartForEngine(normalized.sizeChart),
  };

  if (
    params.selectedSize &&
    !safeProduct.variants.size.includes(params.selectedSize)
  ) {
    safeProduct.variants.size = [
      params.selectedSize,
      ...safeProduct.variants.size,
    ];
  }

  try {
    const latestVals = profile
      ? extractLatestMeasurementValues(profile.measurementsJson)
      : null;
    const userMeasurementsJson =
      latestVals && Object.keys(latestVals).length > 0
        ? normalizeMeasurementsMapForEngine(latestVals)
        : null;

    const fit = calculateFit(
      userMeasurementsJson && Object.keys(userMeasurementsJson).length > 0
        ? {
          measurementsJson: userMeasurementsJson,
          preferredFit: profile?.preferredFit ?? "regular",
        }
        : { measurementsJson: null, preferredFit: profile?.preferredFit ?? "regular" },
      JSON.parse(JSON.stringify(safeProduct)),
    );

    await prisma.productImport.update({
      where: { id: productImport.id },
      data: { fitSummaryJson: JSON.parse(JSON.stringify(fit)) },
    });

    return { fit };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to calculate fit";
    throw new ComputeFitError(
      `Fit calculation failed: ${message}`,
      "calc_failed",
      500,
    );
  }
}
