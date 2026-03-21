import { emailClient } from "@/lib/email/client";
import { prisma } from "@/lib/prisma/client";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await prisma.auditLog.create({
        data: {
          action: "email_send_attempt",
          entityType: "email",
          entityId: to,
          payloadJson: { to, subject, attempt },
        },
      });

      const result = await emailClient.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        html,
        text,
      });

      await prisma.auditLog.create({
        data: {
          action: "email_sent",
          entityType: "email",
          entityId: to,
          payloadJson: { to, subject, messageId: result.messageId },
        },
      });

      return { success: true, messageId: result.messageId };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < MAX_RETRIES) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1));
      }
    }
  }

  await prisma.auditLog.create({
    data: {
      action: "email_failed",
      entityType: "email",
      entityId: to,
      payloadJson: { to, subject, error: lastError?.message },
    },
  });

  return { success: false, error: lastError?.message ?? "Unknown error" };
}
