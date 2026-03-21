import { z } from "zod";

export const mediaUploadSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
  category: z.string().min(1),
});
