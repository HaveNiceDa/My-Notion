import {
  knowledgeSearchTool,
  documentReadTool,
  webSearchTool,
  memoryReadTool,
  memoryWriteTool,
} from "./definitions";
import type { AgentTool } from "./definitions";
import type { CurrentDocumentContext } from "./types";

// 根据上下文构建可用 tool 列表
// knowledge_search / web_search / memory tools 始终可用，document_read 仅在有当前文档时可用
export function buildAvailableTools(
  currentDocument?: CurrentDocumentContext | null,
): AgentTool[] {
  const tools: AgentTool[] = [knowledgeSearchTool, webSearchTool, memoryReadTool, memoryWriteTool];

  if (currentDocument?.id) {
    tools.push(documentReadTool);
  }

  return tools;
}
