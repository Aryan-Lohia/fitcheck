import { FashionHeroIllustration } from "@/components/auth/FashionHeroIllustration";
import { cn } from "@/lib/utils";

type AuthSplitShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function AuthSplitShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: AuthSplitShellProps) {
  return (
    <main className="min-h-screen bg-surface-muted">
      <div className="mx-auto grid min-h-screen max-w-6xl lg:grid-cols-2">
        {/* Desktop hero */}
        <div
          className={cn(
            "relative hidden flex-col justify-between overflow-hidden px-10 py-12 lg:flex",
            "bg-gradient-to-br from-brand-warm/25 via-surface to-brand-blue/10",
          )}
        >
          <header>
            <p className="text-2xl font-bold tracking-tight text-brand-accent">
              FitCheck
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-text-muted">
              Your AI stylist for fit, sizing, and wardrobe decisions—bright,
              fast, and personal.
            </p>
          </header>
          <div className="flex flex-1 items-center justify-center py-8">
            <FashionHeroIllustration className="h-auto w-full max-w-[min(100%,22rem)] opacity-95" />
          </div>
          <p className="text-xs text-text-muted/90">
            Paste a link, upload a photo, get your size story.
          </p>
        </div>

        {/* Form column */}
        <div className="flex flex-col justify-center px-4 py-10 sm:px-8 lg:px-14">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 flex items-center gap-4 lg:hidden">
              <FashionHeroIllustration compact className="h-16 w-16 shrink-0" />
              <div>
                <p className="text-lg font-bold text-brand-accent">FitCheck</p>
                <p className="text-xs text-text-muted">AI fashion fit</p>
              </div>
            </div>

            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-accent">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 text-sm text-text-muted">{description}</p>
            ) : null}

            <div className="mt-8">{children}</div>

            {footer ? (
              <div className="mt-8 border-t border-border-subtle pt-6">{footer}</div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
