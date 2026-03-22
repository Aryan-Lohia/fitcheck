import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFeaturedProductById } from "@/lib/landing/featured-products";

type PageProps = { params: Promise<{ id: string }> };

function retailerDisplay(retailer: string): string {
  const r = retailer.toLowerCase();
  if (r === "myntra") return "Myntra";
  if (r === "meesho") return "Meesho";
  if (r === "ajio") return "Ajio";
  return retailer;
}

export default async function DiscoverProductPage({ params }: PageProps) {
  const { id } = await params;
  const item = await getFeaturedProductById(id);
  if (!item) notFound();

  const chatNext = `/chat?import=${encodeURIComponent(item.sourceUrl)}`;
  const loginPath = `/login?next=${encodeURIComponent(chatNext)}`;
  const signupHref = `/signup?next=${encodeURIComponent(chatNext)}`;

  return (
    <div className="min-h-screen bg-surface-muted text-text-primary">
      <header className="border-b border-border-subtle bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-brand-accent"
          >
            FitCheck
          </Link>
          <Link
            href={loginPath}
            className="text-sm font-semibold text-brand-blue hover:underline"
          >
            Log in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8 pb-16">
        <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-lg shadow-black/20">
          <div className="relative aspect-[4/5] bg-surface-muted">
            <Image
              src={item.imageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 512px) 100vw, 512px"
              unoptimized
            />
          </div>
          <div className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border-subtle bg-surface-muted px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {retailerDisplay(item.retailer)}
              </span>
              {item.sponsored ? (
                <span className="rounded-full bg-brand-blue/20 px-2.5 py-0.5 text-xs font-semibold text-brand-blue">
                  Sponsored
                </span>
              ) : null}
            </div>
            <h1 className="text-xl font-semibold leading-snug text-text-primary">
              {item.title}
            </h1>
            {item.brand ? (
              <p className="text-sm text-text-muted">{item.brand}</p>
            ) : null}
            {item.price ? (
              <p className="text-lg font-bold text-brand-warm">{item.price}</p>
            ) : null}
            <p className="text-sm leading-relaxed text-text-muted">
              Sign in to try this on with your profile and get a fit check in
              chat.
            </p>
            <Link
              href={loginPath}
              className="flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-accent px-4 text-sm font-semibold text-white shadow-lg shadow-brand-accent/25 transition-colors hover:bg-brand-accent/92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              Sign in to continue
            </Link>
            <p className="text-center text-sm text-text-muted">
              New here?{" "}
              <Link
                href={signupHref}
                className="font-semibold text-brand-blue underline-offset-2 hover:underline"
              >
                Create an account
              </Link>
            </p>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-text-muted">
          <Link href={item.sourceUrl} className="underline-offset-2 hover:underline" target="_blank" rel="noopener noreferrer">
            View on {retailerDisplay(item.retailer)}
          </Link>
        </p>
      </main>
    </div>
  );
}
