import { prisma } from "@/lib/prisma/client";
import { aggregateDailyStorageUsage } from "@/lib/usage/aggregator";

export async function run() {
  const users = await prisma.user.findMany({ select: { id: true } });

  for (const u of users) {
    await aggregateDailyStorageUsage(u.id);
  }

  console.log(`aggregateDailyStorageUsage: processed ${users.length} users`);
}
