import { extractTextFromDocument } from "@notion/ai/utils";
import type { CurrentDocumentContext } from "./types";
import { buildToolErrorResult, withToolResultContract } from "./result-contract";

// 文档阅读：将 BlockNote JSON 内容转成纯文本后返回
export function executeDocumentRead(
  currentDocument?: CurrentDocumentContext | null,
): unknown {
  if (!currentDocument?.id) {
    return {
      document: null,
      ...buildToolErrorResult("document_read", "current document is not available", { reason: "unavailable" }),
    };
  }

  let text = "";
  if (currentDocument.content) {
    try {
      text = extractTextFromDocument(currentDocument.content);
    } catch {
      text = currentDocument.content;
    }
  }

  return withToolResultContract("document_read", {
    document: {
      id: currentDocument.id,
      title: currentDocument.title || "Untitled",
      content: text || "",
    },
  }, {
    summary: `Read current document "${currentDocument.title || "Untitled"}".`,
    sources: [{
      type: "document",
      documentId: currentDocument.id,
      title: currentDocument.title || "Untitled",
    }],
    metadata: {
      contentLength: text.length,
    },
  });
}
