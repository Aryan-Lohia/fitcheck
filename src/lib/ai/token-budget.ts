export const MAX_CONTEXT_TOKENS = 6000;

const MIN_PRESERVED_MESSAGES = 8;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function trimHistory(
  messages: Array<{ role: string; text: string }>,
  maxTokens: number = MAX_CONTEXT_TOKENS,
): Array<{ role: string; text: string }> {
  if (messages.length === 0) return [];

  let total = 0;
  for (const m of messages) {
    total += estimateTokens(m.text);
  }

  if (total <= maxTokens) return messages;

  if (messages.length <= MIN_PRESERVED_MESSAGES) {
    return messages;
  }

  const trimmed = [...messages];
  while (
    trimmed.length > MIN_PRESERVED_MESSAGES &&
    total > maxTokens
  ) {
    const removed = trimmed.shift()!;
    total -= estimateTokens(removed.text);
  }

  return trimmed;
}
