import { extractTextFromDocument } from "@notion/ai/utils";
import type { CurrentDocumentContext } from "./types";

// 文档阅读：将 BlockNote JSON 内容转成纯文本后返回
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
