import { z } from "zod";

/** Stored in `UserProfile.fashionProfileJson` — extended onboarding + profile accordions. */
export const fashionProfileSchema = z
  .object({
    ageRange: z
      .enum(["18-24", "25-34", "35-44", "45-54", "55-64", "65+"])
      .nullish(),
    browseDepartment: z.enum(["women", "men"]).nullish(),
    bodyShape: z.string().max(120).nullish(),
    heightDisplayUnit: z.enum(["cm", "inch"]).nullish(),
    heightFeet: z.number().min(2).max(8).nullish(),
    heightInchesRemainder: z.number().min(0).max(11.99).nullish(),
    preferredBrands: z.array(z.string().max(64)).max(32).nullish(),
    brandMixDesignerAndFast: z.boolean().nullish(),
    annualClothingSpend: z.string().max(200).nullish(),
    purchaseRegret: z
      .enum(["rarely", "sometimes", "often", "too_often"])
      .nullish(),
    wardrobeDescription: z
      .enum([
        "works_want_ideas",
        "nothing_to_wear",
        "not_me_anymore",
        "nothing_fits",
      ])
      .nullish(),
    unwornItemsWaiting: z.boolean().nullish(),
    wardrobeWearPercent: z
      .enum(["lt_25", "around_50", "gt_75", "idk"])
      .nullish(),
    /** Up to two vault photos for fit / try-on (any pose — front, back, ¾, side). */
    tryOnReferenceMediaIds: z.array(z.string().min(1)).max(2).nullish(),
  });

export type FashionProfile = z.infer<typeof fashionProfileSchema>;

export const DEFAULT_FASHION_PROFILE: FashionProfile = {};

export function inchesTotalToCm(feet: number, inches: number): number {
  const totalIn = feet * 12 + inches;
  return Math.round(totalIn * 2.54 * 10) / 10;
}

/** Single linear dimension (chest, waist, etc.): display in inches, store cm. */
export function cmToLinearIn(cm: number): number {
  return Math.round((cm / 2.54) * 100) / 100;
}

export function linearInToCm(inches: number): number {
  return Math.round(inches * 2.54 * 10) / 10;
}

export function cmToFeetInches(cm: number): { ft: number; inch: number } {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round((totalIn - ft * 12) * 10) / 10;
  return { ft, inch };
}

export const ONBOARDING_STYLE_OPTIONS = [
  "Casual",
  "Classic",
  "Boho",
  "Street style",
  "Sporty",
  "Minimalist",
  "Preppy",
  "Grunge",
] as const;

export const FAST_FASHION_BRANDS = ["ZARA", "H&M", "GAP", "MANGO"] as const;
export const PREMIUM_BRANDS = ["COS", "GANNI", "ISABEL MARANT"] as const;
export const LUXURY_BRANDS = ["GUCCI", "FENDI", "CHANEL"] as const;

export const BODY_SHAPE_OPTIONS = [
  "Rectangle",
  "Triangle (pear)",
  "Hourglass",
  "Inverted triangle",
  "Oval / Apple",
  "Prefer not to say",
] as const;

export const ANNUAL_SPEND_OPTIONS = [
  "Under ~₹5k / $60",
  "₹5k – ₹15k",
  "₹15k – ₹40k",
  "₹40k+",
  "Prefer not to say",
] as const;
