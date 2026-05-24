# AI 工具调用结果可视化：让用户看见 AI 搜了什么、读了什么

> AI 回答问题时调用了知识库检索、文档阅读、联网搜索——但用户完全不知道。消息流式输出时能看到工具调用状态，一旦完成就消失了。用户只能看到一个光秃秃的回答，不知道 AI 参考了哪些文档、搜了什么网页。这篇文章从问题分析到完整方案，把工具调用结果的持久化、可视化、可交互一次性讲清楚。

## 1. 开篇：AI 搜了什么？用户一无所知

某天我在 My-Notion 里问 AI："我之前写的关于 Monorepo 的笔记在哪？"AI 回答了，但回答里只说"你有一篇关于 pnpm Monorepo 的笔记"——没有链接，没有标题，什么都没有。

我打开 DevTools 看了一下网络请求，发现 AI 确实调用了 `knowledge_search` 工具，返回了文档列表（包含 `documentId`、`title`、`score`）。但这些信息只在流式输出期间短暂存在于前端状态中，消息完成后就被清空了。

**用户有权知道 AI 参考了什么——这不是锦上添花，而是 AI 可信度的基础。**

## 2. 问题分析：工具调用结果的"阅后即焚"

### 2.1 流式期间的短暂可见

原始实现中，工具调用状态通过全局 `toolCalls` 状态管理：

```typescript
// useAIChat.ts — 流式期间的临时状态
const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);

// onToolCallStart: 添加调用中状态
setToolCalls((prev) => [
  ...prev,
  { id: toolCallId, name: toolName, parameters: {}, status: "calling" },
]);

// onToolCallResult: 更新为完成状态
setToolCalls((prev) =>
  prev.map((tc) =>
    tc.id === toolCallId ? { ...tc, result, status: "completed" } : tc,
  ),
);
```

问题在于：`onComplete` 回调触发后，下一条消息发送时 `toolCalls` 被清空，之前的工具调用结果彻底消失。

### 2.2 三个工具，三种信息黑洞

| 工具 | 返回数据 | 用户看到的 |
|------|----------|------------|
| `knowledge_search` | 文档列表（documentId, title, score, content） | 什么都没有 |
| `document_read` | 文档内容（id, title） | 什么都没有 |
| `web_search` | 搜索关键词 | 什么都没有 |

更具体地说：

- **知识库检索**：返回了文档标题和 ID，但用户看不到标题，更点不进去
- **文档阅读**：AI 读了当前文档，但用户不知道它读了哪篇
- **联网搜索**：只显示"Searched for: xxx"，搜索结果完全不可见

### 2.3 根本原因

```
流式输出期间：
  toolCalls 状态 → 有数据 → 但只存在几秒

消息完成后：
  toolCalls 被清空 → 数据消失 → 消息上没有 toolResults 字段

历史对话加载：
  Convex 只存了 content → 没有 toolResults → 永久丢失
```

**数据没有持久化，就不可能可视化。**

## 3. 解决方案设计

### 3.1 整体思路

```
流式期间收集 → 消息完成时写入 → Convex 持久化 → 加载时还原 → 组件渲染
```

核心改动：

1. **类型层**：给 `ChatMessage` 增加 `toolResults` 字段
2. **持久化层**：在 `onComplete` 时将 `toolResults` 序列化写入 Convex
3. **加载层**：`loadMessages` 时反序列化还原 `toolResults`
4. **展示层**：新建 `ToolCallCard` 组件，按工具类型差异化渲染

### 3.2 类型设计

```typescript
// types.ts

export interface KnowledgeSearchDoc {
  documentId: string;
  title: string;
  score: number;
  content: string;
}

export interface ToolCallResult {
  id: string;
  name: string;
  status: "calling" | "executing" | "completed" | "error";
  result?: unknown;
}

export interface ChatMessage {
  id: string;
  content: string;
  reasoningContent?: string;
  role: "user" | "assistant";
  timestamp: Date;
  toolResults?: ToolCallResult[];  // ← 新增
}
```

关键设计决策：

- `ToolCallResult.result` 是 `unknown` 类型，因为不同工具返回的数据结构完全不同
- `toolResults` 是可选字段，只有 assistant 消息且调用了工具时才有值
- `status` 保留四个状态，支持流式期间的实时更新

## 4. 持久化流程

### 4.1 流式期间收集

在 `useAIChat.ts` 中，用一个局部数组 `completedToolResults` 收集所有工具调用结果：

```typescript
const completedToolResults: ToolCallResult[] = [];

// 工具调用开始
onToolCallStart: (toolCallId: string, toolName: string) => {
  setToolCalls((prev) => [
    ...prev.filter((tc) => tc.id !== toolCallId),
    { id: toolCallId, name: toolName, parameters: {}, status: "calling" },
  ]);
  completedToolResults.push({ id: toolCallId, name: toolName, status: "calling" });
},

// 工具调用完成
onToolCallResult: (toolCallId: string, result: unknown) => {
  setToolCalls((prev) =>
    prev.map((tc) =>
      tc.id === toolCallId ? { ...tc, result, status: "completed" } : tc,
    ),
  );
  const existingIdx = completedToolResults.findIndex((r) => r.id === toolCallId);
  if (existingIdx >= 0) {
    completedToolResults[existingIdx] = {
      ...completedToolResults[existingIdx],
      status: "completed",
      result,
    };
  }
},
```

这里做了两件事：

1. 更新全局 `toolCalls` 状态（用于流式期间的实时展示）
2. 同步更新 `completedToolResults` 数组（用于消息完成后的持久化）

### 4.2 消息完成时写入

```typescript
onComplete: async () => {
  const finalToolResults = completedToolResults.length > 0
    ? completedToolResults
    : undefined;

  // 1. 写入消息状态
  setMessages((prev) =>
    prev.map((msg) =>
      msg.id === assistantMessageId
        ? { ...msg, content: currentContent, toolResults: finalToolResults }
        : msg,
    ),
  );

  // 2. 序列化后保存到 Convex
  const messageData: Record<string, string> = { content: currentContent };
  if (finalToolResults) {
    messageData.toolResults = JSON.stringify(finalToolResults);
  }
  await persistence.saveMessage(
    currentConversationId!,
    JSON.stringify(messageData),
    "assistant",
  );
},
```

注意 `messageData` 的结构——`toolResults` 被 JSON 字符串化后嵌套在 `messageData` 里，而 `messageData` 本身也会被 `JSON.stringify`。所以 Convex 里存的是双重 JSON 编码的 `toolResults`。

### 4.3 加载时还原

在 `useAIChatPersistence.ts` 中，`loadMessages` 负责反序列化：

```typescript
const loadMessages = async (convId: Id<"aiConversations">): Promise<ChatMessage[]> => {
  const msgs = await convex.query(api.aiChat.getMessages, { conversationId: convId });
  return msgs.map((msg: any) => {
    let content = msg.content;
    let toolResults: ToolCallResult[] | undefined;
    try {
      const parsedContent = JSON.parse(msg.content);
      if (parsedContent.content !== undefined) {
        content = parsedContent.content;
        if (parsedContent.toolResults) {
          try {
            toolResults = typeof parsedContent.toolResults === "string"
              ? JSON.parse(parsedContent.toolResults)
              : parsedContent.toolResults;
          } catch {}
        }
      }
    } catch {}
    return {
      id: msg._id,
      content,
      role: msg.role,
      timestamp: new Date(msg.createdAt),
      toolResults,
    };
  });
};
```

这里处理了 `toolResults` 可能是字符串（需要二次解析）或对象（直接使用）两种情况，兼容不同版本的存储格式。

### 4.4 完整数据流

```
流式期间：
  onToolCallStart  → completedToolResults.push({ id, name, status: "calling" })
  onToolCallResult → completedToolResults[idx] = { ..., status: "completed", result }

消息完成：
  onComplete → setMessages(msg.toolResults = finalToolResults)
             → Convex: messageData.toolResults = JSON.stringify(finalToolResults)

历史加载：
  loadMessages → JSON.parse(msg.content).toolResults
               → JSON.parse(字符串) → ToolCallResult[]
               → ChatMessage.toolResults
```

## 5. ToolCallCard 组件设计

### 5.1 交互设计

ToolCallCard 的核心交互是**折叠/展开**：

- **默认折叠**：只显示工具名称 + 状态图标 + 一句话摘要
- **点击展开**：显示完整的结果列表
- **运行中**：显示 spinner 动画
- **已完成**：显示绿色对勾

```
┌─────────────────────────────────────────────┐
│ 📖 知识库检索  ✅ 引用了 3 篇文档        ▼  │  ← 折叠态
├─────────────────────────────────────────────┤
│ 📖 知识库检索  ✅ 引用了 3 篇文档        ▲  │  ← 展开态
│ ┌─────────────────────────────────────────┐ │
│ │ 📄 从 npm 到 pnpm：包管理器演进...      │ │  ← 可点击
│ │ 📄 AI 工具调用结果可视化...             │ │  ← 可点击
│ │ 📄 RAG 检索优化实践...                  │ │  ← 可点击
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### 5.2 组件结构

```typescript
// ToolCallCard.tsx

export function ToolCallCard({ toolResult }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isCompleted = toolResult.status === "completed";
  const isRunning = toolResult.status === "calling" || toolResult.status === "executing";

  // 根据工具名称选择图标
  const ToolIcon =
    toolResult.name === "knowledge_search" ? BookOpen :
    toolResult.name === "document_read" ? FileText :
    Globe;

  // 根据工具名称选择显示名（i18n）
  const displayName =
    toolResult.name === "knowledge_search" ? t("knowledgeSearchTool") :
    toolResult.name === "document_read" ? t("documentReadTool") :
    t("webSearchTool");

  // 折叠态摘要
  let resultSummary: string | null = null;
  if (isCompleted && toolResult.result) {
    if (toolResult.name === "knowledge_search") {
      const docCount = result.documents?.length ?? 0;
      resultSummary = docCount > 0
        ? t("referencedDocsCount", { count: docCount })
        : t("noDocumentsFound");
    } else if (toolResult.name === "document_read") {
      resultSummary = result.document?.title ?? null;
    } else if (toolResult.name === "web_search") {
      resultSummary = result.query ?? null;
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}>
        <ToolIcon />
        <span>{displayName}</span>
        {isRunning && <Loader2 className="animate-spin" />}
        {isCompleted && <Check className="text-green-600" />}
        {resultSummary && !expanded && <span>{resultSummary}</span>}
      </button>
      {expanded && resultContent && (
        <div className="border-t border-border px-2 py-1.5">
          {resultContent}
        </div>
      )}
    </div>
  );
}
```

### 5.3 三种工具的差异化渲染

**知识库检索**——文档标题列表，可点击跳转：

```typescript
function KnowledgeSearchResult({ result }) {
  const docs = result.documents ?? [];
  return (
    <div className="space-y-1">
      {docs.map((doc) => (
        <a
          key={doc.documentId}
          href={getDocumentUrl(doc.documentId)}  // → /{locale}/documents/{id}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
        >
          <FileText className="h-3 w-3" />
          <span className="truncate font-medium">{doc.title || t("untitledDocument")}</span>
        </a>
      ))}
    </div>
  );
}
```

关键细节：`getDocumentUrl` 会从当前 URL 解析 locale 前缀，确保链接跳转到正确语言版本：

```typescript
function getDocumentUrl(documentId: string): string {
  if (typeof window !== "undefined") {
    const locale = window.location.pathname.split("/")[1] || "zh-CN";
    return `/${locale}/documents/${documentId}`;
  }
  return `/documents/${documentId}`;
}
```

**文档阅读**——文档标题，可点击跳转：

```typescript
function DocumentReadResult({ result }) {
  const doc = result.document;
  if (!doc) return <span className="text-muted-foreground text-xs">{t("noDocumentAvailable")}</span>;
  return (
    <a
      href={getDocumentUrl(doc.id)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
    >
      <FileText className="h-3 w-3" />
      <span className="truncate font-medium">{doc.title}</span>
    </a>
  );
}
```

**联网搜索**——搜索结果列表（标题 + 摘要 + 外部链接）：

```typescript
function WebSearchResult({ result }) {
  const results = result.results ?? [];
  return (
    <div className="space-y-1">
      {results.map((item, idx) => (
        <a
          key={idx}
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
        >
          <Globe className="h-3 w-3 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="truncate font-medium block">{item.title}</span>
            <span className="text-muted-foreground line-clamp-2">{item.snippet}</span>
          </div>
        </a>
      ))}
    </div>
  );
}
```

### 5.4 消息列表中的渲染逻辑

在 `MessageList.tsx` 中，渲染逻辑需要同时处理两种场景：

```typescript
const renderToolResults = () => {
  if (message.role !== "assistant") return null;

  // 优先使用持久化的 toolResults（历史消息）
  const persistedResults = message.toolResults;
  if (persistedResults && persistedResults.length > 0) {
    return (
      <div className="space-y-1.5 mt-2">
        {persistedResults.map((tr) => (
          <ToolCallCard key={tr.id} toolResult={tr} />
        ))}
      </div>
    );
  }

  // 流式期间使用全局 toolCalls 状态
  if (activeToolCalls && activeToolCalls.length > 0) {
    return (
      <div className="space-y-1.5 mt-2">
        {activeToolCalls.map((tc) => (
          <ToolCallCard
            key={tc.id}
            toolResult={{ id: tc.id, name: tc.name, status: tc.status, result: tc.result }}
          />
        ))}
      </div>
    );
  }

  return null;
};
```

优先级很明确：持久化数据 > 流式临时数据 > 不渲染。

## 6. 联网搜索：从 DashScope 到 SerpAPI

### 6.1 为什么迁移

最初 `web_search` 使用 DashScope 的 `enable_search` 参数：

```typescript
// 旧方案：DashScope enable_search
const response = await openai.chat.completions.create({
  model: "qwen3.6-plus",
  messages: [...],
  extra_body: { enable_search: true, search_strategy: "turbo" },
});
```

问题：

| 维度 | DashScope enable_search | SerpAPI Google Search |
|------|------------------------|----------------------|
| 返回格式 | LLM 生成的自然语言摘要 | 结构化 JSON（title + link + snippet） |
| 可视化 | 无法提取结构化结果 | 直接渲染为可点击链接列表 |
| 计费 | 阿里云按次计费，额外收费 | 每月 100 次免费 |
| 搜索质量 | 依赖阿里云搜索引擎 | Google 搜索结果 |
| 灵活性 | 只能拿到 LLM 总结 | 可自定义 topK、语言、地区 |

核心问题：DashScope 返回的是 LLM 对搜索结果的自然语言总结，而不是结构化的搜索结果。这意味着前端无法提取出标题、链接、摘要来渲染可交互的搜索结果卡片。

### 6.2 SerpAPI 实现

```typescript
// tools/web-search.ts
import { getJson } from "serpapi";

export async function executeWebSearch(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  const query = typeof args.query === "string" ? args.query : "";
  if (!query.trim()) {
    return { query, results: [], error: "query is required" };
  }

  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    return { query, results: [], error: "SERPAPI_API_KEY is not configured" };
  }

  const response = await getJson({
    engine: "google",
    q: query,
    api_key: apiKey,
    hl: "zh-cn",
    gl: "cn",
  });

  const organicResults = (response.organic_results ?? []).slice(0, 5);
  const formattedResults = organicResults.map((result: any) => ({
    title: result.title,
    link: result.link,
    snippet: result.snippet,
  }));

  return { query, results: formattedResults };
}
```

SerpAPI 返回的 `organic_results` 包含 `title`、`link`、`snippet` 三个字段，正好对应 `WebSearchResult` 组件的渲染需求。

### 6.3 迁移前后对比

```
迁移前（DashScope）：
  用户提问 → AI 调用 web_search → DashScope enable_search
  → LLM 生成自然语言摘要 → 前端只显示 "Searched for: xxx"

迁移后（SerpAPI）：
  用户提问 → AI 调用 web_search → SerpAPI Google Search
  → 返回结构化结果 → 前端渲染可点击搜索结果卡片
```

## 7. 国际化

所有新增的 UI 字符串都通过 `next-intl` 管理，在 `packages/business/i18n/` 下维护：

```json
// en.json
{
  "AI": {
    "knowledgeSearchTool": "Knowledge search",
    "documentReadTool": "Read current document",
    "webSearchTool": "Web search",
    "noDocumentsFound": "No documents found",
    "untitledDocument": "Untitled",
    "searchedFor": "Searched for",
    "referencedDocsCount": "Referenced {count} documents"
  }
}
```

```json
// zh-CN.json
{
  "AI": {
    "knowledgeSearchTool": "知识库检索",
    "documentReadTool": "读取当前文档",
    "webSearchTool": "联网搜索",
    "noDocumentsFound": "未找到相关文档",
    "untitledDocument": "无标题文档",
    "searchedFor": "搜索关键词",
    "referencedDocsCount": "引用了 {count} 篇文档"
  }
}
```

组件中通过 `useTranslations("AI")` 获取翻译：

```typescript
const t = useTranslations("AI");
const displayName = toolName === "knowledge_search" ? t("knowledgeSearchTool") : ...;
resultSummary = t("referencedDocsCount", { count: docCount });
```

## 8. 总结

### 改动前 vs 改动后

| 维度 | 改动前 | 改动后 |
|------|--------|--------|
| 工具调用可见性 | 流式期间短暂可见，完成后消失 | 永久可见，历史对话也能看到 |
| 知识库检索 | 用户不知道 AI 搜了哪些文档 | 显示文档标题列表，可点击跳转 |
| 文档阅读 | 用户不知道 AI 读了哪篇文档 | 显示文档标题，可点击跳转 |
| 联网搜索 | 只显示搜索关键词 | 显示搜索结果（标题 + 摘要 + 外部链接） |
| 数据持久化 | toolResults 不存储 | JSON 序列化存入 Convex，加载时还原 |
| 国际化 | 无 | 所有新字符串通过 next-intl 管理 |

### 改动文件清单

| 文件 | 改动 |
|------|------|
| `components/ai-chat/types.ts` | 新增 `ToolCallResult`、`KnowledgeSearchDoc` 类型，`ChatMessage` 增加 `toolResults` 字段 |
| `components/ai-chat/ToolCallCard.tsx` | 新增组件，折叠/展开，三种工具差异化渲染 |
| `components/ai-chat/MessageList.tsx` | 渲染逻辑：优先持久化数据，其次流式临时数据 |
| `components/ai-chat/useAIChat.ts` | 流式期间收集 `completedToolResults`，`onComplete` 时写入消息和 Convex |
| `components/ai-chat/useAIChatPersistence.ts` | `loadMessages` 反序列化 `toolResults` |
| `lib/agent/tools/web-search.ts` | 从 DashScope `enable_search` 迁移到 SerpAPI |
| `packages/business/i18n/en.json` | 新增 7 个 AI 工具调用相关翻译 key |
| `packages/business/i18n/zh-CN.json` | 新增 7 个 AI 工具调用相关翻译 key |

### 设计原则回顾

1. **持久化优先**：没有持久化就没有可视化，先解决数据存留问题
2. **折叠/展开**：默认折叠不干扰阅读，展开后提供完整信息
3. **可交互**：文档标题可点击跳转，搜索结果可点击打开外部链接
4. **差异化渲染**：不同工具返回不同结构，组件按类型分别处理
5. **国际化**：所有新增 UI 字符串走 i18n，不硬编码

---

*本文基于 [My-Notion](https://github.com/HaveNiceDa/My-Notion) 项目的真实开发经历撰写——一个 AI 原生的个人版 Notion，工具调用结果可视化设计。欢迎 Star ⭐*
