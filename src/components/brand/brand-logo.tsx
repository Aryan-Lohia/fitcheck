import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const BRAND_ICON_SRC = "/2.png";
export const BRAND_WORDMARK_SRC = "/1.png";

type BrandLogoProps = {
  variant?: "icon" | "wordmark" | "lockup";
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
  priority?: boolean;
};

export function BrandLogo({
  variant = "lockup",
  className,
  iconClassName,
  wordmarkClassName,
  priority,
}: BrandLogoProps) {
  if (variant === "icon") {
    return (
      <span
        className={cn("inline-flex items-center justify-center", className)}
        role="img"
        aria-label="FitCheck"
      >
        <Image
          src={BRAND_ICON_SRC}
          alt=""
          width={128}
          height={128}
          className={cn("h-8 w-8 shrink-0 object-contain", iconClassName)}
          priority={priority}
          sizes="(max-width: 768px) 32px, 36px"
        />
      </span>
    );
  }

  if (variant === "wordmark") {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <Image
          src={BRAND_WORDMARK_SRC}
          alt="FitCheck"
          width={360}
          height={96}
          className={cn(
            "h-7 w-auto max-h-7 object-contain object-left sm:h-8 sm:max-h-8",
            wordmarkClassName,
          )}
          priority={priority}
          sizes="(max-width: 640px) 160px, 200px"
        />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src={BRAND_ICON_SRC}
        alt=""
        width={400}
        height={400}
        className={cn("w-auto h-10 shrink-0 object-contain", iconClassName)}
        priority={priority}
        sizes="32px"
      />
     
    </span>
  );
}

type BrandLogoLinkProps = BrandLogoProps & {
  href: string;
  className?: string;
};

export function BrandLogoLink({
  href,
  className,
  ...logoProps
}: BrandLogoLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus focus-visible:ring-offset-2",
        className,
      )}
    >
      <BrandLogo {...logoProps} />
    </Link>
  );
}
