import type { Id } from "@convex/_generated/dataModel";
import type { AIModel } from "@/lib/ai/chat";
import type {
  MobileAgentStreamCursor,
  MobileAgentStreamEvent,
} from "@/lib/ai/agent-stream";

export type AgentChatStatus =
  | "idle"
  | "preparing"
  | "streaming"
  | "failed"
  | "resumable"
  | "done";

export type AgentChatInterruptionReason =
  | "background"
  | "network"
  | "user"
  | "unknown"
  | null;

export type ThinkingStep = {
  type: string;
  content: string;
  details?: string;
};

export type AgentToolEventStatus = "running" | "completed" | "failed";

export type AgentToolEventSource = {
  type: "document" | "web" | "memory";
  title?: string;
  url?: string;
  documentId?: string;
  memoryId?: string;
  score?: number;
};

export type AgentToolEventItem = {
  id: string;
  name: string;
  status: AgentToolEventStatus;
  detail: string;
  sources: AgentToolEventSource[];
  recoverable: boolean;
  updatedAt: number;
};

export type AgentToolStreamEvent = Extract<
  MobileAgentStreamEvent,
  { toolCallId: string }
>;

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
  toolEvents: AgentToolEventItem[];
  stepsExpanded: boolean;
  lastFailedInput: string | null;
  interruptionReason: AgentChatInterruptionReason;
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
