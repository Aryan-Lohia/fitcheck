import { emailLayout } from "./_layout";

type Payload = { userName: string; expertName: string; topic: string };

export function bookingAccepted({ userName, expertName, topic }: Payload) {
  const subject = "Booking Confirmed — FitCheck";

  const html = emailLayout(`
    <h1 style="margin:0 0 16px;font-size:24px;color:#333">Booking confirmed!</h1>
    <p style="margin:0 0 12px;font-size:16px;color:#555;line-height:1.6">
      Hi ${userName}, your booking has been accepted by <strong>${expertName}</strong>.
    </p>
    <table style="width:100%;margin:12px 0;border-collapse:collapse">
      <tr>
        <td style="padding:8px 12px;font-size:14px;color:#999;width:140px">Topic</td>
        <td style="padding:8px 12px;font-size:16px;color:#333">${topic}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-size:14px;color:#999">Expert</td>
        <td style="padding:8px 12px;font-size:16px;color:#333">${expertName}</td>
      </tr>
    </table>
    <p style="margin:0;font-size:16px;color:#555;line-height:1.6">
      A meeting link will be shared with you shortly.
    </p>
  `);

  const text = `Hi ${userName}, your booking for "${topic}" has been accepted by ${expertName}. A meeting link will be shared with you shortly.`;

  return { subject, html, text };
}
