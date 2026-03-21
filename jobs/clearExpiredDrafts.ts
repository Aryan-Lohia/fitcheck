import { prisma } from "@/lib/prisma/client";

export async function run() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const { count } = await prisma.userMedia.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      OR: [{ category: "draft" }, { fileSize: 0 }],
    },
  });

  console.log(`clearExpiredDrafts: removed ${count} expired/unconfirmed media rows`);
}
