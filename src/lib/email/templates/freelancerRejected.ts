import { emailLayout } from "./_layout";

type Payload = { name: string; notes: string };

export function freelancerRejected({ name, notes }: Payload) {
  const subject = "Application Update — FitCheck";

  const notesBlock = notes
    ? `<div style="margin:16px 0;padding:12px 16px;background:#f8f8f8;border-left:3px solid #d63031;border-radius:4px;font-size:14px;color:#555">${notes}</div>`
    : "";

  const html = emailLayout(`
    <h1 style="margin:0 0 16px;font-size:24px;color:#333">Hi ${name},</h1>
    <p style="margin:0 0 12px;font-size:16px;color:#555;line-height:1.6">
      After careful review, we're unable to approve your freelancer application at this time.
    </p>
    ${notesBlock}
    <p style="margin:0;font-size:16px;color:#555;line-height:1.6">
      You're welcome to update your profile and reapply in the future.
      If you have questions, reply to this email and our team will be happy to help.
    </p>
  `);

  const text = `Hi ${name}, after careful review we're unable to approve your freelancer application at this time.${notes ? ` Reason: ${notes}` : ""} You're welcome to update your profile and reapply in the future.`;

  return { subject, html, text };
}
