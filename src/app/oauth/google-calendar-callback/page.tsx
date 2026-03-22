"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { defaultGoogleCalendarRedirectUri } from "@/lib/google/oauth-calendar-constants";

/**
 * Google OAuth redirects here with ?code=... so the auth code is not stripped by
 * the home page (which sends logged-in users to /dashboard without query params).
 */
function CallbackContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const fullUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }, []);

  if (error) {
    const redirectExample = defaultGoogleCalendarRedirectUri();
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-lg font-semibold text-brand-primary">Google OAuth error</h1>
        <p className="mt-2 text-sm text-text-muted">{error}</p>
        {errorDescription && (
          <p className="mt-1 text-sm text-text-muted">{decodeURIComponent(errorDescription)}</p>
        )}

        <div className="mt-8 rounded-xl border border-border-subtle bg-surface p-4 text-sm text-text-primary shadow-sm">
          <p className="font-semibold text-text-primary">Fix: Google Cloud Console</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-text-muted">
            <li>
              Open{" "}
              <a
                className="text-brand-blue underline"
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
              >
                APIs &amp; Services → Credentials
              </a>
              (same project as your Client ID).
            </li>
            <li>
              Open your <strong>OAuth 2.0 Client ID</strong>. It must be type{" "}
              <strong>Web application</strong> (not Desktop / iOS / Android for this flow).
            </li>
            <li>
              Under <strong>Authorized JavaScript origins</strong>, add:{" "}
              <code className="rounded bg-black/10 px-1.5 py-0.5 font-mono text-xs">
                http://localhost:3000
              </code>
            </li>
            <li>
              Under <strong>Authorized redirect URIs</strong>, add{" "}
              <strong className="text-text-primary">exactly</strong> (no trailing slash):
              <br />
              <code className="mt-1 inline-block rounded bg-black/10 px-2 py-1 font-mono text-xs break-all">
                {redirectExample}
              </code>
            </li>
            <li>Click Save, wait a minute, then run the token script again.</li>
          </ol>
          <p className="mt-4 text-xs text-text-muted">
            If you use <code className="rounded bg-black/10 px-1">127.0.0.1</code> or another port,
            register that origin and set{" "}
            <code className="rounded bg-black/10 px-1">GOOGLE_CALENDAR_OAUTH_REDIRECT</code> in{" "}
            <code className="rounded bg-black/10 px-1">.env</code> to the same URL the script prints.
          </p>
        </div>
      </div>
    );
  }

  if (!code) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-lg font-semibold text-text-primary">No authorization code</h1>
        <p className="mt-2 text-sm text-text-muted">
          This page is only used after you approve Google Calendar access. If you opened it
          directly, run <code className="rounded bg-black/10 px-1">npm run google-calendar:token</code>{" "}
          and use the link from your terminal.
        </p>
        <p className="mt-4 text-xs text-text-muted break-all">{fullUrl}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-lg font-semibold text-text-primary">Google Calendar — authorization code</h1>
      <p className="mt-2 text-sm text-text-muted">
        Copy the code below, paste it into the terminal where{" "}
        <code className="rounded bg-black/10 px-1">google-calendar:token</code> is waiting, then press
        Enter.
      </p>
      <textarea
        readOnly
        className="mt-4 h-28 w-full rounded-lg border border-border-subtle bg-surface p-3 font-mono text-sm"
        value={code}
        onFocus={(e) => e.target.select()}
      />
      <p className="mt-3 text-xs text-text-muted">
        You can close this tab after the script prints your{" "}
        <code className="rounded bg-black/10 px-1">GOOGLE_CALENDAR_REFRESH_TOKEN</code>.
      </p>
    </div>
  );
}

export default function GoogleCalendarOAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-12 text-center text-sm text-text-muted">Loading…</div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
