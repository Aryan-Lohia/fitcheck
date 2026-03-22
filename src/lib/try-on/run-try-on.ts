import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma/client";
import { generatePresignedDownloadUrl } from "@/lib/s3/presign";
import { s3Bucket, s3Client } from "@/lib/s3/client";
import { getUserMediaAsGeminiInline } from "@/lib/media/user-media-image-base64";
import { getGeminiImageModel } from "@/lib/ai/client";
import { dedupeProductImageRows } from "@/lib/scraper/image-dedupe";
import {
  runTryOnVisionAnalysis,
  isWearableItemType,
  type TryOnVisionAnalysis,
} from "@/lib/try-on/try-on-analysis";

/** Per-variation ceiling; three runs sequential → allow ~7 min total server-side */
const TRY_ON_VARIATION_TIMEOUT_MS = 140_000;

export type TryOnVariationLabel = "front" | "back" | "zoomed";

export type ProductImageRow = { imageUrl: string; s3Key: string | null };

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

type GeneratedVariation = {
  label: TryOnVariationLabel;
  imageDataUrl: string;
};

function refererForProductImageUrl(imageUrl: string): string | undefined {
  try {
    const h = new URL(imageUrl).hostname.toLowerCase();
    if (h.includes("myntassets.com") || h.includes("myntra.com")) {
      return "https://www.myntra.com/";
    }
    if (h.includes("jiocdn") || h.includes("ajio.com")) {
      return "https://www.ajio.com/";
    }
    if (h.includes("meesho") || h.includes("meeshocdn")) {
      return "https://www.meesho.com/";
    }
  } catch {
    /* */
  }
  return undefined;
}

const IMAGE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function fetchImageAsBase64(
  url: string,
): Promise<{ base64: string; mimeType: string }> {
  const ref = refererForProductImageUrl(url);
  const headerSets: Record<string, string>[] = [];
  if (ref) {
    headerSets.push({
      "user-agent": IMAGE_UA,
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      referer: ref,
    });
  }
  headerSets.push({
    "user-agent": IMAGE_UA,
    accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  });

  let last: Error | null = null;
  for (const headers of headerSets) {
    try {
      const res = await fetch(url, { cache: "no-store", headers });
      if (!res.ok) {
        throw new Error(`Image fetch failed (${res.status})`);
      }
      const contentType = res.headers.get("content-type") || "image/jpeg";
      if (!contentType.startsWith("image/")) {
        throw new Error("Response is not an image");
      }
      const arrayBuffer = await res.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      return { base64, mimeType: contentType };
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw last ?? new Error("Image fetch failed");
}

type ProductImageFetchAttempt =
  | { kind: "s3"; key: string }
  | { kind: "http"; url: string };

function buildProductImageFetchAttempts(
  rows: ProductImageRow[],
  selectedProductImageUrl?: string | null,
): ProductImageFetchAttempt[] {
  const deduped = dedupeProductImageRows(rows);
  const attempts: ProductImageFetchAttempt[] = [];
  const seenS3 = new Set<string>();
  const seenHttp = new Set<string>();

  const addHttp = (raw: string) => {
    const url = raw.trim().replace(/^http:\/\//i, "https://");
    if (!url || seenHttp.has(url)) return;
    // Path-only / protocol-relative: not fetchable server-side (same-origin paths without cookies).
    if (url.startsWith("/")) return;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return;
    }
    if (parsed.hostname.toLowerCase() === "local.invalid") return;
    seenHttp.add(url);
    attempts.push({ kind: "http", url });
  };

  const addS3 = (key: string | null | undefined) => {
    const k = key?.trim();
    if (!k || seenS3.has(k)) return;
    seenS3.add(k);
    attempts.push({ kind: "s3", key: k });
  };

  if (selectedProductImageUrl?.trim()) {
    addHttp(selectedProductImageUrl);
  }

  for (const row of deduped) {
    addS3(row.s3Key);
    addHttp(row.imageUrl);
  }

  return attempts;
}

export async function fetchProductImageWithFallback(
  rows: ProductImageRow[],
  selectedProductImageUrl?: string | null,
): Promise<{ base64: string; mimeType: string }> {
  const attempts = buildProductImageFetchAttempts(rows, selectedProductImageUrl);
  if (!attempts.length) {
    throw new Error("No product image URLs available");
  }

  let lastError: Error | null = null;
  for (const attempt of attempts) {
    try {
      const url =
        attempt.kind === "s3"
          ? await generatePresignedDownloadUrl(attempt.key)
          : attempt.url;
      return await fetchImageAsBase64(url);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw new Error(
    lastError
      ? `Product image could not be loaded (CDN link may have expired): ${lastError.message}`
      : "Product image could not be loaded",
  );
}

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
  return (
    "ZOOM GEOMETRY (TOP / SHIRT / JACKET): This must look like a DETAIL PHOTO, not the front try-on. " +
    "Crop from upper chest / collarbone region down to waist or top of hips ONLY—often crop OUT most or all of the face. " +
    "Collar, placket, buttons/zip, chest fabric, and upper sleeves should dominate the frame. " +
    "If you can see the person’s full head AND full waist in the same shot at normal scale, the crop is TOO WIDE—zoom in further. " +
    "Think: phone held close to the chest to inspect fit, not arms-length mirror full torso."
  );
}

function buildNonWearableTryOnPrompt(params: {
  view: TryOnVariationLabel;
  productTitle: string;
  visionBrief: string;
  visionZoomHint: string;
  backgroundStyle: "original" | "studio";
  detailLevel: "balanced" | "high";
  customPrompt?: string;
}): string {
  const backgroundInstruction =
    params.backgroundStyle === "studio"
      ? "Background: simple believable indoor space—NOT a white cyclorama."
      : "Background: everyday home or room—natural, slightly imperfect.";
  const detailInstruction =
    params.detailLevel === "high"
      ? "High detail on the product surface, edges, and how hands/skin contact it."
      : "Balanced realism.";
  const imageOrderRule =
    "Images: (1) USER FRONT (2) USER BACK (3) PRODUCT — the product is NOT wearable; never depict the person wearing it as clothing.";
  const synthesisRule =
    "MANDATORY: Output ONE NEW photorealistic image. The person is the SAME individual as in images 1–2. The product from image 3 appears clearly and faithfully—scale, color, branding, shape. " +
    "FORBIDDEN: do not output any input unchanged; do not paste the packshot as a flat rectangle; do not dress the person IN the product. " +
    "Show plausible use: holding, carrying, placing on a surface, standing beside larger items, etc.";
  const identityRule =
    "Keep face, hair, skin tone, and body consistent with the reference photos.";
  const customBlock = params.customPrompt?.trim()
    ? ` User notes: ${params.customPrompt.trim()}`
    : "";
  const base = [
    "You are FitCheck’s general-product visualizer (home, decor, gadgets, furniture, etc.).",
    imageOrderRule,
    `VISION PLAN (follow closely):\n${params.visionBrief}`,
    synthesisRule,
    identityRule,
    `Product title hint: "${params.productTitle}".`,
    customBlock,
    backgroundInstruction,
    detailInstruction,
    "No text overlays or watermarks.",
  ].join(" ");

  if (params.view === "front") {
    return (
      `${base} FRONT / 3-4 VIEW: Camera toward the front of the person; product clearly visible per the vision plan—natural pose, like a candid photo, not a catalogue.`
    );
  }
  if (params.view === "back") {
    return (
      `${base} BACK VIEW: Anchor on image 2 (user’s back). Show the product in context (held to the side, on a shoulder, on nearby furniture, etc.) per the vision plan—still the same person.`
    );
  }
  return (
    `${base} DETAIL / CLOSE-UP: Tighter framing than the front shot. ${params.visionZoomHint || "Emphasize the product itself with hands or immediate context."} ` +
    "Must look more magnified than the wide front shot."
  );
}

function buildTryOnPrompt(params: {
  view: TryOnVariationLabel;
  productTitle: string;
  fitStyle: "snug" | "true-to-size" | "relaxed";
  backgroundStyle: "original" | "studio";
  detailLevel: "balanced" | "high";
  customPrompt?: string;
  visionBrief?: string;
  visionZoomHint?: string;
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

  const visionPreamble = params.visionBrief?.trim()
    ? `VISION ANALYSIS (follow before other instructions):\n${params.visionBrief.trim()}\n\n`
    : "";

  const base = [
    visionPreamble +
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
  const zoomExtra = params.visionZoomHint?.trim()
    ? ` Additional zoom guidance: ${params.visionZoomHint.trim()}`
    : "";
  const zoomBodyRule =
    "ZOOMED FIT VIEW — MUST BE A CLOSER CROP THAN THE FRONT VIEW: " +
    "This is the third output in a set; users already see a full front try-on elsewhere. " +
    "Your framing must be SUBSTANTIALLY TIGHTER—if your result looks like the front view with the same head-to-waist scale, it is WRONG; zoom in until only the product zone fills most of the frame. " +
    zoomGeometry +
    " Infer product type from title and IMAGE 3. " +
    "Include skin or body at garment edges so fit reads. Use frontal anatomy from IMAGE 1 when the product is worn on the front; use IMAGE 2 only if the meaningful fit detail is on the back. " +
    "Still synthesize the garment from IMAGE 3 on the body with new drape—not a raw crop of IMAGE 1. " +
    "Casual phone close-up realism.\n\n" +
    zoomExtra +
    "\nFINAL CHECK: Output must be obviously more magnified / tighter than a normal waist-up front photo.";
  return `${base} ${zoomBodyRule}`;
}

function buildTryOnPromptForPipeline(params: {
  view: TryOnVariationLabel;
  productTitle: string;
  fitStyle: "snug" | "true-to-size" | "relaxed";
  backgroundStyle: "original" | "studio";
  detailLevel: "balanced" | "high";
  customPrompt?: string;
  analysis: TryOnVisionAnalysis;
}): string {
  const wearable = isWearableItemType(params.analysis.itemType);
  const visionBrief = [
    params.analysis.shortDescription,
    params.analysis.howToVisualize,
    params.analysis.riskNotes ? `Notes: ${params.analysis.riskNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const visionZoomHint = params.analysis.zoomSuggestion;

  if (!wearable) {
    return buildNonWearableTryOnPrompt({
      view: params.view,
      productTitle: params.productTitle,
      visionBrief,
      visionZoomHint,
      backgroundStyle: params.backgroundStyle,
      detailLevel: params.detailLevel,
      customPrompt: params.customPrompt,
    });
  }

  return buildTryOnPrompt({
    view: params.view,
    productTitle: params.productTitle,
    fitStyle: params.fitStyle,
    backgroundStyle: params.backgroundStyle,
    detailLevel: params.detailLevel,
    customPrompt: params.customPrompt,
    visionBrief,
    visionZoomHint,
  });
}

async function generateVariation(params: {
  view: TryOnVariationLabel;
  productTitle: string;
  fitStyle: "snug" | "true-to-size" | "relaxed";
  backgroundStyle: "original" | "studio";
  detailLevel: "balanced" | "high";
  customPrompt?: string;
  analysis: TryOnVisionAnalysis;
  frontImage: { base64: string; mimeType: string };
  backImage: { base64: string; mimeType: string };
  productImage: { base64: string; mimeType: string };
}): Promise<GeneratedVariation> {
  const model = getGeminiImageModel();
  const prompt = buildTryOnPromptForPipeline({
    view: params.view,
    productTitle: params.productTitle,
    fitStyle: params.fitStyle,
    backgroundStyle: params.backgroundStyle,
    detailLevel: params.detailLevel,
    customPrompt: params.customPrompt,
    analysis: params.analysis,
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

export type RunTryOnResult = {
  runId: string;
  /** Markdown/plain text from vision phase — shown in chat */
  analysisSummary: string;
  variations: Array<{
    id: string;
    label: TryOnVariationLabel;
    s3Key: string;
    downloadUrl: string;
  }>;
};

export type RunTryOnGenerationParams = {
  userId: string;
  productImportId: string;
  product: {
    id: string;
    title: string | null;
    brand: string | null;
    images: ProductImageRow[];
  };
  frontMediaId: string;
  backMediaId: string;
  selectedProductImageUrl?: string | null;
  /** When set (e.g. URL import + user-chosen packshot), use this vault image as garment reference first. */
  overrideProductImageMediaId?: string | null;
  fitStyle?: "snug" | "true-to-size" | "relaxed";
  backgroundStyle?: "original" | "studio";
  detailLevel?: "balanced" | "high";
  customPrompt?: string | null;
};

type LoadedTryOnImages = {
  frontImage: { base64: string; mimeType: string };
  backImage: { base64: string; mimeType: string };
  productImage: { base64: string; mimeType: string };
  productTitle: string;
};

async function loadTryOnInlineImages(
  params: Pick<
    RunTryOnGenerationParams,
    | "userId"
    | "product"
    | "frontMediaId"
    | "backMediaId"
    | "selectedProductImageUrl"
    | "overrideProductImageMediaId"
  >,
): Promise<LoadedTryOnImages> {
  const [frontMedia, backMedia] = await Promise.all([
    prisma.userMedia.findFirst({
      where: {
        id: params.frontMediaId,
        userId: params.userId,
        isDeleted: false,
      },
    }),
    prisma.userMedia.findFirst({
      where: {
        id: params.backMediaId,
        userId: params.userId,
        isDeleted: false,
      },
    }),
  ]);
  if (!frontMedia || !backMedia) {
    throw new Error("Front and back images are required");
  }

  let productImage: { base64: string; mimeType: string };

  if (params.overrideProductImageMediaId?.trim()) {
    const pm = await prisma.userMedia.findFirst({
      where: {
        id: params.overrideProductImageMediaId.trim(),
        userId: params.userId,
        isDeleted: false,
        mimeType: { startsWith: "image/" },
      },
    });
    if (!pm) {
      throw new Error("Override product image not found");
    }
    productImage = await getUserMediaAsGeminiInline({
      s3Key: pm.s3Key,
      mimeTypeFromDb: pm.mimeType,
    }).catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Product photo could not be loaded (${msg})`);
    });
  } else {
    const attempts = buildProductImageFetchAttempts(
      params.product.images,
      params.selectedProductImageUrl,
    );
    if (!attempts.length) {
      throw new Error("No product image available for try-on");
    }
    productImage = await fetchProductImageWithFallback(
      params.product.images,
      params.selectedProductImageUrl,
    );
  }

  const [frontImage, backImage] = await Promise.all([
    getUserMediaAsGeminiInline({
      s3Key: frontMedia.s3Key,
      mimeTypeFromDb: frontMedia.mimeType,
    }).catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Your first model reference could not be loaded (${msg})`);
    }),
    getUserMediaAsGeminiInline({
      s3Key: backMedia.s3Key,
      mimeTypeFromDb: backMedia.mimeType,
    }).catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Your second model reference could not be loaded (${msg})`);
    }),
  ]);

  const productTitle =
    params.product.title || params.product.brand || "selected garment";

  return { frontImage, backImage, productImage, productTitle };
}

async function persistTryOnVariations(params: {
  userId: string;
  productImportId: string;
  product: RunTryOnGenerationParams["product"];
  frontMediaId: string;
  backMediaId: string;
  runId: string;
  analysis: TryOnVisionAnalysis;
  fitStyle: "snug" | "true-to-size" | "relaxed";
  backgroundStyle: "original" | "studio";
  detailLevel: "balanced" | "high";
  customPrompt?: string;
  frontImage: { base64: string; mimeType: string };
  backImage: { base64: string; mimeType: string };
  productImage: { base64: string; mimeType: string };
  productTitle: string;
}): Promise<RunTryOnResult> {
  const variations: GeneratedVariation[] = [];
  const views: TryOnVariationLabel[] = ["front", "back", "zoomed"];
  for (const view of views) {
    const v = await withTimeout(
      generateVariation({
        view,
        productTitle: params.productTitle,
        fitStyle: params.fitStyle,
        backgroundStyle: params.backgroundStyle,
        detailLevel: params.detailLevel,
        customPrompt: params.customPrompt,
        analysis: params.analysis,
        frontImage: params.frontImage,
        backImage: params.backImage,
        productImage: params.productImage,
      }),
      TRY_ON_VARIATION_TIMEOUT_MS,
      `Try-on ${view} render`,
    );
    variations.push(v);
  }

  const persisted = await Promise.all(
    variations.map(async (variation) => {
      const { buffer, mimeType } = dataUrlToBuffer(variation.imageDataUrl);
      const ext = mimeType.includes("png")
        ? "png"
        : mimeType.includes("webp")
          ? "webp"
          : "jpg";
      const s3Key = `users/${params.userId}/try-on/${params.productImportId}/${params.runId}-${variation.label}.${ext}`;

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
          userId: params.userId,
          s3Key,
          fileName: `try-on-${variation.label}-${params.runId}.${ext}`,
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
      actorUserId: params.userId,
      action: "try_on_generated",
      entityType: "ProductImport",
      entityId: params.product.id,
      payloadJson: {
        runId: params.runId,
        fitStyle: params.fitStyle,
        backgroundStyle: params.backgroundStyle,
        detailLevel: params.detailLevel,
        customPrompt: params.customPrompt ?? null,
        itemType: params.analysis.itemType,
        frontMediaId: params.frontMediaId,
        backMediaId: params.backMediaId,
        outputs: persisted.map((item) => ({
          id: item.id,
          label: item.label,
          s3Key: item.s3Key,
        })),
      },
    },
  });

  return {
    runId: params.runId,
    analysisSummary: params.analysis.displaySummary,
    variations: persisted,
  };
}

/** Vision + classification only (chat phase 1). */
export async function runTryOnAnalyzePhase(
  params: RunTryOnGenerationParams,
): Promise<{
  runId: string;
  analysis: TryOnVisionAnalysis;
  analysisSummary: string;
}> {
  const customPrompt = params.customPrompt?.trim() || undefined;
  const loaded = await loadTryOnInlineImages(params);
  const analysis = await runTryOnVisionAnalysis({
    productTitle: loaded.productTitle,
    productBrand: params.product.brand,
    customPrompt: customPrompt ?? null,
    frontImage: loaded.frontImage,
    backImage: loaded.backImage,
    productImage: loaded.productImage,
  });
  return {
    runId: randomUUID(),
    analysis,
    analysisSummary: analysis.displaySummary,
  };
}

/** Image generation + persistence after analysis (chat phase 2). */
export async function runTryOnRenderPhase(
  params: RunTryOnGenerationParams & {
    analysis: TryOnVisionAnalysis;
    runId: string;
  },
): Promise<RunTryOnResult> {
  const backgroundStyle = params.backgroundStyle ?? "original";
  const detailLevel = params.detailLevel ?? "high";
  const customPrompt = params.customPrompt?.trim() || undefined;
  const loaded = await loadTryOnInlineImages(params);
  const fitStyle =
    params.fitStyle ?? params.analysis.recommendedFitStyle ?? "true-to-size";
  return persistTryOnVariations({
    userId: params.userId,
    productImportId: params.productImportId,
    product: params.product,
    frontMediaId: params.frontMediaId,
    backMediaId: params.backMediaId,
    runId: params.runId,
    analysis: params.analysis,
    fitStyle,
    backgroundStyle,
    detailLevel,
    customPrompt,
    frontImage: loaded.frontImage,
    backImage: loaded.backImage,
    productImage: loaded.productImage,
    productTitle: loaded.productTitle,
  });
}

export async function runTryOnGeneration(
  params: RunTryOnGenerationParams,
): Promise<RunTryOnResult> {
  const backgroundStyle = params.backgroundStyle ?? "original";
  const detailLevel = params.detailLevel ?? "high";
  const customPrompt = params.customPrompt?.trim() || undefined;
  const loaded = await loadTryOnInlineImages(params);
  const analysis = await runTryOnVisionAnalysis({
    productTitle: loaded.productTitle,
    productBrand: params.product.brand,
    customPrompt: customPrompt ?? null,
    frontImage: loaded.frontImage,
    backImage: loaded.backImage,
    productImage: loaded.productImage,
  });
  const fitStyle =
    params.fitStyle ?? analysis.recommendedFitStyle ?? "true-to-size";
  const runId = randomUUID();
  return persistTryOnVariations({
    userId: params.userId,
    productImportId: params.productImportId,
    product: params.product,
    frontMediaId: params.frontMediaId,
    backMediaId: params.backMediaId,
    runId,
    analysis,
    fitStyle,
    backgroundStyle,
    detailLevel,
    customPrompt,
    frontImage: loaded.frontImage,
    backImage: loaded.backImage,
    productImage: loaded.productImage,
    productTitle: loaded.productTitle,
  });
}
