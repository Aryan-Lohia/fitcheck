-- Align chat session mode with unified AI Chat (shop | tryon).
ALTER TABLE "ChatSession" ALTER COLUMN "mode" SET DEFAULT 'shop';
UPDATE "ChatSession" SET "mode" = 'shop' WHERE "mode" = 'fashion';
