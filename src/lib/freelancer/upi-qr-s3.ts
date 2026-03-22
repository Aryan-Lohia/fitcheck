import { logger } from "@/lib/logger";
import { deleteS3Object } from "@/lib/s3/presign";

/** S3 prefix for expert UPI QR images — must match IAM / bucket policy `freelancers/*`. */
export function freelancerUpiQrKeyPrefix(freelancerProfileId: string): string {
  return `freelancers/${freelancerProfileId}/upi-qr/`;
}

export function isKeyUnderFreelancerUpiQrPrefix(
  key: string,
  freelancerProfileId: string,
): boolean {
  return key.startsWith(freelancerUpiQrKeyPrefix(freelancerProfileId));
}

/** Best-effort delete; logs on failure (permissions, missing object). */
export async function deleteFreelancerUpiQrFromS3(key: string | null | undefined): Promise<void> {
  if (!key?.trim()) return;
  try {
    await deleteS3Object(key);
  } catch (e) {
    logger.warn("S3 delete failed for UPI QR object", {
      key,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/** After saving a new key in DB, remove the previous object if it differs. */
export async function deleteReplacedFreelancerUpiQr(
  previousKey: string | null | undefined,
  newKey: string,
): Promise<void> {
  if (previousKey && previousKey !== newKey) {
    await deleteFreelancerUpiQrFromS3(previousKey);
  }
}
