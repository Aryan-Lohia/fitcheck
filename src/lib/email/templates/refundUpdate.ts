import { emailLayout } from "./_layout";

type Payload = { name: string; amount: string; status: string };

export function refundUpdate({ name, amount, status }: Payload) {
  const subject = "Refund Update — FitCheck";

  const statusColor = status === "completed" ? "#00b894" : status === "failed" ? "#d63031" : "#fdcb6e";

  const html = emailLayout(`
    <h1 style="margin:0 0 16px;font-size:24px;color:#333">Refund update</h1>
    <p style="margin:0 0 12px;font-size:16px;color:#555;line-height:1.6">
      Hi ${name}, here's an update on your refund:
    </p>
    <table style="width:100%;margin:12px 0;border-collapse:collapse">
      <tr>
        <td style="padding:8px 12px;font-size:14px;color:#999;width:140px">Amount</td>
        <td style="padding:8px 12px;font-size:16px;color:#333;font-weight:600">${amount}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-size:14px;color:#999">Status</td>
        <td style="padding:8px 12px;font-size:16px;color:${statusColor};font-weight:600;text-transform:capitalize">${status}</td>
      </tr>
    </table>
    <p style="margin:0;font-size:16px;color:#555;line-height:1.6">
      Refunds typically take 5–7 business days to appear on your statement.
      If you have questions, reply to this email.
    </p>
  `);

  const text = `Hi ${name}, here's an update on your refund. Amount: ${amount}. Status: ${status}. Refunds typically take 5–7 business days to appear on your statement.`;

  return { subject, html, text };
}
