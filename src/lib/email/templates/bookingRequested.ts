import { emailLayout } from "./_layout";

type Payload = { expertName: string; topic: string; preferredTime: string };

export function bookingRequested({ expertName, topic, preferredTime }: Payload) {
  const subject = "New Booking Request — FitCheck";

  const html = emailLayout(`
    <h1 style="margin:0 0 16px;font-size:24px;color:#333">New booking request, ${expertName}!</h1>
    <table style="width:100%;margin:12px 0;border-collapse:collapse">
      <tr>
        <td style="padding:8px 12px;font-size:14px;color:#999;width:140px">Topic</td>
        <td style="padding:8px 12px;font-size:16px;color:#333">${topic}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-size:14px;color:#999">Preferred Time</td>
        <td style="padding:8px 12px;font-size:16px;color:#333">${preferredTime}</td>
      </tr>
    </table>
    <p style="margin:0;font-size:16px;color:#555;line-height:1.6">
      Log in to your dashboard to accept or decline this request.
    </p>
  `);

  const text = `New booking request, ${expertName}! Topic: ${topic}. Preferred time: ${preferredTime}. Log in to your dashboard to accept or decline.`;

  return { subject, html, text };
}
