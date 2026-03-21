const REQUEST_TIMEOUT_MS = 25_000;

export type FetchPageHtmlOptions = {
  /** Overrides default retail referer (e.g. Ajio search PLP when fetching PDP HTML). */
  refererOverride?: string;
};

function secFetchSite(referer: string | undefined, targetUrl: string): string {
  if (!referer) return "none";
  try {
    return new URL(referer).hostname === new URL(targetUrl).hostname
      ? "same-origin"
      : "cross-site";
  } catch {
    return "cross-site";
  }
}

function refererForRetailUrl(url: string): string | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("myntra.com")) return "https://www.myntra.com/";
    if (host.includes("ajio.com")) return "https://www.ajio.com/";
    if (host.includes("meesho.com")) return "https://www.meesho.com/";
  } catch {
    /* invalid URL */
  }
  return undefined;
}

export async function fetchPageHtml(
  url: string,
  opts?: FetchPageHtmlOptions,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const referer = opts?.refererOverride ?? refererForRetailUrl(url);

  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "accept-language": "en-IN,en;q=0.9",
        "accept-encoding": "gzip, deflate, br",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "sec-ch-ua":
          '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": secFetchSite(referer, url),
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
        ...(referer ? { referer } : {}),
      },
    });

    if (!res.ok) {
      throw new Error(`Upstream fetch failed with status ${res.status}`);
    }

    const html = await res.text();
    if (!html || html.trim().length < 100) {
      throw new Error("Upstream returned empty/insufficient HTML");
    }

    return html;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Upstream fetch timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchPageRendered(url: string): Promise<string> {
  return fetchPageHtml(url);
}
