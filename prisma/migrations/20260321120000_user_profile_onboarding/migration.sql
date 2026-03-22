-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN "onboardingProfileCompletedAt" TIMESTAMP(3),
ADD COLUMN "onboardingFeaturesSeenAt" TIMESTAMP(3);

-- Existing users: treat as already onboarded so only new signups see the flow
UPDATE "UserProfile"
SET
  "onboardingProfileCompletedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP),
  "onboardingFeaturesSeenAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP)
WHERE "onboardingProfileCompletedAt" IS NULL;
