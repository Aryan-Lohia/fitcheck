import Link from "next/link";

export default function DiscoverNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-muted px-4 text-center">
      <h1 className="text-xl font-semibold text-text-primary">Product not found</h1>
      <p className="mt-2 max-w-sm text-sm text-text-muted">
        This pick may have rotated off the showcase. Browse the home page for
        current listings.
      </p>
      <Link
        href="/#trending"
        className="mt-6 text-sm font-semibold text-brand-accent hover:underline"
      >
        Back to trending picks
      </Link>
    </div>
  );
}
