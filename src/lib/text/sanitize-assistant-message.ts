/**
 * When the model returns JSON (e.g. `{ "answer": "...", ... }`) in the body,
 * show the human `answer` field instead of raw JSON in the bubble.
 */
export function sanitizeAssistantMessageText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return trimmed;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const answer =
      typeof parsed.answer === "string" ? parsed.answer.trim() : "";
    if (answer) return answer;
  } catch {
    /* not valid JSON — keep original */
  }

  return trimmed;
}
