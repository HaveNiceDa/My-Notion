import type { Id } from "@convex/_generated/dataModel";
import type { AIModel } from "@/lib/ai/chat";
import type { MobileAgentStreamCursor } from "@/lib/ai/agent-stream";

export type AgentChatStatus =
  | "idle"
  | "preparing"
  | "streaming"
  | "failed"
  | "resumable"
  | "done";

export type ThinkingStep = {
  type: string;
  content: string;
  details?: string;
};

export type AgentChatSettings = {
  selectedModel: AIModel;
  enableThinking: boolean;
  knowledgeBaseEnabled: boolean;
};

export type AgentChatDraftState = {
  input: string;
  streamingContent: string;
  reasoningContent: string;
  completedReasoning: string;
  reasoningExpanded: boolean;
  thinkingSteps: ThinkingStep[];
  stepsExpanded: boolean;
  lastFailedInput: string | null;
};

export type AgentChatSessionState = AgentChatDraftState &
  AgentChatSettings & {
    status: AgentChatStatus;
    isSending: boolean;
    activeConversationId: Id<"aiConversations"> | null;
    resumeCursor: MobileAgentStreamCursor | null;
  };

export type AgentChatResumeSnapshot = {
  cursor: MobileAgentStreamCursor;
  conversationId: Id<"aiConversations">;
  content: string;
  reasoning: string;
  updatedAt: number;
};
