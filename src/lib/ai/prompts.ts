import type { ChatMode } from "@/lib/chat/mode";

type ProfileRecord = Record<string, unknown> | null;
type ProductRecord = Record<string, unknown> | null;

function str(val: unknown): string {
  if (typeof val === "string" && val.trim()) return val.trim();
  return "";
}

function num(val: unknown): number | null {
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  if (typeof val === "string") {
    const n = Number(val);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

/** Same measurement keys as `ProfileWizard` MEASUREMENT_FIELDS */
const WIZARD_MEASUREMENT_FIELDS: Array<{ key: string; label: string }> = [
  { key: "heightCm", label: "Height (cm)" },
  { key: "chestCm", label: "Chest (cm)" },
  { key: "waistCm", label: "Waist (cm)" },
  { key: "hipCm", label: "Hip (cm)" },
  { key: "shoulderCm", label: "Shoulder (cm)" },
  { key: "sleeveCm", label: "Sleeve (cm)" },
  { key: "inseamCm", label: "Inseam (cm)" },
];

export type WizardPhotoFlags = {
  /** First saved body reference (vault), or legacy “front-*.jpg” upload */
  primaryReferencePhoto: boolean;
  /** Second reference, or legacy “back-*.jpg” when paired with front */
  secondaryReferencePhoto: boolean;
};

/**
 * Full profile context aligned with `ProfileWizard.tsx` (gender, fit, skin, styles,
 * measurements from latest version, completion, photo upload status).
 * Use for chat + retrieval so recommendations always match the wizard.
 */
export function buildWizardProfileContext(
  profile: ProfileRecord,
  photos: WizardPhotoFlags,
): string {
  const lines: string[] = [
    "Profile source: same fields as the in-app Profile wizard (gender, fit preference, skin tone, style tags, body measurements, optional photos).",
    "For clothing and footwear: personalize fit, color, silhouette, and shopping suggestions using this context.",
    "For furniture, home, tools, gadgets, or other non-apparel shopping: do not treat gender/fit/style tags as mandatory filters unless the user explicitly mixes them into the ask.",
  ];

  if (!profile) {
    lines.push("Status: no saved profile yet — suggest completing Profile for better accuracy.");
    lines.push(
      `Try-on body references: primary ${photos.primaryReferencePhoto ? "set" : "not set"}, secondary ${photos.secondaryReferencePhoto ? "set" : "not set"} (any angle — front, back, side, ¾).`,
    );
    return lines.join("\n");
  }

  const completion =
    typeof profile.profileCompletion === "number" ? profile.profileCompletion : null;
  if (completion !== null) {
    lines.push(`Profile completion: ${completion}% (wizard progress).`);
    if (completion < 50) {
      lines.push(
        "Profile is incomplete (<50%). You must still provide rich, specific recommendations using style principles and explicit assumptions.",
      );
    }
  }

  const gender = str(profile.gender);
  if (gender) lines.push(`Gender: ${gender}.`);

  const fit = str(profile.preferredFit);
  if (fit) lines.push(`Preferred fit (wizard): ${fit}.`);

  const skin = str(profile.skinTone);
  if (skin) lines.push(`Skin tone (wizard picker): ${skin}.`);

  const style = profile.preferredStyle;
  if (Array.isArray(style) && style.length > 0) {
    lines.push(`Style tags (wizard): ${style.join(", ")}.`);
  } else if (typeof style === "string" && style.trim()) {
    lines.push(`Style tags (wizard): ${style.trim()}.`);
  }

  const colors = profile.preferredColors;
  if (Array.isArray(colors) && colors.length > 0) {
    lines.push(`Preferred colors: ${colors.filter((c) => typeof c === "string").join(", ")}.`);
  }

  const mj = profile.measurementsJson as
    | { versions?: Array<{ values?: Record<string, unknown> }> }
    | Record<string, unknown>
    | undefined;

  let values: Record<string, unknown> = {};
  if (mj && typeof mj === "object" && "versions" in mj && Array.isArray(mj.versions)) {
    const latest = mj.versions.at(-1)?.values;
    if (latest && typeof latest === "object") values = latest;
  } else if (mj && typeof mj === "object") {
    values = mj as Record<string, unknown>;
  }

  const measLines: string[] = [];
  for (const { key, label } of WIZARD_MEASUREMENT_FIELDS) {
    const n = num(values[key]);
    if (n !== null) measLines.push(`${label}: ${n}`);
  }
  if (measLines.length > 0) {
    lines.push("Body measurements (wizard):");
    lines.push(...measLines.map((m) => `- ${m}`));
  } else {
    lines.push("Body measurements (wizard): none saved yet.");
  }

  const missing: string[] = [];
  if (!gender) missing.push("gender");
  if (!fit) missing.push("preferred fit");
  if (!skin) missing.push("skin tone");
  if (measLines.length === 0) missing.push("measurements");
  if (!photos.primaryReferencePhoto) missing.push("primary body reference photo");
  if (!photos.secondaryReferencePhoto) missing.push("second body reference photo");
  if (missing.length > 0) {
    lines.push(`Missing profile fields: ${missing.join(", ")}.`);
  }

  lines.push(
    `Try-on reference photos (wizard): primary ${photos.primaryReferencePhoto ? "saved" : "missing"}, secondary ${photos.secondaryReferencePhoto ? "saved" : "missing"}.`,
  );

  return lines.join("\n");
}

/** Short one-line summary for logs or legacy callers */
export function buildProfileSummary(profile: ProfileRecord): string {
  if (!profile) return "No profile available";
  const parts: string[] = [];
  const gender = str(profile.gender);
  if (gender) parts.push(gender);
  const fit = str(profile.preferredFit);
  if (fit) parts.push(`${fit} fit`);
  const style = profile.preferredStyle;
  if (Array.isArray(style) && style.length > 0) parts.push(`style: ${style.join(", ")}`);
  const skin = str(profile.skinTone);
  if (skin) parts.push(skin);
  return parts.length > 0 ? parts.join(", ") : "No profile details";
}

export function buildProductSummary(product: ProductRecord): string {
  if (!product) return "";

  const parts: string[] = [];

  const title = str(product.title);
  if (title) parts.push(title);

  const brand = str(product.brand);
  if (brand) parts.push(`by ${brand}`);

  const normalized =
    (product.normalizedJson as Record<string, unknown> | undefined) ?? {};

  const category = str(normalized.category) || str(product.category);
  if (category) parts.push(`(${category})`);

  const material = str(normalized.material);
  if (material) parts.push(`material: ${material}`);

  const fitType = str(normalized.fitType);
  if (fitType) parts.push(`fit: ${fitType}`);

  const variants = normalized.variants as
    | { size?: string[]; color?: string[] }
    | undefined;
  const sizes =
    (Array.isArray(variants?.size) && variants!.size.length > 0
      ? variants!.size
      : (normalized.sizes as string[] | undefined)) ?? [];
  if (Array.isArray(sizes) && sizes.length > 0) {
    parts.push(`sizes: ${sizes.join(", ")}`);
  }

  const price = str(normalized.price) || str((product as { price?: unknown }).price);
  if (price) parts.push(`price: ${price}`);

  const rating = str(normalized.rating);
  if (rating) parts.push(`rating: ${rating}`);

  const reviewCount = str(normalized.reviewCount);
  if (reviewCount) parts.push(`reviews: ${reviewCount}`);

  const measurements =
    (normalized.measurements as Record<string, unknown> | undefined) ?? {};
  const measParts: string[] = [];
  for (const [k, v] of Object.entries(measurements)) {
    const n = num(v);
    if (n) measParts.push(`${k} ${n}cm`);
  }
  if (measParts.length > 0) parts.push(`measurements: ${measParts.join(", ")}`);

  return parts.length > 0 ? parts.join(" ") : "";
}

export function buildChatPrompt(params: {
  /** Full ProfileWizard-aligned context — always include for chat */
  wizardProfileContext: string;
  productSummary?: string;
  history: Array<{ role: string; text: string }>;
  message: string;
  /** User toggled “Suggested picks” — answer should engage with catalog or explain absence */
  suggestedPicksRequested?: boolean;
  /** User attached vault / upload images — same multimodal turn */
  attachedImageCount?: number;
  /** Shop = general merchandise + fashion; try-on = same assistant with emphasis on garment try-on when relevant */
  chatMode?: ChatMode;
}): string {
  const mode = params.chatMode ?? "shop";
  const system = [
    "You are FitCheck AI — a shopping assistant for clothing, footwear, and general merchandise (home, furniture, storage, kitchen, tools, garden, electronics, etc.).",
    "You give accurate fit and sizing guidance for apparel when the question is about clothes or shoes.",
    "Rules:",
    "- Never hallucinate measurements or sizing data you were not given.",
    "- Base answers on the profile wizard context when it applies (apparel/fit), and on live catalog data when products are listed.",
    "- For non-apparel asks: never refuse solely because the catalog is fashion-heavy — use whatever relevant products were retrieved; if none match, say so briefly and still give practical buying tips (materials, dimensions, room fit, safety) without inventing SKUs.",
    "- Do not redirect furniture, storage, or home questions into unrelated clothing picks unless the user asked for outfits.",
    "- If uncertain, say so briefly, then continue with useful guidance.",
    "- Prefer structured, actionable advice with concrete examples.",
    "- Keep the answer concise by default (around 90-140 words) unless user asks for deep detail.",
    "- For apparel topics: even when profile completion is low, give detailed guidance (silhouette, colors, fabrics, styling, shopping tips).",
    "- If measurements are missing for a clothing question, give fit guidance by cut/silhouette and ask for measurements only at the end in one short line.",
    "- Avoid repetitive refusal/disclaimer language.",
    mode === "tryon"
      ? "- Try-on mode: when the user is clearly doing a virtual garment try-on, prioritize garment fit and visuals; they may still ask general shopping questions — answer those directly."
      : "",
    "",
    "User profile (ProfileWizard — apply fully to clothing/shoes; use lightly or not at all for unrelated product categories):",
    params.wizardProfileContext,
  ].filter(Boolean);

  const nImg = params.attachedImageCount ?? 0;
  if (nImg > 0) {
    system.push("");
    system.push(
      `The user attached ${nImg} image(s) in this message (provided after this text as inline images).`,
    );
    system.push(
      "Examine each image: if garments, comment on colors, patterns, fit/silhouette, styling, occasion; if furniture, room items, or generic products, describe what you see and tie it to the user's question (dimensions, style, use-case) without forcing fashion advice.",
    );
  }

  if (params.productSummary) {
    system.push("");
    system.push("Live catalog retrieval (structured PDP data — treat as factual):");
    system.push(params.productSummary);
    system.push("");
    system.push(
      "Catalog rules: Use only the fields listed above (price, ratings, sizes, colors, materials, fit labels, etc.) as factual. For apparel, compare sizes/fit to the user's profile when relevant. For non-apparel, focus on title, price, materials, and URL — do not apply clothing fit or gender unless the item is wearable. Mention products by title and brand; include the product URL when recommending one. Do not invent discounts, stock, or extra variants. If catalog data is thin, say so briefly.",
    );
  }

  if (params.suggestedPicksRequested) {
    system.push("");
    if (params.productSummary) {
      system.push(
        "Suggested picks mode (user toggled ON): The reply must reference the live catalog items above by brand/title and explain which match the user's ask (and profile when the ask is clothing-related). Keep it natural, not a bullet list of URLs.",
      );
    } else {
      system.push(
        "Suggested picks mode (user toggled ON): No catalog items were retrieved. Give useful guidance for their ask (styling if apparel; practical buying tips if not) and add one short sentence that product links could not be loaded right now.",
      );
    }
  }

  if (params.history.length > 0) {
    system.push("");
    system.push("Conversation so far:");
    for (const msg of params.history) {
      system.push(`${msg.role}: ${msg.text}`);
    }
  }

  system.push("");
  system.push(`User message: ${params.message}`);
  system.push("");
  system.push(
    'Keep "suggestedActions" concise: each action should be 4-5 words max.',
  );
  system.push(
    'Respond with valid JSON only, matching this shape: { "answer": string, "confidence": number (0-1), "reasons": string[], "suggestedActions": string[] }',
  );

  return system.join("\n");
}
