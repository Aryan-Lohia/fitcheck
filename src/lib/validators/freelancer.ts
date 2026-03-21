import { z } from "zod";

export const freelancerApplicationSchema = z.object({
  bio: z.string().min(10),
  phone: z.string().min(8),
  location: z.string().min(2),
  portfolioLinks: z.array(z.string().url()).default([]),
  pastWorkLinks: z.array(z.string().url()).default([]),
  specializationTags: z.array(z.string()).default([]),
  yearsOfExperience: z.number().int().min(0).max(60),
  profilePhoto: z.string().optional(),
  sampleConsultationTopics: z.array(z.string()).default([]),
});
