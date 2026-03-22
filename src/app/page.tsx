import { redirect } from "next/navigation";
import { LandingHeader } from "@/components/marketing/landing-header";
import { LandingHeroZeroState } from "@/components/marketing/LandingHeroZeroState";
import { LandingFeaturedProducts } from "@/components/marketing/LandingFeaturedProducts";
import { LandingSlimFooter } from "@/components/marketing/LandingSlimFooter";
import { postLoginPathForRole } from "@/lib/auth/post-login-path";
import { getSession } from "@/lib/auth/session";

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    redirect(postLoginPathForRole(session.role));
  }

  return (
    <div id="top" className="min-h-screen bg-surface-muted text-text-primary">
      <LandingHeader />
      <LandingHeroZeroState />
      <LandingFeaturedProducts />
      <LandingSlimFooter />
    </div>
  );
}
