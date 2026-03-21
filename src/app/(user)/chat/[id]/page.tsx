"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useRef, useEffect, useState } from "react";
import { api } from "@/hooks/use-api";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { SuggestedPrompts } from "@/components/chat/SuggestedPrompts";
type ChatMessage = {
  id: string;
  senderType: string;
  contentText: string | null;
  createdAt: string;
  attachmentsJson?: unknown;
  contentJson?: {
    suggestedActions?: string[];
    products?: ProductCard[];
    thinking?: ThinkingMeta;
  } | null;
};

type ChatSessionData = {
  id: string;
  title: string;
  messages: ChatMessage[];
};

type OptimisticMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  attachmentIds?: string[];
  actionButtons?: string[];
  products?: ProductCard[];
  thinking?: ThinkingMeta;
};

type ProductCard = {
  id: string;
  title: string;
  brand: string;
  price: string;
  imageUrl: string;
  sourceUrl: string;
};

type ThinkingMeta = {
  mode: "complex" | "normal";
  retrievalEnabled: boolean;
  retrievalQuery: string;
  importedMatches: number;
  liveMatches: number;
  finalProducts: number;
  usedCache: boolean;
  confidence: number;
  suggestedPicksRequested?: boolean;
  attachmentCount?: number;
  visionEnabled?: boolean;
};

export default function ChatConversationPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [optimistic, setOptimistic] = useState<OptimisticMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isComplexMode, setIsComplexMode] = useState(false);
  const [suggestedPicksOn, setSuggestedPicksOn] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["chatSession", id],
    queryFn: () =>
      api<{ session: ChatSessionData }>(`/api/chat/session/${id}`),
    enabled: !!id,
  });

  const sendMutation = useMutation({
    mutationFn: (vars: { message: string; attachmentIds: string[] }) =>
      api<{
        answer?: string;
        actionButtons?: string[];
        products?: ProductCard[];
        thinking?: ThinkingMeta;
      }>("/api/chat/message", {
        method: "POST",
        body: {
          sessionId: id,
          message: vars.message,
          attachmentIds: vars.attachmentIds,
          complex: isComplexMode,
          suggestedPicks: suggestedPicksOn,
        },
      }),
    onMutate: (vars) => {
      const userMsg: OptimisticMessage = {
        id: `opt-user-${Date.now()}`,
        role: "user",
        text: vars.message,
        attachmentIds:
          vars.attachmentIds.length > 0 ? vars.attachmentIds : undefined,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setOptimistic((prev) => [...prev, userMsg]);
      setIsTyping(true);
    },
    onSuccess: async (res) => {
      const aiMsg: OptimisticMessage = {
        id: `opt-ai-${Date.now()}`,
        role: "assistant",
        text: res.answer?.trim() || "I could not generate a response right now.",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        actionButtons: Array.isArray(res.actionButtons) ? res.actionButtons : [],
        products: Array.isArray(res.products) ? res.products : [],
        thinking: res.thinking,
      };
      setOptimistic((prev) => [...prev, aiMsg]);
      setIsTyping(false);
      try {
        await queryClient.refetchQueries({ queryKey: ["chatSession", id] });
        const state = queryClient.getQueryState(["chatSession", id]);
        if (state?.status === "success") setOptimistic([]);
      } catch {
        // Keep optimistic assistant row (including suggested picks) if refetch fails.
      }
    },
    onError: () => {
      setIsTyping(false);
    },
  });

  const serverMessages: OptimisticMessage[] = (data?.session?.messages ?? [])
    .filter((m) => m.contentText)
    .map((m) => {
      const rawAtt = m.attachmentsJson;
      const attachmentIds = Array.isArray(rawAtt)
        ? rawAtt.filter((x): x is string => typeof x === "string" && x.length > 0)
        : undefined;
      return {
        id: m.id,
        role: (m.senderType === "USER" ? "user" : "assistant") as
          | "user"
          | "assistant",
        text: m.contentText!,
        timestamp: new Date(m.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        attachmentIds:
          m.senderType === "USER" && attachmentIds?.length
            ? attachmentIds
            : undefined,
        actionButtons:
          m.senderType === "AI" &&
            Array.isArray(m.contentJson?.suggestedActions)
            ? m.contentJson.suggestedActions
            : [],
        products:
          m.senderType === "AI" && Array.isArray(m.contentJson?.products)
            ? m.contentJson.products
            : [],
        thinking: m.senderType === "AI" ? m.contentJson?.thinking : undefined,
      };
    });

  const allMessages =
    optimistic.length > 0 ? [...serverMessages, ...optimistic] : serverMessages;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length, isTyping]);

  const handleSend = (text: string, attachmentIds: string[] = []) => {
    sendMutation.mutate({ message: text, attachmentIds });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-14 md:pb-0">
      <div className="hidden shrink-0 border-b border-border-subtle/80 bg-surface/90 px-4 py-3 backdrop-blur md:block md:px-6">
        <h1 className="truncate text-base font-semibold text-text-primary">
          {data?.session?.title ?? "Chat"}
        </h1>
      </div>

      <main className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto px-4 pb-4 pt-3 md:px-6">
        <div className="space-y-3">
        {isLoading && (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-10 w-2/3 rounded-xl ${i % 2 === 0 ? "ml-auto bg-brand-blue/15" : "bg-border-subtle"
                  }`}
              />
            ))}
          </div>
        )}

        {!isLoading && allMessages.length === 0 && (
          <SuggestedPrompts onSelect={(t) => handleSend(t, [])} />
        )}

        {allMessages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            text={msg.text}
            timestamp={msg.timestamp}
            attachmentIds={msg.attachmentIds}
            actionButtons={msg.actionButtons}
            products={msg.products}
            thinking={msg.thinking}
            showThinking={
              msg.role === "assistant" &&
              (isComplexMode || Boolean(msg.thinking?.visionEnabled))
            }
            onActionClick={(action) => handleSend(action, [])}
          />
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-brand-warm/35 bg-surface px-4 py-3 shadow-sm">
              <p className="mb-2 text-xs font-medium text-text-muted">
                {sendMutation.variables?.attachmentIds?.length
                  ? isComplexMode
                    ? "Analyzing your photos (detailed)…"
                    : "Analyzing your photos…"
                  : suggestedPicksOn
                    ? "Fetching suggested picks…"
                    : isComplexMode
                      ? "Thinking hard..."
                      : "Thinking..."}
              </p>
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand-blue/50 [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand-blue/50 [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand-blue/50 [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
        </div>
      </main>

      <ChatInput
        dock
        onSend={(p) => handleSend(p.text, p.attachmentIds)}
        disabled={sendMutation.isPending}
        complex={isComplexMode}
        onComplexChange={setIsComplexMode}
        suggestedPicks={suggestedPicksOn}
        onSuggestedPicksChange={setSuggestedPicksOn}
      />
    </div>
  );
}
