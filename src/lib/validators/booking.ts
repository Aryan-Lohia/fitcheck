import { z } from "zod";

export const bookingRequestSchema = z.object({
  topic: z.string().min(3),
  notes: z.string().optional(),
  preferredTime: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(15).max(180).default(30),
});

export const meetingLinkSchema = z.object({
  meetingLink: z.url(),
});
