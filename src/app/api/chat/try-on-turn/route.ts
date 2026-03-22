import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";
import { importProductFromUrl } from "@/lib/product/import-from-url";
import { createProductImportFromUserMedia } from "@/lib/product/import-from-user-media";
import {
  ComputeFitError,
  computeFitForProductImport,
} from "@/lib/product/compute-fit-for-import";
import type { TryOnVisionAnalysis } from "@/lib/try-on/try-on-analysis";
import {
  runTryOnAnalyzePhase,
  runTryOnRenderPhase,
} from "@/lib/try-on/run-try-on";
import { maybeSetSessionTitleAfterFirstTurn } from "@/lib/chat/session-title";

const tryOnTurnSchema = z
  .object({
    sessionId: z.string().min(1),
    prompt: z.string().optional().default(""),
    productUrl: z.string().optional(),
    productImageMediaId: z.string().optional(),
    modelMediaIds: z.array(z.string().min(1)).min(1).max(2),
  })
  .superRefine((val, ctx) => {
    const url = val.productUrl?.trim();
    const pid = val.productImageMediaId?.trim();
    const n = (url ? 1 : 0) + (pid ? 1 : 0);
    if (n !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Add exactly one product source: a link **or** a product photo — not both, not neither.",
      });
    }
    if (url) {
      try {
        // eslint-disable-next-line no-new
        new URL(url);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Product link must be a valid URL.",
          path: ["productUrl"],
        });
      }
    }
  });

const tryOnVisionStoredSchema = z.object({
  itemType: z.enum([
    "wearable_top",
    "wearable_bottom",
    "full_body_wear",
    "footwear",
    "accessory",
    "non_wearable_product",
  ]),
  shortDescription: z.string(),
  howToVisualize: z.string(),
  zoomSuggestion: z.string(),
  riskNotes: z.string(),
  recommendedFitStyle: z.enum(["snug", "true-to-size", "relaxed"]),
  displaySummary: z.string(),
});

const tryOnPendingSchema = z.object({
  runId: z.string().min(1),
  productImportId: z.string().min(1),
  analysis: tryOnVisionStoredSchema,
  frontMediaId: z.string().min(1),
  backMediaId: z.string().min(1),
  customPrompt: z.string().nullable().optional(),
  fit: z.record(z.string(), z.unknown()),
});

const renderTryOnBodySchema = z.object({
  sessionId: z.string().min(1),
  renderForAiMessageId: z.string().min(1),
});

type FitForTryOnText = {
  fitLabel: string;
  recommendedSize: string | null;
  fitConfidence: number;
  reasons: string[];
  warnings: string[];
  alternateSize: string | null;
};

function buildTryOnAnswerText(
  fit: FitForTryOnText,
  tryOnImages: "pending" | "ready",
): string {
  const confPct = Math.round(fit.fitConfidence * 100);
  const lines = [
    `**${fit.fitLabel}** (${confPct}% confidence)`,
    fit.recommendedSize
      ? `**Suggested size:** ${fit.recommendedSize}${fit.alternateSize ? ` (alternate: ${fit.alternateSize})` : ""
      }`
      : "**Suggested size:** Add product size data or measurements for a clearer pick.",
    "",
    "*Why:*",
    ...fit.reasons.map((r) => `- ${r}`),
  ];
  if (fit.warnings.length) {
    lines.push("", "*Notes:*", ...fit.warnings.map((w) => `- ${w}`));
  }
  lines.push(
    "",
    tryOnImages === "pending"
      ? "**Try-on:** Generating your views (front, back, detail)…"
      : "**Try-on:** Front, back, and zoomed renders are shown below.",
  );
  return lines.join("\n");
}

async function handleTryOnRenderPhase(params: {
  userId: string;
  sessionId: string;
  aiMessageId: string;
}) {
  const { userId, sessionId, aiMessageId } = params;

  const chatSession = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!chatSession) return fail("Chat session not found", 404);

  const msg = await prisma.chatMessage.findFirst({
    where: { id: aiMessageId, sessionId, senderType: "AI" },
  });
  if (!msg) return fail("Assistant message not found", 404);

  const raw = msg.contentJson;
  if (!raw || typeof raw !== "object") {
    return fail("Invalid message state", 409);
  }
  const cj = raw as Record<string, unknown>;
  if (cj.tryOn && typeof cj.tryOn === "object") {
    return ok({ tryOn: cj.tryOn });
  }

  const pending = tryOnPendingSchema.safeParse(cj.tryOnPending);
  if (!pending.success) {
    return fail("Try-on is not awaiting image generation", 409);
  }

  const p = pending.data;
  const product = await prisma.productImport.findFirst({
    where: { id: p.productImportId, userId },
    include: { images: true },
  });
  if (!product) return fail("Product import not found", 404);

  const fitTyped = p.fit as FitForTryOnText;

  let tryOnResult: Awaited<ReturnType<typeof runTryOnRenderPhase>>;
  try {
    tryOnResult = await runTryOnRenderPhase({
      userId,
      productImportId: product.id,
      product: {
        id: product.id,
        title: product.title,
        brand: product.brand,
        images: product.images.map((img) => ({
          imageUrl: img.imageUrl,
          s3Key: img.s3Key,
        })),
      },
      frontMediaId: p.frontMediaId,
      backMediaId: p.backMediaId,
      customPrompt: p.customPrompt ?? null,
      analysis: p.analysis as TryOnVisionAnalysis,
      runId: p.runId,
    });
  } catch (e) {
    const msgErr = e instanceof Error ? e.message : "Try-on generation failed";
    return fail(`Try-on generation failed: ${msgErr}`, 502);
  }

  const idFor = (label: "front" | "back" | "zoomed") => {
    const v = tryOnResult.variations.find((x) => x.label === label);
    if (!v) throw new Error(`Missing try-on variation: ${label}`);
    return v.id;
  };
  const tryOnMediaIds = {
    front: idFor("front"),
    back: idFor("back"),
    zoomed: idFor("zoomed"),
  };

  const tryOnPayload = {
    productImportId: product.id,
    fit: p.fit,
    tryOnMediaIds,
    runId: tryOnResult.runId,
    analysisSummary: tryOnResult.analysisSummary,
  };

  const answerText = [
    tryOnResult.analysisSummary.trim(),
    "",
    buildTryOnAnswerText(fitTyped, "ready"),
  ].join("\n");

  await prisma.chatMessage.update({
    where: { id: aiMessageId },
    data: {
      contentText: answerText,
      contentJson: JSON.parse(
        JSON.stringify({
          tryOn: tryOnPayload,
        }),
      ),
    },
  });

  return ok({ tryOn: tryOnPayload });
}

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if ("status" in session) return session;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const bodyObj =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  if (bodyObj && typeof bodyObj.renderForAiMessageId === "string") {
    const renderParsed = renderTryOnBodySchema.safeParse(body);
    if (!renderParsed.success) {
      return fail(
        renderParsed.error.issues[0]?.message ?? "Invalid render request",
        422,
      );
    }
    return handleTryOnRenderPhase({
      userId: session.userId,
      sessionId: renderParsed.data.sessionId,
      aiMessageId: renderParsed.data.renderForAiMessageId.trim(),
    });
  }

  const parsed = tryOnTurnSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  }

  const {
    sessionId,
    prompt: promptRaw,
    productUrl: productUrlRaw,
    productImageMediaId,
    modelMediaIds,
  } = parsed.data;

  const prompt = promptRaw.trim();
  const url = productUrlRaw?.trim() || undefined;
  const productImg = productImageMediaId?.trim() || undefined;

  const frontMediaId = modelMediaIds[0]!;
  const backMediaId = modelMediaIds[1] ?? modelMediaIds[0]!;

  const messageCountBeforeTurn = await prisma.chatMessage.count({
    where: { sessionId },
  });

  const chatSession = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId: session.userId },
  });
  if (!chatSession) return fail("Chat session not found", 404);

  let productImportId: string;

  try {
    if (url) {
      const imported = await importProductFromUrl({
        userId: session.userId,
        url,
      });
      productImportId = imported.productImportId;
    } else if (productImg) {
      const created = await createProductImportFromUserMedia({
        userId: session.userId,
        mediaId: productImg,
        titleHint: prompt || undefined,
      });
      productImportId = created.productImportId;
    } else {
      return fail("Product source missing.", 422);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Product import failed";
    const blocked =
      /\b403\b/.test(msg) ||
      /\b401\b/.test(msg) ||
      msg.toLowerCase().includes("forbidden");
    const hint = blocked
      ? " Retail sites sometimes block server IPs (bot protection). Try again in a few minutes, use another product link, or upload a clear product photo instead."
      : "";
    return fail(`${msg}${hint}`, 502);
  }

  const product = await prisma.productImport.findFirst({
    where: { id: productImportId, userId: session.userId },
    include: { images: true },
  });
  if (!product) return fail("Product import not found", 404);

  let fit: Record<string, unknown>;
  try {
    const r = await computeFitForProductImport({
      userId: session.userId,
      productImportId,
    });
    fit = JSON.parse(JSON.stringify(r.fit)) as Record<string, unknown>;
  } catch (e) {
    if (e instanceof ComputeFitError) {
      return fail(e.message, e.status);
    }
    const msg = e instanceof Error ? e.message : "Fit check failed";
    return fail(msg, 500);
  }

  const fitTyped = fit as {
    fitLabel: string;
    recommendedSize: string | null;
    fitConfidence: number;
    reasons: string[];
    warnings: string[];
    alternateSize: string | null;
  };

  let analyzeResult: Awaited<ReturnType<typeof runTryOnAnalyzePhase>>;
  try {
    analyzeResult = await runTryOnAnalyzePhase({
      userId: session.userId,
      productImportId: product.id,
      product: {
        id: product.id,
        title: product.title,
        brand: product.brand,
        images: product.images.map((img) => ({
          imageUrl: img.imageUrl,
          s3Key: img.s3Key,
        })),
      },
      frontMediaId,
      backMediaId,
      customPrompt: prompt || null,
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Try-on analysis failed";
    return fail(`Try-on analysis failed: ${msg}`, 502);
  }

  const userAttachmentIds = [
    ...new Set(
      [...modelMediaIds, productImg].filter(
        (x): x is string => typeof x === "string" && x.length > 0,
      ),
    ),
  ];

  const userDisplayParts = [
    url ?? null,
    productImg ? "[Product photo]" : null,
    prompt.length ? prompt : null,
  ].filter(Boolean);
  const userDisplayText =
    userDisplayParts.join(" · ") || "Try-on";

  const answerText = [
    analyzeResult.analysisSummary.trim(),
    "",
    buildTryOnAnswerText(fitTyped, "pending"),
  ].join("\n");

  const tryOnPending = {
    runId: analyzeResult.runId,
    productImportId: product.id,
    analysis: analyzeResult.analysis,
    frontMediaId,
    backMediaId,
    customPrompt: prompt.length ? prompt : null,
    fit,
  };

  await prisma.chatMessage.create({
    data: {
      sessionId,
      senderType: "USER",
      contentText: userDisplayText,
      attachmentsJson:
        userAttachmentIds.length > 0 ? userAttachmentIds : undefined,
    },
  });

  const aiMessage = await prisma.chatMessage.create({
    data: {
      sessionId,
      senderType: "AI",
      contentText: answerText,
      contentJson: JSON.parse(
        JSON.stringify({
          tryOnPending,
        }),
      ),
    },
  });

  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { mode: "tryon" },
  });

  await maybeSetSessionTitleAfterFirstTurn({
    sessionId,
    userId: session.userId,
    messageCountBeforeThisTurn: messageCountBeforeTurn,
    titleHint: [product.title, url, prompt].filter(Boolean).join(" — ") || userDisplayText,
  });

  return ok({
    answer: answerText,
    aiMessageId: aiMessage.id,
    needsImageGeneration: true,
  });
}
