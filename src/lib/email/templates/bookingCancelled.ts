import { emailLayout } from "./_layout";

type Payload = { name: string; topic: string; reason: string };

export function bookingCancelled({ name, topic, reason }: Payload) {
  const subject = "Booking Cancelled — FitCheck";

  const reasonBlock = reason
    ? `<div style="margin:16px 0;padding:12px 16px;background:#f8f8f8;border-left:3px solid #fdcb6e;border-radius:4px;font-size:14px;color:#555">${reason}</div>`
    : "";

  const html = emailLayout(`
    <h1 style="margin:0 0 16px;font-size:24px;color:#333">Booking cancelled</h1>
    <p style="margin:0 0 12px;font-size:16px;color:#555;line-height:1.6">
      Hi ${name}, your booking for <strong>${topic}</strong> has been cancelled.
    </p>
    ${reasonBlock}
    <p style="margin:0;font-size:16px;color:#555;line-height:1.6">
      If a payment was captured, a refund will be processed automatically.
      You can book another session anytime from your dashboard.
    </p>
  `);

  const text = `Hi ${name}, your booking for "${topic}" has been cancelled.${reason ? ` Reason: ${reason}` : ""} If a payment was captured, a refund will be processed automatically.`;

  return { subject, html, text };
}
