type Payload = {
  recipientName: string;
  otherPartyName: string;
  topic: string;
  meetingLink: string;
  startTimeLabel: string;
};

export function bookingMeetReadyForRecipient(p: Payload) {
  const subject = `Your Google Meet link — ${p.topic}`;
  const html = `
  <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px">
    <h1 style="margin:0 0 16px;font-size:22px;color:#333">You are booked</h1>
    <p style="margin:0 0 16px;color:#444;line-height:1.5">
      Hi ${p.recipientName}, your session with <strong>${p.otherPartyName}</strong> on
      <em>${p.topic}</em> is scheduled for <strong>${p.startTimeLabel}</strong>.
    </p>
    <p style="margin:0 0 20px">
      <a href="${p.meetingLink}" style="display:inline-block;padding:14px 28px;background-color:#6C5CE7;color:#fff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600">Join Google Meet</a>
    </p>
    <p style="margin:0;font-size:14px;color:#666">Or copy: ${p.meetingLink}</p>
  </div>`;
  const text = `Hi ${p.recipientName}, your session with ${p.otherPartyName} on "${p.topic}" is scheduled for ${p.startTimeLabel}. Join: ${p.meetingLink}`;
  return { subject, html, text };
}
