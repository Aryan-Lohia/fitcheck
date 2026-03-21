"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/hooks/use-api";

export default function ChatListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

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
        <p className="mt-6 text-xs text-text-muted lg:hidden">
          Tap <span className="font-medium text-text-primary">☰</span> above to
          open your chats.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="mt-6 w-full max-w-xs text-balance"
          disabled={createSession.isPending}
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
