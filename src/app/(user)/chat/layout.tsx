"use client";

import { ChatSplitLayout } from "@/components/chat/ChatSplitLayout";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ChatSplitLayout>{children}</ChatSplitLayout>;
}
