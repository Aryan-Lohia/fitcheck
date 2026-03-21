import { GoogleGenerativeAI } from "@google/generative-ai";

function getGeminiClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenerativeAI(key);
}

export function getGeminiModel(complex = false) {
  const client = getGeminiClient();
  return client.getGenerativeModel({
    model: complex ? "gemini-2.5-flash" : "gemini-2.5-flash-lite",
  });
}

/** Chat replies: use full Flash when user attaches images (vision) or requests complex mode. */
export function getGeminiChatModel(opts: { complex: boolean; withImages: boolean }) {
  const client = getGeminiClient();
  const useFull = opts.complex || opts.withImages;
  return client.getGenerativeModel({
    model: useFull ? "gemini-2.5-flash" : "gemini-2.5-flash-lite",
  });
}

export function getGeminiImageModel() {
  const client = getGeminiClient();
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  return client.getGenerativeModel({ model });
}
