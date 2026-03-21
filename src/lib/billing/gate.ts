import { prisma } from "@/lib/prisma/client";
import { getTrialStatus } from "@/lib/billing/trial";

type TierLimits = {
  dailyChatMessages: number;
  dailyProductImports: number;
  storageBytes: number;
  canBookExpert: boolean;
};

const PRO_LIMITS: TierLimits = {
  dailyChatMessages: 999,
  dailyProductImports: 999,
  storageBytes: 1_073_741_824, // 1 GB
  canBookExpert: true,
};

const FREE_LIMITS: TierLimits = {
  dailyChatMessages: 5,
  dailyProductImports: 3,
  storageBytes: 104_857_600, // 100 MB
  canBookExpert: false,
};

export async function getTierLimits(userId: string): Promise<TierLimits> {
  const trial = await getTrialStatus(userId);
  if (!trial.isExpired && trial.proEnabled) return PRO_LIMITS;
  return FREE_LIMITS;
}

function startOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function checkChatLimit(userId: string): Promise<boolean> {
  const limits = await getTierLimits(userId);

  const sessions = await prisma.chatSession.findMany({
    where: { userId },
    select: { id: true },
  });

  if (sessions.length === 0) return true;

  const todayCount = await prisma.chatMessage.count({
    where: {
      sessionId: { in: sessions.map((s) => s.id) },
      senderType: "user",
      createdAt: { gte: startOfDay() },
    },
  });

  return todayCount < limits.dailyChatMessages;
}

export async function checkImportLimit(userId: string): Promise<boolean> {
  const limits = await getTierLimits(userId);

  const todayCount = await prisma.productImport.count({
    where: {
      userId,
      createdAt: { gte: startOfDay() },
    },
  });

  return todayCount < limits.dailyProductImports;
}
