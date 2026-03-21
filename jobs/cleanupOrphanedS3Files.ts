import { prisma } from "@/lib/prisma/client";

export async function run() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const orphans = await prisma.userMedia.findMany({
    where: {
      isDeleted: true,
      deletedAt: { lte: cutoff },
    },
  });

  console.log(`cleanupOrphanedS3Files: found ${orphans.length} orphaned files to clean up`);
  // In production: delete objects from S3 then hard-delete DB rows
}
