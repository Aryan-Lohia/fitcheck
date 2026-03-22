import { getGeminiChatModel } from "@/lib/ai/client";
import { logger } from "@/lib/logger";

export type TryOnItemType =
  | "wearable_top"
  | "wearable_bottom"
  | "full_body_wear"
  | "footwear"
  | "accessory"
  | "non_wearable_product";

export type TryOnVisionAnalysis = {
  itemType: TryOnItemType;
  shortDescription: string;
  howToVisualize: string;
  zoomSuggestion: string;
  riskNotes: string;
  recommendedFitStyle: "snug" | "true-to-size" | "relaxed";
  /** Shown in chat above generated images */
  displaySummary: string;
};

const ITEM_TYPES: TryOnItemType[] = [
  "wearable_top",
  "wearable_bottom",
  "full_body_wear",
  "footwear",
  "accessory",
  "non_wearable_product",
];

const FIT_STYLES = ["snug", "true-to-size", "relaxed"] as const;

function parseTryOnAnalysisJson(raw: string): TryOnVisionAnalysis | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const o = JSON.parse(match[0]) as Record<string, unknown>;
    const itemType = String(o.itemType ?? "");
    if (!ITEM_TYPES.includes(itemType as TryOnItemType)) return null;
    const fitRaw = String(o.recommendedFitStyle ?? "true-to-size").trim();
    const recommendedFitStyle = FIT_STYLES.includes(
      fitRaw as (typeof FIT_STYLES)[number],
    )
      ? (fitRaw as TryOnVisionAnalysis["recommendedFitStyle"])
      : "true-to-size";
    const shortDescription = String(o.shortDescription ?? "").trim();
    const howToVisualize = String(o.howToVisualize ?? "").trim();
    const zoomSuggestion = String(o.zoomSuggestion ?? "").trim();
    const displaySummary = String(o.displaySummary ?? "").trim();
    if (!shortDescription || !howToVisualize || !displaySummary) return null;
    return {
      itemType: itemType as TryOnItemType,
      shortDescription,
      howToVisualize,
      zoomSuggestion,
      riskNotes: String(o.riskNotes ?? "").trim(),
      recommendedFitStyle,
      displaySummary,
    };
  } catch {
    return null;
  }
}

function defaultAnalysis(productTitle: string): TryOnVisionAnalysis {
  return {
    itemType: "wearable_top",
    shortDescription: productTitle,
    howToVisualize:
      "Render the product as clothing worn by the person, matching the product reference.",
    zoomSuggestion:
      "Tighter crop on the main garment zone (chest/torso for tops, feet for shoes).",
    riskNotes: "",
    recommendedFitStyle: "true-to-size",
    displaySummary: `**Product:** ${productTitle}\n\nUsing default garment try-on (vision analysis unavailable).`,
  };
}

/**
 * Phase 1: multimodal understanding of user + product images before image generation.
 */
export async function runTryOnVisionAnalysis(params: {
  productTitle: string;
  productBrand?: string | null;
  customPrompt?: string | null;
  frontImage: { base64: string; mimeType: string };
  backImage: { base64: string; mimeType: string };
  productImage: { base64: string; mimeType: string };
}): Promise<TryOnVisionAnalysis> {
  const model = getGeminiChatModel({ complex: true, withImages: true });
  const meta = [
    `Product title: ${params.productTitle}`,
    params.productBrand ? `Brand: ${params.productBrand}` : "",
    params.customPrompt ? `User notes: ${params.customPrompt}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const instruction = [
    "You are assisting a virtual try-on pipeline. Examine the three images in order:",
    "1) USER FRONT — same person, front view.",
    "2) USER BACK — same person, back view.",
    "3) PRODUCT — catalog/reference image.",
    meta,
    "",
    "Classify the product and how it should be visualized with this person.",
    "If the product is NOT wearable clothing/footwear (e.g. furniture, decor, electronics, home goods), use itemType \"non_wearable_product\" and describe showing the person WITH the product (holding, using, standing next to it)—never as if they are wearing it.",
    "",
    "Respond with valid JSON ONLY, no markdown fences, shape:",
    "{",
    '  "itemType": one of wearable_top | wearable_bottom | full_body_wear | footwear | accessory | non_wearable_product,',
    '  "shortDescription": "one sentence what the product is",',
    '  "howToVisualize": "instructions for an image model: how to composite person + product",',
    '  "zoomSuggestion": "what the close-up / third view should emphasize",',
    '  "riskNotes": "optional caveats (e.g. unclear packshot)",',
    '  "recommendedFitStyle": one of snug | true-to-size | relaxed (for wearable items; for non-wearable use true-to-size),',
    '  "displaySummary": "2-4 short markdown lines for the user: what you saw + plan (use **bold** sparingly)"',
    "}",
  ].join("\n");

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: instruction },
            { inlineData: { data: params.frontImage.base64, mimeType: params.frontImage.mimeType } },
            { inlineData: { data: params.backImage.base64, mimeType: params.backImage.mimeType } },
            { inlineData: { data: params.productImage.base64, mimeType: params.productImage.mimeType } },
          ],
        },
      ],
      generationConfig: { temperature: 0.35 },
    });
    const text = result.response.text()?.trim() ?? "";
    const parsed = parseTryOnAnalysisJson(text);
    if (parsed) return parsed;
    logger.warn("try-on vision analysis parse failed, using default", {
      preview: text.slice(0, 200),
    });
  } catch (e) {
    logger.warn("try-on vision analysis failed, using default", {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  return defaultAnalysis(params.productTitle);
}

export function isWearableItemType(t: TryOnItemType): boolean {
  return t !== "non_wearable_product";
}
