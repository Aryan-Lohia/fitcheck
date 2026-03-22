import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/rbac";
import { ok, fail } from "@/lib/http";
import { importProductFromUrl } from "@/lib/product/import-from-url";

const importSchema = z.object({
  url: z.string().url("A valid product URL is required"),
});

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if ("status" in session) return session;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body");
  }

  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { url } = parsed.data;

  try {
    const result = await importProductFromUrl({
      userId: session.userId,
      url,
    });
    return ok({
      productImportId: result.productImportId,
      normalized: result.normalized,
      cached: result.cached,
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    const lower = raw.toLowerCase();
    let userMessage =
      "We couldn't load this product. Try another link or a different item.";
    if (lower.includes("timed out") || lower.includes("timeout")) {
      userMessage =
        "This product page didn't load in time (the site may be slow or blocking us). Try another product link.";
    } else if (
      lower.includes("403") ||
      lower.includes("401") ||
      lower.includes("forbidden") ||
      lower.includes("blocked")
    ) {
      userMessage =
        "We couldn't access that product page from our servers. Try another link or upload a product photo instead.";
    } else if (lower.includes("empty") || lower.includes("insufficient html")) {
      userMessage =
        "That page didn't return usable product data. Try another product.";
    }
    return fail(userMessage, 502);
  }
}
