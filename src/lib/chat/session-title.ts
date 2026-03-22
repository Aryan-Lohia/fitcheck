import { prisma } from "@/lib/prisma/client";
import { generateChatSessionTitle } from "@/lib/ai/generate-chat-title";

const DEFAULT_TITLE = "New chat";

/**
 * After the first exchange, replace default title with an AI-generated one.
 */
export async function maybeSetSessionTitleAfterFirstTurn(params: {
  sessionId: string;
  userId: string;
  messageCountBeforeThisTurn: number;
  titleHint: string;
}): Promise<void> {
  if (params.messageCountBeforeThisTurn !== 0) return;

  const session = await prisma.chatSession.findFirst({
    where: { id: params.sessionId, userId: params.userId },
    select: { title: true },
  });
  if (!session || session.title !== DEFAULT_TITLE) return;

  const title = await generateChatSessionTitle(params.titleHint);
  await prisma.chatSession.update({
    where: { id: params.sessionId },
    data: { title },
  });
}
