"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useRef, useEffect, useState, useCallback } from "react";
import { api } from "@/hooks/use-api";
import { MessageBubble } from "@/components/chat/MessageBubble";
import type { TryOnBubblePayload } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { SuggestedPrompts } from "@/components/chat/SuggestedPrompts";
import { ChatModeIntro } from "@/components/chat/ChatModeIntro";
import {
  normalizeChatMode,
  type ChatMode,
  CHAT_MODE_SHOP,
  CHAT_MODE_TRYON,
} from "@/lib/chat/mode";

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
    tryOn?: TryOnBubblePayload;
  } | null;
};

type ChatSessionData = {
  id: string;
  title: string;
  mode: string;
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
  tryOn?: TryOnBubblePayload | null;
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

const TRY_ON_SEED_PREFIX = "tryOnSeed:";

export default function ChatConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const preServerMessageCountRef = useRef(0);
  const [optimistic, setOptimistic] = useState<OptimisticMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingHint, setTypingHint] = useState<string>("Thinking...");
  const [draftComposerMode, setDraftComposerMode] =
    useState<ChatMode>(CHAT_MODE_SHOP);
  const [prefillProductUrl, setPrefillProductUrl] = useState<string | null>(
    null,
  );
  const [prefillProductImageMediaId, setPrefillProductImageMediaId] = useState<
    string | null
  >(null);
  const [prefillProductTitle, setPrefillProductTitle] = useState<string | null>(
    null,
  );
  const [tryOnSeedBusy, setTryOnSeedBusy] = useState(false);
  const [tryOnRenderPending, setTryOnRenderPending] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["chatSession", id],
    queryFn: () =>
      api<{ session: ChatSessionData }>(`/api/chat/session/${id}`),
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const messageCount =
    (data?.session?.messages?.length ?? 0) + optimistic.length;
  const modeLocked = messageCount > 0;

  const serverMode = data?.session?.mode
    ? normalizeChatMode(data.session.mode)
    : CHAT_MODE_SHOP;
  const effectiveComposerMode = modeLocked ? serverMode : draftComposerMode;

  useEffect(() => {
    if (!id) return;
    const k = `${TRY_ON_SEED_PREFIX}${id}`;
    const raw = sessionStorage.getItem(k);
    if (!raw) return;
    sessionStorage.removeItem(k);
    try {
      const o = JSON.parse(raw) as {
        productUrl?: string;
        productImageMediaId?: string;
        productTitle?: string;
      };
      if (o.productImageMediaId?.trim()) {
        setPrefillProductImageMediaId(o.productImageMediaId.trim());
        setPrefillProductTitle(o.productTitle?.trim() ?? null);
        setDraftComposerMode(CHAT_MODE_TRYON);
      } else if (o.productUrl?.trim()) {
        setPrefillProductUrl(o.productUrl.trim());
        setDraftComposerMode(CHAT_MODE_TRYON);
      }
    } catch {
      /* ignore */
    }
  }, [id]);

  const clearPrefill = useCallback(() => {
    setPrefillProductUrl(null);
    setPrefillProductImageMediaId(null);
    setPrefillProductTitle(null);
  }, []);

  const startTryOnFromProduct = useCallback(
    async (p: ProductCard) => {
      setTryOnSeedBusy(true);
      try {
        const sessionRes = await api<{ session: { id: string } }>(
          "/api/chat/session",
          { method: "POST" },
        );
        const newId = sessionRes.session.id;
        const key = `${TRY_ON_SEED_PREFIX}${newId}`;

        if (p.imageUrl?.trim()) {
          try {
            const imp = await api<{ mediaId: string }>(
              "/api/profile/media/import-remote-url",
              {
                method: "POST",
                body: {
                  imageUrl: p.imageUrl.trim(),
                  titleHint: p.title,
                },
              },
            );
            sessionStorage.setItem(
              key,
              JSON.stringify({
                productImageMediaId: imp.mediaId,
                productTitle: p.title,
                sourceUrl: p.sourceUrl,
              }),
            );
          } catch {
            sessionStorage.setItem(
              key,
              JSON.stringify({ productUrl: p.sourceUrl }),
            );
          }
        } else {
          sessionStorage.setItem(
            key,
            JSON.stringify({ productUrl: p.sourceUrl }),
          );
        }

        await queryClient.invalidateQueries({ queryKey: ["chatSessions"] });
        router.push(`/chat/${newId}`);
      } finally {
        setTryOnSeedBusy(false);
      }
    },
    [router, queryClient],
  );

  const sendShopMutation = useMutation({
    mutationFn: (vars: {
      message: string;
      attachmentIds: string[];
      complex: boolean;
    }) =>
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
          complex: vars.complex,
        },
      }),
    onMutate: (vars) => {
      const cur = queryClient.getQueryData<{ session: ChatSessionData }>([
        "chatSession",
        id,
      ]);
      preServerMessageCountRef.current = cur?.session?.messages?.length ?? 0;
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
      setTypingHint(
        vars.attachmentIds.length > 0
          ? vars.complex
            ? "Analyzing your photos (detailed)…"
            : "Analyzing your photos…"
          : vars.complex
            ? "Thinking hard..."
            : "Thinking...",
      );
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
        const expectedMin = preServerMessageCountRef.current + 2;
        await queryClient.refetchQueries({ queryKey: ["chatSession", id] });
        await queryClient.invalidateQueries({ queryKey: ["chatSessions"] });
        const readCount = () =>
          queryClient.getQueryData<{ session: ChatSessionData }>([
            "chatSession",
            id,
          ])?.session?.messages?.length ?? 0;
        if (readCount() >= expectedMin) {
          setOptimistic([]);
        } else {
          await queryClient.refetchQueries({ queryKey: ["chatSession", id] });
          if (readCount() >= expectedMin) setOptimistic([]);
        }
      } catch {
        // keep optimistic row if refetch fails
      }
    },
    onError: () => {
      setIsTyping(false);
    },
  });

  const tryOnMutation = useMutation({
    mutationFn: (vars: {
      prompt: string;
      productUrl?: string;
      productImageMediaId?: string;
      modelMediaIds: string[];
    }) =>
      api<{
        answer?: string;
        tryOn?: TryOnBubblePayload;
        aiMessageId?: string;
        needsImageGeneration?: boolean;
      }>("/api/chat/try-on-turn", {
        method: "POST",
        body: {
          sessionId: id,
          prompt: vars.prompt,
          productUrl: vars.productUrl,
          productImageMediaId: vars.productImageMediaId,
          modelMediaIds: vars.modelMediaIds,
        },
      }),
    onMutate: (vars) => {
      const cur = queryClient.getQueryData<{ session: ChatSessionData }>([
        "chatSession",
        id,
      ]);
      preServerMessageCountRef.current = cur?.session?.messages?.length ?? 0;
      const parts = [
        vars.productUrl?.trim() || null,
        vars.productImageMediaId ? "[Product photo]" : null,
        vars.prompt.trim() || null,
      ].filter(Boolean);
      const userMsg: OptimisticMessage = {
        id: `opt-user-${Date.now()}`,
        role: "user",
        text: parts.join(" · ") || "Try-on",
        attachmentIds: [
          ...vars.modelMediaIds,
          ...(vars.productImageMediaId ? [vars.productImageMediaId] : []),
        ],
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setOptimistic((prev) => [...prev, userMsg]);
      setIsTyping(true);
      setTypingHint("Analyzing product & fit…");
    },
    onSuccess: async (res) => {
      try {
        const expectedMin = preServerMessageCountRef.current + 2;
        await queryClient.refetchQueries({ queryKey: ["chatSession", id] });
        await queryClient.invalidateQueries({ queryKey: ["chatSessions"] });
        const readCount = () =>
          queryClient.getQueryData<{ session: ChatSessionData }>([
            "chatSession",
            id,
          ])?.session?.messages?.length ?? 0;
        if (readCount() >= expectedMin) {
          setOptimistic([]);
        } else {
          await queryClient.refetchQueries({ queryKey: ["chatSession", id] });
          if (readCount() >= expectedMin) setOptimistic([]);
        }
      } catch {
        // keep optimistic
      }

      if (!res.needsImageGeneration || !res.aiMessageId?.trim()) {
        setIsTyping(false);
        return;
      }

      setTryOnRenderPending(true);
      setIsTyping(true);
      setTypingHint("Generating try-on images…");
      try {
        await api<{ tryOn?: TryOnBubblePayload }>("/api/chat/try-on-turn", {
          method: "POST",
          body: {
            sessionId: id,
            renderForAiMessageId: res.aiMessageId.trim(),
          },
        });
        await queryClient.refetchQueries({ queryKey: ["chatSession", id] });
        await queryClient.invalidateQueries({ queryKey: ["chatSessions"] });
      } catch {
        /* user still has analysis + fit text; images may be missing */
      } finally {
        setTryOnRenderPending(false);
        setIsTyping(false);
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
      const tryOnBlock = m.contentJson?.tryOn;
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
        tryOn:
          m.senderType === "AI" && tryOnBlock && tryOnBlock.tryOnMediaIds
            ? tryOnBlock
            : undefined,
      };
    });

  const allMessages =
    optimistic.length > 0 ? [...serverMessages, ...optimistic] : serverMessages;

  /** TanStack Query keeps the mutation pending until async `onSuccess` finishes (incl. phase-2 try-on renders). */
  const showTypingBubble =
    isTyping ||
    sendShopMutation.isPending ||
    tryOnMutation.isPending ||
    tryOnRenderPending;

  const displayedTypingHint = tryOnRenderPending
    ? "Generating try-on images…"
    : typingHint;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length, showTypingBubble]);

  const handleSendShop = (
    payload: { text: string; attachmentIds: string[] },
    detailed: boolean,
  ) => {
    sendShopMutation.mutate({
      message: payload.text,
      attachmentIds: payload.attachmentIds,
      complex: detailed,
    });
  };

  const handleSendTryOn = (payload: {
    prompt: string;
    productUrl?: string;
    productImageMediaId?: string;
    modelMediaIds: string[];
  }) => {
    tryOnMutation.mutate(payload);
  };

  const busy =
    sendShopMutation.isPending ||
    tryOnMutation.isPending ||
    tryOnRenderPending ||
    tryOnSeedBusy;

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
            <>
              <ChatModeIntro
                activeMode={draftComposerMode}
                onSelectMode={setDraftComposerMode}
                disabled={busy}
              />
              {draftComposerMode === CHAT_MODE_SHOP ? (
                <SuggestedPrompts
                  onSelect={(t) =>
                    handleSendShop({ text: t, attachmentIds: [] }, false)
                  }
                />
              ) : (
                <p className="px-4 text-center text-xs text-text-muted">
                  Add a product link <strong>or</strong> one product photo, 1–2
                  model photos, then run try-on below.
                </p>
              )}
            </>
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
              tryOn={msg.tryOn}
              thinking={msg.thinking}
              showThinking={
                msg.role === "assistant" &&
                Boolean(
                  msg.thinking?.mode === "complex" ||
                  msg.thinking?.visionEnabled,
                )
              }
              onActionClick={(action) =>
                handleSendShop({ text: action, attachmentIds: [] }, false)
              }
              onTryOnProduct={
                msg.role === "assistant" ? startTryOnFromProduct : undefined
              }
              productTryOnBusy={tryOnSeedBusy}
            />
          ))}

          {showTypingBubble && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-brand-warm/35 bg-surface px-4 py-3 shadow-sm">
                <p className="mb-2 text-xs font-medium text-text-muted">
                  {displayedTypingHint}
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
        chatMode={effectiveComposerMode}
        modeLocked={modeLocked}
        onChatModeChange={setDraftComposerMode}
        onSendShop={handleSendShop}
        onSendTryOn={handleSendTryOn}
        disabled={busy}
        prefillProductUrl={prefillProductUrl}
        prefillProductImageMediaId={prefillProductImageMediaId}
        prefillProductTitle={prefillProductTitle}
        onPrefillConsumed={clearPrefill}
      />
    </div>
  );
}
