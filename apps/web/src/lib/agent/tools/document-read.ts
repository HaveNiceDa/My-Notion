import { extractTextFromDocument } from "@notion/ai/utils";
import type { CurrentDocumentContext, PendingToolCall } from "./types";

const DOCUMENT_READ_SIGNALS = [
  "当前页面",
  "此页面",
  "这个页面",
  "当前文档",
  "此文档",
  "这篇文档",
  "这篇笔记",
  "总结",
  "翻译",
  "深度分析",
  "深度剖析",
  "任务跟踪器",
  "current page",
  "this page",
  "current document",
  "this document",
  "summarize",
  "translate",
  "analyze",
  "task tracker",
];

export function shouldReadCurrentDocument(
  query: string,
  currentDocument?: CurrentDocumentContext | null,
): boolean {
  if (!currentDocument?.id) return false;
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return false;

  return DOCUMENT_READ_SIGNALS.some((signal) => normalizedQuery.includes(signal));
}

export function createDocumentReadToolCall(
  currentDocument?: CurrentDocumentContext | null,
): PendingToolCall {
  return {
    id: `document-read-${Date.now()}`,
    type: "function",
    function: {
      name: "document_read",
      arguments: JSON.stringify({ documentId: currentDocument?.id }),
    },
  };
}

export function executeDocumentRead(
  currentDocument?: CurrentDocumentContext | null,
): unknown {
  if (!currentDocument?.id) {
    return { document: null, error: "current document is not available" };
  }

  let text = "";
  if (currentDocument.content) {
    try {
      text = extractTextFromDocument(currentDocument.content);
    } catch {
      text = currentDocument.content;
    }
  }

  return {
    document: {
      id: currentDocument.id,
      title: currentDocument.title || "Untitled",
      content: text || "",
    },
  };
}
