import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[5.5rem] w-full resize-y rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-base text-text-primary shadow-sm transition-[box-shadow,border-color] placeholder:text-text-muted/80",
        "focus-visible:border-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/35",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";
