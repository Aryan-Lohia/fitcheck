import { emailLayout } from "./_layout";

type Payload = { name: string };

export function freelancerApproved({ name }: Payload) {
  const subject = "You're Approved! — FitCheck";

  const html = emailLayout(`
    <h1 style="margin:0 0 16px;font-size:24px;color:#333">Congratulations, ${name}!</h1>
    <p style="margin:0 0 12px;font-size:16px;color:#555;line-height:1.6">
      Your freelancer application has been <strong style="color:#00b894">approved</strong>.
      You can now receive booking requests from FitCheck users.
    </p>
    <p style="margin:0;font-size:16px;color:#555;line-height:1.6">
      Set up your availability slots so clients can start booking sessions with you.
    </p>
  `);

  const text = `Congratulations, ${name}! Your freelancer application has been approved. You can now receive booking requests from FitCheck users. Set up your availability slots to get started.`;

  return { subject, html, text };
}
