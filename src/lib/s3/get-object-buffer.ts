import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Bucket, s3Client } from "@/lib/s3/client";

export async function getS3ObjectBuffer(s3Key: string): Promise<Buffer> {
  const res = await s3Client.send(
    new GetObjectCommand({ Bucket: s3Bucket, Key: s3Key }),
  );
  const body = res.Body;
  if (!body) {
    throw new Error("Empty S3 object body");
  }
  const bytes = await body.transformToByteArray();
  return Buffer.from(bytes);
}
