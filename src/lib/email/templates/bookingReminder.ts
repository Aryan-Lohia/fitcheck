import { emailLayout } from "./_layout";

type Payload = { name: string; topic: string; meetingLink: string; time: string };

export function bookingReminder({ name, topic, meetingLink, time }: Payload) {
  const subject = "Reminder: Session in 1 Hour — FitCheck";

  const html = emailLayout(`
    <h1 style="margin:0 0 16px;font-size:24px;color:#333">Heads up, ${name}!</h1>
    <p style="margin:0 0 12px;font-size:16px;color:#555;line-height:1.6">
      Your session on <strong>${topic}</strong> starts in about 1 hour at <strong>${time}</strong>.
    </p>
    <div style="margin:20px 0;text-align:center">
      <a href="${meetingLink}" style="display:inline-block;padding:14px 28px;background-color:#6C5CE7;color:#fff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600">Join Meeting</a>
    </div>
    <p style="margin:0;font-size:13px;color:#999;word-break:break-all">
      Or copy this link: ${meetingLink}
    </p>
  `);

  const text = `Reminder: Your session on "${topic}" starts in about 1 hour at ${time}. Meeting link: ${meetingLink}`;

  return { subject, html, text };
}
