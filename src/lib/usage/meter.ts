import { prisma } from "@/lib/prisma/client";

export async function logAiUsage(userId: string, tokensIn: number, tokensOut: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  await prisma.apiUsageDaily.upsert({
    where: { userId_date: { userId, date } },
    update: {
      geminiRequests: { increment: 1 },
      geminiTokensIn: { increment: tokensIn },
      geminiTokensOut: { increment: tokensOut },
    },
    create: {
      userId,
      date,
      geminiRequests: 1,
      geminiTokensIn: tokensIn,
      geminiTokensOut: tokensOut,
      imageAnalysisCount: 0,
      estimatedCost: 0,
    },
  });
}
