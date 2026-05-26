import { defineSchema } from "convex/server";
import { documentTable } from "./document";
import { aiConversationsTable } from "./aiConversations";
import { aiMessagesTable } from "./aiMessages";
import { aiThinkingStepsTable } from "./aiThinkingSteps";
import { apiTokensTable } from "./apiTokens";
import { cliAuditLogsTable } from "./cliAuditLogs";

/** 数据库模式 */
export default defineSchema({
  documents: documentTable,
  aiConversations: aiConversationsTable,
  aiMessages: aiMessagesTable,
  aiThinkingSteps: aiThinkingStepsTable,
  apiTokens: apiTokensTable,
  cliAuditLogs: cliAuditLogsTable,
});
