import { z } from "zod";
import { fashionProfileSchema } from "@/lib/profile/fashion-profile";

/** JSON often carries `null`; treat as unset so PATCH from clients survives round-trips. */
const measurement = z.number().min(1).max(300).nullish();

export const profileSchema = z.object({
  gender: z.string().nullish(),
  skinTone: z.string().nullish(),
  preferredFit: z
    .enum(["slim", "regular", "oversized", "tailored"])
    .nullish(),
  preferredStyle: z.array(z.string()).nullish(),
  preferredColors: z.array(z.string()).nullish(),
  fashionProfile: fashionProfileSchema.nullish(),
  measurements: z
    .object({
      heightCm: measurement,
      chestCm: measurement,
      waistCm: measurement,
      hipCm: measurement,
      shoulderCm: measurement,
      sleeveCm: measurement,
      inseamCm: measurement,
      neckCm: measurement,
      armLengthCm: measurement,
      thighCm: measurement,
      bustCm: measurement,
    })
    .nullish(),
});

const FIT_ENUM = new Set(["slim", "regular", "oversized", "tailored"]);

/** Four segments × 25%: basics, skin tone, measurements, style preferences. */
export type ProfileCompletionInput = {
  gender?: string | null;
  skinTone?: string | null;
  preferredFit?: string | null;
  preferredStyle?: string[] | null;
  preferredColors?: string[] | null;
  measurements?: Record<string, number | undefined> | null;
};

function hasMeaningfulMeasurements(
  m: Record<string, number | undefined> | null | undefined,
): boolean {
  if (!m || typeof m !== "object") return false;
  return Object.values(m).some(
    (v) => typeof v === "number" && Number.isFinite(v) && v > 0,
  );
}

function normalizeStringArray(raw: unknown): string[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const out = raw.filter((x): x is string => typeof x === "string");
    return out.length ? out : null;
  }
  return null;
}

/** Latest measurement values from stored `measurementsJson` (PATCH + version history). */
export function extractLatestMeasurementValues(
  measurementsJson: unknown,
): Record<string, number | undefined> | null {
  if (!measurementsJson || typeof measurementsJson !== "object") return null;
  const versions = (measurementsJson as { versions?: Array<{ values?: unknown }> })
    .versions;
  const values = versions?.at(-1)?.values;
  if (!values || typeof values !== "object") return null;
  const out: Record<string, number | undefined> = {};
  for (const [k, val] of Object.entries(values)) {
    if (typeof val === "number" && Number.isFinite(val) && val > 0) {
      out[k] = val;
      continue;
    }
    if (typeof val === "string") {
      const n = Number(val);
      if (Number.isFinite(n) && n > 0) out[k] = n;
    }
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Single source of truth for profile % shown in UI and stored on `UserProfile.profileCompletion`.
 * — Basics (25%): gender + fit preference both set
 * — Skin (25%): skin tone chosen
 * — Measurements (25%): at least one positive measurement
 * — Style prefs (25%): at least one style tag and/or color preference
 */
export function calculateProfileCompletionFromFields(
  state: ProfileCompletionInput,
): number {
  const basics =
    Boolean(String(state.gender ?? "").trim()) &&
    Boolean(state.preferredFit && FIT_ENUM.has(state.preferredFit));
  const skin = Boolean(String(state.skinTone ?? "").trim());
  const measure = hasMeaningfulMeasurements(state.measurements ?? null);
  const stylePrefs =
    (Array.isArray(state.preferredStyle) && state.preferredStyle.length > 0) ||
    (Array.isArray(state.preferredColors) && state.preferredColors.length > 0);

  const done = [basics, skin, measure, stylePrefs].filter(Boolean).length;
  return Math.round((done / 4) * 100);
}

/** Normalizes loose PATCH / JSON bodies (used by API route). */
export function calculateProfileCompletion(input: Record<string, unknown>): number {
  const measurements = input.measurements;
  return calculateProfileCompletionFromFields({
    gender: typeof input.gender === "string" ? input.gender : null,
    skinTone: typeof input.skinTone === "string" ? input.skinTone : null,
    preferredFit: typeof input.preferredFit === "string" ? input.preferredFit : null,
    preferredStyle: Array.isArray(input.preferredStyle)
      ? (input.preferredStyle as string[])
      : null,
    preferredColors: Array.isArray(input.preferredColors)
      ? (input.preferredColors as string[])
      : null,
    measurements:
      measurements && typeof measurements === "object"
        ? (measurements as Record<string, number | undefined>)
        : null,
  });
}

/** Recompute from a persisted `UserProfile` row (includes `measurementsJson` versions). */
export function profileCompletionFromUserProfile(p: {
  gender: string | null;
  skinTone: string | null;
  preferredFit: string | null;
  preferredStyle: unknown;
  preferredColors: unknown;
  measurementsJson: unknown;
}): number {
  const fromJson = extractLatestMeasurementValues(p.measurementsJson);
  return calculateProfileCompletionFromFields({
    gender: p.gender,
    skinTone: p.skinTone,
    preferredFit: p.preferredFit,
    preferredStyle: normalizeStringArray(p.preferredStyle),
    preferredColors: normalizeStringArray(p.preferredColors),
    measurements: fromJson,
  });
}
