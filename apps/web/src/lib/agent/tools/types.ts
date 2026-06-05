import type { ConvexHttpClient } from "convex/browser";
import type { AgentTracer } from "../trace";
import type { ToolResultErrorReason } from "./result-contract";

// 当前文档上下文，由前端传入，表示用户正在查看的文档
export interface CurrentDocumentContext {
  id: string;
  title: string;
  content?: string | null;
}

// Tool 执行时的流式输出接口，tool 可向前端推送中间结果
export interface ToolStreamOutput {
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
  toolCallId: string;
}

// Tool 执行上下文，传递用户身份、当前文档、模型信息和流式输出能力
export interface ToolContext {
  userId: string;
  model: string;
  currentDocument?: CurrentDocumentContext | null;
  stream?: ToolStreamOutput;
  convex?: ConvexHttpClient;
  trace?: AgentTracer;
}

// Tool 失败时统一返回可恢复结果，避免 ReAct 循环因异常中断。
export interface RecoverableToolError {
  error: string;
  summary: string;
  recoverable: true;
  sources: [];
  metadata: {
    toolName: string;
    contractVersion: "tool-result-v1";
    reason: ToolResultErrorReason;
  };
}
