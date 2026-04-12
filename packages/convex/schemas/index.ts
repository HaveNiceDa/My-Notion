import { defineSchema } from "convex/server";
import { documentTable } from "./document";
import { aiConversationsTable } from "./aiConversations";
import { aiMessagesTable } from "./aiMessages";
import { aiThinkingStepsTable } from "./aiThinkingSteps";

export default defineSchema({
  documents: documentTable,
  aiConversations: aiConversationsTable,
  aiMessages: aiMessagesTable,
  aiThinkingSteps: aiThinkingStepsTable,
});
