import { executeKnowledgeSearch } from "./knowledge-search";
import { executeDocumentRead } from "./document-read";
import { executeDocumentUpdate, executeDocumentWrite } from "./document-write";
import { executeDocumentSearch } from "./document-search";
import { executeWebExtract } from "./web-extract";
import { executeWebSearch } from "./web-search";
import { executeMemoryRead, executeMemorySearch, executeMemoryWrite } from "./memory";
import { executeTaskPlan } from "./task-plan";
import { withToolFallback } from "./fallback";
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
  execute: withToolFallback({
    name: "knowledge_search",
    execute: async (args, ctx) => executeKnowledgeSearch(ctx.userId, args),
  }),
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
  execute: withToolFallback({
    name: "document_read",
    execute: async (_args, ctx) => executeDocumentRead(ctx.currentDocument),
  }),
};

// 文档创建 tool：只生成写入预览，真实落库必须由用户在前端确认触发
export const documentWriteTool: AgentTool = {
  name: "document_write",
  description:
    "创建新的 My-Notion 文档。当用户明确要求新建文档、整理成新页面、生成会议纪要/计划等内容时使用。默认只返回 dry-run 预览和 confirmationRequired，不得直接写入。只生成 Markdown，系统会转换为 BlockNote blocks；不要生成 BlockNote JSON。",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "新文档标题。",
      },
      contentMarkdown: {
        type: "string",
        description: "新文档 Markdown 内容。Agent 只生成 Markdown，不生成 BlockNote JSON。",
      },
      parentDocument: {
        type: "string",
        description: "可选父文档 ID。仅在用户明确要求创建为当前文档子页或指定父文档时传入。",
      },
      dryRun: {
        type: "boolean",
        description: "必须保持 true 或省略；真实写入由用户在前端确认后执行。",
      },
    },
    required: ["title", "contentMarkdown"],
  },
  execute: withToolFallback({
    name: "document_write",
    execute: async (args, ctx) => executeDocumentWrite(args, ctx),
  }),
};

// 文档更新 tool：只生成变更预览，真实落库必须由用户在前端确认触发
export const documentUpdateTool: AgentTool = {
  name: "document_update",
  description:
    "更新已有 My-Notion 文档。可追加或替换当前文档内容，也可改标题。当用户要求修改/追加/重写当前文档时使用。默认只返回 dry-run 预览和 confirmationRequired，不得直接写入。先读取 contentMarkdown 再基于 Markdown 生成更新；不要生成 BlockNote JSON。",
  parameters: {
    type: "object",
    properties: {
      documentId: {
        type: "string",
        description: "目标文档 ID；如果要更新当前页面，可省略并由系统使用当前文档 ID。",
      },
      title: {
        type: "string",
        description: "可选，新标题。",
      },
      contentMarkdown: {
        type: "string",
        description: "可选，要追加或替换的 Markdown 内容。读取文档后基于 contentMarkdown 二次编辑。",
      },
      mode: {
        type: "string",
        enum: ["append", "overwrite"],
        description: "内容更新模式。append=追加到现有内容后；overwrite=替换全文。默认 append。",
      },
      dryRun: {
        type: "boolean",
        description: "必须保持 true 或省略；真实写入由用户在前端确认后执行。",
      },
    },
  },
  execute: withToolFallback({
    name: "document_update",
    execute: async (args, ctx) => executeDocumentUpdate(args, ctx),
  }),
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
  execute: withToolFallback({
    name: "web_search",
    execute: async (args, ctx) => executeWebSearch(args, ctx),
  }),
};

// 网页正文抽取 tool：读取用户提供的 URL 内容，补足 web_search 只返回搜索结果的缺口
export const webExtractTool: AgentTool = {
  name: "web_extract",
  description:
    "读取指定网页 URL 的标题、描述和正文内容。当用户粘贴链接、要求总结/分析某个网页、或需要访问搜索结果中的具体页面时使用。只支持 http/https，不访问本地或私网地址。",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "要读取的完整网页 URL，必须包含 http 或 https。",
      },
    },
    required: ["url"],
  },
  execute: withToolFallback({
    name: "web_extract",
    execute: async (args, ctx) => executeWebExtract(args, ctx),
  }),
};

// 文档元数据搜索 tool：按标题、路径和最近编辑时间查找文档，不读取正文
export const documentSearchTool: AgentTool = {
  name: "document_search",
  description:
    "按标题、层级路径或最近编辑时间搜索用户的 My-Notion 文档元数据。用于查找某个文档在哪里、列出最近文档、定位要读取或更新的文档；如果需要正文内容，再配合 knowledge_search 或 document_read。",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "可选，文档标题或路径关键词；为空时返回最近编辑的文档。",
      },
      limit: {
        type: "number",
        description: "返回数量，默认 10，最大 30。",
      },
      includeArchived: {
        type: "boolean",
        description: "是否包含归档文档，默认 false。",
      },
      updatedAfter: {
        type: "number",
        description: "可选，只返回该时间戳之后编辑过的文档。",
      },
    },
  },
  execute: withToolFallback({
    name: "document_search",
    execute: async (args, ctx) => executeDocumentSearch(args, ctx),
  }),
};

// 长期记忆读取 tool：读取用户偏好、项目事实和阶段性对话结论
export const memorySearchTool: AgentTool = {
  name: "memory_search",
  description:
    "按查询、记忆分层、类别和作用域搜索用户长期记忆。当回答需要遵循长期偏好、项目约束、历史决策、工具经验或跨会话上下文时优先使用。默认只返回非敏感 active 记忆，并包含可解释 scoreBreakdown。",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "用于匹配记忆的当前问题或关键词。",
      },
      kinds: {
        type: "array",
        description: "可选记忆分层过滤：instruction=稳定规则/偏好；semantic=长期事实；episodic=会话事件；procedural=工作流经验。",
        items: {
          type: "string",
          enum: ["instruction", "semantic", "episodic", "procedural"],
        },
      },
      categories: {
        type: "array",
        description: "可选细分类过滤，例如 user_preference、project_fact、session_note。",
        items: { type: "string" },
      },
      scopes: {
        type: "array",
        description: "可选作用域过滤。未传时默认使用当前 user scope，并在有当前文档时包含 document scope。",
        items: {
          type: "object",
          properties: {
            level: {
              type: "string",
              enum: ["user", "workspace", "project", "document", "conversation", "module", "path"],
            },
            key: {
              type: "string",
            },
          },
          required: ["level", "key"],
        },
      },
      limit: {
        type: "number",
        description: "返回记忆数量，默认 8，最大 20。",
      },
      includeSensitive: {
        type: "boolean",
        description: "是否包含 sensitive 记忆，默认 false。",
      },
      includeEvidence: {
        type: "boolean",
        description: "是否返回证据字段，默认 false。",
      },
    },
    required: ["query"],
  },
  execute: withToolFallback({
    name: "memory_search",
    execute: async (args, ctx) => executeMemorySearch(args, ctx),
  }),
};

// 兼容旧 memory_read：内部复用 memory_search，后续可逐步下线
export const memoryReadTool: AgentTool = {
  name: "memory_read",
  description:
    "兼容旧版长期记忆读取工具。新请求优先使用 memory_search；仅在需要按旧 type=preference/project/episodic 过滤时使用。",
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
  execute: withToolFallback({
    name: "memory_read",
    execute: async (args, ctx) => executeMemoryRead(args, ctx),
  }),
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
  execute: withToolFallback({
    name: "memory_write",
    execute: async (args, ctx) => executeMemoryWrite(args, ctx),
  }),
};

// 任务计划 tool：让 Agent 把复杂请求拆成可展示、可推进的多步骤计划。
export const taskPlanTool: AgentTool = {
  name: "task_plan",
  description:
    "为复杂任务生成或更新多步骤执行计划。当用户要求先规划、任务包含多个阶段、需要展示进度或为 Plan 模式铺垫时使用。只产出计划，不直接修改文档或记忆。",
  parameters: {
    type: "object",
    properties: {
      objective: {
        type: "string",
        description: "计划目标，用一句话概括用户要完成的任务。",
      },
      steps: {
        type: "array",
        description: "计划步骤列表，按执行顺序排列。",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "可选步骤 ID；不传时系统会生成 step-1、step-2。",
            },
            title: {
              type: "string",
              description: "步骤标题。",
            },
            description: {
              type: "string",
              description: "可选步骤说明。",
            },
            status: {
              type: "string",
              enum: ["pending", "in_progress", "completed", "blocked"],
              description: "步骤状态，默认 pending。",
            },
          },
          required: ["title"],
        },
      },
    },
    required: ["objective", "steps"],
  },
  execute: withToolFallback({
    name: "task_plan",
    execute: async (args, ctx) => executeTaskPlan(args, ctx),
  }),
};
