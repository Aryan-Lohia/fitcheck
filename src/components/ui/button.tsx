import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-accent text-white shadow-sm hover:bg-brand-accent/92 active:bg-brand-accent/85",
  secondary:
    "border-2 border-brand-blue bg-surface text-brand-blue shadow-sm hover:bg-brand-blue/5",
  outline:
    "border border-border-subtle bg-surface text-text-primary shadow-sm hover:border-brand-blue/40",
  ghost: "text-brand-blue hover:bg-brand-blue/8",
  danger:
    "bg-brand-primary text-white shadow-sm hover:bg-brand-primary/92 active:bg-brand-primary/85",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-muted",
          "disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
