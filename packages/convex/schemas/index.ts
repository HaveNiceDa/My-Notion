import { defineSchema } from "convex/server";
import { documentTable } from "./document";
import { aiConversationsTable } from "./aiConversations";
import { aiMessagesTable } from "./aiMessages";
import { aiThinkingStepsTable } from "./aiThinkingSteps";
import { apiTokensTable } from "./apiTokens";
import { cliAuditLogsTable } from "./cliAuditLogs";
import { cliRateLimitsTable } from "./cliRateLimits";
import { cliDeviceAuthSessionsTable } from "./cliDeviceAuthSessions";
import { agentMemoriesTable } from "./agentMemories";

/** 数据库模式 */
export default defineSchema({
  documents: documentTable,
  aiConversations: aiConversationsTable,
  aiMessages: aiMessagesTable,
  aiThinkingSteps: aiThinkingStepsTable,
  apiTokens: apiTokensTable,
  cliAuditLogs: cliAuditLogsTable,
  cliRateLimits: cliRateLimitsTable,
  cliDeviceAuthSessions: cliDeviceAuthSessionsTable,
  agentMemories: agentMemoriesTable,
});
