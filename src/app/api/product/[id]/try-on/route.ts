import { NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma/client";
import { ok, fail } from "@/lib/http";
import { generatePresignedDownloadUrl } from "@/lib/s3/presign";
import { s3Bucket, s3Client } from "@/lib/s3/client";
import { getGeminiImageModel } from "@/lib/ai/client";

const tryOnSchema = z.object({
  frontMediaId: z.string().min(1),
  backMediaId: z.string().min(1),
  selectedProductImageUrl: z.string().url().optional(),
  fitStyle: z.enum(["snug", "true-to-size", "relaxed"]).default("true-to-size"),
  backgroundStyle: z.enum(["original", "studio"]).default("original"),
  detailLevel: z.enum(["balanced", "high"]).default("high"),
  customPrompt: z.string().max(600).optional(),
});

type GeneratedVariation = {
  label: "front" | "back" | "zoomed";
  imageDataUrl: string;
};

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Image fetch failed (${res.status})`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return { base64, mimeType: contentType };
}

/** Tells the model exactly how tight the zoom frame must be vs a normal front photo. */
function zoomCropDirectiveFromTitle(productTitle: string): string {
  const t = productTitle.toLowerCase();
  if (/\b(shoe|sneaker|sandal|boot|footwear|loafer|heel)\b/.test(t)) {
    return (
      "ZOOM GEOMETRY: Frame ONLY feet and ankles (both if visible); lower shin at most. " +
      "No full-body, no waist-up—this is a shoe try-on close-up."
    );
  }
  if (/\b(pant|jean|trouser|chino|jogger|legging)\b/.test(t) && !/short/.test(t)) {
    return (
      "ZOOM GEOMETRY: Frame from high hip/waistband through mid-thigh or knee only. " +
      "Head, chest, and full-length legs must NOT appear—much tighter than a mirror selfie."
    );
  }
  if (/\b(short|shorts)\b/.test(t)) {
    return (
      "ZOOM GEOMETRY: Frame waist through upper thighs where shorts end; no full torso head-to-toe. " +
      "Closer than a standard front try-on photo."
    );
  }
  if (/\b(dress|gown|jumpsuit|romper)\b/.test(t)) {
    return (
      "ZOOM GEOMETRY: Frame torso through mid-thigh or dress hem—not a full-length formal shot. " +
      "Garment fit detail should fill most of the frame."
    );
  }
  // Shirts, tees, jackets, sweaters, kurtas, hoodies, coats, tops, blouses, polos…
  return (
    "ZOOM GEOMETRY (TOP / SHIRT / JACKET): This must look like a DETAIL PHOTO, not the front try-on. " +
    "Crop from upper chest / collarbone region down to waist or top of hips ONLY—often crop OUT most or all of the face. " +
    "Collar, placket, buttons/zip, chest fabric, and upper sleeves should dominate the frame. " +
    "If you can see the person’s full head AND full waist in the same shot at normal scale, the crop is TOO WIDE—zoom in further. " +
    "Think: phone held close to the chest to inspect fit, not arms-length mirror full torso."
  );
}

function buildTryOnPrompt(params: {
  view: "front" | "back" | "zoomed";
  productTitle: string;
  fitStyle: "snug" | "true-to-size" | "relaxed";
  backgroundStyle: "original" | "studio";
  detailLevel: "balanced" | "high";
  customPrompt?: string;
}) {
  const fitStyleInstruction =
    params.fitStyle === "snug"
      ? "Simulate a snug body-hugging fit with realistic tension at chest/waist."
      : params.fitStyle === "relaxed"
        ? "Simulate a relaxed fit with slightly looser drape and more ease."
        : "Simulate true-to-size fit with natural ease and accurate garment alignment.";
  const backgroundInstruction =
    params.backgroundStyle === "studio"
      ? "Background: plain indoor wall or simple room corner like someone took a quick try-on photo at home—NOT a seamless cyclorama, NOT catalogue studio. Soft available light only."
      : "Background: believable everyday space (bedroom, hallway, mirror area)—natural and slightly imperfect. You may simplify clutter but keep it feeling like a real person’s photo, not a set.";
  const detailInstruction =
    params.detailLevel === "high"
      ? "Prioritize high-detail fabric texture, seam stitching, and fold realism on the body."
      : "Keep balanced realism; garment should look worn by a real person, not flat-lit on a mannequin.";

  const garmentFidelity =
    "The third image is the exact garment reference: reproduce it with maximum fidelity. " +
    "Match logos, brand marks, typography, graphics, prints, patterns, stripes, checks, textures, embroidery, patches, and hardware (buttons, zips, pulls) precisely—same placement, scale, orientation, and colors. " +
    "Do not invent, omit, simplify, or substitute design elements. " +
    "Preserve thread color, contrast, sheen, knit/weave structure, and edge finishes visible in the reference.";

  const productOnlyRule =
    "Dress the person only in the product described by this title (and the reference product image). " +
    `Product title: "${params.productTitle}". ` +
    "Do not add other retail products or categories that the title does not describe—for example, if the product is shorts, do not add socks, shoes, belts, or jewelry unless the title clearly includes them. " +
    "Use plain minimal underlayers only if needed for modesty and not visible as a separate fashion item.";

  const customBlock = params.customPrompt?.trim()
    ? ` User-provided styling additions (follow these exactly; they may add companion pieces such as a plain shirt with shorts): ${params.customPrompt.trim()}`
    : "";

  const identityRule =
    "The output must depict the SAME real individual as in the first two images (front and back references): keep face, features, skin tone, hair, and body proportions consistent. This is a private try-on visualization, not a reshoot with a model.";

  const authenticPersonRule =
    "CRITICAL AESTHETIC: Show an everyday person trying the garment on—like a candid at-home or fitting-room moment. " +
    "Avoid ALL catalogue, e-commerce hero, runway, or fashion-editorial looks: no model poses, no perfect vogue stance, no glossy campaign lighting, no sterile white seamless studio, no mannequin-flat presentation. " +
    "Use relaxed natural posture (weight on one leg, arms natural, slight body asymmetry OK), believable smartphone or casual camera perspective, mild natural shadows, and realistic skin texture. " +
    "The vibe is 'I’m checking how this fits,' not 'I’m on a brand shoot.' " +
    "No glamour retouching, no porcelain skin, no exaggerated jawline or body editing.";

  const framing =
    "Frame so the garment from the product reference is clearly visible and how it sits on THIS person’s body: for tops/jackets show torso and arms naturally; for bottoms show waist through legs as needed; avoid crops that hide fit.";

  const imageOrderRule =
    "Attached images appear in this order: (1) USER FRONT PHOTO — full frontal reference for pose, face, and front-of-body. " +
    "(2) USER BACK PHOTO — rear view of the same person; use this for back-of-body silhouette, shoulders, spine line, hair from behind. " +
    "(3) PRODUCT REFERENCE — the garment to composite.";

  const synthesisRule =
    "MANDATORY OUTPUT: You must SYNTHESIZE A BRAND-NEW IMAGE of this person wearing the garment from IMAGE 3 (and any extra items from the user’s custom prompt). " +
    "FORBIDDEN: Do not output IMAGE 1, IMAGE 2, or IMAGE 3 unchanged, resized, lightly filtered, or with trivial edits. Do not paste or alpha-composite the flat product photo as an obvious rectangle over the body. " +
    "The result must be visually DISTINCT from every input: new lighting interaction, 3D drape, folds, seams, and occlusion where cloth meets skin—proving the product is rendered ON the body, not copied from the packshot. " +
    "Where the user’s reference photos show different clothing, REPLACE the relevant areas with the product from IMAGE 3 so the final frame clearly shows THAT product (and prompt extras), not their old outfit alone. " +
    "If you cannot comply, still produce a best-effort full composite—never return a raw duplicate of an input.";

  const base = [
    "You are FitCheck’s virtual try-on renderer: composite the product onto the real user so it looks like they are actually wearing it.",
    imageOrderRule,
    synthesisRule,
    authenticPersonRule,
    identityRule,
    garmentFidelity,
    productOnlyRule + customBlock,
    "Render believable drape, tension, wrinkles, and seam lines where the cloth meets the body—how real clothes look on a real person.",
    "Do not add text overlays, watermarks, or spurious graphics.",
    "Output one photorealistic image only (not illustration, not CGI plastic skin).",
    fitStyleInstruction,
    backgroundInstruction,
    detailInstruction,
  ].join(" ");

  if (params.view === "front") {
    return (
      `${base} FRONT VIEW — TRUE FRONTAL TRY-ON (NOT BACK, NOT PROFILE-ONLY, NOT MACRO): ` +
      "The camera looks at the FRONT of the person. Their chest, shoulders, and the FRONT of the garment face the lens (mild 3/4 toward camera is OK if IMAGE 1 is 3/4). " +
      "You MUST match IMAGE 1’s viewing direction: if IMAGE 1 is a front selfie, output a front try-on; never substitute a rear view for this slot. " +
      "Show enough body context: for shirts, tees, jackets, sweaters—at least waist-up or 3/4 body so the whole front of the top is visible; include face if IMAGE 1 does. " +
      "IMAGE 3 defines the shirt/garment design worn on that front-of-body. IMAGE 2 is identity-only helper, not the main pose reference here. " +
      "The visible garment must be the product from IMAGE 3 re-rendered on the body—not the flat product sheet alone, not a back shot. " +
      `${framing} ` +
      "This output must be clearly different from the ZOOMED shot: wider framing, frontal, not a tight chest-only crop."
    );
  }
  if (params.view === "back") {
    return (
      `${base} BACK VIEW: anchor the entire composition on IMAGE 2 (user BACK photo)—same back, shoulders, upper arms, hair from behind, and rear stance as in that photo. ` +
      "The output must look like that person’s real back with the product worn; do not invent a different back silhouette. " +
      "IMAGE 1 is secondary (e.g. skin tone edge cases); do not use the front photo as the primary body template for this shot. " +
      "IMAGE 3 defines garment back details (print, seams, hood, hem). Natural rear try-on photo, not a catalogue model spin. " +
      "The back of the outfit must match IMAGE 3’s design—do not merely echo whatever shirt/jacket appeared in image 2 before try-on. " +
      framing
    );
  }
  const zoomGeometry = zoomCropDirectiveFromTitle(params.productTitle);
  const zoomBodyRule =
    "ZOOMED FIT VIEW — MUST BE A CLOSER CROP THAN THE FRONT VIEW: " +
    "This is the third output in a set; users already see a full front try-on elsewhere. " +
    "Your framing must be SUBSTANTIALLY TIGHTER—if your result looks like the front view with the same head-to-waist scale, it is WRONG; zoom in until only the product zone fills most of the frame. " +
    zoomGeometry +
    " Infer product type from title and IMAGE 3. " +
    "Include skin or body at garment edges so fit reads. Use frontal anatomy from IMAGE 1 when the product is worn on the front; use IMAGE 2 only if the meaningful fit detail is on the back. " +
    "Still synthesize the garment from IMAGE 3 on the body with new drape—not a raw crop of IMAGE 1. " +
    "Casual phone close-up realism.\n\n" +
    "FINAL CHECK: Output must be obviously more magnified / tighter than a normal waist-up front photo.";
  return `${base} ${zoomBodyRule}`;
}

async function generateVariation(params: {
  view: "front" | "back" | "zoomed";
  productTitle: string;
  fitStyle: "snug" | "true-to-size" | "relaxed";
  backgroundStyle: "original" | "studio";
  detailLevel: "balanced" | "high";
  customPrompt?: string;
  frontImage: { base64: string; mimeType: string };
  backImage: { base64: string; mimeType: string };
  productImage: { base64: string; mimeType: string };
}): Promise<GeneratedVariation> {
  const model = getGeminiImageModel();
  const prompt = buildTryOnPrompt({
    view: params.view,
    productTitle: params.productTitle,
    fitStyle: params.fitStyle,
    backgroundStyle: params.backgroundStyle,
    detailLevel: params.detailLevel,
    customPrompt: params.customPrompt,
  });

  const generationConfig =
    params.view === "zoomed"
      ? { temperature: 0.92 }
      : params.view === "front"
        ? { temperature: 0.78 }
        : { temperature: 0.78 };

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { data: params.frontImage.base64, mimeType: params.frontImage.mimeType } },
          { inlineData: { data: params.backImage.base64, mimeType: params.backImage.mimeType } },
          { inlineData: { data: params.productImage.base64, mimeType: params.productImage.mimeType } },
        ],
      },
    ],
    generationConfig,
  });

  const response = result.response;
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => "inlineData" in part && part.inlineData?.data);
  const mimeType =
    "inlineData" in (imagePart ?? {}) && imagePart?.inlineData?.mimeType
      ? imagePart.inlineData.mimeType
      : "image/png";
  const data =
    "inlineData" in (imagePart ?? {}) && imagePart?.inlineData?.data
      ? imagePart.inlineData.data
      : null;

  if (!data) {
    throw new Error(`Model did not return image output for ${params.view} variation`);
  }

  return {
    label: params.view,
    imageDataUrl: `data:${mimeType};base64,${data}`,
  };
}

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data URL");
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

type TryOnLabel = "front" | "back" | "zoomed";

const TRY_ON_KEY_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(front|back|zoomed)\./i;

type TryOnRow = { id: string; s3Key: string; createdAt: Date };

function pickLatestCompleteTryOnRun(
  productId: string,
  userId: string,
  items: TryOnRow[],
): { runId: string; byLabel: Record<TryOnLabel, TryOnRow> } | null {
  const prefix = `users/${userId}/try-on/${productId}/`;
  const runs = new Map<string, Partial<Record<TryOnLabel, TryOnRow>>>();

  for (const m of items) {
    if (!m.s3Key.startsWith(prefix)) continue;
    const suffix = m.s3Key.slice(prefix.length);
    const match = suffix.match(TRY_ON_KEY_RE);
    if (!match) continue;
    const runId = match[1];
    const label = match[2].toLowerCase() as TryOnLabel;
    const cur = runs.get(runId) ?? {};
    cur[label] = m;
    runs.set(runId, cur);
  }

  let best: { runId: string; latest: Date; byLabel: Record<TryOnLabel, TryOnRow> } | null = null;

  for (const [runId, map] of runs) {
    if (!map.front || !map.back || !map.zoomed) continue;
    const latest = [map.front.createdAt, map.back.createdAt, map.zoomed.createdAt].reduce(
      (a, b) => (a > b ? a : b),
      map.front.createdAt,
    );
    if (!best || latest > best.latest) {
      best = {
        runId,
        latest,
        byLabel: { front: map.front, back: map.back, zoomed: map.zoomed },
      };
    }
  }

  return best ? { runId: best.runId, byLabel: best.byLabel } : null;
}

/** Returns the latest saved try-on run for this product with fresh download URLs. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if ("status" in session) return session;

  const { id } = await params;

  const product = await prisma.productImport.findFirst({
    where: { id, userId: session.userId },
    select: { id: true },
  });
  if (!product) return fail("Product not found", 404);

  const prefix = `users/${session.userId}/try-on/${id}/`;
  const items = await prisma.userMedia.findMany({
    where: {
      userId: session.userId,
      isDeleted: false,
      category: "try-on",
      s3Key: { startsWith: prefix },
    },
    orderBy: { createdAt: "desc" },
    take: 120,
    select: { id: true, s3Key: true, createdAt: true },
  });

  const picked = pickLatestCompleteTryOnRun(id, session.userId, items);
  if (!picked) {
    return ok({ runId: null, variations: [] });
  }

  const order: TryOnLabel[] = ["front", "back", "zoomed"];
  const variations = await Promise.all(
    order.map(async (label) => {
      const row = picked.byLabel[label];
      const downloadUrl = await generatePresignedDownloadUrl(row.s3Key);
      return {
        id: row.id,
        label,
        s3Key: row.s3Key,
        downloadUrl,
      };
    }),
  );

  return ok({ runId: picked.runId, variations });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if ("status" in session) return session;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = tryOnSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  }

  const product = await prisma.productImport.findFirst({
    where: { id, userId: session.userId },
    include: { images: true },
  });
  if (!product) return fail("Product not found", 404);

  const [frontMedia, backMedia] = await Promise.all([
    prisma.userMedia.findFirst({
      where: {
        id: parsed.data.frontMediaId,
        userId: session.userId,
        isDeleted: false,
      },
    }),
    prisma.userMedia.findFirst({
      where: {
        id: parsed.data.backMediaId,
        userId: session.userId,
        isDeleted: false,
      },
    }),
  ]);
  if (!frontMedia || !backMedia) {
    return fail("Front and back images are required", 400);
  }

  const productImageUrl =
    parsed.data.selectedProductImageUrl ||
    product.images[0]?.imageUrl;
  if (!productImageUrl) {
    return fail("No product image available for try-on", 400);
  }

  try {
    const [frontUrl, backUrl] = await Promise.all([
      generatePresignedDownloadUrl(frontMedia.s3Key),
      generatePresignedDownloadUrl(backMedia.s3Key),
    ]);

    const [frontImage, backImage, productImage] = await Promise.all([
      fetchImageAsBase64(frontUrl),
      fetchImageAsBase64(backUrl),
      fetchImageAsBase64(productImageUrl),
    ]);

    const productTitle = product.title || product.brand || "selected garment";
    const customPrompt = parsed.data.customPrompt?.trim() || undefined;
    const runId = randomUUID();
    const variations = await Promise.all([
      generateVariation({
        view: "front",
        productTitle,
        fitStyle: parsed.data.fitStyle,
        backgroundStyle: parsed.data.backgroundStyle,
        detailLevel: parsed.data.detailLevel,
        customPrompt,
        frontImage,
        backImage,
        productImage,
      }),
      generateVariation({
        view: "back",
        productTitle,
        fitStyle: parsed.data.fitStyle,
        backgroundStyle: parsed.data.backgroundStyle,
        detailLevel: parsed.data.detailLevel,
        customPrompt,
        frontImage,
        backImage,
        productImage,
      }),
      generateVariation({
        view: "zoomed",
        productTitle,
        fitStyle: parsed.data.fitStyle,
        backgroundStyle: parsed.data.backgroundStyle,
        detailLevel: parsed.data.detailLevel,
        customPrompt,
        frontImage,
        backImage,
        productImage,
      }),
    ]);

    const persisted = await Promise.all(
      variations.map(async (variation) => {
        const { buffer, mimeType } = dataUrlToBuffer(variation.imageDataUrl);
        const ext = mimeType.includes("png")
          ? "png"
          : mimeType.includes("webp")
            ? "webp"
            : "jpg";
        const s3Key = `users/${session.userId}/try-on/${id}/${runId}-${variation.label}.${ext}`;

        await s3Client.send(
          new PutObjectCommand({
            Bucket: s3Bucket,
            Key: s3Key,
            Body: buffer,
            ContentType: mimeType,
          }),
        );

        const media = await prisma.userMedia.create({
          data: {
            userId: session.userId,
            s3Key,
            fileName: `try-on-${variation.label}-${runId}.${ext}`,
            mimeType,
            fileSize: BigInt(buffer.length),
            category: "try-on",
          },
        });
        const downloadUrl = await generatePresignedDownloadUrl(s3Key);
        return {
          id: media.id,
          label: variation.label,
          s3Key,
          downloadUrl,
        };
      }),
    );

    await prisma.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: "try_on_generated",
        entityType: "ProductImport",
        entityId: product.id,
        payloadJson: {
          runId,
          fitStyle: parsed.data.fitStyle,
          backgroundStyle: parsed.data.backgroundStyle,
          detailLevel: parsed.data.detailLevel,
          customPrompt: customPrompt ?? null,
          frontMediaId: parsed.data.frontMediaId,
          backMediaId: parsed.data.backMediaId,
          outputs: persisted.map((item) => ({ id: item.id, label: item.label, s3Key: item.s3Key })),
        },
      },
    });

    return ok({ runId, variations: persisted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Try-on generation failed";
    return fail(`Try-on generation failed: ${message}`, 502);
  }
}
