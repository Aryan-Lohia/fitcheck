import { emailLayout } from "./_layout";

type Payload = { name: string };

export function freelancerApplicationReceived({ name }: Payload) {
  const subject = "Application Received — FitCheck";

  const html = emailLayout(`
    <h1 style="margin:0 0 16px;font-size:24px;color:#333">Thanks for applying, ${name}!</h1>
    <p style="margin:0 0 12px;font-size:16px;color:#555;line-height:1.6">
      We've received your freelancer application and our team is reviewing it.
      This usually takes 1–3 business days.
    </p>
    <p style="margin:0;font-size:16px;color:#555;line-height:1.6">
      We'll notify you by email once a decision has been made. In the meantime, feel free to
      keep updating your profile and portfolio.
    </p>
  `);

  const text = `Thanks for applying, ${name}! We've received your freelancer application and our team is reviewing it. This usually takes 1–3 business days. We'll notify you by email once a decision has been made.`;

  return { subject, html, text };
}
