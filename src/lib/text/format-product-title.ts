/** Short retailer label for chips / CTAs from a product URL. */
export function retailerLabelFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("myntra.com")) return "Myntra";
  if (lower.includes("ajio.com")) return "Ajio";
  if (lower.includes("meesho.com")) return "Meesho";
  return "";
}

/**
 * Many catalog titles arrive in ALL CAPS; convert to readable title-style words.
 * Mixed-case titles are left as-is (only whitespace normalized).
 */
export function formatProductTitleForDisplay(title: string): string {
  const t = title.trim().replace(/\s+/g, " ");
  if (!t) return t;
  const letters = t.replace(/[^a-zA-Z]/g, "");
  if (letters.length === 0) return t;
  if (t !== t.toUpperCase()) return t;
  return t
    .toLowerCase()
    .split(" ")
    .map((word) =>
      word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}
