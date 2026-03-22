import { getGeminiModel } from "@/lib/ai/client";

function heuristicTitle(hint: string): string {
  const oneLine = hint.replace(/\s+/g, " ").trim();
  if (!oneLine) return "New chat";
  const words = oneLine.split(/\s+/).slice(0, 8).join(" ");
  return words.length > 60 ? `${words.slice(0, 57)}…` : words;
}

/**
 * Short GPT-style title from the first user turn (or product URL / try-on context).
 */
export async function generateChatSessionTitle(hint: string): Promise<string> {
  const cleaned = hint.replace(/\s+/g, " ").trim().slice(0, 800);
  if (!cleaned) return "New chat";

  try {
    const model = getGeminiModel(false);
    const result = await model.generateContent(
      "Output ONLY a concise chat title: maximum 6 words, no quotation marks, no punctuation at the end. Summarize this user context:\n\n" +
        cleaned,
    );
    let t = result.response.text()?.trim() ?? "";
    t = t.replace(/^["'`]+|["'`]+$/g, "").replace(/\n/g, " ").trim();
    if (t.length > 80) t = `${t.slice(0, 77)}…`;
    return t.length > 0 ? t : heuristicTitle(cleaned);
  } catch {
    return heuristicTitle(cleaned);
  }
}
