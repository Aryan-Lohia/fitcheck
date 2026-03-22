import { google } from "googleapis";

export type MeetBookingInput = {
  topic: string;
  preferredTime: Date | null;
  durationMinutes: number;
  attendeeEmails: string[];
};

/**
 * Creates a Google Calendar event with a Google Meet conference.
 * Requires GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET,
 * GOOGLE_CALENDAR_REFRESH_TOKEN. Optional GOOGLE_CALENDAR_ID (default primary).
 */
export async function createMeetForBooking(
  input: MeetBookingInput,
): Promise<{ hangoutLink: string; eventHtmlLink?: string | null }> {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN?.trim();

  const missing: string[] = [];
  if (!clientId) missing.push("GOOGLE_CALENDAR_CLIENT_ID");
  if (!clientSecret) missing.push("GOOGLE_CALENDAR_CLIENT_SECRET");
  if (!refreshToken) missing.push("GOOGLE_CALENDAR_REFRESH_TOKEN");

  if (missing.length > 0) {
    throw new Error(
      `Google Calendar is not configured. Missing or empty: ${missing.join(", ")}. ` +
      "Add them to .env and restart the dev server. Refresh token: run `npm run google-calendar:token`.",
    );
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });

  const calendar = google.calendar({ version: "v3", auth: oauth2 });
  const calendarId = process.env.GOOGLE_CALENDAR_ID?.trim() || "primary";

  const start =
    input.preferredTime && input.preferredTime.getTime() > Date.now()
      ? input.preferredTime
      : new Date(Date.now() + 60 * 60 * 1000);

  const end = new Date(start.getTime() + input.durationMinutes * 60 * 1000);

  const res = await calendar.events.insert({
    calendarId,
    conferenceDataVersion: 1,
    requestBody: {
      summary: `FitCheck session: ${input.topic}`,
      description: "Video session booked via FitCheck.",
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      attendees: input.attendeeEmails.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: `fitcheck-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });

  const entryPoints = res.data.conferenceData?.entryPoints ?? [];
  const video = entryPoints.find((e) => e.entryPointType === "video");
  const hangoutLink = video?.uri || res.data.hangoutLink;

  if (!hangoutLink) {
    throw new Error("Calendar event created but no Meet link was returned");
  }

  return { hangoutLink, eventHtmlLink: res.data.htmlLink ?? null };
}
