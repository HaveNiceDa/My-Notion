# AI Chat 重构：从全屏页面到右侧可折叠侧边栏，7 个 Zustand Store 合并为 1 个 Hook

> AI Chat 曾经是一个独立的全屏页面，用户想用 AI 得先离开文档。更糟糕的是，状态管理散落在 7 个 Zustand Store 里，互相依赖、难以扩展。这篇文章记录了一次完整的重构——把 AI Chat 从 `/Chat` 路由搬到文档右侧的可折叠面板，同时把 480 行的巨型 Hook 拆成 3 个职责清晰的文件。

## 1. 开篇：用 AI 就得离开文档？

最早的设计是这样的：AI Chat 是一个独立路由 `/Chat`，占据整个屏幕。

```
┌──────────────────────────────────────────┐
│ Navigation │        AI Chat Page         │
│            │                             │
│            │    (全屏对话界面)             │
│            │                             │
└──────────────────────────────────────────┘
```

问题很明显：

- **上下文断裂**：用户在写文档，想问 AI 一个问题，得跳到 `/Chat` 页面，AI 完全看不到当前文档内容
- **来回切换**：问完问题还得切回文档，频繁的页面跳转打断思路
- **状态管理混乱**：7 个 Zustand Store 各管各的，互相之间有隐式依赖，改一个可能炸另一个

这不是"能用但不够好"的问题，而是**根本性的架构缺陷**——AI 应该就在文档旁边，随时可用，而不是一个需要"前往"的独立空间。

## 2. 7 个碎片化 Store 的问题

重构前的状态管理长这样：

| Store | 职责 | 问题 |
|-------|------|------|
| `use-ai-model-store` | 当前选择的 AI 模型 | 和 thinking store 耦合——切换模型要重置思考状态 |
| `use-deep-thinking-store` | 深度思考开关 + 步骤 | 思考步骤硬编码为固定数组，无法动态扩展 |
| `use-knowledge-base-store` | 知识库选择 | 和 vector-store-store 有隐式依赖 |
| `use-thinking-process-store` | 思考过程展示 | 和 deep-thinking-store 职责重叠，边界模糊 |
| `use-tool-call-store` | 工具调用状态 | 独立 store 但和消息流强绑定 |
| `use-vector-store-store` | 向量存储配置 | 单一 RAG 管道，无法扩展多数据源 |
| `use-web-search-store` | 网页搜索开关 | 和 tool-call-store 有交叉依赖 |

核心问题：

1. **状态交叉依赖**：`use-deep-thinking-store` 的开关影响 `use-thinking-process-store` 的展示，`use-knowledge-base-store` 的选择影响 `use-vector-store-store` 的查询。这些依赖没有显式声明，全靠调用顺序保证正确性。
2. **硬编码的思考步骤**：深度思考的步骤写死在 store 里，想加一个步骤得改 store 定义 + 组件渲染逻辑 + API 参数，三处联动。
3. **单一 RAG 管道**：`use-vector-store-store` 只支持一个向量库，想同时搜知识库和网页？没门。
4. **无法扩展**：每加一个 AI 能力（比如图片理解、代码执行），就得新建一个 Store，然后处理它和现有 Store 的依赖关系。

**7 个 Store 的本质问题是：状态按"功能"切分，但实际使用时需要的是按"流程"组合。** AI 对话是一个连贯的流程——用户输入 → 模型选择 → 工具调用 → 结果展示，这些步骤的状态应该在一起管理，而不是散落在 7 个地方。

## 3. 布局重构：从全屏页面到右侧可折叠面板

### 3.1 目标布局

重构后的布局：

```
┌──────────────────────────────────────────────────────────┐
│ Navigation │    Document Content     │    AI Panel       │
│            │                         │   (可折叠)         │
│            │                         │   320-520px       │
│            │                         │   ← 拖拽左边缘    │
│            │                         │                   │
└──────────────────────────────────────────────────────────┘
```

AI 面板就在文档旁边，用户可以一边看文档一边和 AI 对话，不需要离开当前页面。

### 3.2 Layout 层面的实现

在主布局中，AI 面板和文档内容并排：

```tsx
// apps/web/src/app/[locale]/(main)/layout.tsx
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex dark:bg-[#1F1F1F]">
      <Navigation />
      <main className="relative flex-1 h-full overflow-y-auto min-w-0">
        <MainContentNavbar />
        <SearchCommand />
        {children}
      </main>
      <AIChatErrorBoundary>
        <AIChatPanel />
      </AIChatErrorBoundary>
      <AIFloatingButton />
    </div>
  );
}
```

关键设计：

- `main` 用 `flex-1 min-w-0`，确保在 AI 面板展开时文档区域自动收缩
- `AIChatPanel` 作为 flex 子元素，不展开时返回 `null`，文档区域自动占满
- `AIFloatingButton` 在面板关闭时显示，点击打开面板

### 3.3 可拖拽宽度 + 持久化

面板宽度支持拖拽调整，范围 320-520px，拖拽结束后自动保存到 localStorage：

```tsx
// apps/web/src/hooks/useResizableWidth.ts
export function useResizableWidth({
  initialWidth = 400,
  minWidth = 320,
  maxWidth = 520,
  localStorageKey = "ai-chat-panel-width",
  direction = "left",
}: UseResizableWidthOptions = {}) {
  const [width, setWidth] = useState(() => {
    if (typeof window === "undefined") return initialWidth;
    const saved = localStorage.getItem(localStorageKey);
    if (saved) {
      const parsed = Number(saved);
      if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
        return parsed;
      }
    }
    return initialWidth;
  });

  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isResizingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = width;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizingRef.current) return;
        const diff =
          direction === "left"
            ? startXRef.current - moveEvent.clientX
            : moveEvent.clientX - startXRef.current;
        const newWidth = Math.min(
          maxWidth,
          Math.max(minWidth, startWidthRef.current + diff),
        );
        setWidth(newWidth);
      };

      const handleMouseUp = () => {
        if (isResizingRef.current) {
          isResizingRef.current = false;
          localStorage.setItem(localStorageKey, String(width));
        }
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [width, minWidth, maxWidth, direction, localStorageKey],
  );

  return { width, handleMouseDown };
}
```

面板左边缘有一条 1px 的拖拽区域，hover 时变色提示：

```tsx
<div
  className="absolute left-0 top-0 h-full w-1 cursor-ew-resize
    hover:bg-primary/30 active:bg-primary/50 z-10 transition-colors"
  onMouseDown={handleMouseDown}
/>
```

### 3.4 面板开关状态

7 个 Store 合并后，面板的开关状态只需要一个极简的 Zustand Store：

```tsx
// apps/web/src/lib/store/use-ai-chat-store.ts
import { create } from "zustand";

interface AIChatStoreState {
  panelOpen: boolean;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
}

export const useAIChatStore = create<AIChatStoreState>((set) => ({
  panelOpen: false,
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
}));
```

为什么面板状态还用 Zustand 而不是 React State？因为 `AIFloatingButton` 和 `AIChatPanel` 是兄弟组件，需要共享状态。Zustand 比 Context 更轻量，不需要 Provider 包裹。

### 3.5 浮动按钮

面板关闭时，右下角显示一个浮动按钮，点击即可打开：

```tsx
export function AIFloatingButton() {
  const { panelOpen, togglePanel } = useAIChatStore();
  const t = useTranslations("AI");

  if (panelOpen) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={togglePanel}
            className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-md
              bg-background border border-border hover:bg-muted
              transition-all duration-200 hover:shadow-lg
              flex items-center justify-center"
          >
            <AIIcon className="h-7 w-7" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>{t("openAIChat")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

## 4. Hook 重构：480 行拆成 3 个文件

### 4.1 重构前的问题

原来的 `useAIChat.ts` 有 480 行，塞了所有东西：流式请求、Convex 持久化、状态管理、消息编排。改任何一个功能都要在 480 行里找到对应位置，改完还要确认没影响其他功能。

更离谱的是 `runAgentStream` 函数有 13 个位置参数：

```typescript
// 重构前：13 个位置参数，谁能记住第 7 个是什么？
await runAgentStream(
  messages, model, conversationId, enableThinking,
  currentDocument, onChunk, onReasoningChunk,
  onToolCallStart, onToolCallDelta, onToolResultDelta,
  onToolCallResult, onComplete, onError
);
```

### 4.2 拆分方案

| 文件 | 行数 | 职责 |
|------|------|------|
| `stream-client.ts` | ~110 | 流式请求 + 类型定义 |
| `useAIChatPersistence.ts` | ~90 | Convex 数据库操作 |
| `useAIChat.ts` | ~285 | 状态管理 + 编排层 |

### 4.3 stream-client.ts：Options Object 模式

把 13 个位置参数重构为 Options Object 模式：

```typescript
// apps/web/src/components/ai-chat/stream-client.ts
export interface AgentStreamCallbacks {
  onChunk: (chunk: string) => void;
  onReasoningChunk: (chunk: string) => void;
  onToolCallStart: (toolCallId: string, toolName: string) => void;
  onToolCallDelta: (toolCallId: string, delta: string) => void;
  onToolResultDelta: (toolCallId: string, delta: string) => void;
  onToolCallResult: (toolCallId: string, result: unknown) => void;
  onComplete: () => Promise<void>;
  onError: (error: unknown) => void;
}

export interface AgentStreamOptions {
  messages: unknown[];
  model: AIModelId;
  conversationId: string;
  enableThinking: boolean;
  currentDocument: CurrentDocumentContext | null;
  callbacks: AgentStreamCallbacks;
}

export async function runAgentStream(options: AgentStreamOptions) {
  const { messages, model, conversationId, enableThinking, currentDocument, callbacks } = options;
  // ... 流式请求逻辑
}
```

好处：

- **可读性**：调用时每个参数都有名字，不用数位置
- **可扩展**：加新参数只改 interface，不影响已有调用
- **可选参数**：不需要 13 个都传，有默认值的可以省略

调用方从这样：

```typescript
await runAgentStream(msgs, model, convId, true, doc, onChunk, onReason, ...);
```

变成这样：

```typescript
await runAgentStream({
  messages: conversationHistoryMessages,
  model: modelId,
  conversationId: currentConversationId,
  enableThinking,
  currentDocument,
  callbacks: {
    onChunk: (chunk) => { currentContent += chunk; scheduleRender(); },
    onReasoningChunk: (chunk) => { currentReasoningContent += chunk; scheduleRender(); },
    onToolCallStart: (id, name) => { /* ... */ },
    // ...
  },
});
```

### 4.4 useAIChatPersistence.ts：数据库操作隔离

所有 Convex 操作抽到独立 Hook，`useAIChat` 不再直接调用 `convex.query` / `convex.mutation`：

```typescript
// apps/web/src/components/ai-chat/useAIChatPersistence.ts
export function useAIChatPersistence() {
  const { user } = useUser();
  const convex = useConvex();
  const t = useTranslations("AI");

  const loadConversations = useMemoizedFn(async (): Promise<Conversation[]> => {
    if (!user) return [];
    try {
      const result = await convex.query(api.aiChat.getConversations, {});
      return result as Conversation[];
    } catch (error) {
      console.error("Error loading conversations:", error);
      return [];
    }
  });

  const loadMessages = useMemoizedFn(async (convId: Id<"aiConversations">): Promise<ChatMessage[]> => {
    if (!user) return [];
    const msgs = await convex.query(api.aiChat.getMessages, { conversationId: convId });
    return msgs.map((msg: any) => {
      let content = msg.content;
      let reasoningContent: string | undefined;
      let toolResults: ToolCallResult[] | undefined;
      try {
        const parsedContent = JSON.parse(msg.content);
        if (parsedContent.content !== undefined) {
          content = parsedContent.content;
          reasoningContent = parsedContent.reasoningContent;
          if (parsedContent.toolResults) {
            toolResults = typeof parsedContent.toolResults === "string"
              ? JSON.parse(parsedContent.toolResults)
              : parsedContent.toolResults;
          }
        }
      } catch {}
      return { id: msg._id, content, reasoningContent, role: msg.role, timestamp: new Date(msg.createdAt), toolResults };
    });
  });

  const createConversation = useMemoizedFn(async (title: string) => { /* ... */ });
  const saveMessage = useMemoizedFn(async (conversationId, content, role) => { /* ... */ });
  const updateConversationTitle = useMemoizedFn(async (conversationId, title) => { /* ... */ });
  const deleteConversation = useMemoizedFn(async (convId, isCurrent) => { /* ... */ });

  return { loadConversations, loadMessages, createConversation, saveMessage, updateConversationTitle, deleteConversation };
}
```

这样 `useAIChat` 只需要调用 `persistence.saveMessage()`，完全不关心底层是 Convex 还是其他数据库。如果以后换数据库，只改这一个文件。

### 4.5 useAIChat.ts：状态管理 + 编排

重构后的 `useAIChat.ts` 只负责两件事：**管理 React 状态** 和 **编排流程**。

```typescript
// apps/web/src/components/ai-chat/useAIChat.ts
export function useAIChat() {
  const { user } = useUser();
  const t = useTranslations("AI");
  const currentDocument = useCurrentDocumentStore((state) => state.currentDocument);
  const panelOpen = useAIChatStore((state) => state.panelOpen);
  const persistence = useAIChatPersistence();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<Id<"aiConversations"> | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modelId, setModelIdState] = useState<AIModelId>(getInitialAIModelId);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);

  // ... 编排逻辑：sendMessage, loadConversation, createNewConversation 等
}
```

7 个 Zustand Store 的状态，现在全部收敛为 `useState`。为什么？因为这些状态的生命周期和组件一致——面板关了，状态清空；面板开了，重新加载。不需要跨组件共享，`useState` 就够了。

## 5. AIChatPanel.tsx 拆分：394 行 → 3 个文件

### 5.1 拆分方案

| 文件 | 行数 | 职责 |
|------|------|------|
| `ConversationList.tsx` | ~90 | 对话历史列表 |
| `EmptyHome.tsx` | ~70 | 空状态 + 快捷操作 |
| `AIChatPanel.tsx` | ~241 | 面板布局 + 交互逻辑 |

### 5.2 ConversationList.tsx

对话历史列表，纯展示组件，用 `React.memo` 包裹避免不必要的重渲染：

```tsx
export const ConversationList = React.memo(
  ({ conversations, currentConversationId, isLoading, onSelect, onDelete, formatTime }: ConversationListProps) => {
    const t = useTranslations("AI");

    if (isLoading) {
      return <div className="p-3 text-center text-muted-foreground text-xs">{t("loading")}</div>;
    }

    if (conversations.length === 0) {
      return <div className="p-3 text-center text-muted-foreground text-xs">{t("noConversationRecords")}</div>;
    }

    return (
      <div className="max-h-48 overflow-y-auto">
        {conversations.map((conv) => (
          <div key={conv._id} className={cn("flex items-center justify-between p-2 rounded-md cursor-pointer text-xs transition-colors",
              currentConversationId === conv._id ? "bg-accent" : "hover:bg-muted",
            )}
            onClick={() => onSelect(conv._id)}
          >
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium">{conv.title}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="text-muted-foreground">{formatTime(conv.updatedAt)}</span>
              </div>
            </div>
            <Button onClick={(e) => { e.stopPropagation(); onDelete(conv._id); }}
              size="sm" variant="ghost"
              className="h-5 w-5 p-0 text-muted-foreground hover:text-red-500 shrink-0"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </Button>
          </div>
        ))}
      </div>
    );
  },
);
```

### 5.3 EmptyHome.tsx

空状态页面，提供 4 个快捷操作按钮，点击直接填入 prompt：

```tsx
export const EmptyHome = React.memo(({ onPromptSelect }: EmptyHomeProps) => {
  const t = useTranslations("AI");

  const actions = useMemo(
    () => [
      { icon: FileText, label: t("summarizeThisPage"), prompt: t("summarizeThisPagePrompt") },
      { icon: Languages, label: t("translateThisPage"), prompt: t("translateThisPagePrompt") },
      { icon: Search, label: t("deepAnalyze"), prompt: t("deepAnalyzePrompt") },
      { icon: CircleCheck, label: t("createTaskTracker"), prompt: t("createTaskTrackerPrompt") },
    ],
    [t],
  );

  return (
    <div className="flex-1 overflow-y-auto px-5 py-6">
      <div className="min-h-full flex flex-col justify-end gap-5 pb-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {t("todayIWillHelp")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("aiSidebarHomeSubtitle")}</p>
        </div>
        <div className="space-y-1.5">
          {actions.map(({ icon: Icon, label, prompt }) => (
            <button key={label} type="button" onClick={() => onPromptSelect(prompt)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
```

### 5.4 AIChatPanel.tsx

拆分后，`AIChatPanel.tsx` 只负责面板的布局和交互逻辑，清晰多了：

```tsx
export function AIChatPanel() {
  const { panelOpen, closePanel } = useAIChatStore();
  const { width, handleMouseDown } = useResizableWidth({
    initialWidth: 400, minWidth: 320, maxWidth: 520,
    localStorageKey: "ai-chat-panel-width", direction: "left",
  });

  const { messages, input, setInput, isLoading, modelId, setModelId,
    sendMessage, toolCalls, createNewConversation, loadConversation, deleteConversation,
    conversationId, conversations, isLoadingConversations, conversationCreatedAt,
  } = useAIChat();

  if (!panelOpen) return null;

  return (
    <div className="h-full border-l border-border bg-background flex flex-col shrink-0 relative z-10"
      style={{ width: `${width}px` }}
    >
      {/* 拖拽条 */}
      <div className="absolute left-0 top-0 h-full w-1 cursor-ew-resize hover:bg-primary/30 active:bg-primary/50 z-10 transition-colors"
        onMouseDown={handleMouseDown}
      />
      {/* 头部工具栏 */}
      {/* ... */}
      {/* 对话历史下拉 */}
      {/* ... */}
      {/* 消息列表或空状态 */}
      {messages.length === 0 ? (
        <EmptyHome onPromptSelect={handlePromptSelect} />
      ) : (
        <MessageList messages={messages} isLoading={isLoading} toolCalls={toolCalls}
          messagesEndRef={messagesEndRef} conversationCreatedAt={conversationCreatedAt}
        />
      )}
      {/* 输入框 */}
      <MessageInput input={input} onInputChange={handleInputChange} onSend={sendMessage}
        modelId={modelId} onModelChange={setModelId} enableThinking={enableThinking} isSending={isLoading}
      />
    </div>
  );
}
```

## 6. 中文 IME 输入修复

这是一个经典的坑：中文输入法在拼音组合阶段，每次按键都会触发 `onKeyDown`，如果直接监听 `Enter` 发送消息，用户打"你好"时，按 N 就发出去了。

修复方法：检查 `e.nativeEvent.isComposing`：

```tsx
const handleKeyPress = useMemoizedFn(
  (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // IME 组合输入中（如中文拼音）不触发发送
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  },
);
```

注意是 `e.nativeEvent.isComposing`，不是 `e.isComposing`。React 的合成事件对象上没有 `isComposing` 属性，必须访问原生事件。

这个问题在日文、韩文输入法中同样存在，只要用了 IME（Input Method Editor）就会遇到。

## 7. 乐观 UI 更新：先显示，后持久化

重构前，消息发送流程是串行的：

```
用户输入 → 保存到数据库 → 更新 UI → 开始流式请求
```

用户每发一条消息都要等数据库写入完成才能看到，在网络慢的时候体验很差。

重构后改为乐观更新：

```
用户输入 → 立即更新 UI → 后台保存到数据库 → 开始流式请求
```

关键代码：

```typescript
// 立即添加用户消息到 UI
setMessages((prev) => [...prev, userMessage]);

// 立即添加空的助手消息占位
const tempAssistantMessage: ChatMessage = {
  id: assistantMessageId,
  content: "",
  role: "assistant",
  timestamp: new Date(),
};
setMessages((prev) => [...prev, tempAssistantMessage]);

// 后台持久化，不 await
persistence.saveMessage(currentConversationId, JSON.stringify(messageContent), "user");

// 流式更新助手消息内容
await runAgentStream({ /* ... */ });
```

注意 `persistence.saveMessage()` 没有 `await`——用户消息的持久化是"发后即忘"（fire-and-forget），UI 不会等它完成。即使持久化失败，用户也已经看到消息了，最多在刷新后丢失，这比"点了发送没反应"好得多。

助手消息的持久化放在 `onComplete` 回调里，因为需要等流式响应全部接收完才能保存完整内容。

## 8. 错误边界：Class Component 的最后倔强

React 的 Error Boundary 必须用 Class Component 实现（`getDerivedStateFromError` / `componentDidCatch`），但 Class Component 里没法用 Hook（比如 `useTranslations`）。

解决方案：Class Component + Functional Component 组合：

```tsx
// 内部 Class Component：处理错误捕获
class AIChatErrorBoundaryInner extends React.Component<
  ErrorBoundaryProps & { t: (key: string) => string },
  ErrorBoundaryState
> {
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">
            {this.props.t("panelError")}
          </p>
          <p className="text-xs text-muted-foreground mb-4 max-w-[240px]">
            {this.props.t("panelErrorDesc")}
          </p>
          <Button variant="outline" size="sm" onClick={this.handleRetry} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            {this.props.t("retry")}
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

// 外部 Functional Component：使用 Hook 获取翻译函数，传给 Class Component
export function AIChatErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  const t = useTranslations("AI");
  return (
    <AIChatErrorBoundaryInner t={t} fallback={fallback}>
      {children}
    </AIChatErrorBoundaryInner>
  );
}
```

这个模式的核心思路：**Functional Component 负责获取 Hook 值，Class Component 负责错误捕获**。通过 props 把 Hook 的结果传递给 Class Component，两边各司其职。

为什么 AI 面板需要 Error Boundary？因为 AI 对话涉及流式请求、Markdown 渲染、工具调用展示，任何一个环节出错都可能让整个面板白屏。有了 Error Boundary，用户只需要点"重试"就能恢复，不用刷新整个页面。

## 9. 总结

| 维度 | 重构前 | 重构后 |
|------|--------|--------|
| **布局** | 全屏独立页面 `/Chat` | 右侧可折叠面板，320-520px 可拖拽 |
| **状态管理** | 7 个 Zustand Store，交叉依赖 | 1 个 Zustand Store（面板开关）+ useState（对话状态） |
| **核心 Hook** | 1 个 480 行的 `useAIChat.ts` | 3 个文件：`stream-client.ts`（~110 行）、`useAIChatPersistence.ts`（~90 行）、`useAIChat.ts`（~285 行） |
| **流式请求 API** | 13 个位置参数 | Options Object 模式，命名参数 |
| **面板组件** | 1 个 394 行的 `AIChatPanel.tsx` | 3 个文件：`ConversationList.tsx`（~90 行）、`EmptyHome.tsx`（~70 行）、`AIChatPanel.tsx`（~241 行） |
| **IME 输入** | 中文输入法误触发发送 | 检查 `isComposing` 阻止组合输入期发送 |
| **消息持久化** | 串行：先存库再显示 | 乐观更新：先显示，后台持久化 |
| **错误处理** | 无边界保护，白屏 | Error Boundary + 重试按钮 |
| **上下文感知** | AI 看不到当前文档 | 面板紧贴文档，自动传入文档上下文 |

这次重构的核心收获：

1. **AI 应该在用户身边，而不是在另一个页面**——侧边栏设计让 AI 从"工具"变成了"助手"
2. **状态按流程聚合，而不是按功能拆分**——7 个 Store 的碎片化问题，本质是状态划分的粒度不对
3. **大文件拆分不是目的，职责清晰才是**——每个文件只做一件事，改一个功能只动一个文件
4. **乐观更新是 AI 应用的标配**——流式响应本身就慢，不能再让用户等数据库写入

---

*本文基于 [My-Notion](https://github.com/HaveNiceDa/My-Notion) 项目的真实重构经历撰写——一个 AI 原生的个人版 Notion，采用右侧可折叠 AI 侧边栏设计。欢迎 Star ⭐*
