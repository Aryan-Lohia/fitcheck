import { z } from "zod";

const tryOnRefIdsSchema = z.array(z.string().min(1)).max(2);

/** IDs of UserMedia rows the user chose as try-on body references (any angle). */
export function parseTryOnReferenceMediaIds(fashionProfileJson: unknown): string[] {
  if (!fashionProfileJson || typeof fashionProfileJson !== "object" || Array.isArray(fashionProfileJson)) {
    return [];
  }
  const raw = (fashionProfileJson as Record<string, unknown>).tryOnReferenceMediaIds;
  const r = tryOnRefIdsSchema.safeParse(raw);
  return r.success ? r.data : [];
}
