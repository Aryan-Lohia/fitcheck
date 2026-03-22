export const CHAT_MODE_SHOP = "shop" as const;
export const CHAT_MODE_TRYON = "tryon" as const;

export type ChatMode = typeof CHAT_MODE_SHOP | typeof CHAT_MODE_TRYON;

export function normalizeChatMode(raw: string | null | undefined): ChatMode {
  if (raw === CHAT_MODE_TRYON) return CHAT_MODE_TRYON;
  return CHAT_MODE_SHOP;
}
