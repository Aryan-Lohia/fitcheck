"use client";

import { ChatSplitLayout } from "@/components/chat/ChatSplitLayout";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatSplitLayout>{children}</ChatSplitLayout>
    </div>
  );
}
