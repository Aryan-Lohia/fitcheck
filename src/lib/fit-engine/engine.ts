import { mapToSize } from "./size-mapper";

type FitLabel =
  | "Perfect Fit"
  | "Good Fit"
  | "Slightly Tight"
  | "Slightly Loose"
  | "Size Unclear"
  | "Need More Info";

type FitResult = {
  recommendedSize: string | null;
  fitConfidence: number;
  reasons: string[];
  warnings: string[];
  alternateSize: string | null;
  fitLabel: FitLabel;
};

type UserProfile = {
  measurementsJson?: Record<string, number> | null;
  preferredFit?: string | null;
};

type ProductData = {
  measurements: Record<string, number | undefined>;
  variants: { size: string[]; color: string[] };
  sizeChart?: { size: string; measurements: Record<string, number> }[];
};

const COMPARISON_DIMENSIONS = [
  "chest",
  "waist",
  "hip",
  "shoulder",
  "sleeve",
  "inseam",
] as const;

const TIGHT_THRESHOLD = -3;
const LOOSE_THRESHOLD = 5;

function getFitToleranceAdjustment(preference: string): {
  tightAdj: number;
  looseAdj: number;
} {
  switch (preference) {
    case "slim":
      return { tightAdj: 2, looseAdj: 0 };
    case "oversized":
    case "relaxed":
      return { tightAdj: 0, looseAdj: 3 };
    default:
      return { tightAdj: 0, looseAdj: 0 };
  }
}

function labelFromConfidence(
  confidence: number,
  hasTight: boolean,
  hasLoose: boolean,
): FitLabel {
  if (confidence > 0.85) return "Perfect Fit";
  if (confidence > 0.65) return "Good Fit";
  if (confidence > 0.45) {
    if (hasTight && !hasLoose) return "Slightly Tight";
    if (hasLoose && !hasTight) return "Slightly Loose";
    return "Good Fit";
  }
  return "Size Unclear";
}

export function calculateFit(
  userProfile: UserProfile | null,
  product: ProductData,
): FitResult {
  if (
    !userProfile?.measurementsJson ||
    Object.keys(userProfile.measurementsJson).length === 0
  ) {
    return {
      recommendedSize: null,
      fitConfidence: 0.1,
      reasons: ["User measurements not available"],
      warnings: ["Complete your body measurements for accurate fit recommendations"],
      alternateSize: null,
      fitLabel: "Need More Info",
    };
  }

  const userMeasurements = userProfile.measurementsJson;
  const fitPreference = userProfile.preferredFit ?? "regular";
  const { tightAdj, looseAdj } = getFitToleranceAdjustment(fitPreference);
  const productMeasurements = product.measurements;

  const reasons: string[] = [];
  const warnings: string[] = [];
  let goodCount = 0;
  let comparedCount = 0;
  let hasTight = false;
  let hasLoose = false;

  for (const dim of COMPARISON_DIMENSIONS) {
    const userVal = userMeasurements[dim];
    const productVal = productMeasurements[dim];

    if (userVal === undefined || productVal === undefined) continue;

    comparedCount++;
    const diff = productVal - userVal;
    const adjustedTightThreshold = TIGHT_THRESHOLD - tightAdj;
    const adjustedLooseThreshold = LOOSE_THRESHOLD + looseAdj;
    const label = dim.charAt(0).toUpperCase() + dim.slice(1);

    if (diff < adjustedTightThreshold) {
      reasons.push(`${label} may be tight (${Math.abs(diff).toFixed(1)}cm smaller)`);
      hasTight = true;
    } else if (diff > adjustedLooseThreshold) {
      reasons.push(`${label} may be loose (${diff.toFixed(1)}cm larger)`);
      hasLoose = true;
    } else {
      reasons.push(`${label} looks good`);
      goodCount++;
    }
  }

  if (comparedCount === 0) {
    return {
      recommendedSize: product.variants.size[0] ?? null,
      fitConfidence: 0.3,
      reasons: ["No overlapping measurements to compare"],
      warnings: ["Product measurement data is limited"],
      alternateSize: product.variants.size[1] ?? null,
      fitLabel: "Size Unclear",
    };
  }

  const confidence = Math.round((goodCount / comparedCount) * 100) / 100;

  let recommendedSize: string | null = null;
  let alternateSize: string | null = null;

  if (product.sizeChart && product.sizeChart.length > 0) {
    const sizeResult = mapToSize(userMeasurements, product.sizeChart);
    recommendedSize = sizeResult.bestSize;
    alternateSize = sizeResult.alternateSize;
  } else if (product.variants.size.length > 0) {
    recommendedSize = product.variants.size[0];
    alternateSize = product.variants.size[1] ?? null;
    warnings.push("No detailed size chart — recommendation based on general fit");
  }

  if (comparedCount < 3) {
    warnings.push("Limited measurement data — confidence may be lower");
  }

  const fitLabel = labelFromConfidence(confidence, hasTight, hasLoose);

  return {
    recommendedSize,
    fitConfidence: confidence,
    reasons,
    warnings,
    alternateSize,
    fitLabel,
  };
}
