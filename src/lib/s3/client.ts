import { S3Client } from "@aws-sdk/client-s3";

export const s3Client = new S3Client({ region: process.env.AWS_REGION || "ap-south-1" });
export const s3Bucket = process.env.S3_BUCKET_NAME || "";
