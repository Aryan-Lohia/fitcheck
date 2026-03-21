import { createHash } from "crypto";

type CacheEntry = { value: unknown; expiresAt: number };

const store = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000; // 1 hour

export function buildCacheKey(parts: Record<string, string>): string {
  const sorted = Object.keys(parts)
    .sort()
    .reduce<Record<string, string>>((acc, k) => {
      acc[k] = parts[k];
      return acc;
    }, {});
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

export function getCache(key: string): unknown | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function setCache(key: string, value: unknown): void {
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

export function clearExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) store.delete(key);
  }
}
