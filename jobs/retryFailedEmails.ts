import { prisma } from "@/lib/prisma/client";

export async function run() {
  const failed = await prisma.auditLog.findMany({
    where: {
      action: "email_failed",
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    take: 50,
    orderBy: { createdAt: "desc" },
  });

  console.log(`retryFailedEmails: found ${failed.length} failed emails to retry`);
  // In a real implementation, parse payloadJson and re-invoke sendEmail
}
