/** Must match Google Cloud → Credentials → OAuth 2.0 Client → Authorized redirect URIs (exact). */
export const GOOGLE_CALENDAR_OAUTH_REDIRECT_PATH = "/oauth/google-calendar-callback";

export function defaultGoogleCalendarRedirectUri(origin = "http://localhost:3000"): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${GOOGLE_CALENDAR_OAUTH_REDIRECT_PATH}`;
}
