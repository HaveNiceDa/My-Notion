import type { ConvexHttpClient } from "convex/browser";

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
}
