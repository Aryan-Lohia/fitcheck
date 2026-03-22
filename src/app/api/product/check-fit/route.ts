import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/rbac";
import { ok, fail } from "@/lib/http";
import {
  ComputeFitError,
  computeFitForProductImport,
} from "@/lib/product/compute-fit-for-import";

const checkFitSchema = z.object({
  productImportId: z.string().min(1, "productImportId is required"),
  selectedSize: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if ("status" in session) return session;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const parsed = checkFitSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid request body", 422);
  }

  const { productImportId, selectedSize } = parsed.data;

  try {
    const { fit } = await computeFitForProductImport({
      userId: session.userId,
      productImportId,
      selectedSize,
    });
    return ok({ fit });
  } catch (e) {
    if (e instanceof ComputeFitError) {
      return fail(e.message, e.status);
    }
    const message =
      e instanceof Error ? e.message : "Failed to calculate fit";
    return fail(`Fit calculation failed: ${message}`, 500);
  }
}
