import Image from "next/image";
import Link from "next/link";
import { getCachedFeaturedProducts } from "@/lib/landing/featured-products";

function retailerDisplay(retailer: string): string {
  const r = retailer.toLowerCase();
  if (r === "myntra") return "Myntra";
  if (r === "meesho") return "Meesho";
  if (r === "ajio") return "Ajio";
  return retailer;
}

export async function LandingFeaturedProducts() {
  let items: Awaited<ReturnType<typeof getCachedFeaturedProducts>> = [];
  try {
    items = await getCachedFeaturedProducts();
  } catch {
    items = [];
  }

  return (
    <section
      id="trending"
      className="scroll-mt-20 border-t border-border-subtle bg-surface-muted py-16 md:py-24"
      aria-labelledby="trending-heading"
    >
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mb-10 text-center md:text-left">
          <h2
            id="trending-heading"
            className="text-2xl font-bold tracking-tight text-text-primary md:text-3xl"
          >
            Trending picks
          </h2>
          <p className="mt-2 max-w-xl text-sm text-text-muted md:text-base">
            Real listings from partner stores. Tap a card to preview, then sign
            in to import and try on in FitCheck.
          </p>
        </div>

        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-subtle bg-surface px-4 py-12 text-center text-sm text-text-muted">
            Live picks are temporarily unavailable. Refresh in a moment or sign
            in to shop from chat.
          </p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/discover/${item.id}`}
                  className="group block overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-sm transition-colors hover:border-brand-blue/35 hover:shadow-md hover:shadow-black/15"
                >
                  <div className="relative aspect-[4/5] bg-surface-muted">
                    <Image
                      src={item.imageUrl}
                      alt=""
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      unoptimized
                    />
                    {item.sponsored ? (
                      <span className="absolute left-2 top-2 rounded-full bg-brand-blue/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm backdrop-blur-sm">
                        Sponsored
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-1.5 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        {retailerDisplay(item.retailer)}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm font-medium leading-snug text-text-primary">
                      {item.title}
                    </p>
                    {item.price ? (
                      <p className="text-sm font-bold text-brand-warm">
                        {item.price}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
