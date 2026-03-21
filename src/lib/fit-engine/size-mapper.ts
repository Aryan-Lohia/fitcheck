type SizeChartEntry = {
  size: string;
  measurements: Record<string, number>;
};

const COMPARISON_DIMENSIONS = [
  "chest",
  "waist",
  "hip",
  "shoulder",
  "sleeve",
  "inseam",
] as const;

export function mapToSize(
  userMeasurements: Record<string, number>,
  sizeChart: SizeChartEntry[],
): { bestSize: string | null; alternateSize: string | null; scores: Record<string, number> } {
  if (sizeChart.length === 0) {
    return { bestSize: null, alternateSize: null, scores: {} };
  }

  const scores: Record<string, number> = {};

  for (const entry of sizeChart) {
    let totalDiff = 0;
    let matchedDimensions = 0;

    for (const dim of COMPARISON_DIMENSIONS) {
      const userVal = userMeasurements[dim];
      const chartVal = entry.measurements[dim];
      if (userVal !== undefined && chartVal !== undefined) {
        totalDiff += Math.abs(userVal - chartVal);
        matchedDimensions++;
      }
    }

    scores[entry.size] =
      matchedDimensions > 0 ? totalDiff / matchedDimensions : Infinity;
  }

  const sorted = Object.entries(scores)
    .filter(([, score]) => score !== Infinity)
    .sort(([, a], [, b]) => a - b);

  return {
    bestSize: sorted[0]?.[0] ?? null,
    alternateSize: sorted[1]?.[0] ?? null,
    scores,
  };
}
