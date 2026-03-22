-- CreateEnum
CREATE TYPE "BookingMessageRole" AS ENUM ('USER', 'FREELANCER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "BookingMessageKind" AS ENUM ('text', 'quote', 'payment_proof', 'profile_share', 'photos_share', 'system');

-- AlterEnum (PostgreSQL: insert workflow statuses after `accepted`)
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'awaiting_payment' AFTER 'accepted';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'payment_submitted' AFTER 'awaiting_payment';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'payment_confirmed' AFTER 'payment_submitted';

-- AlterTable
ALTER TABLE "FreelancerProfile" ADD COLUMN IF NOT EXISTS "upiQrS3Key" TEXT;
ALTER TABLE "FreelancerProfile" ADD COLUMN IF NOT EXISTS "upiVpa" TEXT;

-- AlterTable
ALTER TABLE "BookingRequest" ADD COLUMN IF NOT EXISTS "quoteAmountMinor" INTEGER;
ALTER TABLE "BookingRequest" ADD COLUMN IF NOT EXISTS "quoteCurrency" TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE "BookingRequest" ADD COLUMN IF NOT EXISTS "quotedAt" TIMESTAMP(3);
ALTER TABLE "BookingRequest" ADD COLUMN IF NOT EXISTS "quoteNotes" TEXT;
ALTER TABLE "BookingRequest" ADD COLUMN IF NOT EXISTS "paymentProofMediaId" TEXT;
ALTER TABLE "BookingRequest" ADD COLUMN IF NOT EXISTS "paymentConfirmedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BookingMessage" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "role" "BookingMessageRole" NOT NULL,
    "kind" "BookingMessageKind" NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingMessage_bookingId_createdAt_idx" ON "BookingMessage"("bookingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BookingRequest_paymentProofMediaId_key" ON "BookingRequest"("paymentProofMediaId");

-- AddForeignKey
ALTER TABLE "BookingMessage" ADD CONSTRAINT "BookingMessage_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "BookingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingMessage" ADD CONSTRAINT "BookingMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_paymentProofMediaId_fkey" FOREIGN KEY ("paymentProofMediaId") REFERENCES "UserMedia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
