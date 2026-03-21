import { prisma } from "@/lib/prisma/client";

export const USER_STORAGE_QUOTA = 1024 * 1024 * 1024;

export async function checkStorageQuota(userId: string, incomingBytes = 0) {
  const rows = await prisma.userMedia.findMany({ where: { userId, isDeleted: false }, select: { fileSize: true } });
  const usedBytes = rows.reduce((sum: number, row: { fileSize: bigint }) => sum + Number(row.fileSize), 0);
  const remainingBytes = USER_STORAGE_QUOTA - usedBytes;
  return {
    usedBytes,
    remainingBytes,
    isOverLimit: incomingBytes > remainingBytes,
  };
}
