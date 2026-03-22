import { logger } from "@/lib/logger";

const REQUEST_TIMEOUT_MS = 25_000;
const RETRY_BACKOFF_MS = 280;

export type FetchPageHtmlOptions = {
  /** Overrides default retail referer (e.g. Ajio search PLP when fetching PDP HTML). */
  refererOverride?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function isIndianRetailHost(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return (
      h.includes("myntra.com") ||
      h.includes("ajio.com") ||
      h.includes("meesho.com") ||
      h.includes("jiocdn") ||
      h.includes("myntassets.com")
    );
  } catch {
    return false;
  }
}

const UA_CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const UA_CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const UA_FF_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0";

type HeaderAttempt = { label: string; headers: Record<string, string> };

function buildFetchAttempts(
  url: string,
  refererBase: string | undefined,
  retail: boolean,
): HeaderAttempt[] {
  const ref = refererBase;
  const attempts: HeaderAttempt[] = [];

  const pushFullChrome = (ua: string, platform: string, referer?: string) => {
    attempts.push({
      label: `chrome-full-${ua === UA_CHROME_WIN ? "win" : "mac"}`,
      headers: {
        "user-agent": ua,
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "en-IN,en-US;q=0.9,en;q=0.8",
        "accept-encoding": "gzip, deflate",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "sec-ch-ua":
          '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": platform,
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": referer ? secFetchSite(referer, url) : "none",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
        ...(referer ? { referer } : {}),
      },
    });
  };

  pushFullChrome(UA_CHROME_MAC, '"macOS"', ref);
  if (retail) {
    pushFullChrome(UA_CHROME_WIN, '"Windows"', ref);
  }

  const minimal = (
    label: string,
    ua: string,
    referer?: string,
  ): HeaderAttempt => ({
    label,
    headers: {
      "user-agent": ua,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-IN,en;q=0.9",
      "accept-encoding": "gzip, deflate",
      ...(referer ? { referer } : {}),
    },
  });

  attempts.push(minimal("chrome-minimal-mac", UA_CHROME_MAC, ref));
  if (retail) {
    attempts.push(minimal("chrome-minimal-win", UA_CHROME_WIN, ref));
    attempts.push(minimal("firefox-minimal-win", UA_FF_WIN, ref));
    attempts.push(minimal("chrome-no-referer", UA_CHROME_MAC, undefined));
    attempts.push(
      minimal("google-referer", UA_CHROME_MAC, "https://www.google.com/"),
    );
    try {
      const origin = new URL(url).origin;
      if (ref && ref !== `${origin}/`) {
        attempts.push(minimal("referer-origin-only", UA_CHROME_MAC, `${origin}/`));
      }
    } catch {
      /* */
    }
  } else {
    attempts.push(minimal("chrome-no-referer-fallback", UA_CHROME_MAC, undefined));
  }

  return attempts;
}

export async function fetchPageHtml(
  url: string,
  opts?: FetchPageHtmlOptions,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const referer = opts?.refererOverride ?? refererForRetailUrl(url);
  const retail = isIndianRetailHost(url);
  const attempts = buildFetchAttempts(url, referer, retail);

  let lastStatus = 0;
  let lastError: Error | null = null;

  try {
    for (let i = 0; i < attempts.length; i++) {
      if (controller.signal.aborted) {
        throw new Error("Upstream fetch timed out");
      }

      const { label, headers } = attempts[i]!;
      try {
        const res = await fetch(url, {
          method: "GET",
          cache: "no-store",
          redirect: "follow",
          signal: controller.signal,
          headers,
        });

        if (res.ok) {
          const html = await res.text();
          if (!html || html.trim().length < 100) {
            lastError = new Error("Upstream returned empty/insufficient HTML");
            lastStatus = res.status;
            if (i < attempts.length - 1) await sleep(RETRY_BACKOFF_MS);
            continue;
          }
          if (i > 0) {
            logger.debug("fetchPageHtml succeeded after retry strategy", {
              label,
              attempt: i + 1,
              urlPreview: url.slice(0, 96),
            });
          }
          return html;
        }

        lastStatus = res.status;
        lastError = new Error(`Upstream fetch failed with status ${res.status}`);
        try {
          await res.text();
        } catch {
          /* drain */
        }

        const retryable =
          res.status === 403 ||
          res.status === 401 ||
          res.status === 429 ||
          res.status === 503;

        logger.debug("fetchPageHtml attempt failed", {
          label,
          status: res.status,
          urlPreview: url.slice(0, 96),
          retryable,
        });

        if (retryable && i < attempts.length - 1) {
          await sleep(RETRY_BACKOFF_MS);
          continue;
        }

        throw lastError;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error("Upstream fetch timed out");
        }
        if (
          error instanceof Error &&
          error.message.startsWith("Upstream fetch failed")
        ) {
          throw error;
        }
        lastError =
          error instanceof Error ? error : new Error("Upstream fetch failed");
        if (i < attempts.length - 1) {
          await sleep(RETRY_BACKOFF_MS);
          continue;
        }
        throw lastError;
      }
    }

    throw (
      lastError ??
      new Error(
        lastStatus
          ? `Upstream fetch failed with status ${lastStatus}`
          : "Upstream fetch failed",
      )
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchPageRendered(url: string): Promise<string> {
  return fetchPageHtml(url);
}
