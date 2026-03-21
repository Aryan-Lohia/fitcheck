export function detectDomainType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("shopify")) return "shopify";
  if (lower.includes("woocommerce")) return "woocommerce";
  if (lower.includes("myntra.com")) return "myntra-like";
  if (lower.includes("meesho.com")) return "meesho-like";
  if (lower.includes("ajio.com")) return "ajio-like";
  return "generic";
}
