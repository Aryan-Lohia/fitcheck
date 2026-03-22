/**
 * One-time helper: obtain a Google OAuth refresh token for Calendar API (Meet creation).
 *
 * Prereqs:
 * 1. Google Cloud Console → APIs & Services → Enable "Google Calendar API".
 * 2. Create OAuth 2.0 Client ID (Web application). Authorized redirect URI (exact):
 *    http://localhost:3000/oauth/google-calendar-callback
 *    (Do not use http://localhost:3000 alone — the app redirects logged-in users to /dashboard
 *    and drops ?code= from the home URL.)
 * 3. Set in project root `.env` (loaded automatically by this script):
 *    GOOGLE_CALENDAR_CLIENT_ID
 *    GOOGLE_CALENDAR_CLIENT_SECRET
 *
 * Run (from repo root):
 *   npx tsx scripts/google-calendar-refresh-token.ts
 *
 * Open the printed URL, sign in, approve scopes. You’ll land on a FitCheck page that shows
 * the code — copy it into the terminal prompt.
 * Copy the printed refresh token into production env as GOOGLE_CALENDAR_REFRESH_TOKEN.
 */

import * as readline from "readline/promises";
import { google } from "googleapis";
import { loadDotEnvFromProjectRoot } from "./load-dot-env";

loadDotEnvFromProjectRoot();

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

async function main() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    console.error(
      "Missing GOOGLE_CALENDAR_CLIENT_ID or GOOGLE_CALENDAR_CLIENT_SECRET.\n" +
      "Add them to the project root .env file, then run: npm run google-calendar:token\n" +
      "(This script loads .env automatically; `tsx` does not unless we parse it.)",
    );
    process.exit(1);
  }

  const redirectUri =
    process.env.GOOGLE_CALENDAR_OAUTH_REDIRECT?.trim() ||
    "http://localhost:3000/oauth/google-calendar-callback";

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  console.log("\nOpen this URL in a browser:\n\n", url, "\n");
  console.log(
    "After authorizing, copy the code from the FitCheck page (not the dashboard).\n",
  );
  let jsOrigin = "http://localhost:3000";
  try {
    jsOrigin = new URL(redirectUri).origin;
  } catch {
    /* keep default */
  }
  console.log("--- If Google says redirect URI / OAuth policy error, register BOTH: ---\n");
  console.log("  Google Cloud → APIs & Services → Credentials → your OAuth client");
  console.log('  Client type must be "Web application" (not Desktop).\n');
  console.log("  Authorized JavaScript origins → Add:");
  console.log(`    ${jsOrigin}\n`);
  console.log("  Authorized redirect URIs → Add (exact, no trailing slash):");
  console.log(`    ${redirectUri}\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = (await rl.question("Paste authorization code: ")).trim();
  rl.close();

  if (!code) {
    console.error("No code provided");
    process.exit(1);
  }

  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    console.error(
      "No refresh_token returned. Try revoking app access in Google Account → Security and run again with prompt=consent (already set).",
    );
    process.exit(1);
  }

  console.log("\n--- Add to your environment ---\n");
  console.log(`GOOGLE_CALENDAR_REFRESH_TOKEN=${tokens.refresh_token}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
