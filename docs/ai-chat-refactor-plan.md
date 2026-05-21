# AI Chat 重构方案：侧边栏 + Agent 架构

## 1. 六项核心要求

| # | 要求 | 优先级 |
|---|---|---|
| 1 | 样式上改为右侧侧边栏 | P0 |
| 2 | 去掉硬编码的思考过程，完全不需要 | P0 |
| 3 | 把 RAG 能力抽离为一个 tool，作为后续 agent 的一个能力 | P0 |
| 4 | 重构 AI 能力，变为 Agent 体系 | P0 |
| 5 | 更新模型配置和向量模型，对齐 my-notion-go 最新配置 | P1 |
| 6 | 每次迭代写成本地文件（progress/ + milestones/） | P0 |

---

## 2. 现状分析

### 2.1 当前架构问题

| 问题 | 描述 |
|---|---|
| **独立页面** | AI Chat 是 `/Chat` 路由下的全屏页面，用户必须离开文档才能使用 AI |
| **硬编码思考过程** | `useThinkingProcessStore` + `StepItem` 硬编码了 `knowledge-base`/`query`/`retrieval` 等步骤类型 |
| **7 个碎片化 Store** | `use-ai-model-store`、`use-deep-thinking-store`、`use-knowledge-base-store`、`use-thinking-process-store`、`use-tool-call-store`、`use-vector-store-store`、`use-web-search-store` |
| **RAG 单一路径** | `/api/rag-stream` 是唯一入口，知识库检索和普通聊天走同一个硬编码 pipeline |
| **模型配置过时** | 当前使用 `qwen3.6-plus` 等旧模型，需对齐 my-notion-go 的 `deepseek-v4-pro` 等 |

### 2.2 当前文件结构

```
apps/web/src/
├── app/[locale]/(main)/(AI)/Chat/
│   ├── page.tsx                          # AI Chat 全屏页面
│   ├── hooks/useAIChat.ts                # 聊天 Hook（526 行）
│   ├── components/
│   │   ├── ConversationSidebar.tsx
│   │   ├── TopNavigation.tsx
│   │   ├── NewConversationLanding.tsx
│   │   ├── MessageList.tsx               # 含硬编码 StepItem
│   │   └── MessageInput.tsx
│   └── utils/index.ts
├── app/api/
│   ├── chat/route.ts
│   ├── rag-stream/route.ts
│   ├── rag-complete/route.ts
│   ├── embeddings/route.ts
│   ├── qdrant/route.ts
│   └── rag-documents/route.ts
├── lib/store/                            # 7 个碎片化 store
└── lib/rag/ragUtils.ts
```

### 2.3 模型配置对比

| 维度 | my-notion（当前） | my-notion-go（目标） |
|---|---|---|
| **默认模型** | `qwen3.6-plus` | `deepseek-v4-pro` |
| **可用模型** | Model-1/2/3 (qwen3.6-plus, qwen3.6-plus-2026-04-02, gui-plus) | deepseek-v4-pro, qwen3.6-27b, kimi-k2.6, glm-5.1 |
| **Embedding 模型** | `text-embedding-v4` | `tongyi-embedding-vision-plus-2026-03-06` |
| **Embedding 维度** | 未显式约束 | 1024 |
| **LLM Base URL** | `dashscope.aliyuncs.com/compatible-mode/v1` | 环境变量 `LLM_BASE_URL` |
| **Embedding Base URL** | 同 LLM | 环境变量 `DASHSCOPE_API_BASE_URL`（DashScope 原生 API） |

---

## 3. 重构方案

### Phase 1：右侧侧边栏（要求 1）

**目标**：AI Chat 从独立页面变为右侧可拖拽面板

```
当前布局:                          重构后布局:
┌──────┬────────────────────┐     ┌──────┬──────────────┬──────────┐
│ Nav  │   AI Chat Page     │     │ Nav  │  Document    │ AI Panel │
│      │   (全屏)           │     │      │  Content     │ (可拖拽) │
└──────┴────────────────────┘     └──────┴──────────────┴──────────┘
```

#### 改动清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `app/[locale]/(main)/layout.tsx` | 修改 | 集成 `AIChatPanel`，主内容区自适应宽度 |
| `app/[locale]/(main)/(AI)/` | 删除 | 整个路由组移除 |
| `_components/Navigation.tsx` | 修改 | "Notion AI" → `togglePanel()` |
| `components/ai-chat/AIChatPanel.tsx` | 新增 | 右侧可拖拽面板 |
| `components/ai-chat/useAIChat.ts` | 新增 | 统一 Hook |
| `components/ai-chat/MessageList.tsx` | 新增 | 无硬编码步骤 |
| `components/ai-chat/MessageInput.tsx` | 新增 | 输入框 |
| `components/ai-chat/types.ts` | 新增 | 类型定义 |
| `components/ai-chat/models.ts` | 新增 | 模型配置（对齐 Go 版） |
| `hooks/useResizableWidth.ts` | 新增 | 可拖拽宽度 Hook |
| `lib/store/use-ai-chat-store.ts` | 新增 | 面板开关 store |

#### AIChatPanel 设计

- 面板宽度 320-520px，左边缘可拖拽，宽度持久化到 localStorage
- 移动端改为全屏覆盖
- Header：会话选择下拉 + 新建 + 关闭
- Body：消息列表（可滚动）
- Footer：输入框 + 模型选择 + 模式切换 + 发送

---

### Phase 2：去除硬编码思考过程（要求 2）

**目标**：完全删除 `useThinkingProcessStore`、`StepItem` 和所有硬编码步骤

#### 删除清单

| 删除项 | 说明 |
|---|---|
| `use-thinking-process-store.ts` | 整个文件删除 |
| `use-deep-thinking-store.ts` | 合并到 `useAIChat` |
| `use-knowledge-base-store.ts` | 合并到 `useAIChat` 的 `mode` |
| `use-tool-call-store.ts` | 合并到 `useAIChat` |
| `use-vector-store-store.ts` | 删除（初始化移到后端） |
| `use-web-search-store.ts` | 合并到 Agent tool 配置 |
| `use-ai-model-store.ts` | 合并到 `useAIChat` |
| `MessageList.tsx` 中的 `StepItem` | 删除 |
| `MessageList.tsx` 中的左侧思考面板 | 删除 |
| `useAIChat.ts` 中的 `thinking_step` 事件处理 | 删除 |
| `rag-stream/route.ts` 中的 `thinking_step` 事件发送 | 删除 |

#### 统一 Hook 状态设计

```typescript
type AIChatState = {
  panelOpen: boolean;
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: ChatMessage[];
  sending: boolean;
  streamError: string | null;
  modelId: AIModelId;
  mode: "chat" | "rag";
  toolCalls: ToolCall[];
};
```

---

### Phase 3：RAG 抽离为 Tool + Agent 架构（要求 3、4）

**目标**：RAG 从硬编码 pipeline 变为 `knowledge_search` tool，AI Chat 变为 Agent 体系

```
当前架构:                              Agent 架构:
用户消息 → RAG Stream API → LLM       用户消息 → Agent API → LLM (with tools)
         ↓                                        ↓
    硬编码 pipeline                      ┌─────────┼─────────┐
    (检索→重排→生成)               knowledge_search  web_search  document_read
                                                ↓
                                          Tool Execution
                                                ↓
                                          LLM (continue)
                                                ↓
                                          Stream Response
```

#### API 路由重构

| 当前 | 重构后 | 说明 |
|---|---|---|
| `/api/chat/route.ts` | 合并到 `/api/agent/stream` | 统一入口 |
| `/api/rag-stream/route.ts` | 合并到 `/api/agent/stream` | RAG 变为 tool |
| `/api/rag-complete/route.ts` | **删除** | 不再需要 |
| `/api/embeddings/route.ts` | 内部 tool 调用 | 不暴露 |
| `/api/qdrant/route.ts` | 内部 tool 调用 | 不暴露 |
| `/api/rag-documents/route.ts` | 保留 | 文档管理 |

#### Agent 流式事件协议

```typescript
type AgentStreamEvent =
  | { type: "text-delta"; id: string; delta: string }
  | { type: "tool-call-start"; toolCallId: string; toolName: string }
  | { type: "tool-call-delta"; toolCallId: string; delta: string }
  | { type: "tool-call-result"; toolCallId: string; result: unknown }
  | { type: "finish"; model: string; usage: TokenUsage };
```

#### Tool 定义

| Tool | 描述 | 参数 |
|---|---|---|
| `knowledge_search` | RAG 知识库检索 | `{ query: string, topK?: number }` |
| `web_search` | 网络搜索 | `{ query: string }` |
| `document_read` | 读取当前文档内容 | `{ documentId: string }` |

#### Agent Router 逻辑

```typescript
// /api/agent/stream/route.ts
export async function POST(req: Request) {
  const { messages, mode, modelId, documentId } = await req.json();
  const tools = buildTools({ mode, documentId });
  const stream = await openai.chat.completions.create({
    model: resolveModel(modelId),
    messages: buildPrompt(messages, documentId),
    tools: tools.length > 0 ? tools : undefined,
    stream: true,
  });
  return streamAgentEvents(stream);
}
```

---

### Phase 4：更新模型配置（要求 5）

**目标**：对齐 my-notion-go 最新模型和 embedding 配置

#### 模型配置更新

```typescript
// packages/ai/config/model.ts - 更新后
export const AI_MODELS = ["deepseek-v4-pro", "qwen3.6-27b", "kimi-k2.6", "glm-5.1"] as const;
export type AIModel = (typeof AI_MODELS)[number];
export const DEFAULT_MODEL: AIModel = "deepseek-v4-pro";

export const MODEL_ID_MAPPING: Record<AIModel, string> = {
  "deepseek-v4-pro": "deepseek-v4-pro",
  "qwen3.6-27b": "qwen3.6-27b",
  "kimi-k2.6": "kimi-k2.6",
  "glm-5.1": "glm-5.1",
};

export const EMB_MODEL = "tongyi-embedding-vision-plus-2026-03-06";
export const EMB_DIMENSION = 1024;
```

#### Embedding 更新

- 模型：`text-embedding-v4` → `tongyi-embedding-vision-plus-2026-03-06`
- 维度：显式约束为 1024
- API：使用 DashScope 原生多模态 embedding API（与 Go 版一致）

---

## 4. 迭代记录规范（要求 6）

### progress/ 目录

每次迭代写入 `progress/YYYYMMDD-HHMMSS.md`，格式：

```markdown
# [迭代目标]

## 完成的改动
- ...

## 验证命令和结果
- `pnpm --filter @notion/web typecheck`: ✅ / ❌
- `pnpm --filter @notion/web build`: ✅ / ❌

## 已知缺口或风险
- ...

## 下一步建议
- ...
```

### milestones/ 目录

每个阶段收敛为 `milestones/MX-xxx.md`，格式：

```markdown
# MX: [阶段名称]

## 目标
...

## 关键改动
...

## 验证
...

## 关联 progress 文件
- progress/YYYYMMDD-*.md
```

---

## 5. 实施步骤

| Step | 内容 | Phase |
|---|---|---|
| 1 | 创建 `use-ai-chat-store.ts`（面板开关） | 1 |
| 2 | 创建 `useResizableWidth.ts` | 1 |
| 3 | 创建 `models.ts`（对齐 Go 版模型配置） | 4 |
| 4 | 创建 `types.ts` | 2 |
| 5 | 创建 `useAIChat.ts`（整合 7 个 store） | 2 |
| 6 | 创建 `AIChatPanel.tsx` | 1 |
| 7 | 创建 `MessageList.tsx`（无硬编码步骤） | 2 |
| 8 | 创建 `MessageInput.tsx` | 1 |
| 9 | 修改 `layout.tsx`，集成面板 | 1 |
| 10 | 修改 `Navigation.tsx`，AI 按钮 toggle | 1 |
| 11 | 删除 `(AI)/Chat/` 旧页面 | 2 |
| 12 | 删除 7 个旧 store | 2 |
| 13 | 创建 `/api/agent/stream/route.ts` | 3 |
| 14 | 实现 `knowledge_search` tool | 3 |
| 15 | 删除 `/api/chat`、`/api/rag-stream`、`/api/rag-complete` | 3 |
| 16 | 更新 `packages/ai/config/model.ts` | 4 |
| 17 | 更新 embedding 模型和维度 | 4 |
| 18 | 写入 progress + milestone | 6 |
| 19 | 验证：typecheck + build + 功能测试 | 全部 |

---

## 6. 风险与注意事项

| 风险 | 缓解措施 |
|---|---|
| Convex 对话数据兼容 | 新 Hook 保持 `api.aiChat.*` 调用，数据层不变 |
| 移动端适配 | 面板在移动端改为全屏覆盖 |
| 向量存储初始化 | 从 MainLayout useEffect 移到 Agent tool 内部按需初始化 |
| 编辑器 AI 不受影响 | 编辑器 AI 走 `/api/editor-ai/streamText`，独立于 Chat |
| 旧 URL `/Chat` 兼容 | 加 redirect 到首页并自动打开面板 |
| Embedding 模型切换 | 需重建 Qdrant collection（维度可能变化） |
