import { z } from "zod";

export const bookingTextMessageSchema = z.object({
  text: z.string().trim().min(1).max(8000),
});

export const bookingSharePhotosSchema = z.object({
  userMediaIds: z.array(z.string().min(1)).min(1).max(12),
});

export const bookingQuoteSchema = z.object({
  amountRupees: z.number().positive().max(1_000_000),
  notes: z.string().trim().max(2000).optional(),
});

export const bookingPaymentProofSchema = z.object({
  mediaId: z.string().min(1),
});
