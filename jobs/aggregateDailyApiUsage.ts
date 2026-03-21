import { prisma } from "@/lib/prisma/client";

const AVG_TOKENS_PER_MESSAGE = 150;

export async function run() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sessions = await prisma.chatSession.findMany({
    where: {
      messages: { some: { createdAt: { gte: today }, senderType: "user" } },
    },
    select: { userId: true, id: true },
  });

  const userSessionMap = new Map<string, string[]>();
  for (const s of sessions) {
    const ids = userSessionMap.get(s.userId) ?? [];
    ids.push(s.id);
    userSessionMap.set(s.userId, ids);
  }

  for (const [userId, sessionIds] of userSessionMap) {
    const messageCount = await prisma.chatMessage.count({
      where: {
        sessionId: { in: sessionIds },
        senderType: "user",
        createdAt: { gte: today },
      },
    });

    const estimatedTokensIn = messageCount * AVG_TOKENS_PER_MESSAGE;
    const estimatedTokensOut = messageCount * AVG_TOKENS_PER_MESSAGE * 2;

    await prisma.apiUsageDaily.upsert({
      where: { userId_date: { userId, date: today } },
      update: {
        geminiRequests: messageCount,
        geminiTokensIn: estimatedTokensIn,
        geminiTokensOut: estimatedTokensOut,
      },
      create: {
        userId,
        date: today,
        geminiRequests: messageCount,
        geminiTokensIn: estimatedTokensIn,
        geminiTokensOut: estimatedTokensOut,
        imageAnalysisCount: 0,
        estimatedCost: 0,
      },
    });
  }

  console.log(`aggregateDailyApiUsage: processed ${userSessionMap.size} users`);
}
