import { z } from "zod";

const measurement = z.number().min(1).max(300).optional();

export const profileSchema = z.object({
  gender: z.string().optional(),
  skinTone: z.string().optional(),
  preferredFit: z.enum(["slim", "regular", "oversized", "tailored"]).optional(),
  preferredStyle: z.array(z.string()).optional(),
  preferredColors: z.array(z.string()).optional(),
  measurements: z.object({
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
  }).optional(),
});

export function calculateProfileCompletion(input: Record<string, unknown>): number {
  const required = ["gender", "skinTone", "preferredFit", "measurements"];
  const done = required.filter((k) => Boolean(input[k])).length;
  return Math.round((done / required.length) * 100);
}
