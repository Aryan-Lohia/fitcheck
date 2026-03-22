import { z } from "zod";

/** `mimeType` may be empty in the browser — server infers from `fileName` when needed. */
export const freelancerUpiPresignSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().optional().default(""),
  sizeBytes: z.number().int().positive().max(3 * 1024 * 1024),
});

export const freelancerUpiConfirmSchema = z
  .object({
    s3Key: z.string().min(1).optional(),
    upiVpa: z.string().trim().max(100).optional(),
  })
  .refine((d) => d.s3Key != null || d.upiVpa !== undefined, {
    message: "Provide s3Key to save a new QR and/or upiVpa to update your UPI ID",
  });
