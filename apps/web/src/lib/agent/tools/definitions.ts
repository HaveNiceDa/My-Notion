import { executeKnowledgeSearch } from "./knowledge-search";
import { executeDocumentRead } from "./document-read";
import { executeWebSearch } from "./web-search";
import type { ToolContext } from "./types";

// Agent Tool 标准接口：每个 tool 自带 OpenAI function schema，LLM 通过 description 自主判断何时调用
export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>, context: ToolContext) => Promise<unknown>;
}

// 知识库检索 tool：搜索用户个人知识库中的文档和笔记
export const knowledgeSearchTool: AgentTool = {
  name: "knowledge_search",
  description:
    "搜索用户个人知识库中的文档和笔记。当用户提问涉及个人笔记、文档内容、项目资料、历史记录等私有信息时使用此工具。",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "搜索查询，使用用户问题中的关键词",
      },
      topK: {
        type: "number",
        description: "返回结果数量，默认3",
      },
    },
    required: ["query"],
  },
  execute: async (args, ctx) => executeKnowledgeSearch(ctx.userId, args),
};

// 文档阅读 tool：读取用户当前正在查看的文档内容
// 不需要 documentId 参数——服务端通过 ToolContext.currentDocument 获取当前文档
export const documentReadTool: AgentTool = {
  name: "document_read",
  description:
    "读取用户当前正在查看的文档内容。当用户要求总结、翻译、分析当前页面/文档时使用此工具。调用时无需任何参数。",
  parameters: {
    type: "object",
    properties: {},
  },
  execute: async (_args, ctx) => executeDocumentRead(ctx.currentDocument),
};

// 联网搜索 tool：通过 DashScope enable_search 搜索互联网实时信息
export const webSearchTool: AgentTool = {
  name: "web_search",
  description:
    "搜索互联网获取实时信息。当用户提问涉及最新新闻、天气、股票价格、时事热点等需要实时数据的问题时使用此工具。",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "搜索查询关键词",
      },
      strategy: {
        type: "string",
        enum: ["turbo", "max", "agent"],
        description:
          "搜索策略：turbo（默认，兼顾速度与效果）、max（更全面搜索）、agent（多轮检索整合，适合复杂问题）",
      },
    },
    required: ["query"],
  },
  execute: async (args, ctx) => executeWebSearch(args, ctx),
};
