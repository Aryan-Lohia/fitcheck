"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useUIStore } from "@/stores/ui-store";

const colorMap = {
  success: "bg-brand-blue/10 border-brand-blue/35 text-brand-blue",
  error: "bg-brand-primary/10 border-brand-primary/35 text-brand-primary",
  info: "bg-brand-warm/20 border-brand-warm/50 text-text-primary",
} as const;

export function Toaster() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 md:bottom-4">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 80 }}
            className={`max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg ${colorMap[toast.type]}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p>{toast.message}</p>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="shrink-0 text-text-muted hover:text-text-primary"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
