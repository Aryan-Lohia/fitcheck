/**
 * Wizard + scrapers may use `chestCm` etc.; fit engine uses `chest`, `waist`, …
 */

const CM_SUFFIX_TO_ENGINE: Record<string, string> = {
  chestCm: "chest",
  waistCm: "waist",
  hipCm: "hip",
  shoulderCm: "shoulder",
  sleeveCm: "sleeve",
  inseamCm: "inseam",
};

const ENGINE_KEYS = new Set([
  "chest",
  "waist",
  "hip",
  "shoulder",
  "sleeve",
  "inseam",
]);

function pickNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

/** Merge wizard/scraper keys into engine dimension keys (cm numbers). */
export function normalizeMeasurementsMapForEngine(
  raw: Record<string, number | undefined> | Record<string, unknown>,
): Record<string, number> {
  const out: Record<string, number> = {};

  for (const [k, val] of Object.entries(raw)) {
    const n = pickNumber(val);
    if (n === undefined) continue;

    const engineKey = CM_SUFFIX_TO_ENGINE[k] ?? (ENGINE_KEYS.has(k) ? k : null);
    if (!engineKey) continue;

    if (out[engineKey] !== undefined) continue;
    out[engineKey] = n;
  }

  return out;
}

export function normalizeSizeChartForEngine(
  chart: Array<{ size: string; measurements: Record<string, number> }> | undefined,
): Array<{ size: string; measurements: Record<string, number> }> {
  if (!chart?.length) return [];
  return chart.map((row) => ({
    size: row.size,
    measurements: normalizeMeasurementsMapForEngine(row.measurements ?? {}),
  }));
}
