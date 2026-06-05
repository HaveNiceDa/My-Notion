import {
  knowledgeSearchTool,
  documentReadTool,
  documentUpdateTool,
  documentWriteTool,
  documentSearchTool,
  webSearchTool,
  webExtractTool,
  memorySearchTool,
  memoryWriteTool,
  myNotionMcpTool,
  taskPlanTool,
} from "./definitions";
import type { AgentTool } from "./definitions";
import type { CurrentDocumentContext } from "./types";

// 根据上下文构建可用 tool 列表
// knowledge_search / web_search / memory / task_plan / document_write 始终可用，当前文档相关 tool 仅在有上下文时启用
export function buildAvailableTools(
  currentDocument?: CurrentDocumentContext | null,
): AgentTool[] {
  const tools: AgentTool[] = [
    knowledgeSearchTool,
    webSearchTool,
    webExtractTool,
    documentSearchTool,
    memorySearchTool,
    memoryWriteTool,
    myNotionMcpTool,
    taskPlanTool,
    documentWriteTool,
  ];

  if (currentDocument?.id) {
    tools.push(documentReadTool);
    tools.push(documentUpdateTool);
  }

  return tools;
}
