"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { decodeHtmlEntities } from "@/lib/text/decode-html-entities";
import { cn } from "@/lib/utils";

type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  messages?: { contentText: string | null; createdAt: string }[];
};

function SessionSkeleton() {
  return (
    <div className="animate-pulse space-y-2 px-2 py-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-14 rounded-xl border border-border-subtle bg-black/[0.04]"
        />
      ))}
    </div>
  );
}

export function ChatSplitLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeChatId =
    pathname?.startsWith("/chat/") && pathname !== "/chat"
      ? pathname.slice("/chat/".length).split("/")[0] ?? null
      : null;

  const { data, isLoading } = useQuery({
    queryKey: ["chatSessions"],
    queryFn: () => api<{ sessions: ChatSession[] }>("/api/chat/session"),
  });

  const createSession = useMutation({
    mutationFn: () =>
      api<{ session: ChatSession }>("/api/chat/session", { method: "POST" }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["chatSessions"] });
      setMobileOpen(false);
      router.push(`/chat/${res.session.id}`);
    },
  });

  const sessions = data?.sessions ?? [];

  const activeSession = activeChatId
    ? sessions.find((s) => s.id === activeChatId)
    : undefined;
  const mobileTitle = activeSession
    ? decodeHtmlEntities(activeSession.title)
    : "AI Chat";

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- close drawer on client navigation (incl. browser back) */
    setMobileOpen(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openSidebar = useCallback(() => setMobileOpen(true), []);
  const closeSidebar = useCallback(() => setMobileOpen(false), []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Mobile top bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle bg-surface px-3 py-2.5 lg:hidden">
        <button
          type="button"
          onClick={openSidebar}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border-subtle bg-surface-muted text-text-primary shadow-sm transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/40"
          aria-expanded={mobileOpen}
          aria-controls="chat-history-sidebar"
          aria-label="Open chat history"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-5 w-5"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-text-primary">
          {mobileTitle}
        </h1>
        <Button
          type="button"
          onClick={() => createSession.mutate()}
          disabled={createSession.isPending}
          className="min-h-11 shrink-0 px-3 text-sm"
        >
          {createSession.isPending ? "…" : "New"}
        </Button>
      </div>

      {/* Backdrop (mobile) */}
      <div
        role="presentation"
        className={cn(
          "fixed inset-0 z-[60] bg-black/40 transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={closeSidebar}
        aria-hidden={!mobileOpen}
      />

      {/* ChatGPT-style: desktop sidebar is pinned left, full height of chat area (between header & footer) */}
      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside
          id="chat-history-sidebar"
          className={cn(
            "flex flex-col border-border-subtle bg-surface shadow-xl transition-transform duration-200 ease-out",
            /* Mobile: full-height drawer */
            "fixed inset-y-0 left-0 z-[70] max-w-[320px] w-[min(100%,20rem)]",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
            /* Desktop: pinned left, viewport height below app header (ChatGPT-style) */
            "lg:translate-x-0 lg:shadow-none lg:border-r lg:border-border-subtle",
            "lg:top-14 lg:bottom-0 lg:left-0 lg:z-30 lg:w-[min(25vw,20rem)]",
          )}
        >
          <div className="hidden items-center justify-between gap-2 border-b border-border-subtle px-3 py-3 lg:flex">
            <h2 className="text-sm font-semibold text-text-primary">Chats</h2>
            <Button
              type="button"
              onClick={() => createSession.mutate()}
              disabled={createSession.isPending}
              className="min-h-9 shrink-0 px-3 text-xs"
            >
              {createSession.isPending ? "…" : "New chat"}
            </Button>
          </div>

          <div className="flex items-center justify-end border-b border-border-subtle px-2 py-2 lg:hidden">
            <button
              type="button"
              onClick={closeSidebar}
              className="min-h-11 min-w-11 rounded-lg text-sm font-medium text-brand-blue hover:bg-brand-blue/8"
              aria-label="Close sidebar"
            >
              Done
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
            {isLoading && <SessionSkeleton />}

            {!isLoading && sessions.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-text-muted">
                No chats yet. Start a new conversation.
              </p>
            )}

            <ul className="flex flex-col gap-1.5">
              {sessions.map((s) => {
                const lastMsg = s.messages?.[s.messages.length - 1];
                const active = s.id === activeChatId;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        closeSidebar();
                        router.push(`/chat/${s.id}`);
                      }}
                      className={cn(
                        "flex min-h-[4.25rem] w-full flex-col rounded-xl border px-3 py-2.5 text-left transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus/40",
                        active
                          ? "border-brand-blue/35 bg-brand-blue/10 shadow-sm"
                          : "border-transparent bg-black/[0.03] hover:bg-black/[0.06]",
                      )}
                      aria-current={active ? "true" : undefined}
                    >
                      <span className="line-clamp-1 text-sm font-medium text-text-primary">
                        {decodeHtmlEntities(s.title)}
                      </span>
                      {lastMsg?.contentText ? (
                        <span className="mt-0.5 line-clamp-2 text-xs text-text-muted">
                          {decodeHtmlEntities(lastMsg.contentText)}
                        </span>
                      ) : null}
                      <span className="mt-1 text-[10px] text-text-muted/90">
                        {new Date(s.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* Main column — reserve same width as fixed sidebar */}
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col bg-gradient-to-b from-brand-warm/[0.08] to-surface-muted",
            "lg:ml-[min(25vw,20rem)] lg:max-w-none",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
