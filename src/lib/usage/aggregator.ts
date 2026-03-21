import { prisma } from "@/lib/prisma/client";

export async function aggregateDailyStorageUsage(userId: string) {
  const files = await prisma.userMedia.findMany({ where: { userId, isDeleted: false } });
  const bytesUsed = files.reduce((sum: number, f: { fileSize: bigint }) => sum + Number(f.fileSize), 0);
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return prisma.storageUsageDaily.upsert({
    where: { userId_date: { userId, date } },
    update: { bytesUsed: BigInt(bytesUsed), fileCount: files.length },
    create: { userId, date, bytesUsed: BigInt(bytesUsed), fileCount: files.length },
  });
}
