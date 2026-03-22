import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface-muted px-4 py-16 text-text-primary md:px-6">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-bold">Privacy</h1>
        <p className="mt-4 text-sm leading-relaxed text-text-muted">
          Our full privacy policy will be published here. For questions, contact
          us at{" "}
          <a
            href="mailto:support@fitcheck.app"
            className="font-semibold text-brand-blue underline-offset-2 hover:underline"
          >
            support@fitcheck.app
          </a>
          .
        </p>
        <Link
          href="/"
          className="mt-8 inline-block text-sm font-semibold text-brand-accent hover:underline"
        >
          ← Back home
        </Link>
      </div>
    </div>
  );
}
