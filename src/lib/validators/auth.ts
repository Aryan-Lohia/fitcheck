import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
  role: z.enum(["USER", "FREELANCE_USER"]).default("USER"),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});
