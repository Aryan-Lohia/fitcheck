import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Bucket, s3Client } from "@/lib/s3/client";

export async function generatePresignedUploadUrl(s3Key: string, mimeType: string) {
  const command = new PutObjectCommand({ Bucket: s3Bucket, Key: s3Key, ContentType: mimeType });
  return getSignedUrl(s3Client, command, { expiresIn: 600 });
}

export async function generatePresignedDownloadUrl(s3Key: string) {
  const command = new GetObjectCommand({ Bucket: s3Bucket, Key: s3Key });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export async function deleteS3Object(s3Key: string) {
  const command = new DeleteObjectCommand({ Bucket: s3Bucket, Key: s3Key });
  return s3Client.send(command);
}
