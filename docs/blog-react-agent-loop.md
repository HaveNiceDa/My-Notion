# 从硬编码路由到 ReAct Agent Loop：AI Chat 的工具调用重构

> 你的 AI Chat 里是不是也有一堆 `if (message.includes("搜索"))` 的判断？我的项目曾经就是这样——用关键词列表决定调哪个工具，后端手动伪造 `tool_calls` 消息，LLM 只是个"复读机"。它确实能跑……直到它跑不动了。这篇文章把硬编码路由的 5 个致命缺陷、ReAct Loop 的设计思路、以及 DashScope 兼容性的坑一次性讲清楚。

## 1. 开篇：关键词匹配，能用，但别认真

重构前，我的 AI Chat 后端路由逻辑长这样：

```typescript
// 旧代码：后端手动判断是否需要调 tool
if (shouldReadDocument(userMessage)) {
  const toolCall = createDocumentReadToolCall(documentId);
  const result = await executeDocumentRead(documentId);
  messages.push({ role: "assistant", content: null, tool_calls: [toolCall] });
  messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
} else if (shouldUseKnowledgeSearch(userMessage)) {
  const toolCall = createKnowledgeSearchToolCall(userMessage);
  const result = await executeKnowledgeSearch(userId, userMessage);
  messages.push({ role: "assistant", content: null, tool_calls: [toolCall] });
  messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
}
// 最后调一次 LLM 生成回答
```

看起来挺清晰？问题藏在细节里。当我加了第三个 tool（`web_search`），又想支持"同时搜知识库和联网"的场景时，整个逻辑就开始崩了。

**关键词匹配不是"智能路由"，是"if-else 地狱"的体面说法。**

## 2. 硬编码路由的 5 个致命缺陷

### 2.1 关键词匹配 = 假装理解意图

```typescript
// knowledge-search.ts（已删除）
const KNOWLEDGE_SEARCH_SIGNALS = [
  "笔记", "文档", "记录", "项目", "资料",
  "我之前", "我写过", "我的",
  // ...越来越长，永远不够
];

export function shouldUseKnowledgeSearch(message: string): boolean {
  return KNOWLEDGE_SEARCH_SIGNALS.some((signal) => message.includes(signal));
}
```

用户说"帮我看看上周的会议纪要"，命中"记录"→ 触发知识库搜索，看起来没问题。但用户说"记录一下这个想法"，也命中"记录"→ 错误触发搜索。用户说"总结一下我写的关于微服务的文章"，没有命中任何关键词 → 不触发搜索。

**关键词匹配的本质问题：它只看字面，不看语义。** 你永远无法穷举所有表达方式，而 LLM 天生就懂语义——你只需要给它 tool 的 description。

### 2.2 没有 ReAct 循环：只能调一次 tool

旧架构中，一次请求最多执行一次 tool call。流程是：

```
用户消息 → 关键词匹配 → 执行一个 tool → 拼结果 → LLM 生成回答
```

但真实场景经常需要多轮工具调用：

- "帮我搜一下知识库里关于 React 的笔记，再看看网上 React 19 有什么新特性" → 需要 `knowledge_search` + `web_search`
- "总结一下当前文档，然后搜一下知识库里相关的资料" → 需要 `document_read` + `knowledge_search`
- "搜一下我的项目文档，然后根据搜索结果帮我写一个技术方案" → 需要 `knowledge_search` → LLM 分析结果 → 可能再调一次 `knowledge_search` 缩小范围

**没有循环，LLM 就无法"观察结果 → 推理 → 再行动"。**

### 2.3 绕过 LLM 的 tool_choice：后端伪造 tool_calls

这是最严重的设计问题。旧代码中，后端自己决定调哪个 tool，然后**伪造** `assistant.tool_calls` 消息塞进对话历史：

```typescript
// 旧代码：后端手动构造 tool_calls，LLM 完全不知道自己"调了 tool"
const toolCall = createKnowledgeSearchToolCall(query);
messages.push({
  role: "assistant",
  content: null,
  tool_calls: [toolCall],  // ← 这是后端伪造的，不是 LLM 生成的
});
messages.push({
  role: "tool",
  tool_call_id: toolCall.id,
  content: JSON.stringify(result),
});
```

LLM 收到的对话历史里突然多了一条"自己调了 tool"的记录，但它根本没有做出这个决策。这导致：

- LLM 无法理解 tool 调用的上下文（它不知道自己"为什么"调了这个 tool）
- LLM 无法根据 tool 结果决定下一步（它根本没参与决策）
- 违背了 OpenAI tool calling 的设计意图——tool_calls 应该由模型生成

### 2.4 Tool 互斥：优先级导致功能缺失

旧代码用 `if-else if` 链做路由，`shouldReadDocument` 优先级高于 `shouldSearch`：

```typescript
if (shouldReadDocument(userMessage)) {
  // 只调 document_read
} else if (shouldUseKnowledgeSearch(userMessage)) {
  // 只调 knowledge_search
}
// 不可能同时触发两个 tool
```

用户说"总结当前文档，并搜一下知识库里的相关内容"——明明需要两个 tool，但 `if-else if` 结构决定了只能走一个分支。

### 2.5 没有迭代保护：理论上无限调用

旧代码没有循环上限的概念。虽然实际上只调一次 tool，但如果你想在 `should*` 判断里加递归逻辑（比如"搜索结果不够就换个关键词再搜"），没有任何机制防止无限递归。

### 缺陷总结

| # | 缺陷 | 后果 |
|---|------|------|
| 1 | 关键词匹配意图 | 误触发 + 漏触发，永远补不完 |
| 2 | 无 ReAct 循环 | 只能调一次 tool，无法多轮推理 |
| 3 | 伪造 tool_calls | LLM 不参与决策，违背 tool calling 设计 |
| 4 | Tool 互斥 | 无法同时调用多个 tool |
| 5 | 无迭代保护 | 理论上可能无限调用 |

## 3. ReAct Loop：让 LLM 自己决定调什么工具

### 3.1 什么是 ReAct

ReAct（Reasoning + Acting）是一种 Agent 模式，核心思想很简单：

1. **Reasoning**：LLM 看到可用 tools 列表和它们的 description，自主推理是否需要调 tool
2. **Acting**：如果需要，LLM 生成 `tool_calls`；如果不需要，直接输出文本
3. **Observation**：执行 tool，将结果加入对话历史
4. **回到 1**：LLM 看到工具结果，决定是否需要继续调 tool

```
用户消息 → ReAct Loop
              │
              ▼
         ┌─────────────────────┐
         │  LLM (with tools)   │ ◄── LLM 看到可用 tools 列表，自主决策
         └─────────┬───────────┘
                   │
          ┌────────┴────────┐
          │                 │
     tool_calls=null    tool_calls=[...]
          │                 │
          ▼                 ▼
     直接输出文本      执行所有 tools
     (循环结束)            │
                    ┌─────┴─────┐
                    │           │
                    ▼           ▼
              tool result   tool result
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

### 3.2 关键设计决策

**MAX_ITERATIONS = 5**：防止无限循环。5 轮足够覆盖绝大多数场景（搜索 → 分析 → 再搜索 → 生成），同时避免 LLM 陷入"调 tool → 不满意 → 再调"的死循环。

**tool_choice = "auto"**：让 LLM 自主决定是否调 tool，不强制。这是 DashScope 兼容性的关键——后面会讲。

**并行 tool calls**：LLM 可以在一次回复中同时调用多个 tool（比如同时 `knowledge_search` 和 `web_search`），我们并行执行所有 tool calls，再把结果一起加入对话历史。

## 4. 核心代码：react-loop.ts

这是整个重构的核心，ReAct 循环引擎：

```typescript
// lib/agent/react-loop.ts
import OpenAI from "openai";
import type { AgentTool } from "./tools/definitions";
import type { ToolContext } from "./tools/types";
import { enqueueEvent, streamModelResponse, applyThinkingParams } from "./stream";

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
  const messages = [...params.messages];

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // 1. 构建 LLM 调用参数
    const createParams: Record<string, unknown> = {
      model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? "auto" : undefined,
      max_tokens: 4096,
      stream: true,
    };
    applyThinkingParams(createParams, enableThinking);

    // 2. 流式调用 LLM，输出 text-delta / reasoning-delta / tool-call-start 等事件
    //    返回 LLM 产生的 tool_calls（如有）
    const pendingToolCalls = await streamModelResponse(
      openai,
      createParams as unknown as OpenAI.ChatCompletionCreateParamsStreaming,
      controller, encoder, responseId, enableThinking,
    );

    // 3. LLM 没有调用任何 tool → 直接输出文本，循环结束
    if (pendingToolCalls.length === 0) {
      break;
    }

    // 4. 将 assistant 的 tool_calls 消息加入对话历史
    messages.push({
      role: "assistant",
      content: null,
      tool_calls: pendingToolCalls,
    });

    // 5. 执行所有 tool calls 并将结果加入对话历史
    for (const toolCall of pendingToolCalls) {
      const tool = toolMap.get(toolCall.function.name);
      if (!tool) {
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` }),
        });
        continue;
      }

      let args: Record<string, unknown>;
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        args = {};
      }

      // 注入流式输出能力到 tool 上下文
      const toolContextWithStream: ToolContext = {
        ...toolContext,
        stream: { controller, encoder, toolCallId: toolCall.id },
      };

      let result: unknown;
      try {
        result = await tool.execute(args, toolContextWithStream);
      } catch (error) {
        result = { error: error instanceof Error ? error.message : String(error) };
      }

      // 向前端推送 tool-call-result 事件
      enqueueEvent(controller, encoder, {
        type: "tool-call-result",
        toolCallId: toolCall.id,
        result,
      });

      // 将 tool 结果加入对话历史，LLM 下一轮能看到
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }

    // 6. 继续下一轮迭代，让 LLM 基于工具结果决定是否继续调用
  }
}
```

整个循环就做一件事：**LLM 生成 → 检查 tool_calls → 执行 → 加入历史 → 再来一轮**。没有关键词匹配，没有 `if-else if`，没有伪造消息。LLM 完全掌控决策。

## 5. Tool 定义标准化

重构前，每个 tool 散落在各自的文件里，接口不统一。重构后，所有 tool 实现统一的 `AgentTool` 接口：

```typescript
// lib/agent/tools/definitions.ts
export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;  // OpenAI function schema
  execute: (args: Record<string, unknown>, context: ToolContext) => Promise<unknown>;
}
```

三个 tool 的定义：

```typescript
// 知识库检索
export const knowledgeSearchTool: AgentTool = {
  name: "knowledge_search",
  description:
    "搜索用户个人知识库中的文档和笔记。当用户提问涉及个人笔记、文档内容、项目资料、历史记录等私有信息时使用此工具。",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "搜索查询，使用用户问题中的关键词" },
      topK: { type: "number", description: "返回结果数量，默认3" },
    },
    required: ["query"],
  },
  execute: async (args, ctx) => executeKnowledgeSearch(ctx.userId, args),
};

// 文档阅读
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

// 联网搜索
export const webSearchTool: AgentTool = {
  name: "web_search",
  description:
    "搜索互联网获取实时信息。当用户提问涉及最新新闻、天气、股票价格、时事热点等需要实时数据的问题时使用此工具。",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "搜索查询关键词" },
    },
    required: ["query"],
  },
  execute: async (args, ctx) => executeWebSearch(args, ctx),
};
```

注意 `document_read` 没有参数——服务端通过 `ToolContext.currentDocument` 获取当前文档，LLM 不需要知道 `documentId`。旧代码要求 LLM 传入 `documentId`，但 LLM 根本不知道当前文档的 ID 是什么，这是一个典型的"把后端实现细节暴露给 LLM"的错误。

新增 tool 只需三步：

1. 实现 `AgentTool` 接口
2. 在 `registry.ts` 的 `buildAvailableTools()` 中注册
3. 完事。LLM 自动通过 description 判断何时调用

```typescript
// lib/agent/tools/registry.ts
export function buildAvailableTools(
  currentDocument?: CurrentDocumentContext | null,
): AgentTool[] {
  const tools: AgentTool[] = [knowledgeSearchTool, webSearchTool];
  if (currentDocument?.id) {
    tools.push(documentReadTool);
  }
  return tools;
}
```

## 6. DashScope 兼容性：那些文档没写的坑

项目使用阿里云 DashScope 作为 LLM 提供商（兼容 OpenAI API），这里踩了一个大坑。

### 6.1 `enable_thinking` 与 `tool_choice` 的 400 冲突

DashScope 的深度思考模式（`enable_thinking: true`）与 `tool_choice` 的非 `"auto"` 值不兼容：

```typescript
// ❌ 这样写会返回 400 错误
const params = {
  model: "qwen3-235b-a22b",
  enable_thinking: true,
  tool_choice: { type: "function", function: { name: "knowledge_search" } },
  // DashScope 返回：thinking mode is incompatible with tool_choice object/required
};

// ❌ 这样也不行
const params = {
  model: "qwen3-235b-a22b",
  enable_thinking: true,
  tool_choice: "required",
  // 同样 400
};
```

**解决方案：`tool_choice` 始终使用 `"auto"`。**

```typescript
// ✅ 始终 auto，让 LLM 自主决策
const createParams = {
  model,
  messages,
  tools: tools.length > 0 ? tools : undefined,
  tool_choice: tools.length > 0 ? "auto" : undefined,
};
```

`"auto"` 的语义是"LLM 可以调 tool，也可以不调"——这正是 ReAct Loop 需要的行为。如果用 `"required"`，LLM 被强制每次都调 tool，永远无法直接回答问题。

### 6.2 `enable_thinking` 必须作为顶层参数

Node.js SDK 中，`enable_thinking` 和 `thinking_budget` 必须作为顶层参数传递，不能放在 `extra_body` 里（那是 Python SDK 的做法）：

```typescript
// ❌ Python SDK 的做法，Node.js 里不生效
const params = {
  model,
  messages,
  extra_body: { enable_thinking: true, thinking_budget: 200 },
};

// ✅ Node.js SDK 的正确做法
const params: Record<string, unknown> = {
  model,
  messages,
  stream: true,
};
params.enable_thinking = true;
params.thinking_budget = 200;
```

### 6.3 多 tool_calls 支持

DashScope 支持在一次回复中返回多个 `tool_calls`，流式响应中通过 `index` 字段区分不同的 tool call：

```typescript
for await (const chunk of response) {
  const delta = chunk.choices[0]?.delta;
  for (const toolCallDelta of delta.tool_calls ?? []) {
    const index = toolCallDelta.index ?? 0;
    // 用 index 累积不同 tool call 的参数
    const existing = pendingToolCalls[index] ?? {
      id: toolCallDelta.id ?? `tool-${index}`,
      type: "function" as const,
      function: { name: "", arguments: "" },
    };
    if (toolCallDelta.id) existing.id = toolCallDelta.id;
    if (toolCallDelta.function?.name) existing.function.name = toolCallDelta.function.name;
    if (toolCallDelta.function?.arguments) {
      existing.function.arguments += toolCallDelta.function.arguments;
    }
    pendingToolCalls[index] = existing;
  }
}
```

DashScope 可能分多次返回一个 tool call 的参数（先返回 name，再分几块返回 arguments），所以需要用 `index` 做累积。

## 7. NDJSON 流式事件协议

前后端通过 NDJSON（Newline Delimited JSON）协议通信，每个事件一行 JSON：

```typescript
// lib/agent/stream.ts
export type AgentStreamEvent =
  | { type: "text-delta"; id: string; delta: string }
  | { type: "reasoning-delta"; id: string; delta: string }
  | { type: "tool-call-start"; toolCallId: string; toolName: string }
  | { type: "tool-call-delta"; toolCallId: string; delta: string }
  | { type: "tool-result-delta"; toolCallId: string; delta: string }
  | { type: "tool-call-result"; toolCallId: string; result: unknown }
  | { type: "finish"; model: string; usage: null }
  | { type: "error"; message: string };
```

事件的生命周期：

| 事件 | 触发时机 | 前端用途 |
|------|----------|----------|
| `text-delta` | LLM 输出文本片段 | 实时渲染 Markdown |
| `reasoning-delta` | 深度思考模式输出推理过程 | 折叠展示"深度思考" |
| `tool-call-start` | LLM 决定调用某个 tool | 显示"正在搜索知识库..." |
| `tool-call-delta` | tool 参数流式到达 | （暂不展示） |
| `tool-result-delta` | tool 执行过程中流式推送结果 | 长结果渐进展示 |
| `tool-call-result` | tool 执行完成 | 显示 tool 结果卡片 |
| `finish` | 循环结束 | 标记消息完成 |
| `error` | 出错 | 显示错误提示 |

一个典型的多轮 tool 调用的 NDJSON 流：

```
{"type":"tool-call-start","toolCallId":"call_1","toolName":"knowledge_search"}
{"type":"tool-call-delta","toolCallId":"call_1","delta":"{\"query\":"}
{"type":"tool-call-delta","toolCallId":"call_1","delta":"React 性能优化\"}"}
{"type":"tool-call-result","toolCallId":"call_1","result":{"documents":[...]}}
{"type":"tool-call-start","toolCallId":"call_2","toolName":"web_search"}
{"type":"tool-call-result","toolCallId":"call_2","result":{"items":[...]}}
{"type":"text-delta","id":"assistant-xxx","delta":"根据搜索结果，"}
{"type":"text-delta","id":"assistant-xxx","delta":"React 性能优化有以下几种方式..."}
{"type":"finish","model":"qwen3-235b-a22b","usage":null}
```

## 8. 前端零改动：协议不变，行为升级

重构最让我满意的一点：**前端代码一行没改。**

为什么？因为 NDJSON 事件协议没变。前端只关心收到什么事件、怎么渲染，不关心后端是关键词匹配还是 ReAct Loop。

唯一的区别是：以前一次请求最多一轮 `tool-call-start → tool-call-result`，现在可能有多轮。但前端本来就是用事件驱动渲染的，多轮事件只是多触发几次状态更新，天然兼容。

```typescript
// 前端解析 NDJSON 的逻辑，重构前后完全一致
for await (const line of readNDJSONStream(response)) {
  const event = JSON.parse(line) as AgentStreamEvent;
  switch (event.type) {
    case "text-delta":
      appendText(event.delta);
      break;
    case "tool-call-start":
      addToolCard(event.toolCallId, event.toolName);
      break;
    case "tool-call-result":
      updateToolCard(event.toolCallId, event.result);
      break;
    case "finish":
      markComplete();
      break;
  }
}
```

这就是好的抽象层的价值——后端从"单次 tool 调用"升级到"ReAct 多轮循环"，前端完全无感。

## 9. 架构对比：Before vs After

### Before：硬编码路由

```
┌──────────────────────────────────────────────────────┐
│                     route.ts (200+ 行)                │
│                                                       │
│  用户消息                                             │
│    │                                                  │
│    ▼                                                  │
│  shouldReadDocument(msg)?                             │
│    ├─ Yes → createDocumentReadToolCall() → 执行       │
│    │         → 伪造 assistant.tool_calls              │
│    │         → 拼入 tool result                       │
│    │                                                  │
│    └─ No → shouldUseKnowledgeSearch(msg)?             │
│              ├─ Yes → createKnowledgeSearchToolCall()  │
│              │         → 伪造 assistant.tool_calls     │
│              │         → 拼入 tool result              │
│              │                                        │
│              └─ No → 跳过 tool                        │
│                                                       │
│    ▼                                                  │
│  LLM 生成回答（只调一次，无法多轮）                     │
│    │                                                  │
│    ▼                                                  │
│  输出 SSE 流                                          │
└──────────────────────────────────────────────────────┘
```

### After：ReAct Agent Loop

```
┌──────────────────────────────────────────────────────┐
│  route.ts (40 行)                                     │
│    auth → 解析 → buildAvailableTools → runReActLoop   │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│  react-loop.ts (ReAct 循环引擎)                       │
│                                                       │
│  for (iteration = 0; iteration < 5; iteration++) {    │
│    ┌─────────────────────────────────────────────┐    │
│    │  LLM (看到 tools 列表，自主决策)              │    │
│    └──────────────────┬──────────────────────────┘    │
│                       │                               │
│              ┌────────┴────────┐                      │
│              │                 │                      │
│         tool_calls=[]    tool_calls=[...]             │
│              │                 │                      │
│              ▼                 ▼                      │
│         break            执行所有 tools               │
│         (结束)            → tool-call-result 事件     │
│                            → messages += results      │
│                            → 继续下一轮               │
│  }                                                    │
│                                                       │
│  输出 finish 事件                                      │
└──────────────────────────────────────────────────────┘
```

关键区别：

| 维度 | Before | After |
|------|--------|-------|
| route.ts 行数 | 200+ | ~40 |
| 谁决定调 tool | 后端关键词匹配 | LLM 自主决策 |
| 单次请求 tool 调用次数 | 最多 1 次 | 最多 5 轮，每轮可并行 |
| tool 互斥 | `if-else if` 互斥 | 可同时调用多个 tool |
| 新增 tool 成本 | 改 route.ts + 加 `should*` 函数 + 加 `create*ToolCall` | 实现 `AgentTool` 接口 + 注册 |
| 前端改动 | 每次都要改 | 零改动 |

## 10. 总结

| | 硬编码路由 | ReAct Agent Loop |
|---|---|---|
| 意图识别 | 关键词列表，误触发 + 漏触发 | LLM 通过 tool description 语义理解 |
| 决策权 | 后端代码 | LLM |
| tool_calls 来源 | 后端伪造 | LLM 生成 |
| 多轮推理 | ❌ 不支持 | ✅ 最多 5 轮 |
| 多 tool 并行 | ❌ 互斥 | ✅ 支持 |
| 迭代保护 | ❌ 无 | ✅ MAX_ITERATIONS = 5 |
| 新增 tool | 改 3+ 个文件 | 实现 1 个接口 + 注册 |
| 前端影响 | 每次都可能改 | 零改动 |
| DashScope 兼容 | 手动处理 | `tool_choice: "auto"` 统一处理 |

**核心思想：把决策权还给 LLM。** 你不需要教 LLM "什么时候该搜索"——你只需要告诉它"你有搜索能力，描述是这样的"，它自己会判断。

关键词匹配是你替 LLM 做决策，ReAct Loop 是让 LLM 自己做决策。前者是"你觉得自己比 LLM 更懂用户意图"，后者是"承认 LLM 比你更懂"。

当然，ReAct Loop 不是银弹。它引入了新的复杂性：多轮调用增加了延迟和 token 消耗，`MAX_ITERATIONS` 需要根据场景调整，LLM 有时会在不需要 tool 的时候强行调用。但这些都是可观测、可调优的——而硬编码路由的问题，是不可扩展的。

---

*本文基于 [My-Notion](https://github.com/HaveNiceDa/My-Notion) 项目的真实重构经历撰写——一个 AI 原生的个人版 Notion，采用 ReAct Agent Loop 架构。欢迎 Star ⭐*
