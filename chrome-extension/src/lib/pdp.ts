/** Heuristic PDP detection — URL path only, no DOM. */

export function isMyntraPdp(href: string): boolean {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (!url.hostname.toLowerCase().includes("myntra.com")) return false;
  const p = url.pathname.toLowerCase();
  if (
    p.includes("/search") ||
    p.includes("/cart") ||
    p.includes("/checkout") ||
    p.includes("/wishlist") ||
    p.includes("/gift")
  ) {
    return false;
  }
  return /\/\d+\/buy\/?$/.test(p);
}

export function isAjioPdp(href: string): boolean {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (!url.hostname.toLowerCase().includes("ajio.com")) return false;
  const p = url.pathname.toLowerCase();
  if (
    p.includes("/search") ||
    p.includes("/cart") ||
    p.includes("/checkout") ||
    p.includes("/wishlist")
  ) {
    return false;
  }
  return /\/p\/[^/]+/.test(p);
}

export function isRetailerProductPage(href: string): boolean {
  return isMyntraPdp(href) || isAjioPdp(href);
}
