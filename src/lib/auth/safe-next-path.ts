/**
 * Returns a safe same-origin path for post-login redirects.
 * Rejects protocol-relative and absolute URLs (open-redirect vectors).
 */
export function safeInternalNextPath(next: string | null): string | null {
  if (next == null || typeof next !== "string") return null;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  if (trimmed.includes("\\")) return null;
  return trimmed;
}
