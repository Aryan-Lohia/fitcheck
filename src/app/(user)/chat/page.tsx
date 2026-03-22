"use client";

import { Suspense, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";

type ImportResponse = { productImportId: string };

/** Survives Strict Mode remounts so we only auto-import once per tab load. */
let deepLinkImportStarted: string | null = null;

function ChatListPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const importParam = searchParams.get("import");
  const { user, isLoading: authLoading } = useAuth();

  const importMutation = useMutation({
    mutationFn: (productUrl: string) =>
      api<ImportResponse>("/api/product/import", {
        method: "POST",
        body: { url: productUrl },
      }),
    onSuccess: (data) => {
      deepLinkImportStarted = null;
      router.push(`/product/${data.productImportId}`);
    },
    onError: (_err, productUrl) => {
      // Keep deepLinkImportStarted === productUrl so the import effect does not
      // re-fire and hammer the API / freeze the UI on the same ?import= URL.
      void productUrl;
    },
  });

  useEffect(() => {
    if (!user || !importParam || authLoading) return;
    if (deepLinkImportStarted === importParam) return;
    deepLinkImportStarted = importParam;
    importMutation.mutate(importParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, importParam, authLoading]);

  const createSession = useMutation({
    mutationFn: () =>
      api<{ session: { id: string } }>("/api/chat/session", {
        method: "POST",
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["chatSessions"] });
      router.push(`/chat/${res.session.id}`);
    },
  });

  const importing = importMutation.isPending && Boolean(importParam);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10 pb-20 md:pb-10">
      <div className="max-w-md text-center">
        <div className="text-4xl" aria-hidden>
          💬
        </div>
        <h2 className="mt-4 text-lg font-semibold text-text-primary">
          FitCheck Assistant
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          Choose a chat from the list or start a new conversation. On your
          phone, open the menu to see your history.
        </p>
        {importing ? (
          <p className="mt-4 text-sm text-brand-blue">Importing product link…</p>
        ) : null}
        {importMutation.isError ? (
          <div className="mt-4 space-y-3" role="alert">
            <p className="text-sm text-brand-primary">
              {importMutation.error.message}
            </p>
            <Button
              type="button"
              variant="secondary"
              className="w-full max-w-xs"
              onClick={() => {
                importMutation.reset();
                deepLinkImportStarted = null;
                router.replace("/chat");
              }}
            >
              Dismiss and continue
            </Button>
          </div>
        ) : null}
        <p className="mt-6 text-xs text-text-muted lg:hidden">
          Tap <span className="font-medium text-text-primary">☰</span> above to
          open your chats.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="mt-6 w-full max-w-xs text-balance"
          disabled={createSession.isPending || importing}
          onClick={() => createSession.mutate()}
        >
          {createSession.isPending
            ? "Starting…"
            : "Consult your AI Fashion Expert"}
        </Button>
      </div>
    </div>
  );
}

export default function ChatListPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-text-muted">
          Loading…
        </div>
      }
    >
      <ChatListPageContent />
    </Suspense>
  );
}
