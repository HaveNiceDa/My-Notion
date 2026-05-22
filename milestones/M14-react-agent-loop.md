# M14: ReAct Agent Loop 重构

## 目标

将当前硬编码关键词匹配的 tool 路由，重构为标准 ReAct（Reasoning + Acting）循环，让 LLM 自主决定是否调用工具、调用哪个工具、以及是否需要多轮工具调用。

## 当前问题分析

### 问题 1：硬编码关键词匹配

```typescript
// knowledge-search.ts
const KNOWLEDGE_SEARCH_SIGNALS = ["知识库", "文档", "笔记", "总结", "搜索", ...];
export function shouldUseKnowledgeSearch(query: string): boolean {
  return KNOWLEDGE_SEARCH_SIGNALS.some((signal) => normalizedQuery.includes(signal));
}
```

- 用户说"帮我看看上周的会议记录"→ 不命中任何关键词 → 不触发知识库检索
- 用户说"总结一下" → 同时命中 knowledge_search 和 document_read → 当前逻辑互斥只选一个
- 新增 tool 需要写新的关键词列表，不可扩展

### 问题 2：无 ReAct 循环

当前流程是线性的：判断 → 执行一次 tool → 生成回答。模型无法：

- 观察工具返回结果后决定是否需要补充检索
- 同时调用多个工具
- 根据工具结果修正推理路径

### 问题 3：绕过 LLM tool_choice

当前后端自行决定调哪个 tool，然后伪造 `assistant.tool_calls` 消息塞入 messages：

```typescript
// route.ts L200-224 — 后端伪造 tool call
const toolCall = shouldReadDocument
  ? createDocumentReadToolCall(body.currentDocument)
  : createKnowledgeSearchToolCall(userQuery, 3);
// ... 执行 tool ...
// 然后把伪造的 assistant.tool_calls + tool result 塞进 messages 再调 LLM
```

LLM 完全没有参与"该不该调 tool / 调哪个 tool"的决策。

### 问题 4：DashScope thinking mode 兼容性 hack

因为绕过了 LLM tool_choice，所以需要手动处理 `enable_thinking` 与 `tool_choice` 的冲突。ReAct 模式下 LLM 自己决定是否调 tool，`tool_choice` 保持默认 `"auto"` 即可，无需特殊处理。

---

## 技术方案

### 架构总览

```
用户消息 → Agent Loop
              │
              ▼
         ┌─────────────────────┐
         │  LLM (with tools)   │ ◄── 第一轮：LLM 看到可用 tools 列表
         └─────────┬───────────┘
                   │
          ┌────────┴────────┐
          │                 │
     tool_calls=null    tool_calls=[...]
          │                 │
          ▼                 ▼
     直接输出文本      执行 tools
     (循环结束)            │
                    ┌─────┴─────┐
                    │           │
                    ▼           ▼
              tool result   tool result
              (knowledge)   (document)
                    │           │
                    └─────┬─────┘
                          │
                          ▼
                   messages += [assistant.tool_calls, tool_results]
                          │
                          ▼
                   回到循环顶部 ──► LLM (with tools)
                          │
                   ... 最多 MAX_ITERATIONS 轮 ...
                          │
                          ▼
                     循环结束，输出 finish
```

### 核心改动

#### 1. Tool 定义标准化

将 tool 定义从"后端硬编码"改为"标准 OpenAI function schema"，让 LLM 看到 tool 描述后自主决策。

```typescript
// lib/agent/tools/definitions.ts

export interface AgentTool {
  name: string;
  description: string;
  parameters: OpenAI.ChatCompletionTool.FunctionObject;
  execute: (args: Record<string, unknown>, context: ToolContext) => Promise<unknown>;
}

export interface ToolContext {
  userId: string;
  currentDocument?: CurrentDocumentContext | null;
}

export const knowledgeSearchTool: AgentTool = {
  name: "knowledge_search",
  description: "搜索用户个人知识库中的文档和笔记。当用户提问涉及个人笔记、文档内容、项目资料、历史记录等私有信息时使用此工具。",
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
  execute: async (args, ctx) => {
    // 复用现有 executeKnowledgeSearch 逻辑
  },
};

export const documentReadTool: AgentTool = {
  name: "document_read",
  description: "读取用户当前正在查看的文档内容。当用户要求总结、翻译、分析当前页面/文档时使用此工具。",
  parameters: {
    type: "object",
    properties: {
      documentId: {
        type: "string",
        description: "当前文档ID",
      },
    },
    required: ["documentId"],
  },
  execute: async (args, ctx) => {
    // 复用现有 executeDocumentRead 逻辑
  },
};
```

#### 2. ReAct 循环引擎

```typescript
// lib/agent/react-loop.ts

const MAX_ITERATIONS = 5;

interface ReActLoopParams {
  openai: OpenAI;
  model: string;
  messages: OpenAI.ChatCompletionMessageParam[];
  tools: OpenAI.ChatCompletionTool[];
  toolMap: Map<string, AgentTool>;
  toolContext: ToolContext;
  enableThinking: boolean;
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
  responseId: string;
}

export async function runReActLoop(params: ReActLoopParams): Promise<void> {
  const {
    openai, model, tools, toolMap, toolContext,
    enableThinking, controller, encoder, responseId,
  } = params;
  let { messages } = params;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const createParams: OpenAI.ChatCompletionCreateParamsStreaming = {
      model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? "auto" : undefined,
      stream: true,
    };

    if (enableThinking) {
      (createParams as Record<string, unknown>).extra_body = {
        enable_thinking: true,
        thinking_budget: 50,
      };
    }

    const pendingToolCalls = await streamModelResponse(
      openai, createParams, controller, encoder, responseId, enableThinking,
    );

    // LLM 没有调用任何 tool → 循环结束
    if (pendingToolCalls.length === 0) break;

    // 将 assistant 的 tool_calls 消息加入历史
    messages.push({
      role: "assistant",
      content: null,
      tool_calls: pendingToolCalls,
    });

    // 执行所有 tool calls
    for (const toolCall of pendingToolCalls) {
      const tool = toolMap.get(toolCall.function.name);
      if (!tool) {
        enqueueEvent(controller, encoder, {
          type: "tool-call-result",
          toolCallId: toolCall.id,
          result: { error: `Unknown tool: ${toolCall.function.name}` },
        });
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` }),
        });
        continue;
      }

      const args = JSON.parse(toolCall.function.arguments);
      const result = await tool.execute(args, toolContext);

      enqueueEvent(controller, encoder, {
        type: "tool-call-result",
        toolCallId: toolCall.id,
        result,
      });

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }

    // 继续下一轮迭代，让 LLM 基于工具结果决定是否继续
  }
}
```

#### 3. Route 简化

```typescript
// route.ts — 重构后

export async function POST(req: NextRequest) {
  // ... auth, body 解析 ...

  const availableTools = buildAvailableTools(body.currentDocument);
  const toolMap = new Map(availableTools.map(t => [t.name, t]));
  const openaiTools: OpenAI.ChatCompletionTool[] = availableTools.map(t => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    buildSystemMessage(availableTools.length > 0),
    ...body.messages,
  ];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await runReActLoop({
          openai, model, messages, tools: openaiTools, toolMap,
          toolContext: { userId, currentDocument: body.currentDocument },
          enableThinking, controller, encoder, responseId,
        });
        enqueueEvent(controller, encoder, { type: "finish", model, usage: null });
      } catch (error) {
        enqueueEvent(controller, encoder, {
          type: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, { ... });
}
```

### 删除的代码

| 文件 | 删除内容 |
|---|---|
| `knowledge-search.ts` | `KNOWLEDGE_SEARCH_SIGNALS`、`shouldUseKnowledgeSearch()`、`createKnowledgeSearchToolCall()` |
| `document-read.ts` | `DOCUMENT_READ_SIGNALS`、`shouldReadCurrentDocument()`、`createDocumentReadToolCall()` |
| `route.ts` | 所有 `should*` 判断逻辑、手动伪造 `tool_calls` 的代码、`mode` 参数处理 |
| `types.ts` | `PendingToolCall`（改用 OpenAI 原生类型） |

### 新增的代码

| 文件 | 内容 |
|---|---|
| `lib/agent/tools/definitions.ts` | `AgentTool` 接口 + `knowledgeSearchTool` / `documentReadTool` 定义 |
| `lib/agent/react-loop.ts` | ReAct 循环引擎（`runReActLoop`） |
| `lib/agent/tools/registry.ts` | `buildAvailableTools()` — 根据上下文决定哪些 tool 可用 |

### DashScope 兼容性

| 场景 | 处理方式 |
|---|---|
| `enable_thinking` + `tool_choice` | `tool_choice` 始终为 `"auto"`（默认值），不传 `object`/`required`，规避 400 错误 |
| 多 tool_calls | DashScope 支持单轮返回多个 tool_calls，ReAct 循环并行执行后统一加入 messages |
| thinking mode 首轮 | 不需要特殊处理，LLM 在 thinking 模式下可以正常返回 tool_calls |

### 前端兼容性

前端无需改动。NDJSON 事件协议不变：

- `tool-call-start` / `tool-call-delta` / `tool-call-result` — 与现有前端解析逻辑兼容
- 新增：单次请求可能出现多轮 tool-call 事件（之前最多一轮）
- `text-delta` / `reasoning-delta` / `finish` / `error` — 不变

### 迭代保护

- `MAX_ITERATIONS = 5`：防止无限循环
- 每次 tool 执行有 try-catch，失败时返回 error 作为 tool result，LLM 可以据此决定是否重试或换策略
- 未知 tool name 返回 error，不会中断循环

---

## 文件结构（重构后）

```
apps/web/src/lib/agent/
├── react-loop.ts          # ReAct 循环引擎
├── tools/
│   ├── definitions.ts     # AgentTool 接口 + 各 tool 定义
│   ├── registry.ts        # buildAvailableTools() — 根据上下文构建可用 tool 列表
│   ├── knowledge-search.ts # 仅保留 executeKnowledgeSearch
│   ├── document-read.ts    # 仅保留 executeDocumentRead
│   ├── types.ts            # CurrentDocumentContext, ToolContext
│   └── index.ts            # 统一导出
└── stream.ts               # streamModelResponse + enqueueEvent（从 route.ts 抽出）

apps/web/src/app/api/agent/stream/
└── route.ts                # 精简为：auth → 解析 → buildTools → runReActLoop
```

---

## 验证计划

1. `pnpm --filter @notion/web typecheck` — 类型检查
2. `pnpm --filter @notion/web lint` — 代码规范
3. `pnpm --filter @notion/web build` — 构建通过
4. 功能验证：
   - 普通对话（无 tool）→ LLM 直接回复，不触发 tool
   - "帮我搜一下项目文档" → LLM 自主调用 `knowledge_search`
   - "总结当前页面" → LLM 自主调用 `document_read`
   - "搜一下项目文档，然后总结当前页面" → LLM 可能同时调用两个 tool（多轮 ReAct）
   - thinking mode + tool call → 不报 400 错误

---

## 后续演进（本次不做）

| 模式 | 描述 | 优先级 |
|---|---|---|
| Spec 模式 | LLM 先输出规格说明，用户确认后再执行 | P1 |
| Plan 模式 | LLM 先输出执行计划，逐步执行 | P1 |
| web_search tool | 接入网络搜索能力 | P2 |
| MCP 接入 | 通过 Responses API 接入百炼托管 MCP 服务 | P2 |
| Tool 结果缓存 | 相同 query 短时间内复用 tool result | P3 |
