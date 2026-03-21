import { prisma } from "@/lib/prisma/client";

export async function activateTrial(userId: string) {
  const startAt = new Date();
  const endAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return prisma.trial.create({ data: { userId, startAt, endAt, status: "active", proEnabled: true } });
}

export async function getTrialStatus(userId: string) {
  const trial = await prisma.trial.findFirst({ where: { userId }, orderBy: { startAt: "desc" } });
  if (!trial) return { isExpired: true, daysRemaining: 0, proEnabled: false };
  const daysRemaining = Math.max(0, Math.ceil((trial.endAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  return { isExpired: daysRemaining <= 0, daysRemaining, proEnabled: trial.proEnabled };
}
