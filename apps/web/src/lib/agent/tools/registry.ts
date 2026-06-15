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

type BuildAvailableToolsOptions = {
  knowledgeBaseEnabled?: boolean;
};

// 根据上下文构建可用 tool 列表
// web_search / memory / task_plan / document_write 始终可用，当前文档相关 tool 仅在有上下文时启用。
// knowledge_search 由调用端开关控制，默认保持开启以兼容现有 Web Agent 行为。
export function buildAvailableTools(
  currentDocument?: CurrentDocumentContext | null,
  options: BuildAvailableToolsOptions = {},
): AgentTool[] {
  const knowledgeBaseEnabled = options.knowledgeBaseEnabled !== false;
  const tools: AgentTool[] = [
    webSearchTool,
    webExtractTool,
    documentSearchTool,
    memorySearchTool,
    memoryWriteTool,
    myNotionMcpTool,
    taskPlanTool,
    documentWriteTool,
  ];

  if (knowledgeBaseEnabled) {
    tools.unshift(knowledgeSearchTool);
  }

  if (currentDocument?.id) {
    tools.push(documentReadTool);
    tools.push(documentUpdateTool);
  }

  return tools;
}
