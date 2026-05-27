import { executeKnowledgeSearch } from "./knowledge-search";
import { executeDocumentRead } from "./document-read";
import { executeWebSearch } from "./web-search";
import { executeMemoryRead, executeMemoryWrite } from "./memory";
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
    "搜索用户个人知识库中的文档和笔记。当用户提问涉及个人笔记、文档内容、项目资料、历史记录等私有信息时使用此工具。检索策略选择：常规文档查询使用 balanced；复杂研究、跨文档归纳、需要更高召回的问题使用 deep；极低延迟场景使用 fast。如果用户显式要求某种策略，优先遵循用户要求。",
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
      strategy: {
        type: "string",
        enum: ["fast", "balanced", "deep"],
        description:
          "检索策略。fast=极低延迟语义检索；balanced=默认混合搜索，适合简单事实查询；deep=复杂研究/跨文档归纳的深度检索。用户显式要求某种策略时优先遵循。",
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

// 联网搜索 tool：通过 SerpAPI 调用 Google 搜索获取实时信息
export const webSearchTool: AgentTool = {
  name: "web_search",
  description:
    "搜索互联网获取实时信息。当用户提问涉及最新新闻、天气、股票价格、时事热点等需要实时数据的问题时使用此工具。返回 Google 搜索结果（标题、链接、摘要）。",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "搜索查询关键词",
      },
    },
    required: ["query"],
  },
  execute: async (args, ctx) => executeWebSearch(args, ctx),
};

// 长期记忆读取 tool：读取用户偏好、项目事实和阶段性对话结论
export const memoryReadTool: AgentTool = {
  name: "memory_read",
  description:
    "读取用户长期记忆，包括用户偏好、项目事实和重要对话结论。当回答需要遵循用户长期偏好、项目约束或跨会话历史时使用此工具。",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "用于匹配记忆的当前问题或关键词；不传时返回最近的活跃记忆。",
      },
      type: {
        type: "string",
        enum: ["preference", "project", "episodic"],
        description: "可选记忆类型过滤：preference=用户偏好，project=项目事实，episodic=阶段性对话结论。",
      },
      limit: {
        type: "number",
        description: "返回记忆数量，默认 8，最大 20。",
      },
    },
  },
  execute: async (args, ctx) => executeMemoryRead(args, ctx),
};

// 长期记忆写入 tool：默认 dry-run，必须用户明确确认后才允许真实写入
export const memoryWriteTool: AgentTool = {
  name: "memory_write",
  description:
    "写入用户长期记忆。仅在用户明确要求“记住/以后都按这个来”或 Agent 提议并获得用户确认后使用。默认必须 dryRun=true 预览，不得直接写入；只有用户明确批准该记忆后才可设置 dryRun=false。",
  parameters: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["preference", "project", "episodic"],
        description: "记忆类型：preference=用户偏好，project=项目事实，episodic=阶段性对话结论。",
      },
      content: {
        type: "string",
        description: "要保存的记忆正文，应简洁、可解释、避免敏感信息泛化。",
      },
      source: {
        type: "string",
        enum: ["user_explicit", "agent_proposed", "manual"],
        description: "写入来源。用户明确要求记住时用 user_explicit；Agent 提议后用户确认时用 agent_proposed。",
      },
      reason: {
        type: "string",
        description: "写入原因，用于 Memory Review 审查。",
      },
      confidence: {
        type: "number",
        description: "置信度 0-1，默认 1。",
      },
      expiresAt: {
        type: "number",
        description: "可选过期时间戳，适合临时或阶段性记忆。",
      },
      supersedesMemoryId: {
        type: "string",
        description: "可选，被这条记忆取代的旧记忆 ID。",
      },
      dryRun: {
        type: "boolean",
        description: "默认 true，只返回预览和 confirmationRequired；用户明确批准后才可设置 false 真实写入。",
      },
    },
    required: ["content"],
  },
  execute: async (args, ctx) => executeMemoryWrite(args, ctx),
};
