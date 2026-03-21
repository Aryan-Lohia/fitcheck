import { emailLayout } from "./_layout";

type Payload = { userName: string; expertName: string; meetingLink: string; topic: string };

export function meetingLinkShared({ userName, expertName, meetingLink, topic }: Payload) {
  const subject = "Your Meeting Link — FitCheck";

  const html = emailLayout(`
    <h1 style="margin:0 0 16px;font-size:24px;color:#333">Meeting link ready</h1>
    <p style="margin:0 0 12px;font-size:16px;color:#555;line-height:1.6">
      Hi ${userName}, here is the meeting link for your session with <strong>${expertName}</strong> on <em>${topic}</em>.
    </p>
    <div style="margin:20px 0;text-align:center">
      <a href="${meetingLink}" style="display:inline-block;padding:14px 28px;background-color:#6C5CE7;color:#fff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600">Join Meeting</a>
    </div>
    <p style="margin:0;font-size:13px;color:#999;word-break:break-all">
      Or copy this link: ${meetingLink}
    </p>
  `);

  const text = `Hi ${userName}, here is the meeting link for your session with ${expertName} on "${topic}": ${meetingLink}`;

  return { subject, html, text };
}
