/**
 * Freelancer onboarding is driven by {@link FreelancerProfile}, not {@link UserProfile}.
 * Until they leave `draft` (submit application), they should complete `/freelancer/profile`.
 */
export function freelancerNeedsProfileSetup(
  profile: { verificationStatus: string } | null | undefined,
): boolean {
  if (!profile) return true;
  return profile.verificationStatus === "draft";
}
