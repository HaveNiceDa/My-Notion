export interface CurrentDocumentContext {
  id: string;
  title: string;
  content?: string | null;
}

export interface PendingToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolExecutionResult {
  result: unknown;
  toolCall: PendingToolCall;
}
