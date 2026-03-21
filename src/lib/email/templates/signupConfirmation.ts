import { emailLayout } from "./_layout";

type Payload = { name: string; email: string };

export function signupConfirmation({ name, email }: Payload) {
  const subject = "Welcome to FitCheck!";

  const html = emailLayout(`
    <h1 style="margin:0 0 16px;font-size:24px;color:#333">Welcome, ${name}!</h1>
    <p style="margin:0 0 12px;font-size:16px;color:#555;line-height:1.6">
      Your FitCheck account has been created with <strong>${email}</strong>.
    </p>
    <p style="margin:0 0 12px;font-size:16px;color:#555;line-height:1.6">
      You now have a 7-day free trial with full access to all Pro features — AI-powered outfit analysis,
      unlimited product imports, and expert stylist bookings.
    </p>
    <p style="margin:0;font-size:16px;color:#555;line-height:1.6">
      Log in and start exploring your personal style today.
    </p>
  `);

  const text = `Welcome, ${name}! Your FitCheck account has been created with ${email}. You have a 7-day free trial with full Pro access. Log in and start exploring your personal style today.`;

  return { subject, html, text };
}
